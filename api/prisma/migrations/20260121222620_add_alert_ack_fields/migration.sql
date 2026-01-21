-- AlterTable
ALTER TABLE "Alert" ADD COLUMN "acknowledgedAt" DATETIME;
ALTER TABLE "Alert" ADD COLUMN "acknowledgedBy" TEXT;
