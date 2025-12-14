import prisma from '../prisma';

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
