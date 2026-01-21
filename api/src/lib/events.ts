import { EventEmitter } from "node:events";
import { getCorrelationId } from "./requestContext";
import { createOperationalEvent } from "../repos/operationalEventsRepo";
import { upsertEscalationDelivery } from "../repos/escalationDeliveryRepo";

export type EventName =
  | "voice_state_transition"
  | "voice_call_started"
  | "voice_intent_detected"
  | "voice_call_completed"
  | "validation_failed"
  | "callback_create_attempt"
  | "callback_create_result"
  | "callback_create_failed"
  | "ai_call_initiated"
  | "appointment_create_result"
  | "alert_triggered"
  | "alert_resolved"
  | "alert_acknowledged"
  | "alert_escalation_requested"
  | "callback_marked_staff_handled"
  | "callback_requested";

export type EventPayloads = {
  voice_state_transition: { from: string; to: string };
  voice_call_started: {
    callSid: string;
    source: "voice";
    environment: string;
  };
  voice_intent_detected: {
    callSid: string;
    intent: "general_inquiry";
    environment: string;
  };
  voice_call_completed: {
    callSid: string;
    finalState: string;
    environment: string;
  };
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
    correlationId?: string;
  };
  alert_escalation_requested: {
    alertType: string;
    eventName: string;
    environment: string;
    summary: string;
    triggeredAt: string;
    correlationId?: string;
    severity: "info" | "warning" | "critical";
    ageSeconds: number;
    callSid?: string;
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
    callSid?: string;
    phone?: string;
  };
  callback_requested: {
    source: "voice" | "sms";
    intent?: string;
    phone?: string;
    name?: string;
    staffFollowupRequired?: boolean;
    correlationId?: string;
    callSid?: string;
    environment?: string;
  };
};

const emitter = new EventEmitter();
emitter.setMaxListeners(50);

const eventCounts: Record<string, number> = {};
const recentEvents: Array<{
  type: string;
  payload: unknown;
  createdAt: string;
}> = [];

const MAX_RECENT_EVENTS = 50;

function sanitizePayload(payload: unknown) {
  if (!payload || typeof payload !== "object") return payload;
  const record = payload as Record<string, unknown>;
  const redactedKeys = ["phone", "name", "email", "dob", "ssn", "address"];
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    if (redactedKeys.includes(key)) {
      sanitized[key] = "[redacted]";
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

function recordRecentEvent(type: string, payload: unknown) {
  recentEvents.push({
    type,
    payload: sanitizePayload(payload),
    createdAt: new Date().toISOString(),
  });

  if (recentEvents.length > MAX_RECENT_EVENTS) {
    recentEvents.shift();
  }
}

function safeStringify(value: unknown) {
  try {
    return JSON.stringify(value ?? {});
  } catch {
    return "{}";
  }
}

async function persistOperationalEvent(
  name: EventName,
  payload: EventPayloads[EventName]
) {
  const record = payload as Record<string, unknown>;
  const severity =
    typeof record?.severity === "string" ? record.severity : null;
  const source =
    typeof record?.source === "string" ? record.source : null;
  const correlationId =
    typeof record?.correlationId === "string" ? record.correlationId : null;
  const environment =
    typeof record?.environment === "string"
      ? record.environment
      : process.env.NODE_ENV || "local";

  const event = await createOperationalEvent({
    eventName: name,
    severity,
    source,
    correlationId,
    environment,
    payload: safeStringify(record ?? {}),
  });

  if (name !== "alert_escalation_requested") return;

  if (!correlationId) {
    console.warn("[events] Missing correlationId; escalation delivery skipped.");
    return;
  }

  const dedupeKey = `${name}:${correlationId}:${severity || "none"}`;
  await upsertEscalationDelivery(dedupeKey, {
    event: { connect: { id: event.id } },
    dedupeKey,
    status: "pending",
    attemptCount: 0,
  });
}

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

  recordRecentEvent(name, {
    ...(typeof finalPayload === "object" && finalPayload !== null
      ? (finalPayload as Record<string, unknown>)
      : { value: finalPayload }),
    correlationId: resolvedCorrelationId,
    environment: process.env.NODE_ENV || "local",
    operatorId,
    operatorName,
    role: operatorRole,
  });

  emitter.emit(name, finalPayload);

  void persistOperationalEvent(name, finalPayload).catch((err) => {
    console.warn("[events] Failed to persist operational event.", err);
  });
}

export function onEvent<E extends EventName>(
  name: E,
  listener: (payload: EventPayloads[E]) => void
) {
  emitter.on(name, listener);
}

export function recordInternalEvent(type: string, payload?: unknown) {
  eventCounts[type] = (eventCounts[type] || 0) + 1;
  recordRecentEvent(type, payload ?? {});
}

export function getEventCounts() {
  return { ...eventCounts };
}

export function getRecentEvents(limit = 50) {
  const safeLimit = Math.max(1, Math.min(limit, MAX_RECENT_EVENTS));
  return recentEvents.slice(-safeLimit).reverse();
}
