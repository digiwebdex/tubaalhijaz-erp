-- CreateEnum
CREATE TYPE "FinanceEntryKind" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "FinanceEntryStatus" AS ENUM ('RECEIVED', 'PENDING', 'OVERDUE', 'PAID');

-- CreateEnum
CREATE TYPE "PlSection" AS ENUM ('COGS', 'OPEX');

-- AlterTable
ALTER TABLE "ChartAccount" ADD COLUMN     "plSection" "PlSection";

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "fileId" TEXT,
ADD COLUMN     "sourceId" TEXT,
ADD COLUMN     "sourceType" TEXT;

-- CreateTable
CREATE TABLE "FinanceEntry" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "kind" "FinanceEntryKind" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "ref" TEXT,
    "partyName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "groupId" TEXT,
    "status" "FinanceEntryStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FinanceEntry_code_key" ON "FinanceEntry"("code");

-- CreateIndex
CREATE INDEX "FinanceEntry_kind_date_idx" ON "FinanceEntry"("kind", "date");

-- CreateIndex
CREATE INDEX "FinanceEntry_status_idx" ON "FinanceEntry"("status");

-- CreateIndex
CREATE INDEX "Invoice_sourceType_sourceId_idx" ON "Invoice"("sourceType", "sourceId");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "UploadedFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

