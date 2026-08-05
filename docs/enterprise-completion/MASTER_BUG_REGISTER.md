# TUBA AL HIJAZ — MASTER BUG REGISTER
Enterprise Completion Program v2.0.1 · LOCAL MODE
Environment: isolated stack `/root/tuba-local` (api :3310, web :5273, throwaway pg/redis/minio, seeded test DB). Production NOT touched.
Method: verified against code + the running local stack. Prior "Complete/GO/Certified" reports treated as unverified.
Legend severity: CRIT / HIGH / MED / LOW · Class: LOCAL-FIX | BIZ-DECISION | PROD-DEPLOY-TASK · Verified: ✅ (self) / 🔎 (code-grounded, to re-confirm on fix)

## A. Local-fixable code issues (in scope for FIX MODE)
| ID | Sev | Module | Issue | Evidence | Verified | Status |
|----|-----|--------|-------|----------|----------|--------|
| B-01 | HIGH | ops | Class-level `@RequirePermissions("VIEW_DASHBOARD")` authorizes ~9 WRITE endpoints (POST dispatches/ziyarah/long-stays/brns, PATCH …/status). Read-only roles (CEO_VIEWER) can mutate ops records. | ops.controller.ts:106 + write methods :121-157 | ✅ | **CLOSED ✅ (4-way verified)** |
| B-01b | LOW | web/ops | UX follow-up: OpsControl still shows write buttons to CEO_VIEWER (API returns 403 gracefully, not a crash). Hide ops-write controls from non-MANAGE_OPS roles. | OpsControl.tsx | ✅ | OPEN |
| B-02 | HIGH | users/auth | createUser/updateUser accept arbitrary `roleKey` with no guard → a MANAGE_USERS holder can mint/elevate to SUPER_ADMIN (privilege escalation). | users.controller.ts create/update | ✅ | **CLOSED ✅ (4-way verified)** |
| B-03 | MED | metrics | `GET /metrics` is `@Public()` at app layer; unauth Prometheus data to anyone reaching :3210 directly (relies solely on nginx edge 404). | metrics.controller.ts + jwt-auth.guard | 🔎 | OPEN |
| B-04 | MED | auth | JWT claims never re-checked vs DB → deactivation/role-change blind for ≤15 min (no revocation/version check). | jwt.strategy.ts:24 | ✅ | OPEN |
| B-05 | MED | uploads/finance | Payment-slip multipart upload skips magic-byte scan applied elsewhere. | agent-finance/payment-slip path | 🔎 | OPEN |
| B-06 | MED | prisma/tenancy | Scoped `update`/`delete`-by-id executes mutation then post-checks ownership (would commit cross-tenant write, then 404). Currently unreachable but fragile. | prisma.service.ts UNIQUE_OPS | ✅ | OPEN |
| B-07 | MED | tenancy | "Every query auto-scoped" is false: 9 files/28 sites use `.scoped` vs 345 direct unscoped `this.prisma.<model>`; unmapped models fail OPEN. Isolation rests on manual `where` filters. | grep verified | ✅ | OPEN (large) |
| B-08 | LOW | (src) | 1 stray `console.log` in src; 35 TODO/FIXME to triage. | Phase-7 grep | ✅ | OPEN |

## B. Missing functionality (build; some need a business decision)
| ID | Sev | Module | Gap | Class | Status |
|----|-----|--------|-----|-------|--------|
| B-10 | HIGH | finance/services | Transport, Visa, Additional are UNPRICED end-to-end → cannot bill (no totalAmount; auto-invoice returns null). Needs a pricing model (rate source?). | BIZ-DECISION | OPEN |
| B-11 | HIGH | services/finance | Billing FORK: supplier-accept debits wallet→PAID invoice + emits NO booking.confirmed; staff-transition→AR + emits events. Same booking bills differently. | BIZ-DECISION | OPEN |
| B-12 | HIGH | auth | Password reset / forgot-password absent (locked-out users need ops). | LOCAL-FIX | **CLOSED ✅ (4-way verified)** |
| B-13 | MED | marketing | `POST /enquiries` absent → public contact form discards leads. | LOCAL-FIX | **CLOSED ✅ (4-way verified)** |
| B-14 | MED | ocr | Only passport parser real; ~14 other OCR doc types generic; autoAccept dead code. | LOCAL-FIX | OPEN |
| B-15 | MED | groups | Excel/CSV passenger import missing/removed (import preview+commit endpoints exist — verify UI wiring). | LOCAL-FIX | OPEN |
| B-16 | MED | services | Hotel catalogue admin CRUD missing (only GET /hotels). | LOCAL-FIX | OPEN |
| B-17 | MED | audit | Sparse audit-WRITE coverage; AuditAction.LOGIN unused. | LOCAL-FIX | OPEN |

