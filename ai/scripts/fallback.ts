// ai/scripts/fallback.ts
export const FALLBACK_SCRIPT = {
  id: "fallback_v1",
  apology: "I want to make sure I don’t give you incorrect information.",
  explanation: "This question is best handled by a staff member.",
  options: [
    "I can take your name and number and have someone call you back.",
    "Or you can contact the business directly during normal hours."
  ],
  confirmationPrompt: "How would you like to proceed?",
  closing: "Thank you. Someone will follow up with you shortly.",
};