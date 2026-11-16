-- CreateTable
CREATE TABLE "Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "logRetentionDays" INTEGER NOT NULL DEFAULT 90,
    "logAgeOutRanAt" DATETIME,
    "logAgeOutRemoved" INTEGER
);
