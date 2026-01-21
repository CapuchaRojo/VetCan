import prisma from "../prisma";

function safeParse(payload: string) {
  try {
    return JSON.parse(payload || "{}");
  } catch {
    return {};
  }
}

export async function getAlertAckTimeline(limit = 50) {
  const rows = await prisma.operationalEvent.findMany({
    where: { eventName: "alert_acknowledged" },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return rows.map((row) => {
    const payload = safeParse(row.payload);
    return {
      eventName: row.eventName,
      createdAt: row.createdAt.toISOString(),
      payload,
    };
  });
}
