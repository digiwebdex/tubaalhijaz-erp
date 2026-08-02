# T002-02 Completion — Mutamer Visa Desk Board

**Task:** T002-02 (TRANSFORM-002)  
**Date:** 2026-08-01  
**Status:** Complete — stopped before T002-03

---

## 1. Exact Scope

Quoted from `analysis/TRANSFORM_002_ARCHITECTURE.md` §17:

> **T002-02** Mutamer Visa Desk Board | Worklist UI/API on Passenger

Screen mapping (§6): Ops Visa Desk `/ops-departments` (Visa) is the **primary** mutamer worklist.  
API mapping (§7): prefer **`GET /ops/visa/mutamers`** (Ops module).  
ADR AD-T002-08: Reuse Ops Visa Desk screen — no second app.

**Not in this pack:** pipeline transitions (T002-03), MOFA bill, Embassy/passport processing, Day-85, Long Stay host, Finance.

---

## 2. Reuse Declaration

| Category | Modules |
|----------|---------|
| **Reused** | Passenger, Groups, VisaRequest, Ops (`VIEW_DASHBOARD`), OpsDepartments layout, KPI/table/chip patterns, AuditLog module, RBAC, Notifications (untouched), Umrah Co catalogue (`/services/umrah-companies`) |
| **Extended** | `OpsController` / `OpsService`; `OpsDepartments` Visa desk |
| **New modules** | **NONE** (only `visa-desk.util.ts` helper inside Ops) |
| **Intentionally untouched** | Hotel/Transport/Catering desks, Finance, Long Stay, Dashboards, Agent Portal, Automation, OCR, pipeline transitions |

---

## 3. Business Workflow

1. Visa Officer (staff with `VIEW_DASHBOARD`) opens **Operations → Departments → Visa**.
2. Mutamer Board loads from `GET /ops/visa/mutamers`.
3. Officer filters by Visa State / Embassy / Visa Type / Umrah Co / Priority / Arrival ≤7d / search.
4. Officer opens a passenger drawer (view) → **Open Group** or **Open Visa Request** (batch envelope).
5. Processing / state transitions continue in **T002-03**.

---

## 4. Business Scenario Validation

| Scenario | Expected | Result |
|----------|----------|--------|
| 1 Officer opens desk | 200 + items | **PASS** |
| 2 Filter by Embassy | Rows match embassy/consulate | **PASS** |
| 3 Filter by Visa State | All rows match state | **PASS** |
| 4 Agent attempts access | 403 | **PASS** |
| 5 Pagination | Distinct pages | **PASS** |

E2E: `apps/api/test/visa-desk-mutamers.e2e-spec.ts` — **7/7 PASS**.

---

## 5. Business Impact

- One operational board for mutamers requiring Visa Desk attention (Passenger SoT).
- Reflects approved pipeline vocabulary at desk level via **derived** states from T001 fields (NEW / BIOMETRIC / ISSUED / REJECTED) until T002-03 persists full machine.
- Agents cannot access the desk.
- Batch VisaRequest queue retained as secondary view (envelope only).

---

## 6. Files Changed

| Path | Change |
|------|--------|
| `apps/api/src/ops/visa-desk.util.ts` | Derive + Prisma filter helpers |
| `apps/api/src/ops/ops.service.ts` | `mutamerVisaDesk` worklist |
| `apps/api/src/ops/ops.controller.ts` | `GET /ops/visa/mutamers` |
| `apps/web/src/app/pages/OpsDepartments.tsx` | Mutamer board UI + batch secondary |
| `apps/api/test/visa-desk-mutamers.e2e-spec.ts` | E2E scenarios |
| `docs/T002_02_COMPLETION.md` | This note |

---

## 7. Database Changes

**None.** No new columns. Assigned Officer is not on schema — column shows `—` (honesty).  
Visa State on the board is **derived** from existing Passenger fields (§3.6). Full `visaPipelineStatus` is T002-03.

---

## 8. Migration

**None.**

---

## 9. API Changes

`GET /ops/visa/mutamers` (requires `VIEW_DASHBOARD`)

Query: `page`, `pageSize` (≤100), `visaState` (NEW\|BIOMETRIC\|ISSUED\|REJECTED\|ALL), `embassy`, `groupId`, `visaType`, `umrahCompanyId`, `priority`, `arrivingWithinDays`, `q`.

Response: `{ items, total, page, pageSize, counts }` with projected group / Umrah Co / embassy / priority / dueDate / visaRequest.

Opening records is **not** audited.

---

## 10. UI Changes

Ops Departments → Visa:

- Primary **Mutamer Board** table (architecture columns; Officer = —).
- Filters + KPI chips + server pagination.
- Passenger detail drawer; links Open Group / Open Visa Request.
- Secondary **Batch Requests** view (existing VisaRequest queue + status transitions for batch envelope only — not mutamer pipeline processing).

---

## 11. RBAC Changes

**None.** Reuses `@RequirePermissions("VIEW_DASHBOARD")` on Ops controller. Agents lack this permission → **403**.

---

## 12. Audit Changes

**None for open/view.** No business-changing mutamer actions in T002-02. Batch status transitions (secondary view) keep existing service audit.

---

## 13. Tests

| Suite | Result |
|-------|--------|
| `visa-desk-mutamers.e2e-spec.ts` | **PASS** (derive + 5 scenarios + regression) |

---

## 14. Risks

| Risk | Level | Mitigation |
|------|-------|------------|
| Derived state ≠ future pipeline enum | Med | Documented; T002-03 will persist canonical states |
| Soft BIOMETRIC/NEW SQL approximation | Low | Display always uses `deriveDeskVisaState` |
| "Visa Not Issued" substring trap | Low | Explicit not-issued guard |
| Assigned Officer column empty | Low | Honesty; no fake assignees |

---

## 15. Manual Verification

1. Login as Ops → `/ops-departments` → Visa → mutamer rows load.  
2. Filter Embassy `Dhaka` → matching rows.  
3. Chip **Biometric** / **Issued** → state matches.  
4. Next/Prev pagination.  
5. Agent JWT → `GET /ops/visa/mutamers` → 403.  
6. Open passenger drawer → Open Group navigates to Ops Control.

---

## 16. Rollback

1. Redeploy prior API/web images.  
2. No DB rollback required.  
3. Ops Visa Desk returns to prior batch-only queue if UI reverted alone.

---

## STOP

**T002-03 (Pipeline state machine) was not started.**  
No Visa Processing, MOFA, Embassy workflow, Passport Return, or Day-85 work in this pack.
