// api/src/voice/voiceLines.ts

export const VOICE_LINES = {
  greeting: [
    "Hey there — thanks for calling.",
    "Hi! I’m glad you reached out today.",
    "Hello — thanks for calling VetCan.",
  ],

  intentPrompt: [
        "What can I help you with today?",
    "How can I help you out?",
  ],

  confirmIntent: [
    "Just to make sure I understand — are you calling to set up a callback?",
    "It sounds like you want a callback. Is that right?",
  ],

  retry: [
    "I didn’t quite catch that. Could you say it another way?",
    "Sorry — could you rephrase that for me?",
  ],

  unknownIntent: [
    "I’m not totally sure what you need yet.",
    "Let’s try that again.",
  ],

  reassurance: [
    "No rush — take your time.",
    "Whenever you’re ready.",
  ],

  schedulingConfirm: [
    "Got it. I can help set that up.",
    "Sure thing — let’s take care of that.",
  ],

  staffHandoff: [
        "What can I help you with today?",
    "How can I help you out?",
  ],

  medicalBoundary: [
    "I can’t help with medical questions directly, but I’ll make sure someone qualified follows up.",
  ],

  close: [
    "Thanks again for calling. Talk soon.",
    "You’re all set. Take care.",
  ],
};
