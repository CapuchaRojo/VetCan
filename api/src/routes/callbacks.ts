// api/src/routes/callbacks.ts
import { Router } from "express";
import prisma from "../prisma";
import { notificationProvider } from "../services/notifications";
import { makeOutboundCall } from "../services/outboundCall";
import { emitEvent } from "../lib/events";
import { forwardAlertToN8N } from '../services/alertForwarder';

const router = Router();

const ALLOWED_REQUEST_TYPES = [
  "new_patient",
  "renewal",
  "general_question",
  "scheduling",
] as const;

type RequestType = (typeof ALLOWED_REQUEST_TYPES)[number];

function normalizePhone(phone: unknown): string {
  const raw = String(phone ?? "").trim();
  return raw.replace(/[^\d+]/g, "");
}

function getAiVoiceUrl(): string {
  return (
    process.env.AI_VOICE_URL ||
    "https://9b2d292c5db1.ngrok-free.app/api/voice/inbound"
  );
}

function isDemoRequest(req: any): boolean {
  return (
    req.query?.demo === "true" ||
    req.body?.demo === true ||
    String(process.env.DEMO_MODE || "").toLowerCase() === "true"
  );
}

function isSimulationRequest(req: any): boolean {
  return (
    req.body?.simulation === true ||
    process.env.NODE_ENV === "test" ||
    String(process.env.AI_CALLBACK_SIMULATION || "").toLowerCase() === "true"
  );
}

/**
 * POST /api/callbacks
 * Create a new callback request (NON-PHI)
 */
router.post("/", async (req, res) => {
  try {
    const { name, phone, preferredTime, requestType } = req.body ?? {};

    if (!name || !phone) {
      return res.status(400).json({ error: "name and phone are required" });
    }

    let normalizedRequestType: RequestType | null = null;
    if (requestType) {
      if (!ALLOWED_REQUEST_TYPES.includes(requestType)) {
        return res.status(400).json({
          error: `requestType must be one of: ${ALLOWED_REQUEST_TYPES.join(", ")}`,
        });
      }
      normalizedRequestType = requestType;
    }

    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      return res.status(400).json({ error: "phone is invalid" });
    }

    const staffFollowupRequired = req.body?.staffFollowupRequired === true;
    const callback = await prisma.callbackRequest.create({
      data: {
        name: String(name).trim(),
        phone: normalizedPhone,
        preferredTime: preferredTime ? String(preferredTime).trim() : null,
        requestType: normalizedRequestType,
        status: "pending",
        staffFollowupRequired,
      },
    });

    if (staffFollowupRequired) {
      console.log('[alerts] triggered callback_staff_required');

      await forwardAlertToN8N({
        alertType: 'callback_staff_required',
        eventName: 'callback_requested',
        severity: 'warning',
        summary: 'Callback requires staff follow-up',
        environment: process.env.NODE_ENV || 'development',
        triggeredAt: new Date().toISOString(),
        correlationId: callback.id,
        ageSeconds: 0,
      });
    }

    const source =
      callback.source === "voice" || callback.source === "sms"
        ? callback.source
        : "sms";

    emitEvent("callback_requested", {
      source,
      phone: callback.phone,
      staffFollowupRequired: callback.staffFollowupRequired,
      correlationId: callback.id,
      environment: process.env.NODE_ENV || "development",
    });

    // best-effort notification
    try {
      await notificationProvider.send(
        callback.phone,
        `Thanks ${callback.name}, we received your request and will contact you shortly.`
      );
    } catch (err) {
      console.warn("[callbacks POST] notification failed:", err);
    }

    return res.status(201).json({
      id: callback.id,
      status: callback.status,
      message: "Callback request received",
    });
  } catch (err) {
    console.error("[callbacks POST] error:", err);
    return res.status(500).json({ error: "Callback creation failed" });
  }
});

/**
 * GET /api/callbacks
 */
router.get("/", async (_req, res) => {
  try {
    const callbacks = await prisma.callbackRequest.findMany({
      orderBy: { createdAt: "desc" },
    });
    return res.json(callbacks);
  } catch (err) {
    console.error("[callbacks GET] error:", err);
    return res.status(500).json({ error: "Failed to fetch callbacks" });
  }
});

/**
 * POST /api/callbacks/:id/complete
 */
router.post("/:id/complete", async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.callbackRequest.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Callback not found" });

    if (existing.status === "completed") {
      return res.status(409).json({ error: "Callback already completed" });
    }

    const callback = await prisma.callbackRequest.update({
      where: { id },
      data: { status: "completed" },
    });

    // best-effort notification
    try {
      await notificationProvider.send(
        callback.phone,
        "Thanks for speaking with us! If you need anything else, feel free to reach out."
      );
    } catch (err) {
      console.warn("[callbacks COMPLETE] notification failed:", err);
    }

    return res.json({
      id: callback.id,
      status: callback.status,
      message: "Callback marked as completed",
    });
  } catch (err) {
    console.error("[callbacks COMPLETE] error:", err);
    return res.status(500).json({ error: "Failed to complete callback" });
  }
});

