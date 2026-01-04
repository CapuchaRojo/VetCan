// api/src/routes/callbacks.ts
import { Router } from "express";
import prisma from "../prisma";
import { notificationProvider } from "../services/notifications";
import { placeOutboundCall } from "../services/outboundCall";

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
  // Keep digits and leading +. Remove spaces, dashes, parentheses, etc.
  // Example: " (689) 278-5991 " -> "6892785991"
  // Example: "+1 (689) 278-5991" -> "+16892785991"
  const raw = String(phone ?? "").trim();
  return raw.replace(/[^\d+]/g, "");
}

/**
 * POST /api/callbacks
 * Create a new callback request (NON-PHI)
 */
router.post("/", async (req, res) => {
  try {
    const { name, phone, preferredTime, requestType } = req.body ?? {};

    if (!name || !phone) {
      return res.status(400).json({
        error: "name and phone are required",
      });
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
        // source is typically set by sms webhook or default in DB;
        // we leave it alone unless you want to force it here.
      },
    });

    // Notification should never crash the request
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

    // Optional: check existence first for cleaner errors
    const existing = await prisma.callbackRequest.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: "Callback not found" });
    }

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
 *
 * IMPORTANT:
 * - Must never crash the API process if Twilio errors.
 * - Twilio trial accounts can only call VERIFIED numbers.
 */
router.post("/:id/call", async (req, res) => {
  try {
    const { id } = req.params;

    const callback = await prisma.callbackRequest.findUnique({
      where: { id },
    });

    if (!callback) {
      return res.status(404).json({ error: "Callback not found" });
    }

    if (callback.status === "completed") {
      return res.status(409).json({ error: "Callback already completed" });
    }

    const to = normalizePhone(callback.phone);
    if (!to) {
      return res.status(400).json({ error: "Callback phone is invalid" });
    }

    // This should throw if Twilio blocks the call (trial restriction, auth, etc.)
    const result = await placeOutboundCall(to);

    // Optional: persist status that an attempt was made (if you have fields for it)
    // If you do NOT have fields, skip DB writes to avoid schema mismatch.
    // await prisma.callbackRequest.update({ where: { id }, data: { lastCallAttemptAt: new Date() } });

    return res.status(200).json({
      ok: true,
      message: "Outbound call initiated",
      // result may include sid etc depending on your implementation
      result,
    });
  } catch (err: any) {
    // DO NOT crash container; always respond.
    console.error("[callbacks CALL] error:", err);

    // If Twilio error has a status/code, surface it safely
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

export default router;
