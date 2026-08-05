# POST-DEPLOYMENT VERIFICATION — EXECUTION SHEET (v2.0.1, PRODUCTION)
Deployed: 2026-08-04 · api+web `:v2.0.1` (healthy) · migrations 25 applied (0 failed). **You execute authenticated workflows with your existing prod accounts (no UAT).** For each: fill Observed + PASS/FAIL + any console/API/server error. Report back; I record, classify, and only then issue release certs. **Any FAIL → STOP; I create PRODUCTION_DEFECT_REPORT.md.**

## Severity legend (for defects)
- **Critical** — data loss/corruption, accounting wrong, security hole, whole workflow down, site/api down.
- **High** — a core workflow broken for a role; RBAC bypass; money/ledger/wallet incorrect in a case.
- **Medium** — partial/edge failure with a workaround; wrong non-financial data.
- **Low** — cosmetic/UX, console warning with no functional impact.

## Capture per step
Expected | Observed | PASS/FAIL | Console errors | API failures (method path→code) | Server errors (api log) | Rollback impact if FAIL

---

## A. Already verified by automated read-only checks (evidence on file) — PASS
- Both containers `v2.0.1` healthy; `web` 200; `api/health` 200.
- New endpoints live: `POST /api/enquiries` validates (400 on bad payload); `POST /api/auth/forgot-password` 200 (no user-enumeration); `/reset-password` page 200.
- RBAC negatives (no token): `/api/rate-cards/transport`, `/api/enquiries`, `/api/ops/groups` → all **401**.
- DB: `TransportRate/VisaRate/AdditionalServiceRate/PasswordResetToken` exist; rate-card tables empty (0/0/0 — seed before booking-price tests); no test data leaked.
- Workers listening: notify, automation, ocr. `booking-confirmation.service.js` in image.
- Public site `/ /services /about /contact` → 200.
- **Pre-existing data note (not a deploy defect):** `LedgerEntry` has 1 orphan row (debit 50000, credit 0, no account) from before this release — logged in KNOWN_ISSUES; clean up separately.

---

## B. PREREQUISITE before booking-price workflows
Rate cards start empty, so Transport/Visa/Additional bookings won't carry a price until you create them.
- [ ] As **Super Admin** → `/rate-cards` → create one TransportRate (e.g. BUS, ONE_WAY, PER_VEHICLE, SAR, price, Effective From today, Active) — needed for §Transport, §Rate Cards, §Booking Confirmation, §Immutable Pricing.

---

## C. AUTHENTICATED WORKFLOWS (execute per role)

### 1. Login — roles: Super Admin, Operations, Finance, Agent, Supplier
Expected: each logs in with prod credentials → lands on its portal/dashboard; wrong password → 401; no console error.

### 2. Dashboard — all roles
Expected: role dashboard loads with data (no white screen, no 5xx), correct widgets for the role.

### 3. RBAC (allow + deny) — all roles
Expected: each role reaches ONLY its permitted areas. Spot-check denies: Agent → `/finance-erp` blocked; Operations → finance edit blocked; Finance → ops write blocked; Supplier → staff areas blocked. **Ops write now needs MANAGE_OPS (granted to OPS_STAFF+SUPER_ADMIN) — Operations must be able to perform an ops write (e.g. create dispatch) = 200, NOT 403.** ← key v2.0.1 regression check.

### 4. Groups — Super Admin, Operations, Agent
Expected: list loads; open a group; create a throwaway test group; edit; readiness gates render. (Delete/cleanup after.)

### 5. Passenger Management — Operations, Agent
Expected: add/list passengers (mutamer fields) in the test group; import preview renders (if used).

### 6. OCR — Operations (review queue), Agent (upload)
Expected: Agent uploads a specimen passport → structured + MRZ fields returned (or manual-entry fallback); Operations sees it in the OCR review queue. No image stored beyond policy.

### 7. Visa — Operations
Expected: visa pipeline / mutamer desk loads; pagination + filter work; a test visa request advances a stage. If a VisaRate exists, price snapshots onto the request.

### 8. Hotel — Agent → Supplier
Expected: Agent creates a hotel request in the test group → routes to a VERIFIED supplier → appears on Supplier portal.

### 9. Transport — Agent → Supplier (uses the rate card from §B)
Expected: Agent creates a transport booking of the rate-card type → booking stores unitPrice/subtotal/VAT(15%)/total/rateCardId (price snapshot).

### 10. Catering — Agent → Supplier
Expected: Agent creates a catering request → routes to supplier → visible on supplier portal.

### 11. Documents — Super Admin, Operations
Expected: document vault loads; upload/view a test document; versioning works.

### 12. Timeline — staff
Expected: workflow/timeline view renders stages for the test group.

### 13. Wallet — Agent, Finance
Expected: Agent wallet balance + statement load; Finance can view wallet ledger. (Note real balances.)

### 14. Finance — Finance
Expected: GL, AR, AP, P&L, Balance Sheet all load with data; no 5xx.

### 15. Ledger — Finance
Expected: ledger entries list/report renders. **After a Booking Confirmation (§17), a balanced debit/credit pair appears for that booking.**

### 16. Rate Cards — Super Admin
Expected: create/list/toggle-active/delete on Transport+Visa+Additional; **staff price override** on a booking (needs EDIT_FINANCIAL_RECORDS) writes audit (original/new/user/reason); a user without that permission → 403.

### 17. Booking Confirmation (UNIFIED — the core v2.0.1 accounting check)
Expected, BOTH paths identical:
- **Supplier path:** Supplier accepts the transport booking (§9) → status ASSIGNED→CONFIRMED, `booking.confirmed` emitted, wallet DEBIT = booking total, ledger postings created, invoice generated, audit `BookingConfirmation` written.
- **Staff path:** Staff confirms an equivalent booking → **identical** wallet DEBIT, ledger, invoice, audit, event.
- **Insufficient wallet:** confirm with balance below total → clear **400** business error; booking stays ASSIGNED; wallet unchanged (no silent confirm).

### 18. Immutable Pricing
Expected: change the rate-card price after a booking exists → the existing booking's stored price is UNCHANGED; a NEW booking uses the new price.

### 19. Automation — Super Admin
Expected: automation overview/rules/runs load; the `booking.confirmed` from §17 triggers the configured rule run (visible in runs).

### 20. Reports — Finance, Super Admin
Expected: finance reports (P&L/BS/AR/AP) return data; export works if used.

### 21. Notifications — all roles
Expected: notification bell loads; a confirmation/automation produces a notification entry (delivery only if SMTP/WA configured).

### 22. Password Reset — public + a real account you control
Expected: `/reset-password` → request link with a prod email you own → (email only if SMTP configured; otherwise token/link recorded in NotificationLog) → set new password → old sessions revoked → login with new password → token single-use. **Use an account you control; this changes that account's password.**

### 23. Enquiries — public → staff inbox
Expected: submit `/contact` form → 200 → appears in the staff enquiries inbox (Super Admin/Operations); mark handled works; Agent (no permission) → 403 on inbox.

---

## D. Reporting back
For each numbered item, send me: PASS/FAIL + Observed + any console/API/server errors. I will:
- Record all results into this sheet + PRODUCTION_INCIDENTS/PATCH docs.
- On any FAIL → create **PRODUCTION_DEFECT_REPORT.md** (classified) and STOP; certification waits until all Critical+High are resolved.
- Only when **every** item is executed + documented and no open Critical/High → issue DEPLOYMENT_COMPLETION_REPORT.md, GO_LIVE_CERTIFICATE.md, FINAL_v2.0.1_PRODUCTION_REPORT.md.
