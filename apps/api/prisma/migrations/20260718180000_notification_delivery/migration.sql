-- AlterTable
ALTER TABLE "User" ADD COLUMN     "preferredLang" TEXT NOT NULL DEFAULT 'bn';

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "preferredLang" TEXT NOT NULL DEFAULT 'bn';

-- AlterTable
ALTER TABLE "NotificationLog" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "error" TEXT,
ADD COLUMN     "lang" TEXT,
ADD COLUMN     "providerId" TEXT;

-- CreateIndex
CREATE INDEX "NotificationLog_tenantId_createdAt_idx" ON "NotificationLog"("tenantId", "createdAt");

