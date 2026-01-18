import { Router } from "express";
import twilio from "twilio";
import prisma from "../prisma";
import {
  buildInboundPlan,
  buildIntentPlan,
  buildNamePlan,
  buildPhonePlan,
  buildTimePlan,
  normalizePhone,
  validateNameInput,
} from "../voice/voiceFlow";
import { VOICE_LINES } from "../voice/voiceLines";
import { pickLine } from "../voice/pickLine";
import { emitEvent } from "../lib/events";
import { validationFail } from "../lib/validationFail";
import {
  createCorrelationId,
  getCorrelationIdForCall,
  runWithCorrelationId,
  setCorrelationIdForCall,
} from "../lib/requestContext";
import {
  buildGeneralInquiryPlan,
  isGeneralInquiryState,
} from "../voice/generalInquiryFlow";

const router = Router();
const VoiceResponse = twilio.twiml.VoiceResponse;
const startedCalls = new Set<string>();
const intentEmittedCalls = new Set<string>();

/**
 * Shared Twilio voice config
 */
const VOICE = {
  voice: "alice" as const,
  rate: "90%",
};

router.use((req, _res, next) => {
  const callSid = String(req.body?.CallSid || req.query?.CallSid || "").trim();
  if (!callSid) {
    return next();
  }

  if (!callSid.startsWith("CA") || callSid.length > 64) {
    validationFail({ scope: "voice", reason: "invalid_call_sid", state: "inbound" });
    return next();
  }

  let correlationId = getCorrelationIdForCall(callSid);
  if (!correlationId) {
    // Generate once at call entry to keep a stable trace ID.
    correlationId = createCorrelationId();
    setCorrelationIdForCall(callSid, correlationId);
  }

  return runWithCorrelationId(correlationId, next);
});

type TwimlPlan = {
  say: string[];
  gather?: {
    input: Array<"speech" | "dtmf">;
    action: string;
    method: "POST";
    speechTimeout: "auto";
  };
  redirect?: string;
  hangup?: boolean;
};

function applyPlan(twiml: twilio.twiml.VoiceResponse, plan: TwimlPlan) {
  const sayTarget = plan.gather
    ? twiml.gather(plan.gather)
    : twiml;

  for (const line of plan.say) {
    sayTarget.say(VOICE, line);
  }

  if (plan.redirect) {
    twiml.redirect(plan.redirect);
  }

  if (plan.hangup) {
    twiml.hangup();
  }
}

/**
 * POST /api/voice/inbound
 */
router.post("/voice/inbound", (_req, res) => {
  const callSid = String(_req.body?.CallSid || "").trim();
  if (callSid && !startedCalls.has(callSid)) {
    startedCalls.add(callSid);
    emitEvent("voice_call_started", {
      callSid,
      source: "voice",
      environment: process.env.NODE_ENV || "local",
    });
  }
  const twiml = new VoiceResponse();
  const plan = buildInboundPlan();
  applyPlan(twiml, plan);

  res.type("text/xml").send(twiml.toString());
});

/**
 * POST /api/voice/intent
 */
router.post("/voice/intent", (req, res) => {
  const twiml = new VoiceResponse();
  const speech = String(req.body.SpeechResult || "").trim();
  const { plan, context } = buildIntentPlan(speech);
  const callSid = String(req.body?.CallSid || "").trim();
  if (
    callSid &&
    context.intent === "general_question" &&
    !intentEmittedCalls.has(callSid)
  ) {
    intentEmittedCalls.add(callSid);
    emitEvent("voice_intent_detected", {
      callSid,
      intent: "general_inquiry",
      environment: process.env.NODE_ENV || "local",
    });
  }
  applyPlan(twiml, plan);
  if (plan.hangup && callSid) {
    emitEvent("voice_call_completed", {
      callSid,
      finalState: plan.nextState,
      environment: process.env.NODE_ENV || "local",
    });
  }

  res.type("text/xml").send(twiml.toString());
});

/**
 * POST /api/voice/general-inquiry
 */
router.post("/voice/general-inquiry", (req, res) => {
  const twiml = new VoiceResponse();
  const rawState = String(req.query.state || "GREETING").trim();
  const state = isGeneralInquiryState(rawState) ? rawState : "GREETING";
  const speech = String(req.body.SpeechResult || req.body.Digits || "").trim();
  const phone = String(req.query.phone || "").trim();
  const callSid = String(req.body?.CallSid || "").trim();

  const plan = buildGeneralInquiryPlan({
    state,
    speech,
    phone,
  });

  applyPlan(twiml, plan);
  if (plan.hangup && callSid) {
    emitEvent("voice_call_completed", {
      callSid,
      finalState: "END",
      environment: process.env.NODE_ENV || "local",
    });
  }
  res.type("text/xml").send(twiml.toString());
});

/**
 * POST /api/voice/name
 */
router.post("/voice/name", (_req, res) => {
  const twiml = new VoiceResponse();
  const plan = buildNamePlan();
  applyPlan(twiml, plan);

  res.type("text/xml").send(twiml.toString());
});

/**
 * POST /api/voice/phone
 */
router.post("/voice/phone", (req, res) => {
  const twiml = new VoiceResponse();
  const rawName = String(req.body.SpeechResult || "").trim();
  const { plan } = buildPhonePlan(rawName);
  applyPlan(twiml, plan);

  res.type("text/xml").send(twiml.toString());
});

/**
 * POST /api/voice/time
 */
router.post("/voice/time", async (req, res) => {
  const twiml = new VoiceResponse();
  const callSid = String(req.body?.CallSid || "").trim();

  const rawName = req.query.name;
  const { name, reason } = validateNameInput(rawName);
  const rawPhone = req.body.SpeechResult || req.body.Digits || "";
  const preferredTime = String(req.body.SpeechResult || "").trim() || null;

  const phone = normalizePhone(rawPhone);

  if (!name && reason) {
    validationFail({ scope: "voice", reason, state: "time" });
  }
  if (!phone) {
    validationFail({ scope: "voice", reason: "missing_phone", state: "time" });
  }

  const result = buildTimePlan({
    name,
    phone,
    preferredTime,
    skipValidation: !!reason || !phone,
  });

  if (!result.ok && result.plan) {
    applyPlan(twiml, result.plan);
    return res.type("text/xml").send(twiml.toString());
  }

// success path continues unchanged


  try {
    emitEvent("callback_create_attempt", { source: "voice" });
    await prisma.callbackRequest.create({
      data: {
        name,
        phone,
        preferredTime,
        status: "pending",
      },
    });

    emitEvent("callback_create_result", { source: "voice", ok: true });
    twiml.say(VOICE, pickLine(VOICE_LINES.schedulingConfirm));
    twiml.say(VOICE, pickLine(VOICE_LINES.staffHandoff));
    twiml.hangup();
    if (callSid) {
      emitEvent("voice_call_completed", {
        callSid,
        finalState: "complete",
        environment: process.env.NODE_ENV || "local",
      });
    }
  } catch (err) {
    emitEvent("callback_create_failed", { source: "voice" });
    emitEvent("callback_create_result", { source: "voice", ok: false });
    console.error("[voice callback error]", err);
    twiml.say(VOICE, pickLine(VOICE_LINES.retry));
    twiml.hangup();
    if (callSid) {
      emitEvent("voice_call_completed", {
        callSid,
        finalState: "complete",
        environment: process.env.NODE_ENV || "local",
      });
    }
  }

  res.type("text/xml").send(twiml.toString());
});

export default router;
