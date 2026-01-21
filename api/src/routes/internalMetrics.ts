import { Router } from "express";
import { getEventCounts } from "../lib/events";
import { getActiveAlerts } from "../lib/alerts";
import { getOperationalEventCounts } from "../repos/operationalEventsRepo";
import { getAlertSnapshots } from "../repos/alertsRepo";
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
    const [dbCounts, dbAlerts] = await Promise.all([
      getOperationalEventCounts(),
      getAlertSnapshots(),
    ]);

    const eventCounts = {
      ...defaultCounts,
      ...(dbCounts || getEventCounts()),
    };

    const activeAlerts =
      dbAlerts && dbAlerts.length > 0 ? dbAlerts : getActiveAlerts();

    res.json({
      uptimeSeconds: Math.floor(process.uptime()),
      environment: process.env.NODE_ENV || "local",
      lastUpdated: new Date().toISOString(),
      eventCounts,
      activeAlerts,
      status: "ok",
    });
  } catch {
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
      status: "ok",
    });
  }
});

export default router;
