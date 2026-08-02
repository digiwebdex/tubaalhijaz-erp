-- T001-04: Mutamer (Passenger) Excel foundation fields — additive only.

ALTER TABLE "Passenger" ADD COLUMN "age" INTEGER;
ALTER TABLE "Passenger" ADD COLUMN "mainEaCode" TEXT;
ALTER TABLE "Passenger" ADD COLUMN "mainEaName" TEXT;
ALTER TABLE "Passenger" ADD COLUMN "subEaCode" TEXT;
ALTER TABLE "Passenger" ADD COLUMN "subEaName" TEXT;
ALTER TABLE "Passenger" ADD COLUMN "biometricStatus" TEXT;
ALTER TABLE "Passenger" ADD COLUMN "visaNumber" TEXT;
ALTER TABLE "Passenger" ADD COLUMN "mofaNumber" TEXT;
ALTER TABLE "Passenger" ADD COLUMN "mutamerType" TEXT;
ALTER TABLE "Passenger" ADD COLUMN "visaStatusLabel" TEXT;

CREATE INDEX "Passenger_mofaNumber_idx" ON "Passenger"("mofaNumber");
CREATE INDEX "Passenger_subEaCode_idx" ON "Passenger"("subEaCode");
