import prisma from "../prisma";

export async function getRecentEscalationDeliveries(limit: number) {
  return prisma.escalationDelivery.findMany({
    include: {
      event: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
  });
}
