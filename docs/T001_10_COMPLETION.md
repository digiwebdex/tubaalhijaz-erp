# T001-10 Completion — Foundation verification pack (non-prod gate)

**Task:** T001-10 (TRANSFORM-001)  
**Date:** 2026-07-31  
**Stop:** Do **not** start Transformation-002. No new roadmap.

## Exact T001-10 Scope (from Transformation document)

> **T001-10 — Foundation verification pack (non-prod gate)**  
> **Maps to:** Whole TRANSFORM-001  
> **Modify:** None required in prod code — run e2e/smoke scenarios (may add tests in deploy pipeline later; **this task is validation definition**)  
> **Reuse:** Existing groups/ocr/notify e2e harness patterns  
> **Change:** Documented scenario set: create group+WA+HAJJ; set gates; CSV business template; passport OCR; group-list OCR flag; notify logs  
> **Acceptance:** All scenarios pass on staging/prod-smoke  
> **Rollback:** N/A  
> **Depends on:** T001-01…09 as deployed

## Reuse Declaration

| | |
|--|--|
| **Modules reused** | Groups, Passengers, Mutamer Import, OCR, Uploads, Notifications, Automation Rules, Ops Group Master, AuditLog, existing e2e harness |
| **Modules extended** | Test suite only — `transform-001-smoke.e2e-spec.ts` |
| **New modules** | **NONE** |
| **Intentionally untouched** | Finance, Hotel, Transport, Visa processing engine, Long Stay day-85, Dashboards, Agent/Ops UI redesign, new production APIs |

## Business Workflow (complete intake)

```
Create Group (Nusuk + HAJJ + WA)
        ↓
OCR Group List (flag on) → Approve → Group
        ↓
Mutamer Excel Preview → Confirm Import → Passengers
        ↓
Passport OCR → Attach Mutamer
        ↓
Readiness Gates (VISA · PACKAGE · PAYMENT · BILL)
        ↓
Intake Notifications (NotificationLog)
        ↓
Ops Group Master board (Staff)
```

| | |
|--|--|
| **Business Owner** | Ops + Agent (tenant-scoped) |
| **Trigger** | New season group intake |
| **Input** | Nusuk list / Excel / passport / gate decisions |
| **Processing** | Existing T001-01…09 paths only |
| **Output** | Shared Group register + mutamers + readiness + notify logs |
| **Next Department** | Downstream BT (visa/hotel/transport/finance) — out of T-001 |

## Business Acceptance Validation

| # | Scenario | Result |
|---|----------|--------|
| 1 | Create Group (HAJJ + WA + Nusuk; unique; Staff+Agent share) | **PASS** |
| 2 | OCR Group List → Approve → Group Created | **PASS** |
| 3 | Mutamer Excel Preview (no DB writes) | **PASS** |
| 4 | Confirm Import → Passengers Created | **PASS** |
| 5 | Passport OCR → Attach Passenger (+ OCR-before-group blocked) | **PASS** |
| 6 | Readiness Gates Update (Agent + Staff) | **PASS** |
| 7 | Intake Notifications (AR-GRP-01…04 + gate log) | **PASS** |
| 8 | Ops Group Board projection | **PASS** |
| 9 | Cross Tenant Rejected | **PASS** |
| 10 | Rollback Validation (flag off + legacy group/CSV) | **PASS** |

Rollup criteria (Transformation §7): unique Nusuk · HAJJ/WA · four gates · business Excel + legacy CSV · passport OCR · group-list OCR behind flag · notify logs · no mutamer portal — **all demonstrable**.

## Operational Readiness

| Item | Status |
|------|--------|
| T001-01…09 completion docs present under `docs/T001_*_COMPLETION.md` | Yes |
| Smoke pack: `apps/api/test/transform-001-smoke.e2e-spec.ts` | Yes |
| Group-list OCR human approve required | Yes |
| Agent tenancy fail-closed | Yes |

## Production Readiness

