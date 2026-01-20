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
    emitEvent("alert_escalation_requested", {
      severity: alert.severity as "info" | "warning" | "critical",
      summary: alert.summary,
      environment: alert.environment ?? "unknown",
      alertType: alert.alertType ?? undefined,
      eventName: alert.eventName ?? undefined,
      ageSeconds: alert.ageSeconds ?? 0,
      callSid: alert.callSid ?? undefined,
      triggeredAt: alert.triggeredAt.toISOString(),
    });

    res.status(201).json({ ok: true, alert });
  } catch (err) {
    console.error("[alerts POST]", err);
    res.status(500).json({ error: "Failed to create alert" });
  }
});

export default router;
