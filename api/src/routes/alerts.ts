import { Router } from "express";
import prisma from "../prisma";
import { emitEvent } from "../lib/events";

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
    console.error("[alerts POST]", err);
    res.status(500).json({ error: "Failed to create alert" });
  }
});

export default router;
