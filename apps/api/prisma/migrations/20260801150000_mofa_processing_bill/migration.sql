-- T002-06 — MOFA Processing Bill (Invoice kind) + Approval Sign / CR Date.
-- Architecture: MOFA Number (Passenger) ≠ MOFA Processing Bill (Invoice).

CREATE TYPE "InvoiceKind" AS ENUM ('STANDARD', 'MOFA_PROCESSING');

ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "kind" "InvoiceKind" NOT NULL DEFAULT 'STANDARD';
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "approvalSign" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "crDate" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Invoice_kind_idx" ON "Invoice"("kind");
