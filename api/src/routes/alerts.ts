import { Router } from "express";
import prisma from "../prisma";
import { emitEvent } from "../lib/events";
import { logger } from "../utils/logger";
import requireAuth from "../middleware/auth";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const {
      severity,
      alertType,
      eventName,
      environment,
      ageSeconds,
      callSid,
      summary,
      triggeredAt,
    } = req.body;

    if (!severity || !summary) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // 🔒 Enforce allowed severities
    if (!["info", "warning", "critical"].includes(severity)) {
      return res.status(400).json({ error: "Invalid severity" });
    }

    const alert = await prisma.alert.create({
      data: {
        severity,
        alertType,
        eventName,
        environment,
        ageSeconds,
        callSid,
        summary,
        triggeredAt: triggeredAt ? new Date(triggeredAt) : new Date(),
      },
    });

    // 🔔 Emit escalation event (typed + normalized)
    // Hard invariants — escalation is terminal
if (!alert.alertType || !alert.eventName) {
  throw new Error(
    `Invariant violation: alert ${alert.id} missing alertType or eventName`
  );
}

emitEvent("alert_escalation_requested", {
  alertType: alert.alertType,
  eventName: alert.eventName,

  // environment must never be null at escalation time
  environment: alert.environment ?? process.env.NODE_ENV ?? "development",

  summary: alert.summary,

  // correct field name
  triggeredAt: alert.triggeredAt.toISOString(),

  // correlation for humans + n8n = alert id
  correlationId: alert.id,

  severity,
  ageSeconds,

  callSid: alert.callSid ?? undefined,
});

    res.status(201).json({ ok: true, alert });
  } catch (err) {
    logger.error("[alerts POST]", err);
    res.status(500).json({ error: "Failed to create alert" });
  }
});

router.post("/:id/ack", requireAuth, async (req, res) => {
  const compositeId = req.params.id;
  const operator = (req as any).operator;

  const acknowledgedBy =
    typeof req.body?.acknowledgedBy === "string" && req.body.acknowledgedBy.trim()
      ? req.body.acknowledgedBy.trim()
      : operator?.name ?? operator?.id ?? "unknown";

  const parts = compositeId.split(":");
  if (parts.length !== 3) {
    return res.status(400).json({ error: "Invalid alert id format" });
  }

  const [alertType, source, correlationId] = parts;
  const acknowledgedAt = new Date();

  try {
    const existing = await prisma.alert.findFirst({
      where: {
        alertType,
        correlationId,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: "Alert not found" });
    }

    if (existing.acknowledgedAt) {
      return res.json({ ok: true, acknowledged: true });
    }

    await prisma.$transaction(async (tx) => {
      await tx.alert.updateMany({
        where: {
          alertType,
          correlationId,
          acknowledgedAt: null,
        },
        data: {
          acknowledgedAt,
          acknowledgedBy,
        },
      });

      // 1️⃣ Cancel pending/failed escalation deliveries
      await tx.escalationDelivery.updateMany({
        where: {
          status: { in: ["pending", "failed"] },
          event: {
            correlationId,
          },
        },
        data: {
          status: "canceled",
          lastError: "Canceled due to alert acknowledgement",
        },
      });
    });

    // 2️⃣ Emit acknowledgement event (source of truth)
    emitEvent("alert_acknowledged", {
      alertId: compositeId,
      alertType,
      eventName: existing.eventName ?? "unknown",
      source: existing.source ?? source,
      correlationId,
      environment: process.env.NODE_ENV ?? "local",
      acknowledgedAt: acknowledgedAt.toISOString(),
      operatorId: operator?.id,
      operatorName: operator?.name,
      role: operator?.role,
    });

    return res.json({ ok: true, acknowledged: true });
  } catch (err) {
    logger.error("[alerts ACK]", err);
    return res.status(500).json({ error: "Failed to acknowledge alert" });
  }
});


export default router;
