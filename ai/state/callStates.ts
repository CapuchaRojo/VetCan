// ai/state/callStates.ts

export enum CallState {
  INIT = "INIT",
  GREETING = "GREETING",
  LISTENING = "LISTENING",

  HOURS = "HOURS",

  PROVIDE_INFO = "PROVIDE_INFO",
  OFFER_CALLBACK = "OFFER_CALLBACK",
  COLLECT_PHONE = "COLLECT_PHONE",
  CONFIRM_CALLBACK = "CONFIRM_CALLBACK",

  FALLBACK = "FALLBACK",
  END = "END",
}

export const ALLOWED_TRANSITIONS: Record<CallState, CallState[]> = {
  [CallState.INIT]: [CallState.GREETING],

  [CallState.GREETING]: [CallState.LISTENING],

  [CallState.LISTENING]: [
    CallState.HOURS,
    CallState.PROVIDE_INFO,
    CallState.OFFER_CALLBACK,
    CallState.FALLBACK,
  ],

  [CallState.HOURS]: [
    CallState.LISTENING,
    CallState.OFFER_CALLBACK,
    CallState.END,
  ],

  [CallState.OFFER_CALLBACK]: [
    CallState.COLLECT_PHONE,
    CallState.END,
  ],

  [CallState.COLLECT_PHONE]: [
    CallState.CONFIRM_CALLBACK,
    CallState.FALLBACK,
  ],

  [CallState.CONFIRM_CALLBACK]: [CallState.END],

  [CallState.FALLBACK]: [
    CallState.COLLECT_PHONE,
    CallState.END,
  ],

  [CallState.END]: [],
};

export type CallState = typeof CALL_STATES[number];

export function isValidTransition(
  from: CallState,
  to: CallState
): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}
