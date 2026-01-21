import { Router } from "express";
import prisma from "../prisma";
import { logger } from "../utils/logger";

const router = Router();

router.get("/", async (_req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  try {
    const [
      callbacksToday,
      callbacksTotal,
      completedToday,
      completedTotal,
      pending,
      lastCallback,
      bySource,
    ] = await Promise.all([
      prisma.callbackRequest.count({
        where: { createdAt: { gte: today } },
      }),
      prisma.callbackRequest.count(),
      prisma.callbackRequest.count({
        where: {
          status: "completed",
          createdAt: { gte: today },
        },
      }),
      prisma.callbackRequest.count({
        where: { status: "completed" },
      }),
      prisma.callbackRequest.count({
        where: { status: "pending" },
      }),
      prisma.callbackRequest.findFirst({
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      prisma.callbackRequest.groupBy({
        by: ["source"],
        _count: {
          _all: true,
        },
      }),
    ]);

    const sourceBreakdown = bySource.reduce(
  (acc: Record<string, number>, row) => {
    acc[row.source ?? "unknown"] = row._count._all;
    return acc;
  },
  {}
);

res.json({
  callbacksToday,
  callbacksTotal,
  completedToday,
  completedTotal,
  pending,
  completionRate:
    callbacksTotal === 0
      ? 0
      : Math.round((completedTotal / callbacksTotal) * 100),
  aiHandled: callbacksTotal,
  sourceBreakdown,
  lastCallbackAt: lastCallback?.createdAt ?? null,
  updatedAt: new Date().toISOString(),
});
  } catch (err) {
    logger.error("[stats error]", err);
    res.status(500).json({ error: "Failed to load stats" });
  }
});

export default router;
