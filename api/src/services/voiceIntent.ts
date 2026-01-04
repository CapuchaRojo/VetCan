// api/src/services/voiceIntent.ts

export type VoiceIntent =
  | "callback"
  | "scheduling"
  | "general_question"
  | "operator"
  | "unknown";

export function classifyIntent(text: string): VoiceIntent {
  const normalized = text.toLowerCase();

  if (
    normalized.includes("call back") ||
    normalized.includes("callback") ||
    normalized.includes("call me")
  ) {
    return "callback";
  }

  if (
    normalized.includes("schedule") ||
    normalized.includes("appointment")
  ) {
    return "scheduling";
  }

  if (
    normalized.includes("question") ||
    normalized.includes("information")
  ) {
    return "general_question";
  }

  if (
    normalized.includes("operator") ||
    normalized.includes("representative") ||
    normalized.includes("human")
  ) {
    return "operator";
  }

  return "unknown";
}
