import { buildFallbackScript } from "../scripts/buildFallbackScript";
import { CallState } from "../state/callStates";
import type { CallContext } from "../runtime/callContext";
import type { HandlerResult } from "../runtime/handlerTypes";

export function fallbackHandler(_ctx: CallContext): HandlerResult {
  return {
    speech: buildFallbackScript(),
    nextState: CallState.OFFER_CALLBACK,
  };
}
