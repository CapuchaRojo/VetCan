// api/src/server.ts
import app from './app';
import { initEventForwarder } from './lib/eventForwarder';
import { initAlertEvaluator } from './lib/alerts';

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
  const invalid: string[] = [];
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  if (accountSid && !accountSid.startsWith('AC')) {
    invalid.push('TWILIO_ACCOUNT_SID');
  }

  if (missing.length === 0 && invalid.length === 0) return;

  const details = [
    missing.length ? `missing: ${missing.join(', ')}` : null,
    invalid.length ? `invalid: ${invalid.join(', ')}` : null,
  ].filter(Boolean).join(' | ');

  throw new Error(`[config] ${details}`);
}

validateRequiredEnv();
initEventForwarder();
initAlertEvaluator();

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`API listening on port ${PORT}`);
});
