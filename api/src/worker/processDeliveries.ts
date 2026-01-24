import prisma from "../prisma";
import { logger } from "../utils/logger";
import { escalationMetrics } from "./escalationMetrics";

const DEFAULT_MAX_ATTEMPTS = 8;
const DEFAULT_BASE_MS = 5_000;
const DEFAULT_MAX_MS = 5 * 60_000;
const DEFAULT_JITTER_MS = 1_000;
const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_BREAKER_FAILURE_THRESHOLD = 3;
const DEFAULT_BREAKER_OPEN_MS = 60_000;
const DEFAULT_BREAKER_HALF_OPEN_MAX_PROBES = 1;
const DEFAULT_BREAKER_LOG_MS = 10_000;
const DEFAULT_METRICS_SNAPSHOT_MS = 60_000;

type BreakerState = "CLOSED" | "OPEN" | "HALF_OPEN";

const breaker = {
  state: "CLOSED" as BreakerState,
  consecutiveFailures: 0,
  openedAt: null as Date | null,
  halfOpenProbeInFlight: false,
  lastDeniedLogAt: 0,
};

let lastSnapshotAtMs = 0;

function resetBreakerState() {
  breaker.state = "CLOSED";
  breaker.consecutiveFailures = 0;
  breaker.openedAt = null;
  breaker.halfOpenProbeInFlight = false;
  breaker.lastDeniedLogAt = 0;
}

