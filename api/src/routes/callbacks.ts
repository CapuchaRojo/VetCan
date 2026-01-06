// api/src/routes/callbacks.ts
import { Router } from "express";
import prisma from "../prisma";
import { notificationProvider } from "../services/notifications";
import { makeOutboundCall } from "../services/outboundCall";

/**
 * Phase 1 (Non-PHI) Callback Requests
 *
 * Allowed data:
 * - name (required)
 * - phone (required)
 * - preferredTime (optional)
 * - requestType (optional, non-medical)
 *
 * Disallowed:
 * - symptoms
 * - diagnoses
 * - medications
 * - medical history
 */

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

    const callback = await prisma.callbackRequest.create({
      data: {
        name: String(name).trim(),
        phone: normalizedPhone,
        preferredTime: preferredTime ? String(preferredTime).trim() : null,
        requestType: normalizedRequestType,
        status: "pending",
      },
    });

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
 */
router.post("/:id/call", async (req, res) => {
  try {
    const { id } = req.params;

    const callback = await prisma.callbackRequest.findUnique({ where: { id } });
    if (!callback) return res.status(404).json({ error: "Callback not found" });

    if (callback.status === "completed") {
      return res.status(409).json({ error: "Callback already completed" });
    }

    const to = normalizePhone(callback.phone);
    if (!to) return res.status(400).json({ error: "Callback phone is invalid" });

    const result = await makeOutboundCall({
      to,
      from: process.env.TWILIO_PHONE_NUMBER!,
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
 * AI-assisted callback (simulation or real)
 */
router.post("/:id/ai-call", async (req, res) => {
  try {
    const { id } = req.params;

    const callback = await prisma.callbackRequest.findUnique({
      where: { id },
    });

    if (!callback) {
      return res.status(404).json({ error: "Callback not found" });
    }

    if (callback.status !== "pending") {
      return res.status(409).json({ error: "Callback not pending" });
    }

    const simulation =
      req.body?.simulation === true ||
      process.env.NODE_ENV === "test" ||
      process.env.AI_CALLBACK_SIMULATION === "true";

    if (simulation) {
      const needsStaff = req.body?.simulatedMedicalQuestion === true;

      const updated = await prisma.callbackRequest.update({
        where: { id },
        data: {
          status: needsStaff ? "needs_staff" : "completed",
          aiHandled: true,
          staffFollowupRequired: needsStaff,
          summary: needsStaff
            ? "Staff follow-up required."
            : "Request handled by AI.",
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

    await makeOutboundCall({
      to: callback.phone,
      from: process.env.TWILIO_PHONE_NUMBER!,
      url: process.env.TWIML_AI_CALLBACK_URL!,
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
