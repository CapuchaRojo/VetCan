import { Router } from "express";
import prisma from "../prisma";
import { emitEvent, getRecentEvents } from "../lib/events";
import {
  acknowledgeAlert,
  getActiveAlerts,
  isAlertEvaluatorInitialized,
} from "../lib/alerts";
import { isEventForwarderEnabled } from "../lib/eventForwarder";
import requireAuth, { requireRole } from "../middleware/auth";

const router = Router();

router.use(requireAuth);

router.get("/status", (_req, res) => {
  res.json({
    uptimeSeconds: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || "local",
    alertEngineInitialized: isAlertEvaluatorInitialized(),
    activeAlertCount: getActiveAlerts().length,
    eventForwarderEnabled: isEventForwarderEnabled(),
  });
});

router.get("/events/recent", (req, res) => {
  const limit = Number(req.query.limit);
  const safeLimit = Number.isFinite(limit) ? limit : 50;
  res.json(getRecentEvents(safeLimit));
});

router.get("/alerts/active", (_req, res) => {
  res.json(getActiveAlerts());
});

router.post("/alerts/:id/acknowledge", requireRole("admin"), (req, res) => {
  const { id } = req.params;
  const alert = acknowledgeAlert(id);
  if (!alert) {
    return res.status(404).json({ error: "Alert not found" });
  }

  emitEvent("alert_acknowledged", {
    alertId: alert.id,
    alertType: alert.alertType,
    eventName: alert.eventName,
    environment: alert.environment,
    acknowledgedAt: alert.acknowledgedAt as string,
    correlationId: alert.correlationId,
  });

  return res.json({ ok: true });
});

router.post(
  "/callbacks/:id/mark-staff-handled",
  requireRole("admin"),
  async (req, res) => {
    const { id } = req.params;

    try {
      const updated = await prisma.callbackRequest.update({
        where: { id },
        data: {
          status: "completed",
          staffFollowupRequired: false,
        },
      });

      emitEvent("callback_marked_staff_handled", {
        callbackId: updated.id,
        environment: process.env.NODE_ENV || "local",
        handledAt: new Date().toISOString(),
      });

      return res.json({ ok: true });
    } catch (err) {
      return res.status(404).json({ error: "Callback not found" });
    }
  }
);

export default router;
