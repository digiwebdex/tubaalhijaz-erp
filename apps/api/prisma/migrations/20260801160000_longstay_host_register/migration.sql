-- T002-07 — Long Stay Host Register (Host/Iqama/WhatsApp/Absher/entry/exit).
-- Day-85 notify/cron is T002-08 — not in this migration.

ALTER TABLE "LongStay" ADD COLUMN IF NOT EXISTS "hostName" TEXT;
ALTER TABLE "LongStay" ADD COLUMN IF NOT EXISTS "hostIqama" TEXT;
ALTER TABLE "LongStay" ADD COLUMN IF NOT EXISTS "hostWhatsapp" TEXT;
ALTER TABLE "LongStay" ADD COLUMN IF NOT EXISTS "hostRelation" TEXT;
ALTER TABLE "LongStay" ADD COLUMN IF NOT EXISTS "absher" TEXT;
ALTER TABLE "LongStay" ADD COLUMN IF NOT EXISTS "entryDate" TIMESTAMP(3);
ALTER TABLE "LongStay" ADD COLUMN IF NOT EXISTS "exitDate" TIMESTAMP(3);
