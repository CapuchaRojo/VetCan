// api/tests/helpers/resetDb.ts
import prisma from '../../src/prisma';

export async function resetDb() {
  // Order matters: children → parents
  await prisma.escalationDelivery.deleteMany();
  await prisma.operationalEvent.deleteMany();
  await prisma.call.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.agent.deleteMany();
}