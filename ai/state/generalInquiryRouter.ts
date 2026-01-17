import { CallState } from "./callStates";
import { CallContext } from "./callContext";

import { handleGreeting } from "../handlers/greeting";
import { handleHours } from "../handlers/hours";
import { handleFallback } from "../handlers/fallback";

export async function routeGeneralInquiry(
  ctx: CallContext
): Promise<CallContext> {
  switch (ctx.state) {
    case CallState.GREETING:
      await handleGreeting(ctx);
      return {
        ...ctx,
        state: CallState.HOURS,
      };

    case CallState.HOURS:
      await handleHours(ctx);
      return {
        ...ctx,
        state: CallState.COMPLETE,
        resolved: true,
      };

    case CallState.FALLBACK:
      await handleFallback(ctx);
      return {
        ...ctx,
        state: CallState.COMPLETE,
        resolved: true,
      };

    default:
      // hard safety
      await handleFallback(ctx);
      return {
        ...ctx,
        state: CallState.COMPLETE,
        resolved: true,
      };
  }
}
