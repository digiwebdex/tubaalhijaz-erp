# T002-03 Completion — Visa Processing Workflow Engine

**Task:** T002-03 (TRANSFORM-002)  
**Date:** 2026-08-01  
**Status:** Complete — stopped before T002-04

---

## 1. Exact Scope

Quoted from `analysis/TRANSFORM_002_ARCHITECTURE.md` §17:

> **T002-03** Pipeline state machine | States + allowed transitions + Excel map + gate assist

Contract = architecture §3 (state catalog, allowed transitions, skip policy, Excel map, gate assist).  
API strategy §7: `POST /passengers/:id/visa-transition`.  
DB §8: EXTEND `Passenger` with pipeline state.

**Not in this pack:** Notification wiring (T002-04), Embassy/Passport SOP product (T002-05), MOFA bill, Day-85, government APIs, reports.

---

## 2. Reuse Declaration

| Category | Items |
|----------|--------|
| **Reused** | Passenger, VisaRequest (batch unchanged), Groups, Visa Desk UI, AuditLog, EventEmitter2 / Automation events, OCR links, RBAC (`VIEW_DASHBOARD`) |
| **Extended** | Passenger schema; PassengersController; Ops mutamer desk projection; OpsDepartments transition actions |
| **New modules** | None (helpers `visa-pipeline.machine.ts` + `VisaPipelineService` inside Groups) |
| **Untouched** | Finance, Long Stay, Day-85, Dashboards, Hotel/Transport, MOFA bill UI, Notification rule wiring |

---

## 3. Transition Matrix

| From | To | Owner | Validation |
|------|-----|-------|------------|
| NEW | MOFA | Visa Desk | Group has visa type |
| NEW | BIOMETRIC | Visa Desk | Skip-forward |
| MOFA | EMBASSY | Visa Desk | — |
| MOFA | BIOMETRIC | Visa Desk | Skip Embassy |
| EMBASSY | BIOMETRIC | Visa Desk | — |
| BIOMETRIC | SUBMITTED | Visa Desk | Biometric status recorded |
| SUBMITTED | PROCESSING | Visa Desk / system | — |
| PROCESSING | ISSUED | Visa Desk | Visa Number required |
| PROCESSING | REJECTED | Visa Desk | Reason required |
| ISSUED | PASSPORT_RETURNED | Visa Desk | `custodyConfirmed=true` |
| PASSPORT_RETURNED | COMPLETED | Visa Desk | — |
| ISSUED | COMPLETED | Visa Desk | Only if `VISA_REQUIRE_PASSPORT_RETURN` is false |
| REJECTED | BIOMETRIC / SUBMITTED / PROCESSING | Visa Desk | Rework |
| REJECTED | REJECTED_CLOSED | Visa Desk | Terminal |
| * | * (same) | — | No-op notes allowed |

Forbidden examples enforced: NEW→ISSUED, COMPLETED→*, REJECTED_CLOSED→*, etc.

---

## 4. Business Workflow

1. Visa Desk opens Mutamer Board (T002-02).  
2. Selects passenger → allowed next states shown.  
3. `POST /passengers/:id/visa-transition` `{ to, reason?, visaNumber?, biometricStatus?, custodyConfirmed? }`.  
4. Engine validates → updates `visaPipelineStatus` + Excel echoes → AuditLog → domain emit.  
5. Response includes `gateAssist` (suggest flip `gateVisa` when ≥80% ISSUED/PASSPORT_RETURNED/COMPLETED).  
6. T002-04 will wire notify rules on `visa.approved` / `visa.rejected`.

---

## 5. Business Scenario Validation

| Scenario | Result |
|----------|--------|
| 1 NEW → MOFA | **PASS** |
| 2 MOFA → EMBASSY | **PASS** |
| 3 PROCESSING → ISSUED | **PASS** |
| 4 ISSUED → PASSPORT_RETURNED | **PASS** |
| 5 Invalid NEW → ISSUED | **REJECT + audit PASS** |
| 6 Agent transition | **403 PASS** |

---

## 6. Business Impact

- Canonical Passenger-centric visa pipeline governs desk work.  
- Invalid skips rejected and audited.  
- Excel labels stay in sync (§3.6).  
- Gate assist nudges Ops toward `gateVisa` without auto-flipping.

---

## 7. Files Changed

