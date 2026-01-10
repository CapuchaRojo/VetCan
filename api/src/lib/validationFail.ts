import { emitEvent } from "./events";

type ValidationFailParams = {
  scope: "voice" | "appointments";
  reason: string;
  state?: string;
};

export function validationFail(params: ValidationFailParams) {
  console.warn(`[validation] ${params.scope}: ${params.reason}`);
  emitEvent("validation_failed", {
    scope: params.scope,
    reason: params.reason,
    state: params.state,
  });
}
