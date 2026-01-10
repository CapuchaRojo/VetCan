import { EventEmitter } from "node:events";

export type EventName =
  | "voice_state_transition"
  | "validation_failed"
  | "callback_create_attempt"
  | "callback_create_result"
  | "ai_call_initiated"
  | "appointment_create_result";

export type EventPayloads = {
  voice_state_transition: { from: string; to: string };
  validation_failed: { scope: "voice" | "appointments"; reason: string; state?: string };
  callback_create_attempt: { source: "voice" };
  callback_create_result: { source: "voice"; ok: boolean };
  ai_call_initiated: { mode: "twilio" };
  appointment_create_result: { ok: boolean };
};

const emitter = new EventEmitter();
  emitter.setMaxListeners(50);

export function emitEvent<E extends EventName>(
  name: E,
  payload: EventPayloads[E]
) {
  emitter.emit(name, payload);
}

export function onEvent<E extends EventName>(
  name: E,
  listener: (payload: EventPayloads[E]) => void
) {
  emitter.on(name, listener);
}
