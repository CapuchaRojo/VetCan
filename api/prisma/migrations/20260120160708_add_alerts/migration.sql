-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "severity" TEXT NOT NULL,
    "alertType" TEXT,
    "eventName" TEXT,
    "environment" TEXT,
    "ageSeconds" INTEGER,
    "callSid" TEXT,
    "summary" TEXT NOT NULL,
    "triggeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CallbackRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "requestType" TEXT,
    "preferredTime" TEXT,
    "status" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'sms',
    "aiHandled" BOOLEAN NOT NULL DEFAULT false,
    "aiOutcome" TEXT,
    "lastAttemptAt" DATETIME,
    "confirmedName" TEXT,
    "nonMedicalReason" TEXT,
    "staffFollowupRequired" BOOLEAN NOT NULL DEFAULT false,
    "summary" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_CallbackRequest" ("createdAt", "id", "name", "phone", "preferredTime", "requestType", "source", "status", "updatedAt") SELECT "createdAt", "id", "name", "phone", "preferredTime", "requestType", "source", "status", "updatedAt" FROM "CallbackRequest";
DROP TABLE "CallbackRequest";
ALTER TABLE "new_CallbackRequest" RENAME TO "CallbackRequest";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
