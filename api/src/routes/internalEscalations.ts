import { Router } from "express";
import requireAuth from "../middleware/auth";
import {
  getEscalationBreakerSnapshot,
  resetEscalationBreakerForOps,
} from "../worker/processDeliveries";
import { escalationMetrics } from "../worker/escalationMetrics";
import { logger } from "../utils/logger";

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

router.post("/breaker/reset", (req, res) => {
  const nowMs = Date.now();
  const { before, after } = resetEscalationBreakerForOps(nowMs);
  const actor = (req as any).operator
    ? {
        id: (req as any).operator.id,
        role: (req as any).operator.role,
        name: (req as any).operator.name,
      }
    : undefined;

  logger.info("[escalations] operator_action: breaker_reset", {
    nowMs,
    ...(actor ? { actor } : {}),
    before,
    after,
  });

  res.json({
    ok: true,
    nowMs,
    breaker: after,
  });
});

export default router;
