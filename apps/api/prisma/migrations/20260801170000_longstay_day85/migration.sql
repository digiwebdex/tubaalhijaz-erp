-- T002-08 Day-85 Compliance Engine
-- Architecture §8: "Day-85 | Derived from entry date + 85; store `day85NotifiedAt`".
-- Additive + nullable: existing rows keep working, no backfill needed.
ALTER TABLE "LongStay" ADD COLUMN IF NOT EXISTS "day85NotifiedAt" TIMESTAMP(3);
