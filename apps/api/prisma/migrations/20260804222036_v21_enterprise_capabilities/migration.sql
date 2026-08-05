-- CreateEnum
CREATE TYPE "LockType" AS ENUM ('SOFT', 'HARD');

-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "lockType" "LockType",
ADD COLUMN     "stageEnteredAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ImpersonationSession" ADD COLUMN     "actionCount" INTEGER,
ADD COLUMN     "summary" TEXT;

-- AlterTable
ALTER TABLE "WorkflowStage" ADD COLUMN     "slaHours" INTEGER;

-- CreateTable
CREATE TABLE "ApprovalRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minPax" INTEGER,
    "visaType" "VisaType",
    "packageType" "PackageType",
    "requiredRole" TEXT NOT NULL DEFAULT 'OPS_STAFF',
    "level" INTEGER NOT NULL DEFAULT 1,
    "minApprovals" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupApproval" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "approverUserId" TEXT NOT NULL,
    "signatureHash" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupVersion" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changedByUserId" TEXT,
    "actingAsUserId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityPolicy" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL DEFAULT 'default',
    "impersonationMaxMinutes" INTEGER NOT NULL DEFAULT 30,
    "forceLogoutOnRoleChange" BOOLEAN NOT NULL DEFAULT true,
    "forceLogoutOnLock" BOOLEAN NOT NULL DEFAULT false,
    "maxSessionMinutes" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecurityPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApprovalRule_active_idx" ON "ApprovalRule"("active");

-- CreateIndex
CREATE INDEX "GroupApproval_groupId_idx" ON "GroupApproval"("groupId");

-- CreateIndex
CREATE INDEX "GroupVersion_groupId_createdAt_idx" ON "GroupVersion"("groupId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GroupVersion_groupId_version_key" ON "GroupVersion"("groupId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityPolicy_key_key" ON "SecurityPolicy"("key");

-- AddForeignKey
ALTER TABLE "GroupApproval" ADD CONSTRAINT "GroupApproval_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupVersion" ADD CONSTRAINT "GroupVersion_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
