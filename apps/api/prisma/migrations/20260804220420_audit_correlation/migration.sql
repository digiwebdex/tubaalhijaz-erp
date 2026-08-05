-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "correlationId" TEXT,
ADD COLUMN     "workflowId" TEXT;

-- AlterTable
ALTER TABLE "GroupTimelineEntry" ADD COLUMN     "correlationId" TEXT;
