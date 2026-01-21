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
  const { id } = req.params;
  const operator = (req as any).operator;

  try {
    const existing = await prisma.alert.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: "Alert not found" });
    }

    const acknowledgedAt = new Date();
    await prisma.alert.update({
      where: { id },
      data: {
        acknowledgedAt,
        acknowledgedBy: operator?.name ?? operator?.id ?? "unknown",
      },
    });

    await prisma.escalationDelivery.updateMany({
      where: {
        status: { in: ["pending", "failed"] },
        event: {
          correlationId: id,
        },
      },
      data: { status: "canceled" },
    });

    emitEvent("alert_acknowledged", {
      alertId: id,
      alertType: existing.alertType ?? "unknown",
      eventName: existing.eventName ?? "unknown",
      environment: existing.environment ?? process.env.NODE_ENV ?? "local",
      acknowledgedAt: acknowledgedAt.toISOString(),
      correlationId: id,
      operatorId: operator?.id,
      operatorName: operator?.name,
      role: operator?.role,
    });

    return res.json({ ok: true });
  } catch (err) {
    logger.error("[alerts ACK]", err);
    return res.status(500).json({ error: "Failed to acknowledge alert" });
  }
});

export default router;
