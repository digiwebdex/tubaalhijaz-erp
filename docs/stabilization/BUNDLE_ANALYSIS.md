# ESP-03 — Bundle Analysis

**Date:** 2026-08-02  
**Tooling:** `pnpm run build` (Vite 6) — no new analyzer package introduced.

---

## Before (monolith)

| Asset | Raw | Gzip |
|-------|-----|------|
| `index-*.js` | 1,762.77 kB | 473.97 kB |
| `index-*.css` | 118.35 kB | 19.47 kB |

All ERP desks, recharts, icons, and router shared one JS payload.

---

## After (split)

### Totals

| Metric | Value |
|--------|-------|
| JS files | ~38 chunks |
| Sum of JS raw | ~1,779 kB (slightly higher due to chunk boundaries) |
| Sum of JS gzip | ~510 kB |
| **Approx first paint JS** (`index` + `react-vendor`) | **~437 kB raw / ~142 kB gzip** |

Gzip sum is not what a single page downloads — users load entry + vendors + **one route chunk**.

### Largest chunks (raw)

| Chunk | Raw kB | Gzip kB | Notes |
|-------|--------|---------|-------|
| `charts-*` | 393 | 108 | recharts — loaded with Finance/Dashboards boards that import it |
| `react-vendor-*` | 237 | 77 | react / react-dom / router |
| `index-*` | 200 | 64 | app shell, Home, Login, shared bootstrap |
| `FinanceERP-*` | 85 | 22 | route-only |
| `OpsControl-*` | 81 | 21 | route-only |
| `FleetERP-*` | 76 | 18 | route-only |
| `ERPShell-*` | 71 | 21 | shared shell when ERP route mounts |
| `AgentPortalGroups-*` | 55 | 15 | agent desk — deferred until Groups tab |
| `icons-*` | 49 | 10 | lucide shared |

### Route chunk sizes (selected)

| Route module | Raw kB | Gzip kB |
|--------------|--------|---------|
| AgentPortal (shell) | 26 | 8 |
| AgentPortalServices | 38 | 10 |
| AgentPortalFinance | 40 | 9 |
| SupplierPortal | 39 | 9 |
| SuperAdmin | 39 | 10 |
| Dashboards (core + charts dep) | 41 | 11 |
| OpsTodayDashboard | 16 | 5 |
| ExecutiveReportsDashboard | 23 | 7 |
| OCRCenter | 23 | 8 |
| WorkflowMap | 25 | 8 |
| AutomationNotifications | 47 | 14 |

### Duplicate dependencies

| Finding | Detail |
|---------|--------|
| `@mui/*` / `@emotion/*` in package.json | **Not imported** by `apps/web/src` — not in production graph (good). Optional future package.json prune (out of ESP-03 “no remove functionality / no dep surgery” unless measured unused in lockfile install). |
| shadcn `components/ui/*` | Still not imported by pages (ESP-02 report); not in main graph except `use-mobile`. |
| recharts | Isolated to `charts-*` chunk; not on Home/Login. |

### CSS

Unchanged magnitude (~118 kB). No CSS splitting applied (Tailwind single pipeline).

---

## Interpretation

- **Initial navigation** no longer downloads every ERP module + recharts.  
- **Finance / chart boards** still pay the charts chunk when opened — expected.  
- Total bytes on disk ≈ same; **per-session transfer** for typical staff flows is lower.