/**
 * POST /api/callbacks/:id/call
 * Manual outbound call (Twilio)
 * Supports demo=true to avoid dialing Twilio during demos.
 */
router.post("/:id/call", async (req, res) => {
  try {
    const { id } = req.params;
    const demo = isDemoRequest(req);

    const callback = await prisma.callbackRequest.findUnique({ where: { id } });
    if (!callback) return res.status(404).json({ error: "Callback not found" });

    // DEMO: do not call Twilio, do not mutate DB
    if (demo) {
      return res.json({
        ok: true,
        mode: "demo",
        demo: true,
        message: "Demo mode: outbound call suppressed (no Twilio call made).",
        callbackId: callback.id,
        to: callback.phone,
      });
    }

    if (callback.status === "completed") {
      return res.status(409).json({ error: "Callback already completed" });
    }

    const to = normalizePhone(callback.phone);
    if (!to) return res.status(400).json({ error: "Callback phone is invalid" });

    const fromNumber = process.env.TWILIO_PHONE_NUMBER;
    if (!fromNumber) {
      return res.status(500).json({ error: 'TWILIO_PHONE_NUMBER not configured' });
    }

    const result = await makeOutboundCall({
      to,
      from: fromNumber,
      url: getAiVoiceUrl(),
    });

    return res.json({
      ok: true,
      message: "Outbound call initiated",
      result,
    });
  } catch (err: any) {
    console.error("[callbacks CALL] error:", err);
    return res.status(500).json({ error: "Outbound call failed" });
  }
});

/**
 * POST /api/callbacks/:id/ai-call
 * AI-assisted callback:
 * - demo=true: NO DB writes, NO Twilio, returns synthetic callback object
 * - simulation: mutates DB (used in tests/dev)
 * - real: Twilio + minimal DB update
 */
router.post("/:id/ai-call", async (req, res) => {
  try {
    const { id } = req.params;

    const callback = await prisma.callbackRequest.findUnique({ where: { id } });
    if (!callback) return res.status(404).json({ error: "Callback not found" });

    const demo = isDemoRequest(req);

    // 🔹 DEMO MODE (no DB writes, no mutations)
    // NOTE: We intentionally bypass "pending" check in demo mode so you can demo on any record safely.
    if (demo) {
      const simulatedMedicalQuestion = req.body?.simulatedMedicalQuestion === true;

      return res.json({
        ok: true,
        mode: "demo",
        demo: true,
        callback: {
          ...callback,
          aiHandled: true,
          staffFollowupRequired: simulatedMedicalQuestion,
          status: simulatedMedicalQuestion ? "needs_staff" : "completed",
          summary: simulatedMedicalQuestion
            ? "Caller asked a medical question; staff follow-up required."
            : "AI handled scheduling request successfully.",
          lastAttemptAt: new Date().toISOString(),
        },
      });
    }

    // Outside demo mode, we enforce the pending-only rule
    if (callback.status !== "pending") {
      return res.status(409).json({ error: "Callback not pending" });
    }

    const simulation = isSimulationRequest(req);

    // 🔹 SIMULATION MODE (DB writes allowed; used in tests/dev)
    if (simulation) {
      const needsStaff = req.body?.simulatedMedicalQuestion === true;

      const updated = await prisma.callbackRequest.update({
        where: { id },
        data: {
          status: needsStaff ? "needs_staff" : "completed",
          aiHandled: true,
          staffFollowupRequired: needsStaff,
          summary: needsStaff
            ? "Caller request requires staff follow-up."
            : "AI handled scheduling request successfully.",

          lastAttemptAt: new Date(),
        },
      });

      return res.json({
        ok: true,
        mode: "simulation",
        status: updated.status,
        staffFollowupRequired: updated.staffFollowupRequired,
      });
    }

    // 🔹 REAL TWILIO PATH
    const twimlUrl = process.env.TWIML_AI_CALLBACK_URL;
    if (!twimlUrl) {
      return res.status(500).json({ error: 'TWIML_AI_CALLBACK_URL not configured' });
    }

    const fromNumber = process.env.TWILIO_PHONE_NUMBER;
    if (!fromNumber) {
      return res.status(500).json({ error: 'TWILIO_PHONE_NUMBER not configured' });
    }

    emitEvent("ai_call_initiated", { mode: "twilio" });
    await makeOutboundCall({
      to: callback.phone,
      from: fromNumber,
      url: twimlUrl,
    });

    await prisma.callbackRequest.update({
      where: { id },
      data: {
        aiHandled: true,
        lastAttemptAt: new Date(),
      },
    });

    return res.json({ ok: true, mode: "twilio" });
  } catch (err) {
    console.error("[callbacks AI-CALL] error:", err);
    return res.status(500).json({ error: "AI callback failed" });
  }
});

export default router;
