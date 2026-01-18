import { Router } from "express";
import { getEventCounts } from "../lib/events";
import { getActiveAlerts } from "../lib/alerts";
import requireAuth from "../middleware/auth";

const router = Router();

router.use(requireAuth);

router.get("/", (_req, res) => {
  // Read-only operational metrics; no request data or payloads exposed.
  try {
    const defaultCounts = {
      callback_requested: 0,
      alert_triggered: 0,
      sms_received: 0,
      voice_call_started: 0,
    };
    const eventCounts = {
      ...defaultCounts,
      ...getEventCounts(),
    };
    res.json({
      uptimeSeconds: Math.floor(process.uptime()),
      environment: process.env.NODE_ENV || "local",
      lastUpdated: new Date().toISOString(),
      eventCounts,
      activeAlerts: getActiveAlerts(),
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
