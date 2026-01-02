import { Router } from 'express';

const router = Router();

/**
 * POST /api/webhooks/twilio/sms
 * Handles inbound SMS from Twilio
 */
router.post('/sms', async (req, res) => {
  const from = req.body.From;
  const body = req.body.Body;

  console.log('[TWILIO INBOUND]', {
    from,
    body,
  });

  res.type('text/xml');
  res.send(`
    <Response>
      <Message>
        Thanks! We received your message and will follow up shortly.
      </Message>
    </Response>
  `);
});

export default router;
