-- T002-03: Mutamer Visa Pipeline state machine on Passenger

-- CreateEnum
CREATE TYPE "VisaPipelineStatus" AS ENUM (
  'NEW',
  'MOFA',
  'EMBASSY',
  'BIOMETRIC',
  'SUBMITTED',
  'PROCESSING',
  'ISSUED',
  'REJECTED',
  'PASSPORT_RETURNED',
  'COMPLETED',
  'REJECTED_CLOSED'
);

-- AlterTable
ALTER TABLE "Passenger" ADD COLUMN "visaPipelineStatus" "VisaPipelineStatus" NOT NULL DEFAULT 'NEW';
ALTER TABLE "Passenger" ADD COLUMN "visaRejectReason" TEXT;

-- Backfill from T001 Excel echoes (architecture §3.6)
UPDATE "Passenger"
SET "visaPipelineStatus" = 'REJECTED'
WHERE "visaStatus" = 'REJECTED'
   OR ("visaStatusLabel" IS NOT NULL AND "visaStatusLabel" ILIKE '%reject%');

UPDATE "Passenger"
SET "visaPipelineStatus" = 'ISSUED'
WHERE "visaPipelineStatus" = 'NEW'
  AND (
    "visaStatus" = 'APPROVED'
    OR (NULLIF(TRIM("visaNumber"), '') IS NOT NULL)
    OR (
      "visaStatusLabel" IS NOT NULL
      AND "visaStatusLabel" ILIKE '%issued%'
      AND "visaStatusLabel" NOT ILIKE '%not issued%'
    )
  );

UPDATE "Passenger"
SET "visaPipelineStatus" = 'BIOMETRIC'
WHERE "visaPipelineStatus" = 'NEW'
  AND NULLIF(TRIM("biometricStatus"), '') IS NOT NULL
  AND LOWER(TRIM("biometricStatus")) NOT IN ('pending', 'not registered', 'n/a', 'na', '-', 'empty');

-- CreateIndex
CREATE INDEX "Passenger_groupId_visaPipelineStatus_idx" ON "Passenger"("groupId", "visaPipelineStatus");
CREATE INDEX "Passenger_visaPipelineStatus_idx" ON "Passenger"("visaPipelineStatus");
