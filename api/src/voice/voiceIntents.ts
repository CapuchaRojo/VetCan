// api/src/voice/voiceIntents.ts

export type Intent =
  | "callback"
  | "scheduling"
  | "general_question"
  | "operator"
  | "unknown";

export type IntentResult = {
  intent: Intent;
  confidence: number; // 0–1
  medicalFlag: boolean;
};

const MEDICAL_KEYWORDS = [
  "pain",
  "diagnosis",
  "ptsd",
  "anxiety",
  "depression",
  "medical",
  "condition",
  "symptom",
  "medication",
];

const INTENT_KEYWORDS: Record<Intent, string[]> = {
  callback: ["call back", "callback", "call me"],
  scheduling: ["schedule", "appointment", "book", "time"],
  general_question: ["question", "info", "ask", "help"],
  operator: ["operator", "representative", "human", "staff"],
  unknown: [],
};

const UNCERTAINTY_MARKERS = ["maybe", "not sure", "i think", "kind of", "uh", "um"];

export function classifyIntent(text: string): IntentResult {
  const normalized = text.toLowerCase();

  const medicalFlag = MEDICAL_KEYWORDS.some((k) => normalized.includes(k));

  let bestIntent: Intent = "unknown";
  let bestScore = 0;

  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    if (intent === "unknown") continue;

    let score = 0;
    for (const keyword of keywords) {
      if (normalized.includes(keyword)) score += 1;
    }

    if (score > bestScore) {
      bestScore = score;
      bestIntent = intent as Intent;
    }
  }

  let confidence = Math.min(1, bestScore / 2);

  for (const marker of UNCERTAINTY_MARKERS) {
    if (normalized.includes(marker)) confidence -= 0.15;
  }

  confidence = Math.max(0, Math.min(confidence, 1));

  return { intent: bestIntent, confidence, medicalFlag };
}
