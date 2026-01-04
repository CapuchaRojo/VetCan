import { Router } from "express";
import prisma from "../prisma";

const router = Router();

router.get("/", async (_req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    callbacksToday,
    callbacksTotal,
    completedToday,
    pending,
    lastCallback,
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
      where: { status: "pending" },
    }),
    prisma.callbackRequest.findFirst({
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  res.json({
    callbacksToday,
    callbacksTotal,
    completedToday,
    pending,
    lastCallbackAt: lastCallback?.createdAt ?? null,
  });
});

export default router;