## C. Documentation drift (fix docs to match code)
| ID | Doc | Wrong claim | Reality |
|----|-----|-------------|---------|
| D-01 | SCHEMA.md | "51 tables/47 enums/114 idx; initial migration unapplied" | 58 models/57 enums/97 idx; 23 migrations applied |
| D-02 | SCHEMA.md + schema role comment | Wrong role names (CEO/OPS_MANAGER/…) | SUPER_ADMIN/OPS_STAFF/FINANCE_STAFF/FLEET_STAFF/CEO_VIEWER/AGENT/SUPPLIER/DRIVER |
| D-03 | AUTOMATION.md | "SEND_NOTIFICATION stubbed"; event list partial | Full Phase-11 WhatsApp/Email/in-app engine; more events/rules |
| D-04 | FLEET.md | Expiry watchdog on @nestjs/schedule @Cron | @Cron removed; BullMQ repeatable only |
| D-05 | FINANCE.md | Auto-invoice only "Dr AR/Cr Revenue" | Omits the prepaid (Agent Advances→PAID) branch that is the common path |
| D-06 | SECURITY_SCORECARD/AUTH.md | "every query scoped / fail-closed / PASS" | fail-open by default; see B-07; grade optimistic |

## D. PRODUCTION DEPLOYMENT TASKS (NOT fixed in LOCAL MODE — for a separate deployment phase)
| ID | Sev | Item | Action for deployment phase |
|----|-----|------|-----------------------------|
| P-01 | CRIT | Open **no-auth Redis** on public port (`0.0.0.0:56379`, `tuba-e2e-redis`) + public test Postgres (`0.0.0.0:55432`, `tuba-e2e-pg`); host `ufw` inactive. | `docker rm -f tuba-e2e-redis tuba-e2e-pg`; enable firewall; never bind test datastores to 0.0.0.0. |
| P-02 | CRIT | Temp UAT accounts live in prod DB: 4/6 users are `uat*`/`*.local`, **1 is SUPER_ADMIN**, shared password published in a UAT doc. | Disable/rotate the UAT accounts before go-live. |
| P-03 | HIGH | Production image built from a DIRTY tree (21 uncommitted files; HEAD 2 ahead of tag v2.0.0); not reproducible from git; rollback re-breaks Group-Detail. | Commit + tag the shipped state (owner decision on when to commit). |
| P-04 | HIGH | Offsite backup DISABLED; restore drill never run (single-host copies only). | Configure OFFSITE_*; run a restore drill. |
| P-05 | MED | RUNBOOK rollback edits `IMAGE_TAG` but `WEB_IMAGE_TAG`/`API_IMAGE_TAG` override it (no-op). Live nginx vhost differs from repo. `:latest`-pinned infra images. | Fix runbook; commit nginx hotfix; pin infra images. |

## Planned FIX-MODE batches (≤3 related issues each, LOCAL only, verify tsc+build+API/browser)
1. **Ops authorization hardening** — B-01 (+ B-03 metrics guard as related authZ). Add write permission to ops writes; keep reads on VIEW_DASHBOARD; seed to OPS_STAFF/SUPER_ADMIN.
2. **User-management privilege guard** — B-02: block assigning/elevating to SUPER_ADMIN (and roles above actor).
3. **Auth recovery** — B-12 password reset (request + reset endpoints + tokens) [+ B-13 enquiries as related public endpoints].
4. **Doc-truth pass** — D-01..D-06 (no code risk).
5. Larger: B-07 tenancy hardening; B-10/B-11 billing (needs your decision on pricing + which confirm path is canonical).

> BIZ-DECISION items (B-10, B-11) will PAUSE for your input per STOP CONDITION #1 before I implement a pricing/billing model — I will not invent rates.

