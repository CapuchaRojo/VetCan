// ai/scripts/buildFallbackScript.ts
import { FALLBACK_SCRIPT } from "./fallback";

export function buildFallbackScript(): string {
  return `
${FALLBACK_SCRIPT.apology}

${FALLBACK_SCRIPT.explanation}

${FALLBACK_SCRIPT.options.join(" ")}

${FALLBACK_SCRIPT.confirmationPrompt}
`.trim();
}