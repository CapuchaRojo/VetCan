import { Router } from 'express';
import prisma from '../prisma';
import { hasAppointmentConflict } from '../services/appointments';

export const router = Router();

/**
 * GET /appointments
 */
router.get('/', async (_req, res) => {
  try {
    const appointments = await prisma.appointment.findMany();
    res.json(appointments);
  } catch (err) {
  console.error('APPOINTMENT ERROR:');
  res.status(500).json({ error: 'Internal server error' });
}
});

/**
 * POST /appointments
 */
router.post('/', async (req, res) => {
  const { patientId, doctorId, startTime, endTime } = req.body;

  try {
    const conflict = await prisma.appointment.findFirst({
      where: {
        doctorId,
        AND: [
          { startTime: { lt: new Date(endTime) } },
          { endTime: { gt: new Date(startTime) } }
        ]
      }
    });

    if (conflict) {
      return res.status(409).json({ error: 'Time conflict' });
    }

    const appointment = await prisma.appointment.create({
      data: {
        patientId,
        doctorId,
        startTime: new Date(startTime),
        endTime: new Date(endTime)
      }
    });

    return res.status(201).json(appointment);
  } catch (err) {
    console.error('APPOINTMENT ERROR:');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
