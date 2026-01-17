import { CallState } from "../state/callStates";

export function resolveNextState(input: string): CallState {
  const normalized = input.toLowerCase();

  if (normalized.includes("hour") || normalized.includes("open")) {
    return CallState.HOURS;
  }

  return CallState.FALLBACK;
}