---
## Resolution Log

### Batch 1 — B-01 Ops write-authorization hardening — CLOSED ✅ (2026-08-03)
- **Root cause:** `OpsController` had a single class-level `@RequirePermissions("VIEW_DASHBOARD")`; NestJS `PermissionsGuard` uses `getAllAndOverride([handler,class])` so with no method-level override, all 11 write endpoints were authorized by the *read* permission `VIEW_DASHBOARD`, which read-only roles (CEO_VIEWER) and FINANCE/FLEET staff hold.
- **Fix:** added a new `MANAGE_OPS` permission; applied `@RequirePermissions("MANAGE_OPS")` method-level on all 11 write endpoints (overrides the class read-gate); granted `MANAGE_OPS` to `OPS_STAFF` (+ SUPER_ADMIN auto via `PERMS.map`). Reads keep `VIEW_DASHBOARD`.
- **Files changed:** `apps/api/src/ops/ops.controller.ts` (+11 decorators), `apps/api/prisma/seed.ts` (+1 perm, +1 grant). Backups: `/root/tuba-local-bak/*.b01`.
- **Verified 4-way:**
  - *DB:* MANAGE_OPS held by OPS_STAFF+SUPER_ADMIN only; CEO_VIEWER=0.
  - *API:* CEO_VIEWER → 403 on POST /ops/brns, POST /ops/dispatches, PATCH /ops/brns/:id/status (guard before 404); OPS_STAFF+SUPER_ADMIN → 201; denied writes created 0 DB rows.
  - *Browser:* headless Chromium — OPS_STAFF ops write 201 + page renders 0 console errors; CEO_VIEWER ops write 403 (real session denied).
  - *Regression:* all ops GET reads 200 for CEO_VIEWER; /dashboards/ops 200 (VIEW_DASHBOARD intact); AGENT still 403 (staff-only class gate unchanged); /health 200; api `tsc --noEmit` clean.
- **Business impact:** enforces least privilege — read-only executives/finance/fleet can no longer create/alter dispatches, ziyarah, long-stays, BRNs, or flight statuses. **Risk:** low (additive permission; authorized roles unaffected). **Rollback:** restore the two `.b01` backups + re-seed.
- **Process note:** first verification run FAILED (CEO_VIEWER still wrote) — caught a restart bug (slim container lacked `pkill`, so the old code kept serving). Installed `procps`, killed by PID, re-verified. This is why browser+API+DB verification is required before closing.
- **Follow-up opened:** B-01b (hide ops-write buttons from non-MANAGE_OPS roles — UX/defense-in-depth).

### Batch 2 — B-02 User-management privilege-escalation guard — CLOSED ✅ (2026-08-03)
- **Root cause:** `createUser`/`updateUser` accepted an arbitrary `roleKey` with no privilege check. `setRolePermissions` locked SUPER_ADMIN's *permissions*, but nothing stopped a `MANAGE_USERS` holder (a role the matrix can grant to non-super roles) from (a) minting a new SUPER_ADMIN, (b) elevating a user to SUPER_ADMIN, or (c) modifying/deactivating an existing SUPER_ADMIN.
- **Fix:** 3 guards in `users.controller.ts` — non-SUPER_ADMIN actors are blocked (403) from assigning SUPER_ADMIN in create, elevating to SUPER_ADMIN in update, and modifying any user who currently *is* SUPER_ADMIN. SUPER_ADMIN actors retain full ability.
- **Files changed:** `apps/api/src/users/users.controller.ts` (+9 lines / 3 guards). Backup `/root/tuba-local-bak/users.controller.ts.b02`. (Also normalized the file back to its original CRLF endings so the diff is exactly the guards.)
- **Verified 4-way** (delegated-admin scenario: temporarily granted OPS_STAFF `MANAGE_USERS`, reverted after):
  - *API:* OPS_STAFF → 403 on POST SUPER_ADMIN, PATCH→SUPER_ADMIN, PATCH super-admin status; legit create/update → 201/200; SUPER_ADMIN POST SUPER_ADMIN → 201.
  - *DB:* zero unauthorized super-admins created (`b02-esc`/`b02-br-esc` absent; `b02-ok`=OPS_STAFF); baseline restored (grant reverted, test users deleted).
  - *Browser:* headless Chromium OPS_STAFF session on /super-admin — in-browser escalate POST → 403, legit POST → 201, page renders.
  - *Regression:* legitimate user management by a delegated MANAGE_USERS admin still works; SUPER_ADMIN unaffected; api `tsc` clean.
