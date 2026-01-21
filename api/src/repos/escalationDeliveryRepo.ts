import type { Prisma } from "@prisma/client";
import prisma from "../prisma";

export async function createEscalationDelivery(
  data: Prisma.EscalationDeliveryCreateInput
) {
  return prisma.escalationDelivery.create({ data });
}

export async function upsertEscalationDelivery(
  dedupeKey: string,
  createData: Prisma.EscalationDeliveryCreateInput
) {
  return prisma.escalationDelivery.upsert({
    where: { dedupeKey },
    create: createData,
    update: {},
  });
}
