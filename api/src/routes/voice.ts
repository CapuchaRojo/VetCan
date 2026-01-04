import { Router } from "express";
import twilio from "twilio";
import prisma from "../prisma";
import { classifyIntent } from "../services/voiceIntent";

const router = Router();
const VoiceResponse = twilio.twiml.VoiceResponse;

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

  gather.say(
    "Thanks for calling. I can help schedule a callback. Please tell me what you need."
  );

  res.type("text/xml").send(twiml.toString());
});

/**
 * POST /api/voice/intent
 */
router.post("/voice/intent", (req, res) => {
  const twiml = new VoiceResponse();
  const speech = req.body.SpeechResult || "";

  if (!speech.trim()) {
  twiml.say("I didn't hear anything. Please try again.");
  twiml.redirect("/api/voice/inbound");
  return res.type("text/xml").send(twiml.toString());
}

  const intent = classifyIntent(speech);

  switch (intent) {
    case "callback":
    case "scheduling":
    case "general_question":
      twiml.say("I will arrange a callback for you.");
      twiml.redirect("/api/voice/name");
      break;

    case "operator":
      twiml.say("Please hold while I notify a representative.");
      twiml.hangup();
      break;

    default:
      twiml.say(
        "Sorry, I did not understand that. Please say callback or appointment."
      );
      twiml.redirect("/api/voice/inbound");
  }

  res.type("text/xml").send(twiml.toString());
});

/**
 * POST /api/voice/name
 */
router.post("/voice/name", (req, res) => {
  const twiml = new VoiceResponse();
  const name = req.body.SpeechResult;

  if (!name) {
    twiml.say("Sorry, I did not catch that.");
    twiml.redirect("/api/voice/inbound");
    return res.type("text/xml").send(twiml.toString());
  }

  const gather = twiml.gather({
    input: ["speech", "dtmf"],
    action: `/api/voice/phone?name=${encodeURIComponent(name)}`,
    method: "POST",
    speechTimeout: "auto",
  });

  gather.say("Thanks. What is the best phone number to reach you?");

  res.type("text/xml").send(twiml.toString());
});

/**
 * POST /api/voice/phone
 */
router.post("/voice/phone", (req, res) => {
  const twiml = new VoiceResponse();
  const name = req.query.name as string;

  const rawPhone = req.body.SpeechResult || req.body.Digits;

  if (!rawPhone) {
    twiml.say("Sorry, I did not catch the phone number.");
    twiml.redirect("/api/voice/name");
    return res.type("text/xml").send(twiml.toString());
  }

  const normalizedPhone = String(rawPhone).replace(/[^\d+]/g, "");

  const gather = twiml.gather({
    input: ["speech"],
    action: `/api/voice/time?name=${encodeURIComponent(
      name
    )}&phone=${encodeURIComponent(normalizedPhone)}`,
    method: "POST",
    speechTimeout: "auto",
  });

  gather.say("What time works best for a callback?");

  res.type("text/xml").send(twiml.toString());
});

/**
 * POST /api/voice/time
 */
router.post("/voice/time", async (req, res) => {
  const twiml = new VoiceResponse();
  const { name, phone } = req.query;
  const preferredTime = req.body.SpeechResult || null;

  try {
    await prisma.callbackRequest.create({
      data: {
        name: String(name),
        phone: String(phone),
        preferredTime,
        status: "pending",
      },
    });

    twiml.say(
      "Thank you. Our staff will call you back shortly. Have a great day."
    );
    twiml.hangup();
  } catch (err) {
    console.error("[voice callback error]", err);
    twiml.say("Sorry, something went wrong. Please call back later.");
    twiml.hangup();
  }

  res.type("text/xml").send(twiml.toString());
});

export default router;
