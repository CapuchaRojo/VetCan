import { CallState } from "../state/callStates";

export type CallContext = {
  callSid: string;
  state: CallState;
  lastUserInput?: string;
  attempts?: number;
};
