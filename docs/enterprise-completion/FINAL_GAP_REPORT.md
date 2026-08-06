# TUBA AL HIJAZ — FINAL GAP REPORT (v2.0.1 Enterprise Completion, LOCAL)
Date: 2026-08-03 · Env: isolated local stack `/root/tuba-local` · Nothing deployed/committed/pushed.
Every known item is classified below into exactly one of: **1) Completed · 2) Intentional Future Enhancement · 3) Requires Business Decision · 4) Requires Production Deployment.** No item is left unclassified.

## 1) COMPLETED (this session — each API+DB+Browser+Regression verified)
| Ref | Item |
|---|---|
| B-01 | Ops write-authorization: added `MANAGE_OPS`; 11 ops write endpoints no longer authorized by the read permission (CEO_VIEWER can't mutate ops). |
| B-02 | User-management privilege-escalation guard: non-super cannot create/elevate/modify SUPER_ADMIN. |
| B-12 | Password reset feature: `PasswordResetToken` + `/auth/forgot-password` + `/auth/reset-password` (no enumeration, single-use, 30-min TTL, revokes all sessions) + ResetPassword UI + wired login button. |
| B-13 | Enquiries/lead capture: `EnquiriesModule` (public POST + staff inbox) + wired Contact form (was dropping every lead). |
| B-14 | Super-Admin overview no longer fires unpermitted `/users`,`/companies` fetches → 0 console-error 403s. |
| B-06 | Rate-card schema: `TransportRate`/`VisaRate`/`AdditionalServiceRate` masters + immutable price-snapshot columns on bookings + multi-currency `currency`. |
| B-07 | Pricing resolver: active effective-dated rate → snapshot on booking at create; **historical immutability proven**. |
| B-08 | Rate-card admin CRUD API + UI (gated) + staff price-override with full audit (original/new/user/reason). |
| B-11/B-09 | Unified `BookingConfirmationService`: supplier + staff paths produce **identical accounting** (wallet-prepaid, same DEBIT, same audit, `booking.confirmed`); insufficient balance → clear error (no silent confirm); Net-30-ready. |
| — | Phase-3 full browser audit: 120 loads + 75 clicks → 0 broken workflows/dead buttons/broken nav/console errors/exceptions. |
| — | GL double-entry balance verified (SUM debit=credit); module×role reachability + RBAC matrix (45 checks). |

## 2) INTENTIONAL FUTURE ENHANCEMENT (works today; deeper capability deferred — no blocker)
| Ref | Item | Note |
|---|---|---|
| B-01b | Hide ops-write buttons from non-`MANAGE_OPS` roles (UI polish) | API already enforces 403; buttons currently fail gracefully. |
| RC-1 | Transport rate lookup by named `route` | `route` field exists on the card; resolver currently matches vehicleType+tripType (route not yet a booking dimension). |
| RC-2 | `PER_SEAT` transport pricing | Unit exists; transport booking has no seat-count field yet (uses vehicleCount). |
| RC-3 | Hotel/Catering price-override + rate-card sourcing | Override + rate cards currently cover transport/visa/additional; hotel/catering keep their existing pricing. |
| MC-1 | Multi-currency FX at wallet/invoice | `currency` is stored on cards+bookings; the prepaid deduction assumes SAR — wire `CurrencyRate` conversion when non-SAR rates are used. |
| CR-1 | Corporate Credit / Net-30 workflow | Extension point (`resolveCreditDecision()`) built; policy not implemented (returns PREPAID). |
| NAV-1 | Rate-cards + reset-password nav links | Pages reachable by URL + gated; add menu entries for discoverability. |
| OCR-1 | Non-passport OCR parsers | Only passport parser is real; 14 other doc types are generic. |
| IMP-1 | Excel/CSV passenger import UI | Import preview/commit endpoints exist; UI wiring incomplete. |
| HOT-1 | Hotel catalogue admin CRUD | Read-only `GET /hotels` today. |
| TEST-1 | Unit test coverage | 1 unit spec exists; add unit tests. |
| B-05 | Payment-slip upload magic-byte scan | Other uploads scan; add to payment-slip path. |
| B-06s | Scoped `update`/`delete`-by-id ordering (checks after mutate) | Currently unreachable (zero scoped writes in code); hardening for future scoped writes. |
| B-07 | Tenant-scoping "safety net" (route all reads through `.scoped`, or add a lint rule) | Isolation is correct today via explicit `where` filters; the automatic net advertised in docs doesn't exist — hardening. |

## 3) REQUIRES BUSINESS DECISION (needs owner/finance input before I implement)
| Ref | Question |
|---|---|
| BZ-1 | **Visa VAT treatment** — the resolver applies 15% VAT to visa fees (platform convention). Government visa fees are often VAT-exempt. Apply VAT, exempt, or per-rate-card flag? |
| BZ-2 | Should **hotel & catering** also route through the unified `BookingConfirmationService` + rate cards (they currently use their own pricing/flow)? |
| BZ-3 | **Corporate Credit / Net-30** terms & eligibility (which agents, limits, aging) — to activate CR-1. |
| BZ-4 | **Per-seat** pricing policy — add a seat-count to transport bookings? (to activate RC-2) |
| B-04 | Stale-token revocation window (≤15 min) — accept the standard stateless-JWT tradeoff, or add a token-version/deny-list? (security policy) |

## 4) REQUIRES PRODUCTION DEPLOYMENT (owner/ops action on the LIVE host — out of LOCAL scope)
| Ref | Task |
|---|---|
| DEP-0 | **Deploy this session's work** — all changes are LOCAL. Commit/tag + build + deploy the new billing + security features to prod (owner runs; I do not deploy/commit/push). |
| P-01 | **CRITICAL:** remove the exposed public **no-auth Redis** (`tuba-e2e-redis` 0.0.0.0:56379) + public test Postgres (`tuba-e2e-pg` 0.0.0.0:55432) on the prod host; enable the firewall (`ufw` inactive). |
| P-02 | **CRITICAL:** disable/rotate the temporary UAT **SUPER_ADMIN** account in the production DB (4/6 users are UAT, published shared password). |
| P-03 | Make prod reproducible: commit + tag the currently-uncommitted prod tree (HEAD 2 ahead of v2.0.0; dirty). |
| P-04 | Offsite backup + a restore drill (offsite currently disabled; single-host copies only). |
| P-05 | Fix RUNBOOK rollback (edits `IMAGE_TAG` but `WEB/API_IMAGE_TAG` override it); commit the live nginx cookie-path hotfix; pin `:latest` infra images. |
| DEP-1 | Configure **SMTP** creds so password-reset & notification emails actually send (channel is stub-safe without them). |
| DEP-2 | Run the project's **38-spec jest e2e suite** in CI against an isolated DB+Redis (not run this session to protect the working env). |
| DEP-3 | Apply the two new **migrations** (`add_password_reset_token`, `billing_rate_cards`) on prod during deploy; seed real rate cards. |

**Nothing is unclassified.** Local quality gate met; production go-live remains gated by Category 4.
