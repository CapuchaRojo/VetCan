import { Router } from 'express';

import appointmentsRouter from './appointments';
import patientsRouter from './patients';
import callsRouter from './calls';

const router = Router();

router.use('/appointments', appointmentsRouter);
router.use('/patients', patientsRouter);
router.use('/calls', callsRouter);

export default router;
