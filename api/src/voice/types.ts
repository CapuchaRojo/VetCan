// api/src/voice/types.ts
import type { Intent } from "./voiceIntents";

export type VoiceState = "inbound" | "intent" | "name" | "phone" | "time" | "complete";

export type VoiceContext = {
  state: VoiceState;
  intent?: Intent;
  confidence?: number;
  medicalFlag?: boolean;
  name?: string;
  phone?: string;
  preferredTime?: string | null;
};

export type VoicePlan = {
  say: string[];
  nextState: VoiceState;
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
