# TRANSFORM-001 — Test Report

**Gate:** T001-10 Foundation verification pack (non-prod)  
**Executed:** 2026-07-31 / 2026-08-01 (e2e harness against ephemeral Postgres + Redis + MinIO)  
**Harness:** Nest Jest e2e (`apps/api/test/jest-e2e.json`), `Demo@123` seed users  

---

## 1. Summary

| Category | Result |
|----------|--------|
| Transformation smoke (`transform-001-smoke`) | **10/10 PASS** |
| TRANSFORM-001 regression pack (10 suites) | **65/65 PASS** |
| Web unit (`group-foundation.selftest`) | **PASS** |
| Overall gate | **GREEN** for staging/prod-smoke authorization |

---

## 2. Smoke Summary (T001-10)

**Suite:** `apps/api/test/transform-001-smoke.e2e-spec.ts`

| # | Scenario | Result |
|---|----------|--------|
| 1 | Create Group (HAJJ + WhatsApp + Nusuk); unique Nusuk; Staff+Agent share | **PASS** |
| 2 | OCR Group List → Approve → Group Created (flag on) | **PASS** |
| 3 | Mutamer Excel Preview (no DB writes) | **PASS** |
| 4 | Confirm Import → Passengers Created | **PASS** |
| 5 | Passport OCR → Attach Passenger; OCR-before-group blocked | **PASS** |
| 6 | Readiness Gates Update (Agent + Staff) | **PASS** |
| 7 | Intake Notifications (AR-GRP-01…04 + gate NotificationLog) | **PASS** |
| 8 | Ops Group Board projection (name, Nusuk, gates, agent, …) | **PASS** |
| 9 | Cross Tenant Rejected (404/403) | **PASS** |
| 10 | Rollback Validation (flag off + legacy group + legacy CSV) | **PASS** |

**Command:**

```bash
pnpm --filter @tuba/api test:e2e -- --testPathPattern='transform-001-smoke'
```

---

## 3. Regression Summary

**Command:**

```bash
pnpm --filter @tuba/api test:e2e -- --testPathPattern='groups-nusuk|groups-readiness|passengers-mutamer|mutamer-import|ocr-intake|ocr-nusuk|intake-notification|ops-group-master|transform-001-smoke'
```

| Suite | Task | Result |
|-------|------|--------|
| `groups-nusuk.e2e-spec.ts` | T001-01 | PASS |
| `groups-readiness-gates.e2e-spec.ts` | T001-02 | PASS |
| `passengers-mutamer.e2e-spec.ts` | T001-04 | PASS |
| `mutamer-import.e2e-spec.ts` | T001-05 | PASS |
| `ocr-intake.e2e-spec.ts` | T001-06 | PASS |
| `ocr-nusuk-group-list.e2e-spec.ts` | T001-07 | PASS |
| `intake-notifications.e2e-spec.ts` | T001-08 | PASS |
| `intake-notification.unit.e2e-spec.ts` | T001-08 | PASS |
| `ops-group-master.e2e-spec.ts` | T001-09 | PASS |
| `transform-001-smoke.e2e-spec.ts` | T001-10 | PASS |

**Totals:** 10 suites · **65 tests · 65 passed · 0 failed**

### Web unit

```bash
# from apps/web (tsx available)
npx tsx src/app/lib/group-foundation.selftest.ts
# → group-foundation.selftest: OK
```

Covers T001-03/09 helpers (visa map, Nusuk format, gates, `GATE_BOARD_COLS`, `singleGatePatch`).

---

## 4. Coverage by Capability

| Capability | Verified by |
|------------|-------------|
| Nusuk uniqueness + HAJJ | Smoke S1; `groups-nusuk` |
| Readiness gates | Smoke S6; `groups-readiness-gates`; Ops board S8 |
| Mutamer Excel preview/commit + legacy | Smoke S3–S4, S10; `mutamer-import` |
| Passport OCR create/attach | Smoke S5; `ocr-intake` |
| Group List OCR + flag | Smoke S2, S10; `ocr-nusuk-group-list` |
| Intake notifications | Smoke S7; `intake-notifications` |
| Ops Group Master | Smoke S8; `ops-group-master` |
| Tenancy | Smoke S9; multiple task e2e |
| Backward compatibility | Smoke S10 |

---

## 5. Environment Under Test

| Component | Notes |
|-----------|-------|
| Postgres | Ephemeral e2e (`tuba-e2e-pg`) migrated + seeded |
| Redis | Ephemeral e2e for BullMQ |
| MinIO | Shared from stack (`tuba-alhijaz` network) |
| OCR | Stub Vision/Gemini providers in smoke/OCR suites |
| Flags | `ENABLE_NUSUK_GROUP_LIST_OCR=true` during smoke; Scenario 10 toggles off |
| WA/SMTP | Unconfigured — skip-safe path exercised |

---

## 6. Gaps / Not Automated Here

- Full browser UI click-through (Agent wizard / Ops board) — covered by helpers + API contracts; recommend one manual desk check  
- Live Gemini/Vision accuracy on real Nusuk PDFs — requires human OCR review drill on staging  
- Production WA delivery end-to-end — requires real `WASENDER_API_KEY`  
- Load test of 1000-row import — contract allows 1000; volume soak optional  

---

## 7. Sign-off for Test Gate

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Tech Lead (tests) | | | |
| QA / Verification | | | |

Automated gate status for TRANSFORM-001 non-prod: **PASS**.
