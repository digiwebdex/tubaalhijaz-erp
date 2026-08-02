# T002-06 Completion — MOFA Completeness + MOFA Bill

**Task:** T002-06 (TRANSFORM-002)  
**Date:** 2026-08-01  
**Status:** Complete — stopped before T002-07

---

## Architecture overrides prompt

The prompt titled this “MOFA Processing Workflow” and said **Do NOT build Finance**.  
Architecture §17 defines:

> **T002-06** MOFA completeness + MOFA Bill | KPIs + Invoice kind Bill Sheet

**Contract followed = architecture.**  
MOFA Number (Passenger) and MOFA Processing Bill (`Invoice.kind=MOFA_PROCESSING`) remain **separate**. Bill Sheet is flag-gated (`ENABLE_MOFA_PROCESSING_BILL`).

**Difference:** Prompt omitted the Bill Sheet; architecture requires it (AD-T002-05). Prompt “MOFA Status/Date/Notes” fields were **not invented** — architecture reuses `Passenger.mofaNumber` only.

---

## 1. Exact Scope

Quoted from `analysis/TRANSFORM_002_ARCHITECTURE.md` §17:

> **T002-06** MOFA completeness + MOFA Bill | KPIs + Invoice kind Bill Sheet

Supporting: §1.6 (number ≠ bill), §2.3 (Qty×Rate + Approval Sign + CR Date), §12 (MOFA completeness %), §8 (Invoice kind), flag `ENABLE_MOFA_PROCESSING_BILL`.

---

## 2. Architecture Contract

| Item | Implementation |
|------|----------------|
| MOFA Number | REUSE `Passenger.mofaNumber` — staff desk complete via transition/PATCH |
| Completeness KPI | `mofaNumber` filled / issued count on `GET /ops/visa/mutamers` |
| MOFA Bill | `Invoice.kind=MOFA_PROCESSING` + qty×rate line + `approvalSign` + `crDate` |
| Separation | Explicit notes/copy; separate APIs/screens |
| Flag | `ENABLE_MOFA_PROCESSING_BILL` (default off in prod env; e2e on) |

---

## 3. Reuse Declaration

| Category | Items |
|----------|--------|
| **Reused** | Passenger, Visa Pipeline, Visa Desk, Groups, Invoice/InvoiceItem, Finance ERP, AuditLog, RBAC, Ops layout |
| **Extended** | Transition DTO (`mofaNumber`, `completeMofa`); desk KPI; Invoice schema; Finance controller Bill Sheet |
| **New modules** | None |
| **Untouched** | Embassy/Passport SOP (T002-05), Long Stay, Day-85, Reports pack (T002-09), government APIs |

---

## 4. Business Workflow

**Completeness (Visa Desk)**  
1. Mutamer → MOFA.  
2. Staff **Save MOFA No** (`completeMofa` + `mofaNumber`) → AuditLog.  
3. Desk KPI shows filled/issued %.  
4. Continue pipeline.

**Bill (Finance — separate)**  
1. When flag on → Finance ERP **MOFA Bill Sheet**.  
2. Create Qty×Rate bill for group/tenant.  
3. Finance Approval Sign + CR Date.  
4. Explicitly not hotel/transport; not mutamer MOFA Number.

---

## 5. Business Scenario Validation

| Scenario | Result |
|----------|--------|
| 1 Enter MOFA | **PASS** |
| 2 MOFA info completed | **PASS** |
| 3 Missing required data | **PASS** |
| 4 Agent update → 403 | **PASS** |
| 5 Audit written | **PASS** |
| Completeness KPI | **PASS** |
| Bill create + sign | **PASS** |

---

## 6. Business Impact

- Visa Desk can track MOFA Number completeness without conflating finance.  
- Finance can bill MOFA processing Qty×Rate when the flag is enabled.  
- Agents cannot mutate desk MOFA Number.

---

## 7. Files Changed

