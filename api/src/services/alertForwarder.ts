import type { AlertEscalationPayload } from '../types/alerts';
import { logger } from '../utils/logger';

export async function forwardAlertToN8N(payload: AlertEscalationPayload) {
  const url = process.env.N8N_ALERT_WEBHOOK_URL;

  if (!url) {
    logger.warn('[events] N8N_ALERT_WEBHOOK_URL not set; n8n forwarding disabled.');
    return;
  }

  try {
    const fetchFn = globalThis.fetch;
    if (!fetchFn) {
      logger.warn('[events] fetch unavailable; n8n forwarding disabled.');
      return;
    }

    const res = await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      logger.error('[events] Failed to forward event.', await res.text());
    }
  } catch (err) {
    logger.error('[events] Failed to forward event.', err);
  }
}
