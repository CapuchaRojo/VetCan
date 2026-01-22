-- AlterTable
ALTER TABLE "Alert" ADD COLUMN "correlationId" TEXT;
ALTER TABLE "Alert" ADD COLUMN "source" TEXT;

-- CreateIndex
CREATE INDEX "Alert_correlationId_idx" ON "Alert"("correlationId");

-- CreateIndex
CREATE INDEX "Alert_source_idx" ON "Alert"("source");

-- CreateIndex
CREATE UNIQUE INDEX "Alert_alertType_correlationId_key" ON "Alert"("alertType", "correlationId");