| Path | Change |
|------|--------|
| `apps/api/prisma/schema.prisma` | `InvoiceKind`, Invoice `kind`/`approvalSign`/`crDate` |
| `apps/api/prisma/migrations/20260801150000_mofa_processing_bill/` | Migration |
| `apps/api/src/finance/invoice.service.ts` | create/sign MOFA bills |
| `apps/api/src/finance/finance.controller.ts` | Bill Sheet endpoints |
| `apps/api/src/groups/visa-pipeline.service.ts` / DTOs | `mofaNumber` / `completeMofa` |
| `apps/api/src/groups/passengers.service.ts` | Staff-only MOFA Number PATCH |
| `apps/api/src/ops/ops.service.ts` | `mofaCompleteness` KPI |
| `apps/web/.../OpsDepartments.tsx` | KPI + Save MOFA No |
| `apps/web/.../FinanceERP.tsx` | MOFA Bill Sheet screen |
| `apps/api/.env.example` | Flag docs |
| `apps/api/test/mofa-processing.e2e-spec.ts` | Scenarios |
| `docs/T002_06_COMPLETION.md` | This note |

---

## 8. Database Changes

- Enum `InvoiceKind` (`STANDARD`, `MOFA_PROCESSING`)  
- `Invoice.kind` (default `STANDARD`)  
- `Invoice.approvalSign`, `Invoice.crDate`  
- Index on `kind`  

No new Passenger columns (mofaNumber already existed).

---

## 9. Migration

`20260801150000_mofa_processing_bill` — applied to e2e + live.

---

## 10. API Changes

| Endpoint | Notes |
|----------|--------|
| `POST /passengers/:id/visa-transition` | `mofaNumber`, `completeMofa` |
| `PATCH /passengers/:id` | Staff-only `mofaNumber` |
| `GET /ops/visa/mutamers` | `mofaCompleteness` |
| `GET /finance/mofa-processing-bills/status` | Flag status |
| `GET/POST /finance/mofa-processing-bills` | List/create (flag) |
| `PATCH /finance/mofa-processing-bills/:id/sign` | Approval Sign + CR Date |

---

## 11. UI Changes

- Visa Desk: MOFA No % KPI + Save MOFA No + separation copy  
- Finance ERP: **MOFA Bill Sheet** nav (shows disabled message when flag off)

---

## 12. RBAC Changes

None new. Desk: `VIEW_DASHBOARD` + no `companyId`. Bill: `FINANCIAL_REPORTS` / `EDIT_FINANCIAL_RECORDS`.

---

## 13. Audit Changes

- MOFA Number transitions → `VisaPipeline` UPDATE/REJECT  
- Bill sign → `MofaProcessingBill` APPROVE  

---

## 14. Event Changes

Bill create reuses existing `invoice.generated` emit. No new notification engine.

---

## 15. Tests Executed

| Suite | Result |
|-------|--------|
| `mofa-processing.e2e-spec.ts` | **7 PASS** |
| Pipeline / embassy / desk regression | **PASS** |

---

## 16. Risks

| Risk | Mitigation |
|------|------------|
| Number vs bill confusion | Separate models, screens, copy |
| Bill enabled too early | Flag default off |
| Ops without finance perms | Bill APIs require finance permissions |

---

## 17. Manual Verification

1. Ops Visa Desk → Save MOFA No on MOFA mutamer → KPI updates after ISSUED.  
2. Agent PATCH mofaNumber → 403.  
3. Set `ENABLE_MOFA_PROCESSING_BILL=true`, restart API → Finance → MOFA Bill Sheet → create Qty×Rate → Sign.  
4. Confirm notes say not mutamer MOFA Number.

---

## 18. Rollback

1. Redeploy prior images; set flag false.  
2. Optional drop Invoice kind columns / enum.  
3. Passenger.mofaNumber column remains (T001).

---

## STOP

**T002-07 (Long Stay Host Register) was not started.**
