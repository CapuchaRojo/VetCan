import { CallState } from "./callStates";

export interface CallContext {
  callSid: string;
  from: string;
  state: CallState;
  attempts: number;
  resolved: boolean;
}
