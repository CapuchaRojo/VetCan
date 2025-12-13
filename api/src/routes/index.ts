import { Router } from 'express';

import { router as patientsRouter } from './patients';
import { router as appointmentsRouter } from './appointments';

// Optional routes — only mount if they exist
// Commented out until implemented
// import { router as callsRouter } from './calls';
// import { router as authRouter } from './auth';

export const router = Router();

router.use('/patients', patientsRouter);
router.use('/appointments', appointmentsRouter);

// router.use('/calls', callsRouter);
// router.use('/auth', authRouter);

