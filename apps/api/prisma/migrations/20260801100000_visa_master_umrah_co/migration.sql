-- T002-01: Visa Master & Umrah Co linkage
-- HAJJ already on VisaType (T001-01). This migration adds Umrah Co FK + supplier kind.

-- AlterEnum
ALTER TYPE "SupplierType" ADD VALUE 'UMRAH_COMPANY';

-- AlterTable Group
ALTER TABLE "Group" ADD COLUMN "umrahCompanyId" TEXT;

-- AlterTable VisaRequest
ALTER TABLE "VisaRequest" ADD COLUMN "umrahCompanyId" TEXT;

-- CreateIndex
CREATE INDEX "Group_umrahCompanyId_idx" ON "Group"("umrahCompanyId");
CREATE INDEX "VisaRequest_umrahCompanyId_idx" ON "VisaRequest"("umrahCompanyId");

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_umrahCompanyId_fkey"
  FOREIGN KEY ("umrahCompanyId") REFERENCES "Company"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "VisaRequest" ADD CONSTRAINT "VisaRequest_umrahCompanyId_fkey"
  FOREIGN KEY ("umrahCompanyId") REFERENCES "Company"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
