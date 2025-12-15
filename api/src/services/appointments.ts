import prisma from '../prisma';

/**
 * Checks if a doctor already has a scheduled appointment
 * overlapping the given time window.
 */
export async function hasAppointmentConflict(
  doctorId: string,
  startTime: Date,
  endTime: Date
): Promise<boolean> {
  const conflict = await prisma.appointment.findFirst({
    where: {
      doctorId,
      status: 'SCHEDULED',
      AND: [
        { startTime: { lt: endTime } },
        { endTime: { gt: startTime } }
      ]
    }
  });

  return Boolean(conflict);
}

/**
 * Cancels an appointment if allowed.
 * Enforces business rules:
 * - must exist
 * - cannot cancel twice
 * - cannot cancel completed appointments
 */
export async function cancelAppointment(id: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id }
  });

  if (!appointment) {
    throw new Error('NOT_FOUND');
  }

  if (appointment.status === 'CANCELLED') {
    throw new Error('ALREADY_CANCELLED');
  }

  if (appointment.status === 'COMPLETED') {
    throw new Error('ALREADY_COMPLETED');
  }

  return prisma.appointment.update({
    where: { id },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date()
    }
  });
}
