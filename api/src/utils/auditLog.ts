import type { Intent } from "../voice/voiceIntents";

type PendingVoiceCallback = {
  intent: Intent;
  confidence: number;
  name?: string;
  phone?: string;
  preferredTime?: string | null;
  medicalFlag: boolean;
};
