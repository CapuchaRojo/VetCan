// api/src/config/runtimeGuards.ts

export function isTestEnv() {
  return process.env.NODE_ENV === "test";
}

export function isTelephonyConfigured() {
  if (isTestEnv()) return false;

  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER
  );
}

export function isAICallbackEnabled() {
  if (isTestEnv()) return false;

  return Boolean(
    process.env.TWIML_AI_CALLBACK_URL &&
    isTelephonyConfigured()
  );
}