function getNumberEnv(key: string, fallback: number) {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getBreakerConfig() {
  return {
    failureThreshold: getNumberEnv(
      "ESCALATION_BREAKER_FAILURE_THRESHOLD",
      DEFAULT_BREAKER_FAILURE_THRESHOLD
    ),
    openMs: getNumberEnv(
      "ESCALATION_BREAKER_OPEN_MS",
      DEFAULT_BREAKER_OPEN_MS
    ),
    halfOpenMaxProbes: getNumberEnv(
      "ESCALATION_BREAKER_HALF_OPEN_MAX_PROBES",
      DEFAULT_BREAKER_HALF_OPEN_MAX_PROBES
    ),
    logMs: getNumberEnv("ESCALATION_BREAKER_LOG_MS", DEFAULT_BREAKER_LOG_MS),
  };
}

function getSnapshotIntervalMs() {
  return getNumberEnv(
    "ESCALATION_METRICS_SNAPSHOT_MS",
    DEFAULT_METRICS_SNAPSHOT_MS
  );
}

function logBreakerDenied(now: number) {
  const { logMs } = getBreakerConfig();
  if (now - breaker.lastDeniedLogAt < logMs) return;
  breaker.lastDeniedLogAt = now;
  logger.warn("[deliveries] breaker open; dispatch skipped.");
}

function openBreaker(now: number) {
  const { failureThreshold, openMs } = getBreakerConfig();
  breaker.state = "OPEN";
  breaker.openedAt = new Date(now);
  breaker.consecutiveFailures = 0;
  breaker.halfOpenProbeInFlight = false;
  logger.warn(
    `[deliveries] breaker opened (threshold ${failureThreshold}, open ${openMs}ms)`
  );
}

function canAttempt(now: number) {
  const { openMs, halfOpenMaxProbes } = getBreakerConfig();

  if (breaker.state === "OPEN") {
    if (breaker.openedAt && now - breaker.openedAt.getTime() < openMs) {
      logBreakerDenied(now);
      return false;
    }
    breaker.state = "HALF_OPEN";
    breaker.halfOpenProbeInFlight = false;
  }

  if (breaker.state === "HALF_OPEN") {
    if (breaker.halfOpenProbeInFlight) {
      logBreakerDenied(now);
      return false;
    }
    if (halfOpenMaxProbes <= 0) {
      logBreakerDenied(now);
      return false;
    }
    breaker.halfOpenProbeInFlight = true;
    return true;
  }

  return true;
}

function onSuccess() {
  if (breaker.state !== "CLOSED") {
    logger.info("[deliveries] breaker closed");
  }
  breaker.state = "CLOSED";
  breaker.consecutiveFailures = 0;
  breaker.openedAt = null;
  breaker.halfOpenProbeInFlight = false;
}

function onFailure(now: number) {
  if (breaker.state === "HALF_OPEN") {
    openBreaker(now);
    return;
  }

  breaker.consecutiveFailures += 1;
  const { failureThreshold } = getBreakerConfig();
  if (breaker.consecutiveFailures >= failureThreshold) {
    openBreaker(now);
  }
}

export function resetBreakerForTests() {
  resetBreakerState();
}

export function getEscalationBreakerSnapshot(nowMs: number) {
  const { openMs } = getBreakerConfig();
  const openedAtMs = breaker.openedAt ? breaker.openedAt.getTime() : null;
  const openUntilMs = openedAtMs !== null ? openedAtMs + openMs : null;
  const remainingOpenMs =
    openUntilMs !== null ? Math.max(0, openUntilMs - nowMs) : null;

  return {
    state: breaker.state,
    failureCount: breaker.consecutiveFailures,
    openedAtMs,
    openUntilMs,
    remainingOpenMs,
  };
}

export async function captureEscalationMetricsSnapshot(nowMs: number) {
  try {
    const counters = escalationMetrics.counters;
    const breakerSnapshot = getEscalationBreakerSnapshot(nowMs);

    await prisma.escalationMetricsSnapshot.create({
      data: {
        attempted: counters.attempted,
        delivered: counters.delivered,
        failed: counters.failed,
        skippedBreaker: counters.skippedBreaker,
        skippedBackoff: counters.skippedBackoff,
        skippedNonePending: counters.skippedNonePending,
        breakerState: breakerSnapshot.state,
        breakerFailureCount: breakerSnapshot.failureCount,
        breakerOpenedAt:
          breakerSnapshot.openedAtMs === null
            ? null
            : new Date(breakerSnapshot.openedAtMs),
        breakerOpenUntil:
          breakerSnapshot.openUntilMs === null
            ? null
            : new Date(breakerSnapshot.openUntilMs),
        breakerRemainingMs: breakerSnapshot.remainingOpenMs,
        source: "worker",
      },
    });

    logger.info("[metrics] escalation snapshot written", {
      nowMs,
      breakerState: breakerSnapshot.state,
      countersSummary: {
        attempted: counters.attempted,
        delivered: counters.delivered,
        failed: counters.failed,
      },
    });
  } catch (err) {
    logger.warn("[metrics] escalation snapshot failed", {
      nowMs,
      error: (err as Error).message,
    });
  }
}

function shouldCaptureSnapshot(nowMs: number) {
  const intervalMs = getSnapshotIntervalMs();
  if (intervalMs <= 0) return false;
  if (nowMs - lastSnapshotAtMs < intervalMs) return false;
  lastSnapshotAtMs = nowMs;
  return true;
}

export function resetEscalationBreakerForOps(nowMs = Date.now()) {
  const before = getEscalationBreakerSnapshot(nowMs);
  resetBreakerState();
  const after = getEscalationBreakerSnapshot(nowMs);
  return { before, after };
}

export function setBreakerStateForTests(params: {
  state: BreakerState;
  consecutiveFailures?: number;
  openedAtMs?: number | null;
  halfOpenProbeInFlight?: boolean;
  lastDeniedLogAt?: number;
}) {
  breaker.state = params.state;
  breaker.consecutiveFailures = params.consecutiveFailures ?? 0;
  breaker.openedAt =
    params.openedAtMs === null || params.openedAtMs === undefined
      ? null
      : new Date(params.openedAtMs);
  breaker.halfOpenProbeInFlight = params.halfOpenProbeInFlight ?? false;
  breaker.lastDeniedLogAt = params.lastDeniedLogAt ?? 0;
}

function computeBackoffMs(attemptCount: number) {
  const base = getNumberEnv("ESCALATION_RETRY_BASE_MS", DEFAULT_BASE_MS);
  const maxMs = getNumberEnv("ESCALATION_RETRY_MAX_MS", DEFAULT_MAX_MS);
  const jitter = getNumberEnv("ESCALATION_RETRY_JITTER_MS", DEFAULT_JITTER_MS);

  const exponential = Math.min(base * Math.pow(2, attemptCount), maxMs);
  const jitterMs = Math.floor(Math.random() * jitter);
  return exponential + jitterMs;
}

function parsePayload(payload: string) {
  try {
    return JSON.parse(payload || "{}");
  } catch {
    return null;
  }
}

async function dispatchToN8n(payload: unknown) {
  const url = process.env.N8N_ALERT_WEBHOOK_URL;
  if (!url) {
    logger.warn("[deliveries] N8N_ALERT_WEBHOOK_URL not set; delivery skipped.");
    return { ok: false, error: "missing_webhook_url" } as const;
  }

  const fetchFn = globalThis.fetch;
  if (!fetchFn) {
    logger.warn("[deliveries] fetch unavailable; delivery skipped.");
    return { ok: false, error: "fetch_unavailable" } as const;
  }

  try {
    const res = await fetchFn(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload ?? {}),
    });

    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: text || `HTTP ${res.status}` } as const;
    }

    return { ok: true } as const;
  } catch (err) {
    return { ok: false, error: (err as Error).message } as const;
  }
}

