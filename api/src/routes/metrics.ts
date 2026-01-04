import { Router } from "express";
import prisma from "../prisma";

const router = Router();

router.get("/", async (_req, res) => {
  const [
    totalCallbacks,
    pending,
    completed,
    lastCallback,
  ] = await Promise.all([
    prisma.callbackRequest.count(),
    prisma.callbackRequest.count({ where: { status: "pending" } }),
    prisma.callbackRequest.count({ where: { status: "completed" } }),
    prisma.callbackRequest.findFirst({
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  res.json({
    totalCallbacks,
    pending,
    completed,
    completionRate:
      totalCallbacks === 0
        ? 0
        : Math.round((completed / totalCallbacks) * 100),
    lastCallbackAt: lastCallback?.createdAt ?? null,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

export default router;
