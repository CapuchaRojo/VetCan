import { CallState } from "../state/callStates";

export type HandlerResult = {
  speech: string;
  nextState: CallState;
};
