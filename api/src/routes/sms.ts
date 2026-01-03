// api/src/routes/sms.ts
import { Router } from 'express';
import prisma from '../prisma';
import { notificationProvider } from '../services/notifications';

const router = Router();

/**
 * Normalize intent from SMS body
 */
function detectIntent(body: string): 'callback' | 'unknown' {
  const text = body.toLowerCase();

  if (
    text.includes('call me') ||
    text.includes('callback') ||
    text.includes('call back') ||
    text.includes('appointment') ||
    text.includes('schedule')
  ) {
    return 'callback';
  }

  return 'unknown';
}

/**
 * POST /api/webhooks/twilio/sms
 */
router.post('/sms', async (req, res) => {
  const from = req.body.From;
  const body = req.body.Body || '';

  console.log('[TWILIO INBOUND SMS]', { from, body });

  const intent = detectIntent(body);

  if (intent !== 'callback') {
    await notificationProvider.send(
      from,
      `Thanks for texting us! If you'd like a callback, reply with "call me" or "appointment".`
    );
    return res.sendStatus(200);
  }

  // Create callback request
  await prisma.callbackRequest.create({
    data: {
      name: 'SMS Request',
      phone: from,
      status: 'pending',
      source: 'sms',
    },
  });

  // Confirmation SMS
  await notificationProvider.send(
    from,
    `Thanks! We've received your callback request. Our staff will contact you shortly.`
  );

  res.sendStatus(200);
});

export default router;
