// api/src/server.ts
import app from './app';

function validateRequiredEnv() {
  if (process.env.NODE_ENV === 'test') return;

  const required = [
    'JWT_SECRET',
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'TWILIO_PHONE_NUMBER',
    'TWIML_AI_CALLBACK_URL',
  ];

  const missing = required.filter((key) => !process.env[key]);
  if (missing.length === 0) return;

  const message = `[config] Missing required env vars: ${missing.join(', ')}`;
  if (process.env.NODE_ENV === 'production') {
    console.error(message);
  } else {
    console.warn(message);
  }
}

validateRequiredEnv();

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`API listening on port ${PORT}`);
});
