# ESP-01 — Legacy Module Migration

**Sprint:** Enterprise Stabilization ESP-01  
**Date:** 2026-08-02  
**Scope:** UI chrome only — migrate remaining legacy list/form surfaces to the Enterprise Component Kit.  
**Non-goals:** No database, API, backend, RBAC, workflow, finance, visa, OCR, automation, or notification *logic* changes.

## SSOT

- `docs/ui/UI_DESIGN_SYSTEM.md`
- `docs/ui/UI_COMPONENT_GUIDE.md`
- `docs/ui/UI_04_COMPONENT_STANDARD.md`
- `docs/ui/UI_12_CERTIFICATION.md`
- `docs/ui/LEGACY_COMPONENT_REPORT.md`

## Modules migrated

| # | Module | Primary file | Kit adoption |
|---|--------|--------------|--------------|
| 1 | Fleet | `apps/web/src/app/pages/FleetERP.tsx` | Vehicle/Driver/Fuel/Maintenance/Insurance masters → `ErpPageTemplate` + search/filter/table/pagination/drawer/delete; helpers `ActionBtn`/`Modal`/`Chip` → kit adapters |
| 2 | Supplier | `apps/web/src/app/pages/SupplierPortal.tsx` | `SBadge` → `ErpStatusChip`; `FF`/`FInput`/`FSelect` → `ErpField`/`ErpInput`/`ErpSelect`; `erpToast` |
| 3 | OCR Center | `apps/web/src/app/pages/OCRCenter.tsx` | Queue → kit page template + table; `Modal` → `ErpDrawer`; `StatusPill` → `ErpStatusChip` |
| 4 | Automation | `apps/web/src/app/pages/AutomationNotifications.tsx` | Log screen → kit; `ABtn`/`StatBadge` → kit adapters; `erpToast` |
| 5 | Workflow | `apps/web/src/app/pages/WorkflowMap.tsx` + `routes.tsx` | Wired `/workflow-map` to live `WorkflowMap`; Directory → kit table/search/pagination |
| 6 | Super Admin | `apps/web/src/app/pages/SuperAdmin.tsx` | `SBadge` → `ErpStatusChip`; `FilterBar` → `ErpSearchBar` + `ErpButton` |

## Enterprise components adopted

`ErpPageTemplate`, `ErpSearchBar`, `ErpFilterPanel`, `ErpDataTable`, `ErpPagination`, `ErpDrawer`, `ErpDrawerFooterActions`, `ErpForm` / `ErpField` / `ErpInput` / `ErpSelect` / `ErpTextarea`, `ErpButton`, `ErpStatusChip`, `ErpDeleteDialog`, `erpToast`.

## Layout contract (list desks)

Title → Primary action → Search → Filter → Table → Pagination → Drawer → Sticky save bar.

## Intentionally remaining legacy (out of ESP-01 target list or non-tabular)

- Fleet: GPS map canvas, dispatch assignment canvas, dashboard KPI cards (non-table).
- Supplier: split booking detail panel chrome; dashboard KPI cards; statement/payments placeholders.
- Automation: Rules flow-builder canvas; notification template editor; in-app dropdown demo.
- Workflow: Pipeline / tracker visualization (non-table).
- Super Admin: Company review modal internals; dashboard charts; Advanced → ComingSoon redirects.
- Finance secondary desks / Agent Finance-Services (not in ESP-01 target list — see UI-12).

## Tests

- `pnpm exec tsc --noEmit` (apps/web) — pass
- Build / `test:erp` / `test:rbac` / `test:nav` — run as part of ESP-01 closeout

## Risks

- Adapter wrappers (`ActionBtn`, `Modal`, `ABtn`, `FF`) still exist for call-site compatibility; primary desks use kit directly.
- Workflow Map was previously ComingSoon; users with `VIEW_DASHBOARD` now see the live map (same RBAC path).
- Supplier `erpToast` messages flattened from sonner `{ description }` options — copy only, same outcomes.

## Rollback

Revert the six page files + `apps/web/src/app/routes.tsx` (workflow route) and this doc. No migrations or API changes to roll back.
