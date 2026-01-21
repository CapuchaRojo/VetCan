import { Router } from "express";
import { getEventCounts } from "../lib/events";
import { getActiveAlerts } from "../lib/alerts";
import { getOperationalEventCounts } from "../repos/operationalEventsRepo";
import { getAlertSnapshots } from "../repos/alertsRepo";
import { getRecentEscalationDeliveries } from "../repos/escalationDeliveriesRepo";
import { getAlertAckTimeline } from "../repos/ackTimelineRepo";
import { logger } from "../utils/logger";
import requireAuth from "../middleware/auth";

const router = Router();

router.use(requireAuth);

router.get("/", async (_req, res) => {
  // Read-only operational metrics; no request data or payloads exposed.
  try {
    const defaultCounts = {
      callback_requested: 0,
      alert_triggered: 0,
      sms_received: 0,
      voice_call_started: 0,
    };
    const [dbCounts, dbAlerts, dbDeliveries, dbAckTimeline] = await Promise.all([
      getOperationalEventCounts(),
      getAlertSnapshots(),
      getRecentEscalationDeliveries(50),
      getAlertAckTimeline(50),
    ]);

    const eventCounts = {
      ...defaultCounts,
      ...(dbCounts || getEventCounts()),
    };

    const activeAlerts =
      dbAlerts && dbAlerts.length > 0 ? dbAlerts : getActiveAlerts();

    const deliveries = dbDeliveries.map((delivery) => ({
      dedupeKey: delivery.dedupeKey,
      status: delivery.status,
      attemptCount: delivery.attemptCount,
      lastAttemptAt: delivery.lastAttemptAt
        ? delivery.lastAttemptAt.toISOString()
        : null,
      lastError: delivery.lastError,
      sentAt: delivery.sentAt ? delivery.sentAt.toISOString() : null,
      eventName: delivery.event.eventName,
    }));

    res.json({
      uptimeSeconds: Math.floor(process.uptime()),
      environment: process.env.NODE_ENV || "local",
      lastUpdated: new Date().toISOString(),
      eventCounts,
      activeAlerts,
      ackTimeline: dbAckTimeline,
      deliveries,
      status: "ok",
    });
  } catch {
    logger.warn("[metrics] DB metrics unavailable; falling back to memory.");
    const defaultCounts = {
      callback_requested: 0,
      alert_triggered: 0,
      sms_received: 0,
      voice_call_started: 0,
    };
    res.json({
      uptimeSeconds: 0,
      environment: process.env.NODE_ENV || "local",
      lastUpdated: new Date().toISOString(),
      eventCounts: defaultCounts,
      activeAlerts: [],
      ackTimeline: [],
      deliveries: [],
      status: "ok",
    });
  }
});

export default router;
