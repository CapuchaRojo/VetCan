import { Router } from 'express';

import appointmentsRouter from './appointments';
import patientsRouter from './patients';
import callsRouter from './calls';
import callbacksRouter from './callbacks';
import SmsRouter from './sms';

const router = Router();

router.use('/appointments', appointmentsRouter);
router.use('/patients', patientsRouter);
router.use('/calls', callsRouter);
router.use('/callbacks', callbacksRouter);


// Twilio webhooks
router.use('/webhooks/twilio', SmsRouter);

export default router;
