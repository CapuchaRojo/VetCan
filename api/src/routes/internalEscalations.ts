import { Router } from "express";
import requireAuth from "../middleware/auth";
import { getEscalationBreakerSnapshot } from "../worker/processDeliveries";
import { escalationMetrics } from "../worker/escalationMetrics";

const router = Router();

router.use(requireAuth);

router.get("/status", (_req, res) => {
  const nowMs = Date.now();
  res.json({
    breaker: getEscalationBreakerSnapshot(nowMs),
    counters: escalationMetrics.counters,
    nowMs,
  });
});

export default router;
