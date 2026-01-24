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

-- CreateTable
CREATE TABLE "EscalationMetricsRollupHourly" (
    "id" TEXT NOT NULL,
    "hourStart" TIMESTAMP(3) NOT NULL,
    "attempted" INTEGER NOT NULL,
    "delivered" INTEGER NOT NULL,
    "failed" INTEGER NOT NULL,
    "skippedBreaker" INTEGER NOT NULL,
    "skippedBackoff" INTEGER NOT NULL,
    "skippedNonePending" INTEGER NOT NULL,
    "breakerOpenCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EscalationMetricsRollupHourly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscalationMetricsRollupDaily" (
    "id" TEXT NOT NULL,
    "dayStart" TIMESTAMP(3) NOT NULL,
    "attempted" INTEGER NOT NULL,
    "delivered" INTEGER NOT NULL,
    "failed" INTEGER NOT NULL,
    "skippedBreaker" INTEGER NOT NULL,
    "skippedBackoff" INTEGER NOT NULL,
    "skippedNonePending" INTEGER NOT NULL,
    "breakerOpenCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EscalationMetricsRollupDaily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EscalationMetricsRollupHourly_hourStart_key" ON "EscalationMetricsRollupHourly"("hourStart");

-- CreateIndex
CREATE UNIQUE INDEX "EscalationMetricsRollupDaily_dayStart_key" ON "EscalationMetricsRollupDaily"("dayStart");
