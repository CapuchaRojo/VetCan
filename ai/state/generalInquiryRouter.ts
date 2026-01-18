import { CallState, isValidTransition } from "./callStates";
import type { CallContext } from "../runtime/callContext";
import { greetingHandler } from "../handlers/greeting";
import { hoursHandler } from "../handlers/hours";
import { fallbackHandler } from "../handlers/fallback";
import { resolveNextState } from "../runtime/intentRouter";

export async function routeGeneralInquiry(
  ctx: CallContext
): Promise<CallContext> {
  switch (ctx.state) {
    case CallState.INIT:
      return {
        ...ctx,
        state: CallState.GREETING,
      };

    case CallState.GREETING:
      greetingHandler(ctx);
      return {
        ...ctx,
        state: CallState.LISTENING,
      };

    case CallState.LISTENING: {
      const next = resolveNextState(ctx.lastUserInput || "");
      if (!isValidTransition(ctx.state, next)) {
        return { ...ctx, state: CallState.FALLBACK };
      }
      return { ...ctx, state: next };
    }

    case CallState.PROVIDE_INFO:
      hoursHandler(ctx);
      return {
        ...ctx,
        state: CallState.OFFER_CALLBACK,
      };

    case CallState.FALLBACK:
      fallbackHandler(ctx);
      return {
        ...ctx,
        state: CallState.OFFER_CALLBACK,
      };

    default:
      // hard safety
      fallbackHandler(ctx);
      return { ...ctx, state: CallState.END };
  }
}
