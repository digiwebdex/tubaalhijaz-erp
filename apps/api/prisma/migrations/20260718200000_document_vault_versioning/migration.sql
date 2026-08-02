-- AlterTable
ALTER TABLE "UploadedFile" ADD COLUMN     "expiryDate" TIMESTAMP(3),
ADD COLUMN     "isLatest" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "scanStatus" TEXT NOT NULL DEFAULT 'CLEAN',
ADD COLUMN     "supersedesId" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE UNIQUE INDEX "UploadedFile_supersedesId_key" ON "UploadedFile"("supersedesId");

-- CreateIndex
CREATE INDEX "UploadedFile_companyId_kind_isLatest_idx" ON "UploadedFile"("companyId", "kind", "isLatest");

-- CreateIndex
CREATE INDEX "UploadedFile_expiryDate_idx" ON "UploadedFile"("expiryDate");

-- AddForeignKey
ALTER TABLE "UploadedFile" ADD CONSTRAINT "UploadedFile_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "UploadedFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

