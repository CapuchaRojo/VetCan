import type { Prisma } from "@prisma/client";
import prisma from "../prisma";

export async function createEscalationDelivery(
  data: Prisma.EscalationDeliveryCreateInput
) {
  return prisma.escalationDelivery.create({ data });
}
