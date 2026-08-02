-- T001-02: Readiness gates + PACKAGE gate (additive, backward compatible)
-- Defaults false so existing Group rows and old clients remain valid.

ALTER TABLE "Group" ADD COLUMN "gateVisa" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Group" ADD COLUMN "gatePackage" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Group" ADD COLUMN "gatePayment" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Group" ADD COLUMN "gateBill" BOOLEAN NOT NULL DEFAULT false;