| Path | Change |
|------|--------|
| `apps/api/prisma/schema.prisma` | `VisaPipelineStatus` + Passenger fields |
| `apps/api/prisma/migrations/20260801120000_visa_pipeline_status/` | Migration + backfill |
| `apps/api/src/groups/visa-pipeline.machine.ts` | Pure matrix + validation |
| `apps/api/src/groups/visa-pipeline.service.ts` | Transition service |
| `apps/api/src/groups/passengers.controller.ts` | `POST :id/visa-transition` |
| `apps/api/src/groups/passengers.dto.ts` | `VisaTransitionDto` |
| `apps/api/src/groups/groups.module.ts` | Register service |
| `apps/api/src/automation/events.ts` | `PASSENGER_VISA_TRANSITIONED`, `VISA_APPROVED`, `VISA_REJECTED` |
| `apps/api/src/ops/ops.service.ts` / `ops.controller.ts` | Filter/project by pipeline status |
| `apps/web/.../OpsDepartments.tsx` | Transition actions + full state chips |
| `apps/api/.env.example` | `VISA_REQUIRE_PASSPORT_RETURN` |
| `apps/api/test/visa-pipeline.e2e-spec.ts` | Workflow e2e |
| `apps/api/test/visa-pipeline.machine.e2e-spec.ts` | Unit matrix tests |
| `docs/T002_03_COMPLETION.md` | This note |

---

## 8. Database Changes

- Enum `VisaPipelineStatus` (11 values)  
- `Passenger.visaPipelineStatus` (default `NEW`)  
- `Passenger.visaRejectReason` (nullable)  
- Indexes on `(groupId, visaPipelineStatus)` and `visaPipelineStatus`  
- Backfill from T001 visa/biometric echoes

---

## 9. Migration

`20260801120000_visa_pipeline_status` — applied to e2e + live.

---

## 10. API Changes

`POST /passengers/:id/visa-transition`  
- Permission: `VIEW_DASHBOARD`  
- Body: `{ to, reason?, notes?, visaNumber?, biometricStatus?, custodyConfirmed? }`  
- Success: `{ from, to, allowedNext, gateAssist, … }`  
- Invalid: **400** + AuditLog `REJECT`  
- Agent: **403**

`GET /ops/visa/mutamers` now filters/counts by `visaPipelineStatus` and returns `allowedNext`.

---

## 11. UI Changes

Ops Visa Mutamer Board: full pipeline state chips; drawer shows **→ next** actions with prompts for reason / visa number / custody.

---

## 12. RBAC Changes

No new permission keys. Transition requires `VIEW_DASHBOARD`; service also rejects any caller with `companyId` (agents/suppliers).

---

## 13. Audit Changes

| Event | Action | Module |
|-------|--------|--------|
| Successful transition | `UPDATE` | `VisaPipeline` |
| Rejected transition | `REJECT` | `VisaPipeline` |

Opening desk rows still not audited.

---

## 14. Notification Events

Emitted (not wired to templates — T002-04):

- `passenger.visa.transitioned` — every transition  
- `visa.approved` — enter ISSUED  
- `visa.rejected` — enter REJECTED  

No new queue; reuse EventEmitter2 → Automation dispatcher.

---

## 15. Tests Executed

| Suite | Result |
|-------|--------|
| `visa-pipeline.e2e-spec.ts` | **PASS** |
| `visa-pipeline.machine.e2e-spec.ts` | **PASS** (matrix/unit) |
| `visa-desk-mutamers.e2e-spec.ts` | **PASS** (regression) |

---

## 16. Risks

| Risk | Mitigation |
|------|------------|
| Skip-forward abuse | Audited; skip flag recorded |
| Passport-return SOP | Feature flag `VISA_REQUIRE_PASSPORT_RETURN` |
| Notify spam before T002-04 | Events emitted; rules not added yet |
| Gate assist false positives | Suggest only; no auto flip |

---

## 17. Manual Verification

1. Ops → Visa Desk → open NEW mutamer → **→ MOFA**.  
2. Continue MOFA → EMBASSY → … → PROCESSING → ISSUED (enter visa no).  
3. ISSUED → PASSPORT_RETURNED (confirm custody).  
4. Attempt NEW → ISSUED → 400 + audit REJECT.  
5. Agent JWT → transition → 403.  
6. Optional: set `VISA_REQUIRE_PASSPORT_RETURN=true` → ISSUED → COMPLETED rejected.

---

## 18. Rollback

1. Redeploy prior API/web images.  
2. Optional reverse migration: drop columns/indexes; leave enum value in Postgres.  
3. Clients stop calling `visa-transition`.

---

## STOP

**T002-04 (Approval/Rejection notifications wiring) was not started.**