| Check | Status |
|-------|--------|
| `ENABLE_NUSUK_GROUP_LIST_OCR` default **off** (prod-safe) | ✓ Documented in `.env.example` |
| `REQUIRE_HAJI_WHATSAPP` default **off** (backward compatible) | ✓ |
| Backward-compatible Group without Nusuk | ✓ Scenario 10 |
| Existing API compatibility (`/groups`, `/ops/groups`, import, OCR) | ✓ Regression suite |
| Existing UI compatibility (no T001-10 UI change) | ✓ |
| Existing Import (business + legacy CSV) | ✓ |
| Existing OCR (passport + flagged group-list) | ✓ |
| Existing Notification pack (AR-GRP-01…04) | ✓ |
| WA skip-safe without `WASENDER_API_KEY` | ✓ (prior T001-08) |

### Recommended production env

```bash
# Keep OFF until ops trained on Group List OCR review
ENABLE_NUSUK_GROUP_LIST_OCR=false

# Optional: enforce Haji WhatsApp on HAJJ/UMRAH
# REQUIRE_HAJI_WHATSAPP=true
```

### Smoke command (non-prod / staging)

```bash
pnpm --filter @tuba/api test:e2e -- --testPathPattern='transform-001-smoke'
# Full TRANSFORM-001 regression:
pnpm --filter @tuba/api test:e2e -- --testPathPattern='groups-nusuk|groups-readiness|passengers-mutamer|mutamer-import|ocr-intake|ocr-nusuk|intake-notification|ops-group-master|transform-001-smoke'
```

## Business Impact

**Transformation-001 exit criterion met for non-prod gate:** Excel Group Details + Mutamer sample + Nusuk OCR intake operate inside ERP without spreadsheet as system of record for intake. No new business features were added in T001-10 — verification only.

## Files Changed

| Path | Change |
|------|--------|
| `apps/api/test/transform-001-smoke.e2e-spec.ts` | **New** — foundation smoke (10 scenarios) |
| `docs/T001_10_COMPLETION.md` | This note |

## Database / Migration / API / UI / RBAC / Audit

| Area | Change |
|------|--------|
| Database | **None** |
| Migration | **None** |
| API | **None** (verification only) |
| UI | **None** |
| RBAC | **None** |
| Audit | Verified existing Groups/OCR/Import audits still fire via smoke |

## Tests Executed

| Suite | Result |
|-------|--------|
| `transform-001-smoke.e2e-spec.ts` | **10/10 PASS** |
| TRANSFORM-001 regression pack (10 suites) | **65/65 PASS** |
| `group-foundation.selftest.ts` (web unit) | **PASS** |

Regression pack includes: `groups-nusuk`, `groups-readiness-gates`, `passengers-mutamer`, `mutamer-import`, `ocr-intake`, `ocr-nusuk-group-list`, `intake-notifications`, `intake-notification.unit`, `ops-group-master`, `transform-001-smoke`.

## Risks

| Risk | Mitigation |
|------|------------|
| Enabling Group List OCR in prod without review training | Keep flag off until SOP ready |
| OCR accuracy on Nusuk numbers | Human approve mandatory |
| Notify spam if WA matrix fully on | Notification Center toggles / disable AR-GRP-* |
| Staging env missing MinIO/Redis | Smoke needs same infra as other OCR e2e |

## Manual Verification (staging / prod-smoke)

1. Confirm `ENABLE_NUSUK_GROUP_LIST_OCR` intended value  
2. Agent creates HAJJ group with WhatsApp + Nusuk  
3. Ops Group Master shows row + toggles gates  
4. Mutamer business CSV preview → commit  
5. Passport OCR attach to mutamer  
6. (Optional) Flag on → Group List OCR → approve  
7. Bell / NotificationLog for intake events  
8. Other agent cannot open group (404)

## Rollback

N/A for T001-10 (no prod code change). Overall TRANSFORM-001 rollback remains: revert web+api images; set `ENABLE_NUSUK_GROUP_LIST_OCR=false`; disable AR-GRP-01…04 if needed.

---

**TRANSFORM-001 status:** Verification pack complete. Ready for staging/prod-smoke sign-off.  
**Do not start Transformation-002 from this task.**
