import prisma from "../prisma";
import { logger } from "../utils/logger";

const DEFAULT_MAX_ATTEMPTS = 8;
const DEFAULT_BASE_MS = 5_000;
const DEFAULT_MAX_MS = 5 * 60_000;
const DEFAULT_JITTER_MS = 1_000;
const DEFAULT_BATCH_SIZE = 20;

function getNumberEnv(key: string, fallback: number) {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
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

  if (deliveries.length === 0) return;

  const now = Date.now();

  for (const delivery of deliveries) {
    const backoffMs = computeBackoffMs(delivery.attemptCount);
    const lastAttempt = delivery.lastAttemptAt
      ? delivery.lastAttemptAt.getTime()
      : null;

    if (lastAttempt && lastAttempt + backoffMs > now) {
      continue;
    }

    const payload = parsePayload(delivery.event.payload);
    if (!payload) {
      await prisma.escalationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "failed",
          attemptCount: delivery.attemptCount + 1,
          lastAttemptAt: new Date(),
          lastError: "invalid_payload",
        },
      });
      continue;
    }

    const result = await dispatchToN8n(payload);
    if (result.ok) {
      await prisma.escalationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "sent",
          attemptCount: delivery.attemptCount + 1,
          lastAttemptAt: new Date(),
          lastError: null,
          sentAt: new Date(),
        },
      });
    } else {
      await prisma.escalationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "failed",
          attemptCount: delivery.attemptCount + 1,
          lastAttemptAt: new Date(),
          lastError: result.error,
        },
      });
    }
  }
}
