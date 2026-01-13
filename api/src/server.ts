// api/src/server.ts
import app from './app';
import { initEventForwarder } from './lib/eventForwarder';
import { initAlertEvaluator } from './lib/alerts';

function validateRequiredEnv() {
  if (process.env.NODE_ENV === 'test') return;

  const required = [
    'JWT_SECRET',
  ];

  const missing = required.filter((key) => !process.env[key]);
  if (missing.length === 0) return;

  const details = [
    missing.length ? `missing: ${missing.join(', ')}` : null,
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
