-- AlterTable
ALTER TABLE "OcrDocument" ADD COLUMN     "duplicateOfPassengerId" TEXT,
ADD COLUMN     "validation" JSONB;

-- AddForeignKey
ALTER TABLE "OcrDocument" ADD CONSTRAINT "OcrDocument_duplicateOfPassengerId_fkey" FOREIGN KEY ("duplicateOfPassengerId") REFERENCES "Passenger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

