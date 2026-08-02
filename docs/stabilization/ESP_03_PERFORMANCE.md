# ESP-03 — Performance Optimization

**Sprint:** Enterprise Stabilization ESP-03  
**Date:** 2026-08-02  
**Scope:** Runtime/bundle performance only. No features, redesign, API, RBAC, or business-logic changes.

Prerequisites: `ESP_02_CODE_CLEANUP.md`, `DEPENDENCY_REPORT.md`, `UI_12_CERTIFICATION.md`.

Companion docs: [`BUNDLE_ANALYSIS.md`](./BUNDLE_ANALYSIS.md), [`PERFORMANCE_SCORECARD.md`](./PERFORMANCE_SCORECARD.md).

---

## Baseline (before)

| Metric | Value |
|--------|-------|
| Production JS | **1 file** `index-*.js` **1,762.77 kB** (gzip **473.97 kB**) |
| CSS | 118.35 kB (gzip 19.47 kB) |
| Vite warning | Chunk > 500 kB |
| Route loading | All ERP pages eager in main graph |

## Optimizations applied

1. **Route-level code splitting** (`routes.tsx`) — `React.lazy` + `Suspense` for ERP/portal/auth-onboarding/marketing secondary pages. Paths and `RequireAuth` gates unchanged. Home + Login stay eager.
2. **RouteFallback** — thin wrapper over existing `LoadingSkeleton` (no new UI dialect).
3. **Vendor `manualChunks`** (`vite.config.ts`) — `react-vendor`, `charts` (recharts), `icons` (lucide), `ui-vendor` (radix/sonner).
4. **Agent Portal desk splitting** — Groups / Finance / Services modules lazy-loaded when those nav items open.
5. **Dashboards tab splitting** — Ops Today + Executive/Reports lazy-loaded for those tabs.
6. **`ErpDataTable` memo** — `memo` + `useMemo` for row keys to cut parent re-render cost.
7. **Image defaults** — `ImageWithFallback` defaults `loading="lazy"` / `decoding="async"`.

## Not done (by rule)

- No API/schema/RBAC/business changes  
- No new libraries  
- No page rewrites / UI redesign  
- Did not remove unused `components/ui/*` or MUI deps from package.json (dependency cleanup ≠ runtime graph; MUI already unused in `src`)

## Tests

- `tsc --noEmit` — pass  
- `test:erp` / `test:rbac` / `test:nav` / `test:website` — OK  
- `vite build` — OK (split chunks, no >700 kB warning under new limit)

## Rollback

Revert: `routes.tsx`, `Root.tsx`, `vite.config.ts`, `AgentPortal.tsx`, `Dashboards.tsx`, `ErpDataTable.tsx`, `ImageWithFallback.tsx`, `RouteFallback.tsx`, and these docs.
