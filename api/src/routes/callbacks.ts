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

/**
 * Very conservative keyword gate for medical content.
 * (We want false positives over false negatives.)
 */
function isMedicalContent(text: string): boolean {
  const t = (text || "").toLowerCase();
  const keywords = [
    "symptom",
    "diagnos",
    "condition",
    "disease",
    "pain",
    "dose",
    "dosage",
    "mg",
    "medication",
    "medicine",
    "prescription",
    "rx",
    "side effect",
    "contraindication",
    "allergy",
    "blood pressure",
    "heart",
    "cancer",
    "anxiety",
    "depression",
    "ptsd",
    "bipolar",
    "schiz",
    "insomnia",
    "seizure",
    "epilep",
    "pregnan",
    "breastfeed",
  ];
  return keywords.some((k) => t.includes(k));
}

function buildSafeSummary(parts: {
  confirmedName?: string | null;
  nonMedicalReason?: string | null;
  preferredTime?: string | null;
  staffFollowupRequired?: boolean;
}): string {
  const chunks: string[] = [];
  if (parts.confirmedName) chunks.push(`Confirmed name: ${parts.confirmedName}.`);
  if (parts.nonMedicalReason) chunks.push(`Reason: ${parts.nonMedicalReason}.`);
  if (parts.preferredTime) chunks.push(`Preferred time: ${parts.preferredTime}.`);
  if (parts.staffFollowupRequired) chunks.push(`Staff follow-up requested.`);
  // Force 1–2 sentences max (keep it tight)
  return chunks.slice(0, 2).join(" ");
}

type AiOutcome = "reached" | "voicemail" | "no_answer" | "failed";

function isSimulationEnabled(): boolean {
  return String(process.env.AI_CALLBACK_SIMULATION || "").toLowerCase() === "true";
}

function getAiVoiceUrl(): string {
  // Prefer env var override, fall back to your ngrok TwiML endpoint
  return process.env.AI_VOICE_URL || "https://9b2d292c5db1.ngrok-free.app/api/voice/inbound";
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
    } catch (notifyErr) {
      console.warn("[callbacks POST] notification failed:", notifyErr);
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
 * List all callback requests
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
 * Mark callback as completed
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
    } catch (notifyErr) {
      console.warn("[callbacks COMPLETE] notification failed:", notifyErr);
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
 * Phase 3
 * POST /api/callbacks/:id/call
 * Initiate an outbound call (Twilio) to the callback's phone number.
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
      url: getAiVoiceUrl(), // use same voice entrypoint
    });

    return res.status(200).json({
      ok: true,
      message: "Outbound call initiated",
      result,
    });
  } catch (err: any) {
    console.error("[callbacks CALL] error:", err);

    const status = typeof err?.status === "number" ? err.status : 500;
    const code = err?.code;
    const message = err?.message ?? "Outbound call failed";

    return res.status(500).json({
      ok: false,
      error: "Outbound call failed",
      details: message,
      twilio: code ? { code, status } : undefined,
    });
  }
});

/**
 * Phase 4
 * POST /api/callbacks/:id/ai-call
 * Human-triggered AI callback (simulation or real)
 */
router.post("/:id/ai-call", async (req, res) => {
  try {
    const { id } = req.params;
    const simulation = process.env.AI_CALLBACK_SIMULATION === "true";

    const callback = await prisma.callbackRequest.findUnique({
      where: { id },
    });

    if (!callback) {
      return res.status(404).json({ error: "Callback not found" });
    }

    if (callback.status !== "pending") {
      return res.status(409).json({ error: "Callback not pending" });
    }

  // 🔹 Simulation mode (NO Twilio, NO AI voice)
  if (simulation) {
    const {
      simulatedReason,
      simulatedPreferredTime,
      simulatedMedicalQuestion,
    } = req.body ?? {};

    // 🔒 Explicit compliance gate — NO inference
    const needsStaff = simulatedMedicalQuestion === true;

    const updated = await prisma.callbackRequest.update({
      where: { id },
      data: {
        status: needsStaff ? "needs_staff" : "completed",
        aiHandled: true,
        staffFollowupRequired: needsStaff,
        preferredTime: needsStaff
          ? callback.preferredTime
          : simulatedPreferredTime ?? callback.preferredTime,
        summary: needsStaff
          ? "Caller asked a medical question; staff follow-up required."
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
  
    // 🔹 Real AI/Twilio flow (Phase 3.3 hook point)
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
