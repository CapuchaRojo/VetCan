// api/src/voice/types.ts
import type { Intent } from "./voiceIntents";

export const VOICE_TRANSITIONS = {
  inbound: ["intent"],
  intent: ["name", "inbound", "complete", "general_inquiry"],
  name: ["phone"],
  phone: ["time", "name"],
  time: ["complete", "inbound"],
  general_inquiry: ["complete"],
  complete: [],
} as const;

export type VoiceState = keyof typeof VOICE_TRANSITIONS;
export type NextStateFor<S extends VoiceState> =
  (typeof VOICE_TRANSITIONS)[S][number];

export type VoiceContext = {
  state: VoiceState;
  intent?: Intent;
  confidence?: number;
  medicalFlag?: boolean;
  name?: string;
  phone?: string;
  preferredTime?: string | null;
};

export type VoicePlan<S extends VoiceState = VoiceState> = {
  say: string[];
  nextState: NextStateFor<S>;
  gather?: {
    input: Array<"speech" | "dtmf">;
    action: string;
    method: "POST";
    speechTimeout: "auto";
  };
  redirect?: string;
  hangup?: boolean;
};

export type PendingVoiceCallback = {
  intent: Intent;
  confidence: number;
  medicalFlag: boolean;
  name?: string;
  phone?: string;
  preferredTime?: string | null;
};
