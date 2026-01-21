import { emitEvent } from "./events";
import { logger } from "../utils/logger";

type ValidationFailParams = {
  scope: "voice" | "appointments";
  reason: string;
  state?: string;
};

export function validationFail(params: ValidationFailParams) {
  logger.warn(`[validation] ${params.scope}: ${params.reason}`);
  emitEvent("validation_failed", {
    scope: params.scope,
    reason: params.reason,
    state: params.state,
  });
}