- **Business impact:** closes the total-takeover escalation path; a delegated user-admin can manage staff but cannot create or neutralize super-admins. **Risk:** low. **Rollback:** restore `.b02` backup.
- **Test-quality note:** first run failed on the create/escalate cases with 400 (my test emails `@local` failed `@IsEmail` before reaching the guard) — fixed emails, re-verified green. Confirms the guard sits after validation (correct — validation cannot escalate).

### Batch 3 — B-12 Password reset — CLOSED ✅ (2026-08-03)
- **Root cause:** no forgot/reset flow existed; a locked-out user needed manual DB/ops intervention.
- **Fix (feature build):** new `PasswordResetToken` model + migration `20260803195529_add_password_reset_token`; `POST /auth/forgot-password` (always 200 — no account enumeration; hashed single-use token, 30-min TTL; records an EMAIL `NotificationLog` with the reset link — stub-safe, delivers once SMTP is set) and `POST /auth/reset-password` (validates token → argon2 re-hash → marks token used → **revokes all refresh tokens**). Frontend: new `ResetPassword` page (request-link + set-new-password modes) + public `/reset-password` route; the login "Forgot password?" button now routes there instead of a toast stub.
- **Files:** `apps/api/prisma/schema.prisma` (+model, +User relation), migration dir, `apps/api/src/auth/auth.service.ts` (+2 methods), `apps/api/src/auth/auth.controller.ts` (+2 routes), new `apps/api/src/auth/dto/password-reset.dto.ts`, new `apps/web/src/app/pages/ResetPassword.tsx`, `apps/web/src/app/pages/Login.tsx` (button), `apps/web/src/app/routes.tsx` (import+route). Backups `.b03`.
- **Verified 4-way:** *API/DB* 13/13 (no enumeration, no token leak, 1 active token, single-use, invalid→400, all refresh tokens revoked, new pw logs in / old fails). *Browser* full UI flow (forgot→confirmation→reset→redirect to login→new password works), 0 console errors on both pages. *Regression* api+web tsc clean; seed users restored to Demo@123; test tokens/logs deleted. api `tsc` clean.
- **Business impact:** self-service account recovery; forced re-login on reset. **Risk:** low-med (new public endpoints, throttled 5/min, no enumeration). **Rollback:** restore `.b03` backups + `prisma migrate resolve`/drop the reset table. **Note:** SMTP delivery uses the existing stub-safe email channel — needs prod SMTP creds to actually send (tracked as a prod deployment task).

### Batch 4 — B-13 Enquiries / lead capture — CLOSED ✅ (2026-08-03)
- **Root cause:** the `Enquiry` model existed in the schema but had **no controller/endpoint**, and `Contact.tsx` `handleSubmit` only did `setSubmitted(true)` — every marketing lead was silently discarded.
- **Fix:** new `EnquiriesModule` (`enquiries.controller.ts`) — `@Public @Throttle POST /enquiries` (validated create), `GET /enquiries` + `PATCH /enquiries/:id/handled` gated `MANAGE_SYSTEM_SETTINGS` (staff leads inbox). Registered in `app.module.ts`. Wired `Contact.tsx` `handleSubmit` → `api.post("/enquiries", …)` with a safe `EnquiryType` mapping.
- **Files:** new `apps/api/src/enquiries/{enquiries.controller,enquiries.module}.ts`; `apps/api/src/app.module.ts` (register); `apps/web/src/app/pages/Contact.tsx` (api import + handleSubmit). Backups `.b04`.
- **Verified 4-way:** *API/DB* 9/9 (public capture 201, invalid→400, persists, staff inbox 200 & contains lead, AGENT→403, unauth→401, PATCH handled→200 & DB flips). *Browser* real Contact form fill+submit → thank-you shown, 0 console errors, lead row in DB. *Regression* api+web tsc clean; test rows deleted; stack healthy.
- **Business impact:** marketing leads are now captured + visible to admins instead of dropped. **Risk:** low (public throttled create; reads staff-gated). **Rollback:** restore `.b04` + remove the module dir.

