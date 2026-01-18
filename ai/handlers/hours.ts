import { buildHoursScript } from "../scripts/buildHoursScript";
import { CallState } from "../state/callStates";
import type { CallContext } from "../runtime/callContext";
import type { HandlerResult } from "../runtime/handlerTypes";

export function hoursHandler(_ctx: CallContext): HandlerResult {
  const script = buildHoursScript();
  return {
    speech: `${script} Would you like a callback from a staff member?`,
    nextState: CallState.OFFER_CALLBACK,
  };
}
