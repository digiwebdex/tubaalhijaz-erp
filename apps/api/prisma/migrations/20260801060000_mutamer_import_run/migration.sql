-- T001-05: Mutamer import run fingerprint (duplicate-import guard)

CREATE TABLE "MutamerImportRun" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "successCount" INTEGER NOT NULL,
    "importedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MutamerImportRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MutamerImportRun_tenantId_createdAt_idx" ON "MutamerImportRun"("tenantId", "createdAt");

CREATE UNIQUE INDEX "MutamerImportRun_groupId_fileHash_key" ON "MutamerImportRun"("groupId", "fileHash");

ALTER TABLE "MutamerImportRun" ADD CONSTRAINT "MutamerImportRun_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
