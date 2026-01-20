import { emitEvent, getEventCounts, onEvent } from "./events";
import { pushAlertUpdate } from "./alertStream";

/**
 * Alert state tracked in-memory
 */
type AlertState = {
  id: string;
  alertType: string;
  eventName: string;
  summary: string;   
  count: number;
  threshold: number;
  windowSeconds: number;
  firstTriggeredAt: string;
  resolvedAt?: string;
  durationSeconds?: number;
  acknowledgedAt?: string;
  environment: string;
  correlationId?: string;
  source?: "voice" | "sms";
  phone?: string;
  callSid?: string;
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
let callbackListenerRegistered = false;
let callbackResolveListenerRegistered = false;

type AlertSeverity = "info" | "warning" | "critical";

function getAlertAgeSeconds(firstTriggeredAt: string) {
  return Math.max(
    0,
    Math.floor((Date.now() - Date.parse(firstTriggeredAt)) / 1000)
  );
}

function getAlertSeverity(ageSeconds: number): AlertSeverity {
  if (ageSeconds >= 300) return "critical";
  if (ageSeconds >= 60) return "warning";
  return "info";
}

function handleAlertEscalation(alert: AlertState) {
  const ageSeconds = getAlertAgeSeconds(alert.firstTriggeredAt);
  const severity = getAlertSeverity(ageSeconds);
  emitEvent("alert_escalation_requested", {
    alertType: alert.alertType,
    eventName: alert.eventName,
    summary: alert.summary,
    environment: alert.environment,
    triggeredAt: alert.firstTriggeredAt,
    correlationId: alert.correlationId,
    severity,
    ageSeconds,
    callSid: alert.callSid,
  });

  pushAlertUpdate({
    type: "alert_escalated",
    alertType: alert.alertType,
    eventName: alert.eventName,
    summary: alert.summary,
    environment: alert.environment,
    triggeredAt: alert.firstTriggeredAt,
    severity,
    ageSeconds,
    callSid: alert.callSid,
  });

  // TODO(A5.8.1): wire alert escalation resolution to staff-handled events.
}

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

  if (!callbackListenerRegistered) {
    callbackListenerRegistered = true;
    onEvent("callback_requested", (payload) => {
      if (!payload || typeof payload !== "object") return;
      if (!payload?.staffFollowupRequired) return;
      if (payload.source !== "voice" && payload.source !== "sms") return;

      const correlationId =
        "correlationId" in payload
          ? (payload as { correlationId?: string }).correlationId
          : undefined;
      const callSid =
        "callSid" in payload
          ? (payload as { callSid?: string }).callSid
          : undefined;
      const keySuffix = correlationId || callSid || payload.phone || "unknown";
      const key = `callback_staff_required:${payload.source}:${keySuffix}`;

      if (activeAlerts.has(key)) return;

      const alert: AlertState = {
        id: key,
        alertType: "callback_staff_required",
        eventName: "callback_requested",
        summary: "Staff callback required",   // ✅ simple, canonical
        count: 1,
        threshold: 1,
        windowSeconds: 0,
        firstTriggeredAt: new Date().toISOString(),
        environment: process.env.NODE_ENV || "local",
        correlationId,
        source: payload.source,
        phone: payload.phone,
        callSid,
      };

      activeAlerts.set(key, alert);

      emitEvent("alert_triggered", {
        alertType: alert.alertType,
        eventName: alert.eventName,
        count: alert.count,
        threshold: alert.threshold,
        windowSeconds: alert.windowSeconds,
        environment: alert.environment,
        triggeredAt: alert.firstTriggeredAt,
        correlationId: alert.correlationId,
      });

      handleAlertEscalation(alert);
    });
  }

  if (!callbackResolveListenerRegistered) {
    callbackResolveListenerRegistered = true;
    onEvent("callback_marked_staff_handled", (payload) => {
      if (!payload || typeof payload !== "object") return;
      const correlationId =
        "correlationId" in payload
          ? (payload as { correlationId?: string }).correlationId
          : undefined;
      const callSid =
        "callSid" in payload
          ? (payload as { callSid?: string }).callSid
          : undefined;
      const phone =
        "phone" in payload ? (payload as { phone?: string }).phone : undefined;

      const matches = (alert: AlertState) =>
        alert.alertType === "callback_staff_required" &&
        (alert.correlationId === correlationId ||
          alert.callSid === callSid ||
          alert.phone === phone);

      for (const [key, alert] of activeAlerts.entries()) {
        if (!matches(alert)) continue;
        if (alert.resolvedAt) continue;

        const resolvedAt = new Date().toISOString();
        const durationSeconds = Math.max(
          0,
          Math.floor(
            (Date.parse(resolvedAt) -
              Date.parse(alert.firstTriggeredAt)) /
              1000
          )
        );

        alert.resolvedAt = resolvedAt;
        alert.durationSeconds = durationSeconds;

        emitEvent("alert_resolved", {
          alertType: alert.alertType,
          eventName: alert.eventName,
          count: alert.count,
          threshold: alert.threshold,
          windowSeconds: alert.windowSeconds,
          environment: alert.environment,
          triggeredAt: alert.firstTriggeredAt,
          resolvedAt,
          durationSeconds,
          correlationId: alert.correlationId,
        });

        activeAlerts.delete(key);
      }
    });
  }

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
           id: key,
           alertType: rule.alertType,
           eventName: rule.eventName,
           summary: `${rule.eventName} exceeded threshold`,
           count,
           threshold: rule.threshold,
           windowSeconds,
           firstTriggeredAt: new Date().toISOString(),
           environment: process.env.NODE_ENV || "local",
         };

          activeAlerts.set(key, alert);

          // 🔔 Single, canonical trigger event
          emitEvent("alert_triggered", {
            alertType: alert.alertType,
            eventName: alert.eventName,
            count: alert.count,
            threshold: alert.threshold,
            windowSeconds: alert.windowSeconds,
            environment: alert.environment,
            triggeredAt: alert.firstTriggeredAt,
          });
          handleAlertEscalation(alert);
        } else {
          // Alert still active → update count only
          activeAlerts.get(key)!.count = count;
        }
      } else {
        const existing = activeAlerts.get(key);
        if (existing) {
          const resolvedAt = new Date().toISOString();
          const durationSeconds = Math.max(
            0,
            Math.floor(
              (Date.parse(resolvedAt) -
                Date.parse(existing.firstTriggeredAt)) /
                1000
            )
          );

          existing.resolvedAt = resolvedAt;
          existing.durationSeconds = durationSeconds;

          emitEvent("alert_resolved", {
            alertType: existing.alertType,
            eventName: existing.eventName,
            count: existing.count,
            threshold: existing.threshold,
            windowSeconds: existing.windowSeconds,
            environment: existing.environment,
            triggeredAt: existing.firstTriggeredAt,
            resolvedAt,
            durationSeconds,
            correlationId: existing.correlationId,
          });
        }
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
  return Array.from(activeAlerts.values()).map((alert) => {
    const ageSeconds = getAlertAgeSeconds(alert.firstTriggeredAt);
    const severity = getAlertSeverity(ageSeconds);
    return {
      ...alert,
      ageSeconds,
      severity,
    };
  });
}

export function isAlertEvaluatorInitialized() {
  return initialized;
}

export function acknowledgeAlert(alertId: string) {
  const alert = activeAlerts.get(alertId);
  if (!alert) return null;
  alert.acknowledgedAt = new Date().toISOString();
  return alert;
}
