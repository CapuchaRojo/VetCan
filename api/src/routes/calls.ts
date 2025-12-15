import { Router } from 'express';
import prisma from '../prisma';
import { requireAuth } from '../middleware/auth';

const router = Router();

/**
 * Protect all call routes
 */
router.use(requireAuth);

/**
 * GET /api/calls
 */
router.get('/', async (_req, res) => {
  try {
    const calls = await prisma.call.findMany();
    return res.json(calls);
  } catch (err) {
    console.error('CALLS ERROR:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/calls
 */
router.post('/', async (req, res) => {
  const {
    patientId,
    callSid,
    direction,
    startedAt,
    endedAt,
    recording
  } = req.body;

  try {
    const call = await prisma.call.create({
      data: {
        patientId,
        callSid,
        direction,
        startedAt: startedAt ? new Date(startedAt) : undefined,
        endedAt: endedAt ? new Date(endedAt) : undefined,
        recording
      }
    });

    return res.status(201).json(call);
  } catch (err) {
    console.error('CALL CREATE ERROR:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
