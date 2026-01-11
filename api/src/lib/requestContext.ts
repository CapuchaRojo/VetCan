import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

type RequestContext = {
  correlationId?: string;
};

const storage = new AsyncLocalStorage<RequestContext>();
const callCorrelationMap = new Map<string, string>();

export function createCorrelationId(): string {
  return randomUUID();
}

export function setCorrelationIdForCall(callSid: string, correlationId: string) {
  callCorrelationMap.set(callSid, correlationId);
}

export function getCorrelationIdForCall(callSid: string) {
  return callCorrelationMap.get(callSid);
}

export function runWithCorrelationId<T>(correlationId: string, fn: () => T): T {
  // Propagate correlation ID across async handlers for this request.
  return storage.run({ correlationId }, fn);
}

export function getCorrelationId() {
  return storage.getStore()?.correlationId;
}
