# ESP-02 — Dependency Report

**Sprint:** Enterprise Stabilization ESP-02  
**Date:** 2026-08-02  
**Method:** Static reference scan (`rg` / Python word-boundary counts) over `apps/web/src/app/**/*.{ts,tsx}`.  
**Rule:** No guessing. Uncertain items → report only, do not delete.

Sources consulted: `docs/ui/DEAD_CODE_REPORT.md`, `docs/ui/LEGACY_COMPONENT_REPORT.md`, `docs/ui/UI_12_CERTIFICATION.md`, `docs/stabilization/ESP_01_LEGACY_MIGRATION.md`.

---

## 1. Verdict summary

| Class | Action |
|-------|--------|
| Confirmed unused (zero call sites) | Safe to remove in ESP-02 |
| Still referenced | Keep |
| Orphan / archived pages behind ComingSoon | Report only — **do not delete** (product decision) |
| Kit public API with zero page consumers | Retain (standard kit surface) |
| shadcn `components/ui/*` (except `use-mobile`) | Report only — no page imports found; purge needs separate sign-off |

---

## 2. Confirmed unused — remove in ESP-02

| Symbol / item | Location | Evidence | Confidence |
|---------------|----------|----------|------------|
| `KPICard` | `AgentPortal.tsx` | Defined only; no JSX/call sites in file. (SuperAdmin has its own `KPICard`.) | H |
| `PField` | `AgentPortal.tsx` | Defined only | H |
| `FileRow` | `AgentPortal.tsx` | Defined only | H |
| `ImageCard` | `AgentPortal.tsx` | Defined only | H |
| `ProfileCard` | `AgentPortal.tsx` | Defined only | H |
| `Modal` adapter | `FleetERP.tsx` | Defined; `<Modal` JSX count = **0** (forms use `ErpDrawer` directly) | H |
| Unused kit/lang imports | `SupplierPortal.tsx` | Import-only (hits=1): `ErpPageTemplate`, `ErpButton`, `ErpSearchBar`, `ErpFilterPanel`, `ErpDataTable`, `ErpPagination`, `ErpDrawer`, `ErpForm`, `ErpFormRow`, `useLang`, `fontFor` | H |
| Unused kit imports | `SuperAdmin.tsx` | Import-only: `ErpPageTemplate`, `ErpFilterPanel`, `ErpDataTable`, `ErpPagination`, `ErpDrawer`, `ErpDrawerFooterActions`, `ErpForm*`, `ErpDeleteDialog`, `erpToast`, `useLang`, `fontFor`, `SampleDataBanner`, unused recharts + many lucide | H* |
| Unused kit import | `WorkflowMap.tsx` | `ErpButton` import-only | H |
| Lucide leftovers after helper delete | `AgentPortal.tsx` | Icons only used by removed helpers (`ArrowUp`/`ArrowDown`/`Camera`/`GREEN` const) | H |

\*SuperAdmin: trim only symbols with import-only hits; keep `ErpButton`, `ErpSearchBar`, `ErpStatusChip` (FilterBar / SBadge).

---

## 3. Still referenced — keep (legacy adapters)

| Adapter | File | Call-site refs (excl. def) |
|---------|------|----------------------------|
| `ActionBtn`, `Field`, `TH`, `Chip`, `SevChip`, `EmptyRow`, `inputCls`/`inputSelCls`, `STAT_C` | FleetERP | >0 |
| `SBadge`, `THead`, `TableState`, `FF`, `FInput`, `FSelect`, `Card`, `CardHead`, `Amt` | SupplierPortal | >0 |
| `Modal`, `StatusPill`, `ConfBar` | OCRCenter | >0 |
| `ABtn`, `StatBadge`, `ChBadge`, `Toggle`, `FlowArrow`, `FlowBlock` | AutomationNotifications | >0 |
| `SBadge`, `SectionHead`, `FilterBar`, `THead`, `Toggle`, `KPICard` | SuperAdmin | >0 |
| `ActionBtn`, `TH`, `Amt` | FinanceERP | >0 |

ESP-01 adapters remain until those call sites migrate — **not removed**.

---

## 4. Orphan / ComingSoon pages — report only

| File | Router | Notes |
|------|--------|-------|
| `MobileApps.tsx` | `/mobile-apps` → `ComingSoon` | Not imported; archive |
| `Tablet.tsx` | `/tablet` → `ComingSoon` | Not imported; archive |
| `DesignSystem.tsx` | `/design-system` → `ComingSoon` | Living DS reference; comments in `States.tsx` |
| `I18nSystem.tsx` | `/i18n-system` → `ComingSoon` | Not imported; archive |
| `WorkflowMap.tsx` | **LIVE** after ESP-01 | Keep — routed |

**Do not delete** orphan page files in ESP-02. Routes unchanged per sprint rules.

---

## 5. Enterprise Kit exports — retain

| Export | Page consumers | Decision |
|--------|----------------|----------|
| `ErpCard` / `ErpSectionHeader` | None outside `components/erp` | Keep — kit API |
| `ErpBadge` (raw) | None (pages use `ErpStatusChip`) | Keep — sibling of StatusChip |
| `ErpConfirmDialog` | Used by `ErpDeleteDialog` | Keep |

---

## 6. `components/ui/*` (shadcn)

| Finding | Detail |
|---------|--------|
| Imports from outside `components/ui/` | **None** found except `use-mobile` / `MOBILE_BREAKPOINT` used by `ERPShell` / `ErpDrawer` |
| Remaining ~45 shadcn files | Zero page imports in this scan |
| Decision | **Report only** — do not mass-delete without product sign-off (may be intentional DS scaffolding) |

---

## 7. Duplicate dialects (not dead — standardization debt)

Live parallel implementations remain (documented in LEGACY_COMPONENT_REPORT; not deleted in ESP-02):

- `ActionBtn` / `ABtn` vs `ErpButton`
- `FInput` / `FF` vs `ErpInput` / `ErpField`
- Raw `<table>` / `TH` vs `ErpDataTable`
- `SBadge` / `Chip` vs `ErpStatusChip`
- `toast` (sonner) vs `erpToast` in some modules (Agent vault still uses `toast`)

ESP-02 does **not** rewrite these (that is migration work, not cleanup).

---

## 8. Dead menu / routes

| Item | Status |
|------|--------|
| ComingSoon routes | Intentional narrow launch — keep routes |
| Dead menu items | No orphan menu entries found beyond ComingSoon destinations |

---

## 9. What ESP-02 will change

1. Delete confirmed-dead helpers in `AgentPortal.tsx`.  
2. Delete unused `Modal` adapter in `FleetERP.tsx`.  
3. Trim confirmed unused imports in Supplier / SuperAdmin / Workflow / AgentPortal / OCR / Fleet.  
4. Document retained adapters and reported-only orphans.

No DB / API / RBAC / route / business-logic edits.