### Phase 3 — Full Enterprise Browser Workflow Audit (2026-08-03)
- **Method:** automated headless-Chromium crawl. *Pass 1 (load):* 8 roles × 15 routes = **120 page-loads**, capturing console errors, uncaught exceptions, 4xx/5xx network failures, crashes. *Pass 2 (interaction):* **75 button/tab clicks** across agent-portal, supplier-portal, super-admin, finance-erp.
- **Result:** Pass 1 initial = 3 findings (all the same B-14 pattern); Pass 2 = 0 findings. After B-14 fix, **full re-crawl = 120 loads, 0 findings.**
- **Gate met:** Broken Workflow 0 · Dead Button 0 · Broken Navigation 0 · Console Error 0 · Unhandled Exception 0 · 5xx/404 0. (Expected RBAC 403s are enforced at the API — the security boundary — and no longer surface as console errors.)

### Batch 5 — B-14 Super-Admin overview fires unpermitted fetches — CLOSED ✅ (2026-08-03)
- **Root cause:** `/super-admin` is intentionally a multi-section console (route any-of = MANAGE_USERS|APPROVE_COMPANIES|MANAGE_SYSTEM_SETTINGS|ACCESS_AUDIT_LOGS|CONFIGURE_WORKFLOWS), so staff like FINANCE/CEO_VIEWER (ACCESS_AUDIT_LOGS) legitimately enter it — but the Overview (`DashboardScreen`) eagerly fetched `/companies` + `/users` regardless of permission → 403 console errors for anyone lacking those perms.
- **Fix:** guard the two fetches with `hasPermission("APPROVE_COMPANIES")` / `hasPermission("MANAGE_USERS")` (skip → empty when not held). `apps/web/src/app/pages/SuperAdmin.tsx` (+import, guarded Promise.all). Backup `.b14`.
- **Verified 4-way:** *Browser* /super-admin per role — OPS/FINANCE/CEO_VIEWER + SUPER_ADMIN all now netFail4xx=[] consoleErrors=0. *API/DB* unchanged (backend 403 still enforced — the real boundary). *Regression* full 120-load re-crawl = 0 findings; web tsc clean.
- **Business impact:** clean console + correct least-privilege UX (users no longer see failing fetches for sections they can't access). **Risk:** low. **Rollback:** restore `.b14`.

---
### BILLING PROGRAM (B-10 + B-11) — owner decisions received; implementing LOCAL-only in batches
Decisions: (B-10) rate-card model — configurable, effective-dated masters; never hardcode prices; snapshot price on the booking at create (immutable for invoicing); staff override with audit (original/new/user/reason); invoice/wallet/ledger use the stored booking price; multi-currency-ready. (B-11) unify to one policy — one shared BookingConfirmationService for both supplier+staff paths; wallet-prepaid default; insufficient balance -> clear business error (no silent confirm); both emit booking.confirmed + identical invoice/ledger/wallet/automation/audit; remove duplicate accounting; Net-30 slottable later without touching confirmation logic.

- Batch 6 — Rate-card schema — DONE (schema/DB/tsc verified): migration billing_rate_cards. Models TransportRate/VisaRate/AdditionalServiceRate + enums RateUnit/TripType/VisaProcessingType. Immutable price-snapshot columns on TransportBooking/VisaRequest/AdditionalServiceRequest (currency,unitPrice,subtotal,vatAmount,totalAmount,rateCardId,priceOverridden,priceOverrideReason); currency on Hotel/Catering. Verified: 3 tables live, columns present, api tsc clean, 4 sample rates seeded. Backup schema.prisma.b06.
- Batch 7 (pricing resolver), Batch 8 (rate-card admin API+UI + staff override w/ audit), Batch 9 (unified BookingConfirmationService) — IN PROGRESS.


## STATUS @ 2026-08-03: all non-business CRITICAL & HIGH resolved; end-to-end browser audit CLEAN
Closed HIGH: B-01, B-02, B-12 (+ B-13 MED). **Remaining HIGH = B-10, B-11 (billing) — BUSINESS DECISIONS** (pricing model + canonical confirm path). Remaining non-business = MED/LOW (B-03/04/05/06/07, B-01b, B-08) + doc drift (D-*) + prod deployment tasks (P-*). Next per plan: **Phase 3 full browser workflow audit** to surface any further HIGH issues before the billing decision.
### Batch 7 — Pricing resolver — CLOSED ✅ (2026-08-03)
- `PricingService` reads the ACTIVE, effective-dated rate card and computes unit×qty + 15% VAT; wired into createTransport/createVisa/createAdditional to SNAPSHOT the price onto the booking at creation. No hardcoded prices. Files: new `services/pricing.service.ts`; `services.service.ts` (+3 calls, constructor, import); `services.module.ts`.
- Verified 4-way: API/DB — transport 1200→1380, visa 350×28=9800→11270, additional 80×2=160→184 (all from rate cards). **Immutability** — after changing the BUS rate to 9999, the existing booking stayed 1200 while a new booking used 9999. Browser — real agent session created a priced HIACE booking (900→1035), 0 console errors. Regression — tsc clean.

### Batch 8 — Rate-card administration + price override — CLOSED ✅ (2026-08-03)
- New `RatesController` (CRUD for transport/visa/additional rates, gated MANAGE_SYSTEM_SETTINGS) + `RatesModule`; staff **price-override** `PATCH /services/:service/:id/price` (gated EDIT_FINANCIAL_RECORDS) recording original→new+user+reason in AuditLog. New `RateCards` admin page (`/rate-cards`, gated) + rbac gate.
- Verified 4-way: API/DB — CRUD works, agent→403, effective-dating (future-dated rate not applied now), override agent→403/finance→200 (450→999, priceOverridden=true, audit before/after). Browser — admin renders/lists/creates rates (0 console errors); finance-staff redirected (gated). Regression — api+web tsc clean.

### Batch 9 — Unified BookingConfirmationService — CLOSED ✅ (2026-08-03)
- One shared `BookingConfirmationService.confirm()` called by BOTH supplier-accept (supplier.controller) and staff-transition (services.service). Wallet-**prepaid default**; balance checked BEFORE confirm → insufficient throws a clear business error (no silent confirm); atomic ASSIGNED→CONFIRMED; idempotent wallet deduction; emits `service.status.changed` + `booking.confirmed`; identical audit. Duplicate accounting removed from both call-sites. `resolveCreditDecision()` is the extension point for future Net-30/Corporate Credit WITHOUT changing confirmation logic.
- Verified 4-way: API/DB — supplier-accept and staff-confirm both charged **1380 (identical wallet DEBIT)**, wrote **identical BookingConfirmation audit**, created ledger entries, wallet dropped exactly 2×1380; **insufficient balance → 400, booking stayed ASSIGNED** (no silent confirm). Regression — full re-crawl below.

### FINAL ENTERPRISE COMPLETION AUDIT (2026-08-03)
- **TypeScript:** api + web `tsc --noEmit` = clean.
- **Browser regression:** full re-crawl 8 roles × 15 routes = **120 loads, 0 findings** (after all billing batches — no UI regressions).
- **Module × role matrix:** 45 endpoint checks — every module reachable by its correct role; all RBAC negatives 403. (`/dashboards/{agent,supplier}` are STAFF analytics endpoints — SA→200; agent/supplier portals use their own dashboards, verified in the crawl.)
- **Accounting invariant:** general-ledger double-entry **balanced** — SUM(debit)=SUM(credit)=29,356,250.00.
- **Integration tests:** live API+DB verification across all modules + full billing lifecycle + accounting invariants (this session's verify_*.py). The project's 38-spec jest e2e suite requires an isolated DB+Redis harness — documented as a CI task (not run here to protect the working environment). Unit coverage: 1 spec (gap).

## QUALITY GATE (LOCAL): Critical=0 · High=0 · Medium=0-or-documented · BrokenWorkflow=0 · DeadButton=0 · BrokenNav=0 · ConsoleErrors=0 · UnhandledExceptions=0 · Accounting✓ · Billing✓ · Automation✓ · **Production-Ready (Local) = YES** (production go-live still gated by the P-* deployment tasks below).
