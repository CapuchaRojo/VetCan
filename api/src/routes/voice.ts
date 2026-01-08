import { Router } from "express";
import twilio from "twilio";
import prisma from "../prisma";
import { classifyIntent } from "../voice/voiceIntents";
import { VOICE_LINES } from "../voice/voiceLines";
import { pickLine } from "../voice/pickLine";
import { humanizeLine } from "../voice/humanize";

const router = Router();
const VoiceResponse = twilio.twiml.VoiceResponse;

/**
 * Shared Twilio voice config
 */
const VOICE = {
  voice: "alice" as const,
  rate: "90%",
};

/**
 * POST /api/voice/inbound
 */
router.post("/voice/inbound", (_req, res) => {
  const twiml = new VoiceResponse();

  const gather = twiml.gather({
    input: ["speech"],
    action: "/api/voice/intent",
    method: "POST",
    speechTimeout: "auto",
  });

  const line = `${pickLine(VOICE_LINES.greeting)} ${pickLine(
    VOICE_LINES.intentPrompt
  )}`;

  gather.say(VOICE, humanizeLine(line));

  res.type("text/xml").send(twiml.toString());
});

/**
 * POST /api/voice/intent
 */
router.post("/voice/intent", (req, res) => {
  const twiml = new VoiceResponse();
  const speech = String(req.body.SpeechResult || "").trim();

  if (!speech) {
    twiml.say(VOICE, pickLine(VOICE_LINES.retry));
    twiml.redirect("/api/voice/inbound");
    return res.type("text/xml").send(twiml.toString());
  }

  const { intent, confidence } = classifyIntent(speech);

  if (confidence < 0.4) {
    twiml.say(
      VOICE,
      humanizeLine(pickLine(VOICE_LINES.reassurance))
    );
  }

  switch (intent) {
    case "callback":
    case "scheduling":
    case "general_question":
      twiml.say(VOICE, pickLine(VOICE_LINES.schedulingConfirm));
      twiml.redirect("/api/voice/name");
      break;

    case "operator":
      twiml.say(VOICE, pickLine(VOICE_LINES.staffHandoff));
      twiml.hangup();
      break;

    default:
      twiml.say(VOICE, pickLine(VOICE_LINES.unknownIntent));
      twiml.redirect("/api/voice/inbound");
  }

  res.type("text/xml").send(twiml.toString());
});

/**
 * POST /api/voice/name
 */
router.post("/voice/name", (_req, res) => {
  const twiml = new VoiceResponse();

  const gather = twiml.gather({
    input: ["speech"],
    action: "/api/voice/phone",
    method: "POST",
    speechTimeout: "auto",
  });

  gather.say(VOICE, pickLine(VOICE_LINES.reassurance));

  res.type("text/xml").send(twiml.toString());
});

/**
 * POST /api/voice/phone
 */
router.post("/voice/phone", (req, res) => {
  const twiml = new VoiceResponse();
  const rawName = String(req.body.SpeechResult || "").trim();

  // Validate name length and content to prevent injection
  const name = rawName.slice(0, 100).replace(/[<>\"\'%;()&]/g, "");

  if (!name || name.length < 1) {
    twiml.say(VOICE, pickLine(VOICE_LINES.retry));
    twiml.redirect("/api/voice/name");
    return res.type("text/xml").send(twiml.toString());
  }

  const gather = twiml.gather({
    input: ["speech", "dtmf"],
    action: `/api/voice/time?name=${encodeURIComponent(name)}`,
    method: "POST",
    speechTimeout: "auto",
  });

  gather.say(VOICE, pickLine(VOICE_LINES.reassurance));

  res.type("text/xml").send(twiml.toString());
});

/**
 * POST /api/voice/time
 */
router.post("/voice/time", async (req, res) => {
  const twiml = new VoiceResponse();

  const name = String(req.query.name || "").trim();
  const rawPhone = req.body.SpeechResult || req.body.Digits || "";
  const preferredTime = String(req.body.SpeechResult || "").trim() || null;

  const phone = String(rawPhone).replace(/[^\d+]/g, "");

  if (!name || !phone) {
    twiml.say(VOICE, pickLine(VOICE_LINES.retry));
    twiml.redirect("/api/voice/inbound");
    return res.type("text/xml").send(twiml.toString());
  }

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
