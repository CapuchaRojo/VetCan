import { emitEvent, getEventCounts } from "./events";

/**
 * Alert state tracked in-memory
 */
type AlertState = {
  alertType: string;
  eventName: string;
  count: number;
  threshold: number;
  windowSeconds: number;
  firstTriggeredAt: string;
};

/**
 * Threshold rule definition
 */
type ThresholdRule = {
  envKey: string;
  eventName: string;
  alertType: string;
};

/**
 * Configurable alert rules
 */
const RULES: ThresholdRule[] = [
  {
    envKey: "ALERT_VALIDATION_FAILED_THRESHOLD",
    eventName: "validation_failed",
    alertType: "validation_failed_spike",
  },
  {
    envKey: "ALERT_CALLBACK_FAILURE_THRESHOLD",
    eventName: "callback_create_failed",
    alertType: "callback_failure_spike",
  },
];

/**
 * Active alerts (currently triggered)
 */
const activeAlerts = new Map<string, AlertState>();

let initialized = false;
let lastCounts: Record<string, number> | null = null;

/**
 * Helpers
 */
function parseThreshold(value: string | undefined) {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
}

function parseWindowSeconds(value: string | undefined) {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
}

function getWindowCount(
  current: Record<string, number>,
  previous: Record<string, number>,
  eventName: string
) {
  const nowCount = current[eventName] || 0;
  const prevCount = previous[eventName] || 0;
  return Math.max(0, nowCount - prevCount);
}

/**
 * Initialize the alert evaluation loop
 */
export function initAlertEvaluator() {
  if (initialized) return;
  initialized = true;

  const windowSeconds = parseWindowSeconds(
    process.env.ALERT_WINDOW_SECONDS
  );

  const thresholds = RULES.map((rule) => {
    const threshold = parseThreshold(process.env[rule.envKey]);
    return threshold
      ? { ...rule, threshold }
      : null;
  }).filter(Boolean) as Array<ThresholdRule & { threshold: number }>;

  if (thresholds.length === 0) return;

  if (!windowSeconds) {
    console.warn("[alerts] Invalid ALERT_WINDOW_SECONDS; alerts disabled.");
    return;
  }

  const evaluate = () => {
    let counts: Record<string, number> = {};

    try {
      counts = getEventCounts();
    } catch {
      return;
    }

    if (!lastCounts) {
      lastCounts = counts;
      return;
    }

    for (const rule of thresholds) {
      const key = `${rule.alertType}:${rule.eventName}`;
      const count = getWindowCount(counts, lastCounts, rule.eventName);

      if (count >= rule.threshold) {
        if (!activeAlerts.has(key)) {
          const alert: AlertState = {
            alertType: rule.alertType,
            eventName: rule.eventName,
            count,
            threshold: rule.threshold,
            windowSeconds,
            firstTriggeredAt: new Date().toISOString(),
          };

          activeAlerts.set(key, alert);

          // 🔔 Single, canonical alert event
          emitEvent("alert_triggered", {
            alertType: alert.alertType,
            eventName: alert.eventName,
            count: alert.count,
            threshold: alert.threshold,
            windowSeconds: alert.windowSeconds,
            environment: process.env.NODE_ENV || "local",
            triggeredAt: alert.firstTriggeredAt,
          });
        } else {
          activeAlerts.get(key)!.count = count;
        }
      } else {
        activeAlerts.delete(key);
      }
    }

    lastCounts = counts;
  };

  setInterval(evaluate, windowSeconds * 1000);
}

/**
 * Expose active alerts for metrics/dashboard
 */
export function getActiveAlerts(): AlertState[] {
  return Array.from(activeAlerts.values());
}
