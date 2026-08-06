# 05 · POST-DEPLOYMENT VERIFICATION CHECKLIST — v2.0.1 (deeper; run after smoke, ~15 min)
Exercises the actual v2.0.1 changes. Prefer a throwaway test group/booking; do NOT alter real customer records. Clean up test data after.

## Schema & data integrity
- [ ] `PasswordResetToken`, `TransportRate`, `VisaRate`, `AdditionalServiceRate` tables exist (Migration Plan §post).
- [ ] `TransportBooking` has `currency,unitPrice,rateCardId` (3 cols).
- [ ] GL balanced: `SUM(debit)=SUM(credit)` on `LedgerEntry`.

## Security fixes (must all hold)
- [ ] **P-01/P-02 confirmed closed** on the host: no `tuba-e2e-*` containers; `ufw status`=active; UAT super-admin disabled.
- [ ] **Ops write-authz (B-01):** a non-ops staff account (only VIEW_DASHBOARD) gets **403** on an ops write (e.g. create dispatch); ops staff succeeds.
- [ ] **Escalation guard (B-02):** a delegated admin (non-SUPER_ADMIN) gets **403** creating/elevating a `SUPER_ADMIN` or modifying a super-admin; SUPER_ADMIN still can.
- [ ] **Super-admin console (B-14):** overview loads only for SUPER_ADMIN; other roles blocked cleanly.

## New feature — password reset (B-12)
- [ ] `POST /api/auth/forgot-password` with a known email → 200 (generic response); a `PasswordResetToken` row is created; a NotificationLog EMAIL row with the reset link exists (or an email is delivered if SMTP configured).
- [ ] `POST /api/auth/reset-password` with the token → 200; old refresh tokens revoked; login works with the new password; token is single-use (second attempt fails).
- [ ] Unknown email → still 200 (no user enumeration).

## New feature — billing (B-06/07/08/09)
- [ ] **Rate-card admin (B-08):** SUPER_ADMIN creates a TransportRate (e.g. BUS, ONE_WAY, PER_VEHICLE, SAR, price, effectiveFrom today); it appears in `/rate-cards`; toggle active + delete work; each writes an AuditLog.
- [ ] **Pricing snapshot (B-07):** create a transport booking of that type → booking stores `unitPrice/subtotal/vatAmount(15%)/totalAmount/rateCardId`.
- [ ] **Immutability:** change the rate-card price; the EXISTING booking's stored price is UNCHANGED; a NEW booking uses the new price.
- [ ] **Override (B-08):** staff with EDIT_FINANCIAL_RECORDS overrides a booking price → totals recompute; AuditLog records original+new+user+reason; a user without the permission gets 403.
- [ ] **Unified confirmation (B-09):** confirm one booking via **supplier-accept** and an equivalent one via **staff-confirm** → BOTH: flip ASSIGNED→CONFIRMED, emit `booking.confirmed`, deduct the SAME wallet amount, write a `BookingConfirmation` audit, generate the same invoice/ledger postings.
- [ ] **Insufficient balance:** confirm with a wallet below the amount → clear **400** business error; booking stays ASSIGNED; wallet unchanged (no silent confirm).

## Lead capture (B-13)
- [ ] Website `/contact` submit → 200; enquiry visible in the staff enquiries inbox; agent (non-staff-permission) gets 403 on the inbox.

## Regression sweep (no console errors / broken nav)
- [ ] Log in as each of: staff, finance, agent, supplier — visit their main screens; no white screens, no console `TypeError/ReferenceError`, no 5xx/404 in network tab.

## Cleanup
- [ ] Remove any test group/booking/rate-card/enquiry created above.
