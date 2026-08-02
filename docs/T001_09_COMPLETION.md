# T001-09 Completion — Ops Group Master board columns (Staff)

**Task:** T001-09 (TRANSFORM-001)  
**Date:** 2026-07-31  
**Stop:** Do **not** start T001-10.

## Exact T001-09 Scope (from Transformation document)

> **T001-09 — Ops Group Master board columns (Staff)** (maps to 1.5–1.7 Operation Map “Group Master”)  
> **Modify:** `OpsControl.tsx` group table / detail (and API mappers if `/ops/groups` DTO projection needed in `ops` module)  
> **Reuse:** `GET /ops/groups`  
> **Change:** Columns: Nusuk Group Number, name, pax, visa type, package, four gates, WhatsApp, uploaded by, agent  
> **Backward compatible:** Old columns remain or coexist  
> **Acceptance:** Staff sees Excel-like readiness; can toggle gates  
> **Rollback:** Prior OpsControl  
> **Depends on:** T001-01, T001-02, T001-03

## Reuse Declaration

| | |
|--|--|
| **Modules reused** | Ops Control Group Master, `GET /ops/groups`, `PATCH /groups/:id`, group-foundation helpers, AuditLog, existing RBAC (`VIEW_DASHBOARD` / ops staff) |
| **Modules extended** | `OpsControl.tsx` Group Master table; `ops.service` groupMaster projection (`name`); helpers for board gate columns |
| **New modules** | **NONE** |
| **Intentionally NOT touched** | Agent Portal, OCR, Mutamer import, Notifications, Finance, Hotel, Transport, Visa processing, Dashboard redesign |

## Business Workflow

| | |
|--|--|
| **Business Owner** | Ops Staff (Group Master board) |
| **Trigger** | Staff opens Ops → Group Master |
| **Input** | Live groups from `GET /ops/groups` |
| **Processing** | Board shows foundation columns; staff toggles VISA/PKG/PAY/BILL → `PATCH /groups/:id` (audited) |
| **Output** | Excel-like readiness visible across agents; gates persist |
| **Next Department** | Visa / Package / Payment / Bill desks act on gate state (downstream BT work) |

## Business Scenario Validation

| # | Scenario | Expected | Result |
|---|----------|----------|--------|
| 1 | Staff opens Group Master | Sees Nusuk, name, pax, visa type, package, four gates, WhatsApp, uploaded by, agent | **PASS** (UI + API projection) |
| 2 | Staff toggles VISA gate inline | Persists via PATCH; audit row | **PASS** (e2e) |
| 3 | Staff toggles PAY + BILL | Persist independently | **PASS** (e2e) |
| 4 | Agent calls `GET /ops/groups` | Forbidden | **PASS** (RBAC regression) |
| 5 | Legacy columns still present | Group ID, Visa Status, Ops coexist | **PASS** |

## Operational Readiness

Staff can run the Group Details board without Excel as SoT for readiness gates. Requires web + API redeploy (API additive `name` field).

## Business Impact

**Before:** Foundation fields partially on board (T001-03 chips); no name column; gates not Excel-column toggles.  
**After:** Spreadsheet-like VISA · PKG · PAY · BILL columns with inline toggle; name + full foundation column set on Staff Group Master.

## Files Changed

- `apps/api/src/ops/ops.service.ts` — project `name`
- `apps/web/src/app/pages/OpsControl.tsx` — Excel gate columns + inline toggle
- `apps/web/src/app/lib/group-foundation.ts` — `GATE_BOARD_COLS`, `singleGatePatch`
- `apps/web/src/app/lib/group-foundation.selftest.ts` — unit coverage
- `apps/api/test/ops-group-master.e2e-spec.ts` — e2e / regression
- `docs/T001_09_COMPLETION.md`

## Database / Migration

| Item | Detail |
|------|--------|
| Schema migration | **NONE** |
| Data | None |

## API / UI / RBAC / Audit

| Area | Change |
|------|--------|
| API | Additive `name` on `GET /ops/groups` rows; gate toggle reuses `PATCH /groups/:id` |
| UI | Same Group Master screen — columns + inline gates (no second screen) |
| RBAC | Unchanged |
| Audit | Reuses Groups UPDATE audit on gate PATCH |

## Tests Executed

- Unit: `group-foundation.selftest.ts` — **PASS** (GATE_BOARD_COLS + singleGatePatch)
- E2E / integration: `ops-group-master.e2e-spec.ts` — **3/3 PASS**
- Regression: Agent forbidden on `/ops/groups` — **PASS**
- Web `tsc --noEmit` — **PASS**

## Risks

- Wide table needs horizontal scroll on smaller ops desks (min-width ~1280px)
- Rapid multi-gate clicks are sequential PATCHes (acceptable for ops board)

## Manual Verification

1. Redeploy web + API  
2. Ops → Group Master → confirm Name + VISA/PKG/PAY/BILL columns  
3. Toggle VISA on a live row → refresh still Ready  
4. Edit modal still updates WhatsApp / Nusuk  
5. Agent portal unchanged  

## Rollback

Redeploy prior web image (and API if `name` projection must be reverted — additive only, safe to leave).
