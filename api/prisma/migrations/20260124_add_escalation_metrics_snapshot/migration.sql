-- CreateTable
CREATE TABLE "EscalationMetricsSnapshot" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempted" INTEGER NOT NULL,
    "delivered" INTEGER NOT NULL,
    "failed" INTEGER NOT NULL,
    "skippedBreaker" INTEGER NOT NULL,
    "skippedBackoff" INTEGER NOT NULL,
    "skippedNonePending" INTEGER NOT NULL,
    "breakerState" TEXT NOT NULL,
    "breakerFailureCount" INTEGER NOT NULL,
    "breakerOpenedAt" TIMESTAMP(3),
    "breakerOpenUntil" TIMESTAMP(3),
    "breakerRemainingMs" INTEGER,
    "source" TEXT NOT NULL,

    CONSTRAINT "EscalationMetricsSnapshot_pkey" PRIMARY KEY ("id")
);