export async function processEscalationDeliveries() {
  const maxAttempts = getNumberEnv(
    "ESCALATION_RETRY_MAX_ATTEMPTS",
    DEFAULT_MAX_ATTEMPTS
  );
  const batchSize = getNumberEnv(
    "ESCALATION_RETRY_BATCH_SIZE",
    DEFAULT_BATCH_SIZE
  );

  const deliveries = await prisma.escalationDelivery.findMany({
    where: {
      status: { in: ["pending", "failed"] },
      attemptCount: { lt: maxAttempts },
    },
    include: { event: true },
    orderBy: { createdAt: "asc" },
    take: batchSize,
  });

  const nowMs = Date.now();
  if (shouldCaptureSnapshot(nowMs)) {
    void captureEscalationMetricsSnapshot(nowMs);
  }
  if (deliveries.length === 0) {
    logger.info("[deliveries] skipped: none_pending", { nowMs });
    escalationMetrics.counters.skippedNonePending += 1;
    return;
  }

  const { failureThreshold, openMs } = getBreakerConfig();
  let loggedBreakerOpen = false;
  let countedBreakerSkip = false;

  for (const delivery of deliveries) {
    const backoffMs = computeBackoffMs(delivery.attemptCount);
    const lastAttempt = delivery.lastAttemptAt
      ? delivery.lastAttemptAt.getTime()
      : null;

    if (lastAttempt && lastAttempt + backoffMs > nowMs) {
      logger.info("[deliveries] skipped: backoff", {
        deliveryId: delivery.id,
        eventId: delivery.eventId,
        dedupeKey: delivery.dedupeKey,
        attemptCount: delivery.attemptCount,
        nowMs,
        lastAttemptAt: lastAttempt,
        nextEligibleAt: lastAttempt + backoffMs,
        backoffMs,
      });
      escalationMetrics.counters.skippedBackoff += 1;
      continue;
    }

    if (!loggedBreakerOpen && breaker.state === "OPEN") {
      const openedAtMs = breaker.openedAt?.getTime();
      const openUntilMs =
        openedAtMs !== undefined ? openedAtMs + openMs : null;
      const remainingMs =
        openUntilMs !== null ? Math.max(0, openUntilMs - nowMs) : null;
      if (openedAtMs !== undefined && openedAtMs + openMs > nowMs) {
        logger.warn("[deliveries] skipped: breaker_open", {
          nowMs,
          openUntilMs,
          remainingMs,
          failureCount: breaker.consecutiveFailures,
          threshold: failureThreshold,
          openMs,
        });
        loggedBreakerOpen = true;
      }
    }

    if (!canAttempt(nowMs)) {
      if (!countedBreakerSkip) {
        escalationMetrics.counters.skippedBreaker += 1;
        countedBreakerSkip = true;
      }
      continue;
    }

    const attemptNumber = delivery.attemptCount + 1;
    const attemptStartedAt = new Date();

    await prisma.escalationDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "failed",
        lastError: "invalid_payload",
        attemptCount: attemptNumber,
        lastAttemptAt: attemptStartedAt,
      },
    });

    const payload = parsePayload(delivery.event.payload);
    if (!payload) {
      onFailure(Date.now());
      logger.warn("[deliveries] failed", {
        deliveryId: delivery.id,
        eventId: delivery.eventId,
        attempt: attemptNumber,
        error: "invalid_payload",
        statusTextOrBodyIfAvailable: "invalid_payload",
      });
      escalationMetrics.counters.failed += 1;
      await prisma.escalationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "failed",
          lastError: "invalid_payload",
        },
      });
      continue;
    }

    logger.info("[deliveries] attempting", {
      deliveryId: delivery.id,
      eventId: delivery.eventId,
      dedupeKey: delivery.dedupeKey,
      attempt: attemptNumber,
    });
    escalationMetrics.counters.attempted += 1;

    const result = await dispatchToN8n(payload);
    if (result.ok) {
      onSuccess();
      logger.info("[deliveries] delivered", {
        deliveryId: delivery.id,
        eventId: delivery.eventId,
        attempt: attemptNumber,
      });
      escalationMetrics.counters.delivered += 1;
      await prisma.escalationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "delivered",
          lastError: null,
          sentAt: new Date(),
        },
      });
    } else {
      onFailure(Date.now());
      logger.warn("[deliveries] failed", {
        deliveryId: delivery.id,
        eventId: delivery.eventId,
        attempt: attemptNumber,
        error: result.error,
        statusTextOrBodyIfAvailable: result.error,
      });
      escalationMetrics.counters.failed += 1;
      await prisma.escalationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "failed",
          lastError: result.error,
        },
      });
    }
  }
}
