# ESP-02 — Code Cleanup & Standardization

**Sprint:** Enterprise Stabilization ESP-02  
**Date:** 2026-08-02  
**Scope:** Technical debt reduction only — unused dead helpers/imports. No features, redesign, architecture, routes, API, RBAC, or business logic.

Prerequisite report: [`DEPENDENCY_REPORT.md`](./DEPENDENCY_REPORT.md).

---

## What was removed (confirmed)

| Item | File | Why safe |
|------|------|----------|
| `KPICard`, `PField`, `FileRow`, `ImageCard`, `ProfileCard` | `AgentPortal.tsx` | Zero call sites (UI-12 H candidates) |
| Unused lucide / consts (`NAVY`, `GREEN`, `DARK`, etc.) | `AgentPortal.tsx` | Only referenced by removed helpers |
| `Modal` ErpDrawer adapter | `FleetERP.tsx` | `<Modal` JSX count = 0 |
| Unused lucide (`Search`, `ChevronRight`, `Eye`) | `FleetERP.tsx` | Import-only |
| Unused kit/lang imports | `SupplierPortal.tsx` | Import-only after ESP-01 adapters |
| Unused lucide / full `recharts` import / unused kit | `SuperAdmin.tsx` | Charts never rendered; kit symbols unused except Button/SearchBar/StatusChip |
| `ErpButton`, `ErpStatusKind` unused imports | `WorkflowMap.tsx` | Import-only |
| `CheckCircle`, `X`, `Search` unused | `OCRCenter.tsx` | Import-only |

## What was retained

- All ESP-01 legacy adapters still in use (`ActionBtn`, `ABtn`, `FF`/`FInput`, `SBadge`, `TH`, etc.)
- Orphan pages (`MobileApps`, `Tablet`, `DesignSystem`, `I18nSystem`) — ComingSoon routes; product archive
- Kit exports `ErpCard` / `ErpBadge` / `ErpConfirmDialog` — public kit API
- Entire `components/ui/*` shadcn tree (except active `use-mobile`) — report-only; no mass delete
- All routes, APIs, RBAC, business logic

## Standardization note

Canonical ERP implementations remain: `ErpButton`, `ErpDataTable`, `ErpDrawer`, `ErpForm*`, `ErpStatusChip`, `erpToast`, `ErpSearchBar`, `ErpFilterPanel`. Duplicate dialects in legacy desks are **debt**, not deleted in ESP-02 (would be migration).

## Tests

- `tsc --noEmit` — pass  
- `test:erp` / `test:rbac` / `test:nav` — OK  
- `vite build` — OK  

## Rollback

Revert touched page files + these docs. No DB/API changes.
