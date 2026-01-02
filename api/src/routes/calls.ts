import { Router } from 'express';
import prisma from '../prisma';
import requireAuth from '../middleware/auth';

const router = Router();

/**
 * Protect all call routes
 */

/**
 * GET /api/calls
 */
router.get('/', async (_req, res) => {
  try {
    const calls = await prisma.call.findMany();
    res.json(calls);
  } catch (err) {
    console.error('CALLS ERROR:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/calls
 */
router.post('/', async (req, res) => {
  try {
    const call = await prisma.call.create({
      data: {
        patientId: req.body.patientId,
        callSid: req.body.callSid,
        direction: req.body.direction,
        startedAt: req.body.startedAt ? new Date(req.body.startedAt) : undefined,
        endedAt: req.body.endedAt ? new Date(req.body.endedAt) : undefined,
        recording: req.body.recording
      }
    });

    res.status(201).json(call);
  } catch (err) {
    console.error('CALL CREATE ERROR:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
