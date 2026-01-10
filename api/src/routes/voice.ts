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
  sanitizeName,
} from "../voice/voiceFlow";
import type { VoicePlan } from "../voice/types";
import { VOICE_LINES } from "../voice/voiceLines";
import { pickLine } from "../voice/pickLine";

const router = Router();
const VoiceResponse = twilio.twiml.VoiceResponse;

/**
 * Shared Twilio voice config
 */
const VOICE = {
  voice: "alice" as const,
  rate: "90%",
};

function applyPlan(twiml: twilio.twiml.VoiceResponse, plan: VoicePlan) {
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
  const { plan } = buildIntentPlan(speech);
  applyPlan(twiml, plan);

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

  const rawName = String(req.query.name || "").trim();
  const name = sanitizeName(rawName);
  const rawPhone = req.body.SpeechResult || req.body.Digits || "";
  const preferredTime = String(req.body.SpeechResult || "").trim() || null;

  const phone = normalizePhone(rawPhone);

  const result = buildTimePlan({ name, phone, preferredTime });

  if (!result.ok && result.plan) {
    applyPlan(twiml, result.plan);
    return res.type("text/xml").send(twiml.toString());
  }

// success path continues unchanged


  try {
    await prisma.callbackRequest.create({
      data: {
        name,
        phone,
        preferredTime,
        status: "pending",
      },
    });

    twiml.say(VOICE, pickLine(VOICE_LINES.schedulingConfirm));
    twiml.say(VOICE, pickLine(VOICE_LINES.staffHandoff));
    twiml.hangup();
  } catch (err) {
    console.error("[voice callback error]", err);
    twiml.say(VOICE, pickLine(VOICE_LINES.retry));
    twiml.hangup();
  }

  res.type("text/xml").send(twiml.toString());
});

export default router;
