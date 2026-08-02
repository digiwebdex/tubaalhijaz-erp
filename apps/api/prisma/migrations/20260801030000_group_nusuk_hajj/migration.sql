-- T001-01: Group Nusuk identity & HAJJ visa type
-- Additive / backward compatible: existing Group rows keep working without Nusuk number.

-- AlterEnum
ALTER TYPE "VisaType" ADD VALUE 'HAJJ';

-- AlterTable
ALTER TABLE "Group" ADD COLUMN "nusukGroupNumber" TEXT;
ALTER TABLE "Group" ADD COLUMN "hajiWhatsapp" TEXT;
ALTER TABLE "Group" ADD COLUMN "consulate" TEXT;
ALTER TABLE "Group" ADD COLUMN "servicesValue" DECIMAL(14,2);
ALTER TABLE "Group" ADD COLUMN "uploadedByUserId" TEXT;
ALTER TABLE "Group" ADD COLUMN "uploadedByLabel" TEXT;

-- CreateIndex (unique when set; PostgreSQL allows multiple NULLs)
CREATE UNIQUE INDEX "Group_nusukGroupNumber_key" ON "Group"("nusukGroupNumber");

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_uploadedByUserId_fkey"
  FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
