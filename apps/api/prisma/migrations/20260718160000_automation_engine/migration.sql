-- AlterTable
ALTER TABLE "AutomationRule" ADD COLUMN     "conditions" JSONB,
ADD COLUMN     "eventKey" TEXT;

-- AlterTable
ALTER TABLE "AutomationRunLog" ADD COLUMN     "action" TEXT,
ADD COLUMN     "eventKey" TEXT,
ADD COLUMN     "jobId" TEXT;

-- CreateIndex
CREATE INDEX "AutomationRule_eventKey_enabled_idx" ON "AutomationRule"("eventKey", "enabled");

-- CreateIndex
CREATE INDEX "AutomationRunLog_startedAt_idx" ON "AutomationRunLog"("startedAt");

