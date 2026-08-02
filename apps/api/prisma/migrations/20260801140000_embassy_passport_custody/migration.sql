-- T002-05 — slim embassy / passport custody fields on Passenger (SOP-gated product).
-- Architecture §8: EXTEND Passenger; no PassportMovement table unless SOP mandates.

ALTER TABLE "Passenger" ADD COLUMN IF NOT EXISTS "embassyRef" TEXT;
ALTER TABLE "Passenger" ADD COLUMN IF NOT EXISTS "embassySubmittedAt" TIMESTAMP(3);
ALTER TABLE "Passenger" ADD COLUMN IF NOT EXISTS "passportReturnedAt" TIMESTAMP(3);
