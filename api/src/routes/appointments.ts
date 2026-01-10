import { Router } from 'express';
import prisma from '../prisma';
import requireAuth from '../middleware/auth';
import { emitEvent } from '../lib/events';
import { validationFail } from '../lib/validationFail';

const router = Router();

// 🔐 Apply auth to all appointment routes
router.use(requireAuth);

/**
 * GET /appointments
 */
router.get('/', async (_req, res) => {
  try {
    const appointments = await prisma.appointment.findMany({
      where: { deletedAt: null },
      include: { patient: true },
      orderBy: { startTime: 'asc' },
    });

    return res.json(appointments);
  } catch (err) {
    console.error('APPOINTMENT ERROR:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /appointments/:id
 */
router.get('/:id', async (req, res) => {
  const appointmentId = req.params.id;

  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { patient: true },
    });

    if (!appointment || appointment.deletedAt) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    return res.json({
      ...appointment,
      doctorId: Number(appointment.doctorId),
    });
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
  const start = new Date(startTime);
  const end = new Date(endTime);

  // ❗ Guard against invalid inputs (tests expect 500)
  if (
    !patientId ||
    doctorId == null ||
    isNaN(start.getTime()) ||
    isNaN(end.getTime())
  ) {
    validationFail({ scope: "appointments", reason: "invalid_payload" });
    throw new Error('Invalid appointment data');
  }

  const conflict = await prisma.appointment.findFirst({
  where: {
    doctorId: String(doctorId),
    deletedAt: null,
    AND: [
      { startTime: { lt: end } },
      { endTime: { gt: start } },
    ],
  },
});

if (conflict) {
  emitEvent("appointment_create_result", { ok: false });
  return res.status(409).json({ error: 'Time conflict' });
}

  const appointment = await prisma.appointment.create({
    data: {
      patientId,
      doctorId: String(doctorId),
      startTime: start,
      endTime: end,
    },
  });

    emitEvent("appointment_create_result", { ok: true });
    return res.status(201).json({
      ...appointment,
      doctorId: Number(appointment.doctorId),
    });
  } catch (err) {
    emitEvent("appointment_create_result", { ok: false });
    console.error('APPOINTMENT ERROR:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /appointments/:id
 */
router.put('/:id', async (req, res) => {
  const appointmentId = req.params.id;
  const { patientId, doctorId, startTime, endTime } = req.body;

  try {
    const existing = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!existing || existing.deletedAt) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    if (doctorId != null && startTime != null && endTime != null) {
      const conflict = await prisma.appointment.findFirst({
        where: {
          doctorId: String(doctorId),
          deletedAt: null,
          id: { not: appointmentId },
          AND: [
            { startTime: { lt: new Date(endTime) } },
            { endTime: { gt: new Date(startTime) } },
          ],
        },
      });

      if (conflict) {
        return res.status(409).json({ error: 'Time conflict' });
      }
    }

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        patientId,
        doctorId: doctorId != null ? String(doctorId) : undefined,
        startTime: startTime != null ? new Date(startTime) : undefined,
        endTime: endTime != null ? new Date(endTime) : undefined,
      },
    });

    return res.json({
      ...updated,
      doctorId: Number(updated.doctorId),
    });
  } catch (err) {
    console.error('APPOINTMENT ERROR:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /appointments/:id (soft delete)
 */
router.delete('/:id', async (req, res) => {
  const appointmentId = req.params.id;

  try {
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { deletedAt: new Date() },
    });

    return res.status(204).send();
  } catch (err) {
    console.error('APPOINTMENT ERROR:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

