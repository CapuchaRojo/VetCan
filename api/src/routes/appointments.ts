import { Router } from 'express';
import prisma from '../prisma';
import {
  hasAppointmentConflict,
  cancelAppointment
} from '../services/appointments';

export const router = Router();

/**
 * GET /appointments
 */
router.get('/', async (_req, res) => {
  try {
    const appointments = await prisma.appointment.findMany();
    return res.json(appointments);
  } catch (err) {
    console.error('APPOINTMENT ERROR:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /appointments
 */
router.post('/', async (req, res) => {
  const { patientId, doctorId, startTime, endTime } = req.body;

  try {
    const conflict = await hasAppointmentConflict(
      doctorId,
      new Date(startTime),
      new Date(endTime)
    );

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
    console.error('APPOINTMENT ERROR:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /appointments/:id/cancel
 */
router.post('/:id/cancel', async (req, res) => {
  try {
    const appointment = await cancelAppointment(req.params.id);
    return res.status(200).json(appointment);
  } catch (err: any) {
    if (err.message === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    if (err.message === 'ALREADY_CANCELLED') {
      return res.status(409).json({ error: 'Appointment already cancelled' });
    }

    if (err.message === 'ALREADY_COMPLETED') {
      return res
        .status(409)
        .json({ error: 'Completed appointments cannot be cancelled' });
    }

    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
