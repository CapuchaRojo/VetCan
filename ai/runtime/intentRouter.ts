import { CallState } from "../state/callStates";

export function resolveNextState(input: string): CallState {
  const normalized = input.toLowerCase();

  if (normalized.includes("hour") || normalized.includes("open")) {
    return CallState.PROVIDE_INFO;
  }

  if (
    normalized.includes("callback") ||
    normalized.includes("call back") ||
    normalized.includes("call me") ||
    normalized.includes("call you")
  ) {
    return CallState.OFFER_CALLBACK;
  }

  return CallState.FALLBACK;
}
