-- CreateEnum
CREATE TYPE "LongStayStatus" AS ENUM ('UPCOMING', 'ACTIVE', 'RENEWAL', 'COMPLETED');

-- CreateEnum
CREATE TYPE "RenewalStatus" AS ENUM ('NONE', 'REQUESTED', 'APPROVED');

-- DropIndex
DROP INDEX "Invoice_sourceType_sourceId_idx";

-- CreateTable
CREATE TABLE "LongStay" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "hotelName" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "nights" INTEGER NOT NULL,
    "checkIn" TIMESTAMP(3) NOT NULL,
    "checkOut" TIMESTAMP(3) NOT NULL,
    "pax" INTEGER NOT NULL DEFAULT 0,
    "renewal" "RenewalStatus" NOT NULL DEFAULT 'NONE',
    "status" "LongStayStatus" NOT NULL DEFAULT 'UPCOMING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LongStay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LongStay_code_key" ON "LongStay"("code");

-- CreateIndex
CREATE INDEX "LongStay_status_idx" ON "LongStay"("status");

-- CreateIndex
CREATE INDEX "LongStay_groupId_idx" ON "LongStay"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletTransaction_refType_refId_direction_key" ON "WalletTransaction"("refType", "refId", "direction");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_sourceType_sourceId_key" ON "Invoice"("sourceType", "sourceId");

-- AddForeignKey
ALTER TABLE "LongStay" ADD CONSTRAINT "LongStay_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LongStay" ADD CONSTRAINT "LongStay_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

