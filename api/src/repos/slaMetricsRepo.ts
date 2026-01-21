import prisma from "../prisma";

const TEN_MINUTES_SECONDS = 10 * 60;

function toSeconds(start: Date, end: Date) {
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));
}

function bucketize(values: number[]) {
  const buckets = { le2m: 0, le5m: 0, le10m: 0, gt10m: 0 };

  for (const value of values) {
    if (value <= 120) {
      buckets.le2m += 1;
    } else if (value <= 300) {
      buckets.le5m += 1;
    } else if (value <= 600) {
      buckets.le10m += 1;
    } else {
      buckets.gt10m += 1;
    }
  }

  const averageSeconds = values.length
    ? Math.round(values.reduce((sum, v) => sum + v, 0) / values.length)
    : 0;
  const breachCount = values.filter((v) => v > TEN_MINUTES_SECONDS).length;

  return { averageSeconds, breachCount, buckets };
}

export async function getSlaMetrics() {
  const events = await prisma.operationalEvent.findMany({
    where: {
      eventName: {
        in: [
          "callback_requested",
          "ai_call_initiated",
          "callback_marked_staff_handled",
          "alert_triggered",
          "alert_acknowledged",
        ],
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const callbackStart = new Map<string, Date>();
  const callbackResolved = new Map<string, Date>();
  const alertStart = new Map<string, Date>();
  const alertResolved = new Map<string, Date>();

  for (const event of events) {
    if (!event.correlationId) continue;

    if (event.eventName === "callback_requested") {
      if (!callbackStart.has(event.correlationId)) {
        callbackStart.set(event.correlationId, event.createdAt);
      }
      continue;
    }

    if (event.eventName === "ai_call_initiated" || event.eventName === "callback_marked_staff_handled" || event.eventName === "alert_acknowledged") {
      if (!callbackResolved.has(event.correlationId)) {
        callbackResolved.set(event.correlationId, event.createdAt);
      }
      continue;
    }

    if (event.eventName === "alert_triggered") {
      if (!alertStart.has(event.correlationId)) {
        alertStart.set(event.correlationId, event.createdAt);
      }
      continue;
    }

    if (event.eventName === "alert_acknowledged") {
      if (!alertResolved.has(event.correlationId)) {
        alertResolved.set(event.correlationId, event.createdAt);
      }
    }
  }

  const callbackDurations: number[] = [];
  for (const [correlationId, start] of callbackStart.entries()) {
    const resolvedAt = callbackResolved.get(correlationId);
    if (!resolvedAt) continue;
    callbackDurations.push(toSeconds(start, resolvedAt));
  }

  const alertDurations: number[] = [];
  for (const [correlationId, start] of alertStart.entries()) {
    const resolvedAt = alertResolved.get(correlationId);
    if (!resolvedAt) continue;
    alertDurations.push(toSeconds(start, resolvedAt));
  }

  return {
    callbacks: bucketize(callbackDurations),
    alerts: bucketize(alertDurations),
  };
}
