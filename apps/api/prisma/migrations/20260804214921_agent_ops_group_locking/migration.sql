-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'RETURNED', 'REJECTED', 'LOCKED', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ChangeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "GroupTimelineEvent" AS ENUM ('CREATED', 'SUBMITTED', 'APPROVED', 'REJECTED', 'RETURNED', 'LOCKED', 'UNLOCKED', 'CHANGE_REQUESTED', 'CHANGE_APPROVED', 'CHANGE_REJECTED', 'COMPLETED', 'ARCHIVED', 'IMPERSONATION_STARTED', 'IMPERSONATION_ENDED');

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "actingAsUserId" TEXT,
ADD COLUMN     "reason" TEXT,
ADD COLUMN     "userAgent" TEXT;

-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedByUserId" TEXT,
ADD COLUMN     "locked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lockedAt" TIMESTAMP(3),
ADD COLUMN     "returnReason" TEXT,
ADD COLUMN     "submittedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ChangeRequest" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "field" TEXT,
    "description" TEXT NOT NULL,
    "status" "ChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "decidedByUserId" TEXT,
    "decisionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "ChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupTimelineEntry" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "event" "GroupTimelineEvent" NOT NULL,
    "actorUserId" TEXT,
    "actorLabel" TEXT,
    "actingAsUserId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupTimelineEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImpersonationSession" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "agentUserId" TEXT NOT NULL,
    "reason" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "ImpersonationSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChangeRequest_groupId_idx" ON "ChangeRequest"("groupId");

-- CreateIndex
CREATE INDEX "ChangeRequest_status_idx" ON "ChangeRequest"("status");

-- CreateIndex
CREATE INDEX "GroupTimelineEntry_groupId_createdAt_idx" ON "GroupTimelineEntry"("groupId", "createdAt");

-- CreateIndex
CREATE INDEX "ImpersonationSession_adminUserId_startedAt_idx" ON "ImpersonationSession"("adminUserId", "startedAt");

-- CreateIndex
CREATE INDEX "ImpersonationSession_agentUserId_idx" ON "ImpersonationSession"("agentUserId");

-- AddForeignKey
ALTER TABLE "ChangeRequest" ADD CONSTRAINT "ChangeRequest_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupTimelineEntry" ADD CONSTRAINT "GroupTimelineEntry_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
