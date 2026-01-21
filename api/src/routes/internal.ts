import { Router } from "express";
import prisma from "../prisma";
import { emitEvent, getRecentEvents, recordInternalEvent } from "../lib/events";
import { getRecentOperationalEvents } from "../repos/operationalEventsRepo";
import {
  acknowledgeAlert,
  getActiveAlerts,
  isAlertEvaluatorInitialized,
} from "../lib/alerts";
import { isEventForwarderEnabled } from "../lib/eventForwarder";
import requireAuth, { requireRole } from "../middleware/auth";
import { IS_DEV } from "../config/env";

const router = Router();

router.get("/status", requireAuth, (_req, res) => {
  res.json({
    uptimeSeconds: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || "local",
    alertEngineInitialized: isAlertEvaluatorInitialized(),
    activeAlertCount: getActiveAlerts().length,
    eventForwarderEnabled: isEventForwarderEnabled(),
  });
});

router.get("/events/recent", requireAuth, async (req, res) => {
  const limit = Number(req.query.limit);
  const safeLimit = Number.isFinite(limit) ? limit : 50;
  
  try {
    const events = await getRecentOperationalEvents(safeLimit);
    res.json({ events });
  } catch {
    res.json({ events: getRecentEvents(safeLimit) });
  }
});

router.get("/alerts/active", (_req, res) => {
  res.json(getActiveAlerts());
});

router.post(
  "/events/emit",
  (req, res, next) => {
    if (!IS_DEV) {
      return res.status(404).json({ error: "Route not found" });
    }
    return next();
  },
  requireAuth,
  (req, res) => {
    const type = req.body?.type;
    if (typeof type !== "string" || !type.trim()) {
      return res.status(400).json({ error: "Invalid event" });
    }
    const payload =
      req.body?.payload && typeof req.body.payload === "object"
        ? req.body.payload
        : {};

    recordInternalEvent(type.trim(), payload);
    return res.json({ ok: true });
  }
);

router.post("/alerts/:id/acknowledge", requireRole("admin"), (req, res) => {
  const { id } = req.params;
  const alert = acknowledgeAlert(id);
  if (!alert) {
    return res.status(404).json({ error: "Alert not found" });
  }

  const operator = (req as any).operator;

  emitEvent("alert_acknowledged", {
    alertId: alert.id,
    alertType: alert.alertType,
    eventName: alert.eventName,
    environment: alert.environment,
    acknowledgedAt: alert.acknowledgedAt as string,
    correlationId: alert.correlationId,
    operatorId: operator?.id,
    operatorName: operator?.name,
    role: operator?.role,
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

      const operator = (req as any).operator;

      emitEvent("callback_marked_staff_handled", {
        callbackId: updated.id,
        environment: process.env.NODE_ENV || "local",
        handledAt: new Date().toISOString(),
        operatorId: operator?.id,
        operatorName: operator?.name,
        role: operator?.role,
      });

      return res.json({ ok: true });
    } catch (err) {
      return res.status(404).json({ error: "Callback not found" });
    }
  }
);

export default router;
