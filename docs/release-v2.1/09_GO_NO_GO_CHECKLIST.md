# 09 · GO / NO-GO CHECKLIST — v2.1

**Purpose:** Single gate to authorize (or block) the v2.1 production release. Every item must be checked or explicitly waived (with owner sign-off) before **GO**.

---

## A. Code / Build Readiness
- [ ] RC is frozen — no code/schema/UI changes since freeze.
- [ ] Clean checkout builds: `build:shared` → api build → web build all succeed.
- [ ] `tsc --noEmit` clean (api + web).
- [ ] Correct `VITE_API_URL` baked into the web build.

## B. Verification Evidence
- [ ] Backend test suites green (workflow / Phase-2 / audit-context / notifications).
- [ ] Frontend 12-point checklist passed for all 9 screens.
- [ ] Pixel QA: 27 captures clean (0 err/warn/failed-req, no overflow, no polling).
- [ ] UAT 12/12 recorded (Doc 05 / FINAL_UAT_REPORT).

## C. Database / Migrations
- [ ] `prisma migrate status` reviewed; only the 5 v2.1 migrations pending in prod.
- [ ] Migrations confirmed **additive** (no destructive DDL).
- [ ] Migration order understood (Doc 02).
- [ ] **Pre-deploy DB backup taken AND restore-tested.**

## D. Configuration & Secrets
- [ ] Production secrets set, NOT dev values: `JWT_SECRET`, `DATABASE_URL`, `MINIO_*`.
- [ ] Required env vars present (Doc 01 §2).
- [ ] `COOKIE_SECURE=true`, `CORS_ORIGIN`/`WEB_ORIGIN` correct for prod domains.
- [ ] WaSender credentials ready (or explicit decision to configure post-deploy).
- [ ] Plan to seed SLA hours / approval matrix / templates per policy (Doc 05 §4).

## E. Security (carry-over blockers — must be resolved or owner-waived)
- [ ] **P-01** — public no-auth Redis / test-Postgres exposure closed; firewall enabled.
- [ ] **P-02** — UAT/published-password super-admin accounts removed/rotated in prod DB.
- [ ] RBAC grants reviewed against org chart.

## F. Rollback Readiness
- [ ] Previous API image/build tag recorded.
- [ ] Previous Web build artifact retained.
- [ ] DB restore tooling + access confirmed.
- [ ] Rollback plan (Doc 03) understood by on-call.

## G. Operational Readiness
- [ ] Deploy window agreed; stakeholders notified.
- [ ] Monitoring in place (Doc 06); on-call assigned.
- [ ] Smoke (Doc 04) + Post-deploy (Doc 05) owners assigned.
- [ ] Incident runbook (Doc 07) accessible to on-call.

---

## Decision
| Role | Name | GO / NO-GO | Date/Time |
|------|------|-----------|-----------|
| Release Lead | | | |
| DBA | | | |
| Product / Owner | | | |

**Overall:  ☐ GO   ☐ NO-GO**

> Any unchecked item in A–D or F blocks GO unless the Owner records an explicit written waiver. Section E items are go-live security blockers carried from v2.0.1 and should not be waived without deliberate risk acceptance.
