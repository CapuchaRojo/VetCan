import type { Prisma } from "@prisma/client";
import prisma from "../prisma";

export async function createOperationalEvent(
  data: Prisma.OperationalEventCreateInput
) {
  return prisma.operationalEvent.create({ data });
}

export async function getOperationalEventCounts() {
  const rows = await prisma.operationalEvent.groupBy({
    by: ["eventName"],
    _count: { _all: true },
  });

  return rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.eventName] = row._count._all;
    return acc;
  }, {});
}

const REDACTED_KEYS = ["phone", "name", "email", "dob", "ssn", "address"];

function sanitizePayload(payload: unknown) {
  if (!payload || typeof payload !== "object") return payload;
  const record = payload as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    sanitized[key] = REDACTED_KEYS.includes(key) ? "[redacted]" : value;
  }

  return sanitized;
}

export async function getRecentOperationalEvents(limit: number) {
  const rows = await prisma.operationalEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return rows.map((row) => {
    let parsed: unknown = {};
    try {
      parsed = row.payload ? JSON.parse(row.payload) : {};
    } catch {
      parsed = {};
    }

    return {
      type: row.eventName,
      payload: sanitizePayload(parsed),
      createdAt: row.createdAt.toISOString(),
    };
  });
}
