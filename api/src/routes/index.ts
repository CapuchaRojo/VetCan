// VetCan/api/src/routes/index.ts
import { Router } from 'express';
import twilio from 'twilio';
import prisma from '../prisma';

import appointmentsRouter from './appointments';
import patientsRouter from './patients';
import callsRouter from './calls';
import callbacksRouter from './callbacks';
import smsRouter from './sms';
import stats from './stats';


const router = Router();
const VoiceResponse = twilio.twiml.VoiceResponse;

/* -------------------------------------------------
   CORE API ROUTES
-------------------------------------------------- */

router.use('/appointments', appointmentsRouter);
router.use('/patients', patientsRouter);
router.use('/calls', callsRouter);
router.use('/callbacks', callbacksRouter);
router.use('/webhooks/twilio', smsRouter);
router.use('/stats', stats);


/* -------------------------------------------------
   VOICE – INBOUND CALLBACK FLOW (NON-PHI)
-------------------------------------------------- */

/**
 * POST /api/voice/inbound
 * Entry point for inbound calls
 */
router.post('/voice/inbound', (_req, res) => {
  const twiml = new VoiceResponse();

  const gather = twiml.gather({
    input: ['speech'],
    action: '/api/voice/name',
    method: 'POST',
    speechTimeout: 'auto',
  });

  gather.say(
    'Thanks for calling. I can help schedule a callback. What is your first name?'
  );

  res.type('text/xml').send(twiml.toString());
});

/**
 * POST /api/voice/name
 * Capture caller name
 */
router.post('/voice/name', (req, res) => {
  const twiml = new VoiceResponse();
  const name = req.body.SpeechResult;

  if (!name) {
    twiml.say('Sorry, I did not catch that.');
    twiml.redirect('/api/voice/inbound');
    return res.type('text/xml').send(twiml.toString());
  }

  const gather = twiml.gather({
    input: ['speech', 'dtmf'],
    action: `/api/voice/phone?name=${encodeURIComponent(name)}`,
    method: 'POST',
    speechTimeout: 'auto',
  });

  gather.say('Thanks. What is the best phone number to reach you?');

  res.type('text/xml').send(twiml.toString());
});

/**
 * POST /api/voice/phone
 * Capture callback phone number
 */
router.post('/voice/phone', (req, res) => {
  const twiml = new VoiceResponse();
  const name = req.query.name as string;
  const phone = req.body.SpeechResult || req.body.Digits;

  if (!phone) {
    twiml.say('Sorry, I did not catch the phone number.');
    twiml.redirect('/api/voice/name');
    return res.type('text/xml').send(twiml.toString());
  }

  const gather = twiml.gather({
    input: ['speech'],
    action: `/api/voice/time?name=${encodeURIComponent(
      name
    )}&phone=${encodeURIComponent(phone)}`,
    method: 'POST',
    speechTimeout: 'auto',
  });

  gather.say('What time works best for a callback?');

  res.type('text/xml').send(twiml.toString());
});

/**
 * POST /api/voice/time
 * Capture preferred time + create callback request
 */
router.post('/voice/time', async (req, res) => {
  const twiml = new VoiceResponse();
  const { name, phone } = req.query;
  const preferredTime = req.body.SpeechResult || null;

  try {
    await prisma.callbackRequest.create({
      data: {
        name: String(name),
        phone: String(phone),
        preferredTime,
        status: 'pending',
      },
    });

    twiml.say(
      'Thank you. Our staff will call you back shortly. Have a great day.'
    );
    twiml.hangup();
  } catch (err) {
    console.error('[voice callback error]', err);
    twiml.say(
      'Sorry, something went wrong. Please call back later.'
    );
    twiml.hangup();
  }

  res.type('text/xml').send(twiml.toString());
});

export default router;
