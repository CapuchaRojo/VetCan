-- CreateTable
CREATE TABLE "OperationalEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventName" TEXT NOT NULL,
    "severity" TEXT,
    "source" TEXT,
    "correlationId" TEXT,
    "environment" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "EscalationDelivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" DATETIME,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" DATETIME,
    CONSTRAINT "EscalationDelivery_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "OperationalEvent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "OperationalEvent_correlationId_idx" ON "OperationalEvent"("correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "EscalationDelivery_dedupeKey_key" ON "EscalationDelivery"("dedupeKey");

-- CreateIndex
CREATE INDEX "EscalationDelivery_status_lastAttemptAt_idx" ON "EscalationDelivery"("status", "lastAttemptAt");
