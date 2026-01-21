import prisma from "../prisma";

export async function getAlertSnapshots() {
  const rows = await prisma.alert.findMany({
    orderBy: { createdAt: "desc" },
  });

  return rows.map((alert) => ({
    alertType: alert.alertType || "unknown",
    eventName: alert.eventName || "unknown",
    count: 1,
    threshold: 1,
    windowSeconds: 0,
    triggeredAt: alert.triggeredAt.toISOString(),
    environment: alert.environment || "local",
  }));
}
