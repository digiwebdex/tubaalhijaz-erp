# TUBA AL HIJAZ — UI-08 Executive Dashboard & Reports

**Sprint:** UI-08  
**Status:** Complete  
**SSOT:** `docs/ui/UI_DESIGN_SYSTEM.md`, `UI_03_DASHBOARD.md`, `UI_04_COMPONENT_STANDARD.md`  
**Code:**
- `apps/web/src/app/pages/ExecutiveReportsDashboard.tsx` — Executive + Reports views  
- `apps/web/src/app/pages/Dashboards.tsx` — shell tabs wired  
- `apps/web/src/app/lib/rbac.ts` — `DASH_NAV_PERMS.reports`  

**Scope:** Executive Dashboard + Reports / management views only.  
**Out of scope:** Finance module redesign, Website, Mobile, Ops Today (UI-03), Visa/Long Stay desks.

---

## 1. Objective

Replace the legacy CEO Board (heavy charts + mock widgets) with a Bangla-first **Executive Dashboard** and a simple **Reports** management table view, using existing dashboard aggregations only.

---

## 2. APIs reused (no new SQL)

| Endpoint | Used for |
|----------|----------|
| `GET /dashboards/ceo` | YTD revenue, profit, AR, groups, revenue trend, top agents |
| `GET /dashboards/ops` | Today's ops KPIs, department queues |
| `GET /dashboards/visa` | Visa pipeline, backlog, Long Stay / Day-85 rollups |
| `GET /dashboards/finance` | Cash / AR / AP snapshot, AR aging |

No duplicate calculation logic — values displayed as returned.

---

## 3. Shell tabs

| Tab id | Label (BN) | Component |
|--------|------------|-----------|
| `today` | আজকের কাজ | `OpsTodayDashboard` (UI-03 — unchanged) |
| `ceo` | নির্বাহী | `ExecutiveDashboard` |
| `reports` | রিপোর্ট | `ReportsManagementView` |
| … | legacy boards | Existing Visa / Finance / Ops / … screens |

Permissions: `ceo` → `VIEW_DASHBOARD`; `reports` → `VIEW_DASHBOARD` **or** `FINANCIAL_REPORTS` (UX only).

---

## 4. Executive Dashboard layout

```
Header (+ Refresh)
↓
Executive Summary (revenue, profit, groups, AR)
↓
Today's Operations + Pending Work
↓
Operations KPIs (dept progress bars)
↓
Visa KPIs (tiles + pipeline bars)
↓
Long Stay KPIs (incl. Day-85 / Day-90 / red cards)
↓
Finance Snapshot (tiles + revenue bars + AR aging bars)
↓
Alerts & Top Agents
↓
Reports entry (switch to Reports tab)
```

**Visuals:** Cards + progress bars only (no Recharts on this view).  
**Drill-down:** Every KPI tile navigates to an existing module (`/ops-control`, `/ops-departments`, `/finance-erp`, `/agent-portal`) when the path is allowed.

**CEO content mapping**

| Prompt item | Source |
|-------------|--------|
| Today's Operations | `/dashboards/ops` kpis |
| Pending Work | `ops.kpis.pendingTasks` |
| Revenue Snapshot | `/dashboards/ceo` + finance KPIs |
| Alerts | Derived flags from existing KPI fields (delay, red cards, Day-85, rejected, overdue) |
| Top Agents | `ceo.topAgents` |
| Long Stay / Day-85 | `visa.longStay.*` |

---

## 5. Reports view

Simple Bangla-first management tables:

| Report kind | Rows from |
|-------------|-----------|
| Top Agents | `ceo.topAgents` |
| Visa Pipeline | `visa.pipeline` |
| Long Stay | `visa.longStay` summary rows |
| AR Aging | `finance.arAging` |
| Ops Queues | `ops.departments` |

Uses `ErpPageTemplate` → Search → Filter hint → `ErpDataTable` → `ErpPagination` → `ErpDrawer` (row detail + open module).

---

## 6. Kit components

`ErpPageTemplate`, `ErpSearchBar`, `ErpFilterPanel`, `ErpDataTable`, `ErpPagination`, `ErpDrawer`, `ErpButton`, `ErpStatusChip`

---

## 7. Responsive

- Summary / KPI grids: 2 → 3 → 4 / 6 columns  
- Toolbar stacks on small screens  
- Progress panels stack on mobile  

---

## 8. Tests

```bash
cd apps/web
pnpm run typecheck
pnpm run build
pnpm run test:erp
pnpm run test:rbac
```

Manual: Dashboards → নির্বাহী → KPI drill → রিপোর্ট → filter/search/drawer → Open module.

---

## 9. Rollback

Revert:
- `ExecutiveReportsDashboard.tsx` (delete)
- `Dashboards.tsx` / `rbac.ts` / this doc  

No migrations.
