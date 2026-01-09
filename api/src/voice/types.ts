// api/src/voice/types.ts
import type { Intent } from "./voiceIntents";

export type PendingVoiceCallback = {
  intent: Intent;
  confidence: number;
  medicalFlag: boolean;
  name?: string;
  phone?: string;
  preferredTime?: string | null;
};
