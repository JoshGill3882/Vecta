-- CreateTable
CREATE TABLE "Settings" (
    "id" INTEGER NOT NULL,
    "logRetentionDays" INTEGER NOT NULL DEFAULT 90,
    "logAgeOutRanAt" TIMESTAMP(3),
    "logAgeOutRemoved" INTEGER,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);
