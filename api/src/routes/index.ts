import { Router } from 'express';

import appointmentsRouter from './appointments';
import patientsRouter from './patients';
import callsRouter from './calls';
import callbacksRouter from './callbacks';

const router = Router();

router.use('/appointments', appointmentsRouter);
router.use('/patients', patientsRouter);
router.use('/calls', callsRouter);
router.use('/callbacks', callbacksRouter);

export default router;
