import type { Prisma } from "@prisma/client";
import prisma from "../prisma";

export async function createOperationalEvent(
  data: Prisma.OperationalEventCreateInput
) {
  return prisma.operationalEvent.create({ data });
}
