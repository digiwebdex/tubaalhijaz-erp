# TUBA AL HIJAZ — Dead Code Report

**Sprint:** UI-12 (verification)  
**Date:** 2026-08-02  
**Rule:** Report only — **do not delete automatically**. Confirm with product owners before any removal.

Confidence: **H** = high · **M** = medium · **L** = low  

---

## 1. Dead / stub routes

From `apps/web/src/app/routes.tsx`:

| Route | Component | Reality | Confidence |
|-------|-----------|---------|------------|
| `/workflow-map` | `ComingSoon` | Page file `WorkflowMap.tsx` **exists** but is **not** routed | H |
| `/mobile-apps` | `ComingSoon` | `MobileApps.tsx` exists, not routed | H |
| `/tablet` | `ComingSoon` | `Tablet.tsx` exists, not routed | H |
| `/design-system` | `ComingSoon` | `DesignSystem.tsx` exists (living DS), not routed | H |
| `/i18n-system` | `ComingSoon` | `I18nSystem.tsx` exists, not routed | H |

**Interpretation:** Orphaned page implementations behind ComingSoon routes. Likely intentional “narrow honest launch” (see routes comments). Removal would discard prototypes — treat as **archived**, not garbage, until product decides.

---

## 2. Orphan page files (not imported by router)

| File | Notes | Confidence |
|------|-------|------------|
| `WorkflowMap.tsx` | Replaced by ComingSoon at `/workflow-map` | H |
| `MobileApps.tsx` | Same | H |
| `Tablet.tsx` | Same | H |
| `DesignSystem.tsx` | Documented as living reference in UI_DESIGN_SYSTEM; route stubbed | H |
| `I18nSystem.tsx` | Same pattern | H |

Still valuable as references; **do not auto-delete**.

---

## 3. Kit exports with zero page consumers

| Export | Defined | Used outside `components/erp/` | Confidence |
|--------|---------|--------------------------------|------------|
| `ErpCard` / `ErpSectionHeader` | `ErpCard.tsx` | **No** page imports found | H |
| `ErpBadge` (raw) | `ErpBadge.tsx` | Pages use `ErpStatusChip`; raw `ErpBadge` unused | M |
| `ErpConfirmDialog` | Shared with `ErpDeleteDialog` | Delete used in Groups; confirm may be indirect | M |

`ErpStatusChip`, `ErpButton`, `ErpDataTable`, `ErpDrawer`, `ErpPageTemplate`, `ErpSearchBar`, `ErpFilterPanel`, `ErpPagination`, `ErpForm*` are actively used.

---

## 4. Likely dead helpers inside live files

| Location | Symbol / pattern | Notes | Confidence |
|----------|------------------|-------|------------|
| `AgentPortal.tsx` | `KPICard` | Defined; dashboard no longer uses KPI grid | H |
| `AgentPortal.tsx` | `ProfileCard` / `PField` / `FileRow` / `ImageCard` | Profile is empty-state kit; helpers may be unused | M |
| `FinanceERP.tsx` | Residual `ActionBtn` | Still used by secondary screens | — keep |
| `FinanceERP.tsx` | Demo chart data (`CASH_FLOW`, `PL_CHART`) | Used by P&L/BS demo visuals | L (live vs demo) |

---

## 5. Dead CSS / assets

| Item | Finding | Confidence |
|------|---------|------------|
| PWA offline page | No `offline.html` | H — documented gap, not dead code |
| Service worker | None in `apps/web/src` | H — not shipped |
| `site.webmanifest` | Present + built to `dist/` | Active |
| shadcn `components/ui/*` | Large set; **not imported by pages** in audit | M — may be used by non-page components; inventory before purge |
| `HeroBackdrop` / marketing CSS classes | Used by Home | Active |

---

## 6. Dead icons / utilities

| Item | Finding | Confidence |
|------|---------|------------|
| Lucide imports | Per-file unused imports possible; not fully scanned | L |
| `@tuba/shared` i18n | Actively used | Active |
| `useDash` | Ops Today / Dashboards | Active |

Full unused-export tree-shaking should use `knip` / `ts-prune` in a dedicated chore — **out of scope for UI-12 auto-removal**.

---

## 7. Duplicate implementations (not dead, but debt)

| Concern | Examples |
|---------|----------|
| Parallel form controls | `FInput` vs `ErpInput` |
| Parallel tables | Raw `<table>` vs `ErpDataTable` |
| Parallel status chips | `SBadge` vs `ErpStatusChip` |
| Dual dashboard hosts | `OpsTodayDashboard` + legacy boards inside `Dashboards.tsx` |

These are **live duplicates**, not dead code — see LEGACY_COMPONENT_REPORT.md.

---

## 8. Safe cleanup candidates (manual, future chore)

Only after product sign-off:

1. Wire or archive `DesignSystem.tsx` / `I18nSystem.tsx` / `Tablet.tsx` / `MobileApps.tsx` / `WorkflowMap.tsx`.  
2. Remove unused `KPICard` (and other confirmed-unused helpers) from `AgentPortal.tsx`.  
3. Adopt or delete unused `ErpCard` exports.  
4. Run knip on `apps/web` with an allowlist for marketing assets.

**UI-12 action:** none removed.
