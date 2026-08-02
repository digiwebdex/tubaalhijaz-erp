-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UploadKind" ADD VALUE 'VOUCHER';
ALTER TYPE "UploadKind" ADD VALUE 'INVOICE';

-- AlterTable
ALTER TABLE "UploadedFile" ADD COLUMN     "meta" JSONB;

-- AlterTable
ALTER TABLE "VisaRequest" ADD COLUMN     "statusReason" TEXT;

-- AlterTable
ALTER TABLE "HotelBooking" ADD COLUMN     "statusReason" TEXT;

-- AlterTable
ALTER TABLE "TransportBooking" ADD COLUMN     "statusReason" TEXT;

-- AlterTable
ALTER TABLE "CateringBooking" ADD COLUMN     "statusReason" TEXT;

-- AlterTable
ALTER TABLE "AdditionalServiceRequest" ADD COLUMN     "statusReason" TEXT;

-- AlterTable
ALTER TABLE "Voucher" ADD COLUMN     "fileId" TEXT;

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "UploadedFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;


