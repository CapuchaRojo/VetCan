import { Router } from "express";
import { getEventCounts } from "../lib/events";
import { getActiveAlerts } from "../lib/alerts";

const router = Router();

router.get("/", (_req, res) => {
  // Read-only operational metrics; no request data or payloads exposed.
  try {
    res.json({
      uptimeSeconds: Math.floor(process.uptime()),
      environment: process.env.NODE_ENV || "local",
      eventCounts: getEventCounts(),
      activeAlerts: getActiveAlerts(),
    });
  } catch {
    res.json({
      uptimeSeconds: 0,
      environment: process.env.NODE_ENV || "local",
      eventCounts: {},
      activeAlerts: [],
    });
  }
});

export default router;
