import { CallState } from "../state/callStates";
import { handleGreeting } from "../handlers/greetingHandler";
import { handleHours } from "../handlers/hoursHandler";
import { handleFallback } from "../handlers/fallbackHandler";
import { CallContext } from "./callContext";

export function runGeneralInquiry(context: CallContext) {
  switch (context.state) {
    case CallState.GREETING:
      return handleGreeting();

    case CallState.HOURS:
      return handleHours();

    case CallState.FALLBACK:
      return handleFallback();

    default:
      return handleFallback();
  }
}
