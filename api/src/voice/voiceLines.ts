// api/src/voice/voiceLines.ts

export const VOICE_LINES = {
  greeting: [
    "Hey there — thanks for calling.",
    "Hi — I’m glad you reached out today.",
    "Hello — thanks for calling VetCan.",
  ],

  intentPrompt: [
    "How can I help you today?",
    "What can I assist you with?",
    "Tell me what you’re calling about.",
  ],

  retry: [
    "Sorry — could you say that again?",
    "I didn’t quite catch that.",
  ],

  unknownIntent: [
    "I’m not totally sure what you need yet.",
    "Let’s try that again.",
  ],

  reassurance: [
    "No rush — take your time.",
    "That’s okay, I’m listening.",
    "I’ve got you.",
  ],

  schedulingConfirm: [
    "Okay — I can help arrange a callback.",
    "Got it — I’ll help get someone to follow up.",
  ],

  askName: [
    "What name should we use for the callback?",
    "What’s your name?",
  ],

  retryName: [
    "Sorry — I didn’t catch your name. Could you say it again?",
    "One more time — what name should we use?",
  ],

  askPhone: [
    "What phone number should we call you back at?",
    "Please say or enter the best number for the callback.",
  ],

  confirmation: [
    "Perfect — I’ve got that.",
    "Thanks — you’re all set.",
  ],

  staffHandoff: [
    "I’ll make sure the right person follows up.",
    "I’ll pass this along to our team.",
  ],

  medicalBoundary: [
    "I’m not able to give medical advice, but I can help get you connected.",
    "I can’t answer medical questions directly, but I can make sure staff follows up.",
  ],

  error: [
    "Sorry — something went wrong on our end.",
    "I hit a snag — but we’ll get this handled.",
  ],

  outboundGreeting: [
    "Hi — this is VetCan following up.",
    "Hello — VetCan calling you back.",
  ],

  outboundHold: [
    "One moment while I connect you.",
    "Thanks — please hold for just a moment.",
  ],

  close: [
    "Thanks again for calling.",
    "You’re all set. Take care.",
    "We’ll be in touch soon.",
  ],
};
