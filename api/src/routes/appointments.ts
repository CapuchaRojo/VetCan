import { Router } from 'express';
import prisma from '../prisma';

export const router = Router();

/**
 * GET /appointments
 */
router.get('/', async (_req, res) => {
  try {
    const appointments = await prisma.appointment.findMany();
    res.json(appointments);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

/**
 * POST /appointments
 */
router.post('/', async (req, res) => {
  try {
    const appointment = await prisma.appointment.create({
      data: req.body
    });
    res.json(appointment);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create appointment' });
  }
});

