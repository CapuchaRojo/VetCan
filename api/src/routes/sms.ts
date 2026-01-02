import { Router } from 'express';
import prisma from '../prisma';
import { notificationProvider } from '../services/notifications';

const router = Router();

/**
 * POST /api/webhooks/twilio/sms
 * Handles inbound SMS from Twilio
 * → creates callback request
 * → sends confirmation SMS
 */
router.post('/sms', async (req, res) => {
  const from = req.body.From;
  const body = req.body.Body;

  console.log('[TWILIO INBOUND]', {
    from,
    body,
  });

  try {
    // Create callback request
    const callback = await prisma.callbackRequest.create({
      data: {
        name: 'SMS User',
        phone: from,
        reason: body || 'Inbound SMS request',
        status: 'pending',
      },
    });

    console.log('[CALLBACK CREATED]', callback.id);

    // Send confirmation SMS (fails gracefully if Twilio not ready)
    await notificationProvider.send(
      from,
      'Thanks! We received your message and will call you back shortly.'
    );

    // Twilio requires valid TwiML (XML)
    res.type('text/xml');
    res.send(`
      <Response>
        <Message>
          Thanks! We received your message and will follow up shortly.
        </Message>
      </Response>
    `);
  } catch (err) {
    console.error('[TWILIO SMS ERROR]', err);

    res.type('text/xml');
    res.send(`
      <Response>
        <Message>
          Sorry — something went wrong. Please try again later.
        </Message>
      </Response>
    `);
  }
});

export default router;
