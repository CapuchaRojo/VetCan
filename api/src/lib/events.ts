import { EventEmitter } from "node:events";
import { getCorrelationId } from "./requestContext";

export type EventName =
  | "voice_state_transition"
  | "validation_failed"
  | "callback_create_attempt"
  | "callback_create_result"
  | "callback_create_failed"
  | "ai_call_initiated"
  | "appointment_create_result"
  | "alert_triggered"
  | "alert_resolved"
  | "alert_acknowledged"
  | "callback_marked_staff_handled";

export type EventPayloads = {
  voice_state_transition: { from: string; to: string };
  validation_failed: { scope: "voice" | "appointments"; reason: string; state?: string };
  callback_create_attempt: { source: "voice" };
  callback_create_result: { source: "voice"; ok: boolean };
  callback_create_failed: { source: "voice" };
  ai_call_initiated: { mode: "twilio" };
  appointment_create_result: { ok: boolean };
  alert_triggered: {
    alertType: string;
    eventName: string;
    count: number;
    threshold: number;
    windowSeconds: number;
    environment: string;
    triggeredAt: string;
  };
  alert_resolved: {
    alertType: string;
    eventName: string;
    count: number;
    threshold: number;
    windowSeconds: number;
    environment: string;
    triggeredAt: string;
    resolvedAt: string;
    durationSeconds: number;
    correlationId?: string;
  };
  alert_acknowledged: {
    alertId: string;
    alertType: string;
    eventName: string;
    environment: string;
    acknowledgedAt: string;
    correlationId?: string;
    operatorId?: string;
    operatorName?: string;
    role?: string;
  };
  callback_marked_staff_handled: {
    callbackId: string;
    environment: string;
    handledAt: string;
    correlationId?: string;
    operatorId?: string;
    operatorName?: string;
    role?: string;
  };
};

const emitter = new EventEmitter();
emitter.setMaxListeners(50);

const eventCounts: Partial<Record<EventName, number>> = {};
const recentEvents: Array<{
  eventName: EventName;
  timestamp: string;
  correlationId?: string;
  environment: string;
  operatorId?: string;
  operatorName?: string;
  role?: string;
}> = [];

const MAX_RECENT_EVENTS = 200;

export function emitEvent<E extends EventName>(
  name: E,
  payload: EventPayloads[E]
) {
  eventCounts[name] = (eventCounts[name] || 0) + 1;

  const contextCorrelationId = getCorrelationId();
  const payloadCorrelationId =
    typeof payload === "object" &&
    payload !== null &&
    "correlationId" in payload
      ? (payload as { correlationId?: string }).correlationId
      : undefined;

  const resolvedCorrelationId =
    contextCorrelationId || payloadCorrelationId;

  const operatorId =
    typeof payload === "object" &&
    payload !== null &&
    "operatorId" in payload
      ? (payload as { operatorId?: string }).operatorId
      : undefined;
  const operatorName =
    typeof payload === "object" &&
    payload !== null &&
    "operatorName" in payload
      ? (payload as { operatorName?: string }).operatorName
      : undefined;
  const operatorRole =
    typeof payload === "object" &&
    payload !== null &&
    "role" in payload
      ? (payload as { role?: string }).role
      : undefined;

  let finalPayload = payload as any;
  if (
    resolvedCorrelationId &&
    typeof payload === "object" &&
    payload !== null &&
    !("correlationId" in payload)
  ) {
    finalPayload = { ...(payload as any), correlationId: resolvedCorrelationId };
  }

  recentEvents.push({
    eventName: name,
    timestamp: new Date().toISOString(),
    correlationId: resolvedCorrelationId,
    environment: process.env.NODE_ENV || "local",
    operatorId,
    operatorName,
    role: operatorRole,
  });

  if (recentEvents.length > MAX_RECENT_EVENTS) {
    recentEvents.shift();
  }

  emitter.emit(name, finalPayload);
}

export function onEvent<E extends EventName>(
  name: E,
  listener: (payload: EventPayloads[E]) => void
) {
  emitter.on(name, listener);
}

export function getEventCounts() {
  return { ...eventCounts };
}

export function getRecentEvents(limit = 50) {
  const safeLimit = Math.max(1, Math.min(limit, MAX_RECENT_EVENTS));
  return recentEvents.slice(-safeLimit).reverse();
}
