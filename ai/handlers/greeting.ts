import { GREETING_SCRIPT } from "../scripts/greeting";
import { CallState } from "../state/callStates";
import type { CallContext } from "../runtime/callContext";
import type { HandlerResult } from "../runtime/handlerTypes";

export function greetingHandler(_ctx: CallContext): HandlerResult {
  return {
    speech: `${GREETING_SCRIPT.text} ${GREETING_SCRIPT.followUp}`,
    nextState: CallState.LISTENING,
  };
}
