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
  | "alert_triggered";

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
  };
};

const emitter = new EventEmitter();
const eventCounts: Partial<Record<EventName, number>> = {};
  emitter.setMaxListeners(50);

export function emitEvent<E extends EventName>(
  name: E,
  payload: EventPayloads[E]
) {
  eventCounts[name] = (eventCounts[name] || 0) + 1;
  const correlationId = getCorrelationId();
  const finalPayload =
    correlationId &&
    typeof payload === "object" &&
    payload !== null &&
    !("correlationId" in payload)
      ? { ...payload, correlationId }
      : payload;

  emitter.emit(name, finalPayload);
}

export function onEvent<E extends EventName>(
  name: E,
  listener: (payload: EventPayloads[E]) => void
) {
  emitter.on(name, listener);
}

// In-memory counters for observability; reset on process restart.
export function getEventCounts() {
  return { ...eventCounts };
}
