# T002-09 Completion — Reports & Dashboards

**Task:** T002-09 (TRANSFORM-002)  
**Date:** 2026-08-01  
**Status:** Complete — stopped before T002-10

---

## Architecture overrides prompt

The prompt titled this “Operations Control Center / Reports & Executive Dashboards” and listed a broad KPI catalog (Customer Intake OCR, Notifications Sent/Failed/Pending, etc.).  
Architecture §17 defines:

> **T002-09** Reports & Dashboards | Backlog widgets; mutamer visa/MOFA report; honesty copy

**Contract followed = architecture.** Differences:

| Prompt said | Architecture said | What shipped |
|-------------|-------------------|--------------|
| Full “Operations Control Center” with Intake / Notifications KPI groups | §12 Dashboard Mapping — 7 specific widgets + honesty copy | Only §12 widgets + marketing honesty; Intake/Notifications KPIs **not** invented |
| “Calculate only when architecture requires” + many new KPI groups | §15 “Replace ComingSoon; read aggregations” | Reuse `OpsService.mutamerVisaDesk` / `longStays` / gate columns — no reporting DB |
| Separate ops intelligence surface | §6 “Dashboards `/dashboards` — Replace ComingSoon visa cards; add LS red cards + biometric backlog” | Same `/dashboards` shell; new **Visa & Compliance** tab inside it |
| Drill to operate | Same (no business actions) | Card actions navigate to existing Visa Desk / Long Stay / Group Master |

---

## 1. Exact Scope

Quoted from `analysis/TRANSFORM_002_ARCHITECTURE.md` §17:

> **T002-09** Reports & Dashboards | Backlog widgets; mutamer visa/MOFA report; honesty copy

Supporting clauses:

> §6 — Dashboards `/dashboards` | Replace ComingSoon visa cards; add LS red cards + biometric backlog  
> §6 — Marketing Home/Login | **Honesty:** remove NUSUK/MOFA API claims  
> §12 — Active visa pipeline counts by state · Biometric registered, visa not issued · Groups arriving ≤7d still not issued · MOFA number completeness % · Long Stay red cards (day-85/90) · `gateVisa` board · Agent “Visa Status” card  
> §12 — Remove mock “MOFA clearance confirmed” demo strings from live dashboards  
> §15 — Dashboards/reports | Replace ComingSoon; read aggregations

---

## 2. Architecture Contract

| Widget (§12) | Source | Surface |
|--------------|--------|---------|
| Pipeline counts by state | `OpsService.mutamerVisaDesk` → `counts` | `/dashboards/visa` + Ops strip + Agent card |
| Biometric registered, not issued | `biometricBacklogWhere()` | `/dashboards/visa` backlog |
| Arriving ≤7d still not issued | desk `arrivingWithinDays=7` + group count | `/dashboards/visa` backlog |
| MOFA completeness % | desk `mofaCompleteness` | `/dashboards/visa` + Agent card |
| Long Stay red cards (day-85/90) | `OpsService.longStays` + `day85View` | `/dashboards/visa` |
| `gateVisa` board | `gateReadiness()` on Group gates | `/dashboards/visa` |
| Agent Visa Status | tenant-scoped desk counts | `/dashboards/agent.visa` |
| Honesty copy | Marketing Home / Login / Services / About | Public pages |

---

## 3. Reuse Declaration

**Reused**

- `DashboardsModule` / `DashboardsService` / `DashboardCache`
- `OpsService.mutamerVisaDesk`, `OpsService.longStays`, `day85View`, `visa-desk.util`
- Existing `/dashboards` shell + `VIEW_DASHBOARD` RBAC
- Finance `ReportsService` (unchanged CEO/Finance tabs)
- Existing Ops Departments Visa Desk and Ops Control Long Stay (drill targets)

**Extended**

- `GET /dashboards/visa` (already present; verified + e2e)
- `GET /dashboards/agent` → `visa` block (already present; wired in UI)
- `Dashboards.tsx` — Visa & Compliance screen; Ops/Agent ComingSoon replaced
- Marketing honesty copy; mock “MOFA clearance” strings removed
- `docs/DASHBOARDS.md`

**New modules:** none

**Intentionally untouched:** OCR Center, Finance Bill Sheet, Automation engine, Day-85 sweep, Visa pipeline transitions, reporting tables/materialized views, BI/export engines, Intake/Notification KPI invents from the prompt

---

## 4. Business Workflow

```
Executive / Ops staff (VIEW_DASHBOARD)
   ↓
Open /dashboards → Visa & Compliance (or Ops / Agent tabs)
   ↓
Read §12 KPIs (pipeline, MOFA %, biometric, arrival risk, LS red cards, gates)
   ↓
Drill → Visa Desk / Long Stay / Group Master (existing screens)
   ↓
Operate there — dashboard itself performs no mutations
```

---

## 5. KPI Matrix

| Group | KPI | In scope? | Source |
|-------|-----|-----------|--------|
| Visa | Pipeline states NEW…REJECTED_CLOSED | Yes (§12) | Passenger.visaPipelineStatus |
| Visa | Biometric not issued | Yes (§12) | biometricBacklogWhere |
| Visa | Arriving ≤7d not issued | Yes (§12) | departDate + not-issued states |
| MOFA | Complete % / Pending % | Yes (§12) | mofaNumber / issued family |
| Long Stay | Host complete %, Day-85 Due, Day-90 Escalated | Yes (§12) | LongStay + day85View |
| Groups | Ready / Waiting Visa/Package/Payment/Bill | Yes (gateVisa board) | Group gate* columns |
| Ops (existing) | Groups Active etc. | Pre-existing ops tab | unchanged |
| Customer Intake (OCR/Import) | — | **No** — not in §12 | — |
| Notifications Sent/Failed | — | **No** — not in §12 | — |

---

## 6. Business Impact

- Executives and Ops see the same Visa Desk / Day-85 numbers on a single board — no second source of truth.
- ComingSoon visa cards are gone; backlog and red cards are actionable via drill-down.
- Marketing no longer claims a live NUSUK/MOFA government API, matching the staff-update model (architecture principle 4 / honesty).

---

## 7. Files Changed

| File | Change |
|------|--------|
| `apps/web/src/app/pages/Dashboards.tsx` | VisaDash screen; Ops/Agent live visa widgets; drill routes |
| `apps/web/src/app/lib/rbac.ts` | `DASH_NAV_PERMS.visa` |
| `apps/web/src/app/components/ERPShell.tsx` | Remove “MOFA clearance confirmed” demo bell |
| `apps/web/src/app/pages/Home.tsx` | Honesty copy |
| `apps/web/src/app/pages/Login.tsx` | Honesty copy |
| `apps/web/src/app/pages/Services.tsx` | Honesty copy |
| `apps/web/src/app/pages/About.tsx` | Honesty copy |
| `apps/web/src/app/pages/MobileApps.tsx` | Demo string cleanup |
| `apps/web/src/app/pages/DesignSystem.tsx` | Sample toast honesty |
| `apps/api/test/dashboards.e2e-spec.ts` | T002-09 scenarios |
| `docs/DASHBOARDS.md` | Document `/visa` + agent.visa |
| `docs/T002_09_COMPLETION.md` | This file |

Backend `DashboardsService.visa()` / `agent().visa` were already implemented for T002-09; no schema change required.

---

## 8. Database Changes

None.

---

## 9. Migration

None.

---

## 10. API Changes

| Endpoint | Change |
|----------|--------|
| `GET /dashboards/visa` | Confirmed SoT for §12 widgets (read-only, cached 30s) |
| `GET /dashboards/agent` | Confirmed `visa: { pipeline, notIssued, mofaCompletePercent }` |

No new reporting APIs. No mutations.

---

## 11. UI Changes

- New nav item **Visa & Compliance** on `/dashboards`
- Ops → “Visa Pipeline Backlog” replaces ComingSoon
- Agent → “Visa Status” live tenant-scoped counts
- Card actions: Visa Desk → `/ops-departments`, Long Stay / Group Master → `/ops-control`
- Marketing honesty on Home / Login / Services / About
- Demo “MOFA clearance confirmed” strings removed from shell / mobile demo / agent mock list

---

## 12. RBAC Changes

None new. Entire `/dashboards/*` remains `@RequirePermissions("VIEW_DASHBOARD")`. Agents 403. Frontend `DASH_NAV_PERMS.visa = [VIEW_DASHBOARD]`.

---

## 13. Audit Changes

None. Dashboard viewing is not audited (per task).

---

## 14. Event Changes

None.

---

## 15. Tests Executed

`dashboards.e2e-spec.ts` additions:

1. Executive opens `/dashboards/visa` → 200 + shape shape  
2. Visa KPIs correct (pipeline vs groupBy, MOFA %, biometric backlog, gates)  
3. Long Stay KPIs correct (total, redCards = due+escalated)  
4. Agent → `/dashboards/visa` → 403  
5. Agent Visa Status payload on `/dashboards/agent`

Plus existing dashboard regression suite. Web `tsc --noEmit` clean.

---

## 16. Risks

| Risk | Mitigation |
|------|------------|
| Cache lag (30s) vs Visa Desk live | Acceptable for executive board; bust on demand in tests |
| Prompt KPI groups not built | Documented as architecture override — do not invent |
| Agent portal vs Agent dashboard confusion | AgentDash is staff overview (`VIEW_DASHBOARD`); portal batch tracker unchanged |

---

## 17. Manual Verification

1. Login as Ops/CEO → `/dashboards` → **Visa & Compliance** loads with pipeline / MOFA / LS / gates.  
2. Confirm pipeline totals match Visa Desk KPI strip.  
3. Click **Visa Desk →** opens `/ops-departments`. **Long Stay →** opens `/ops-control`.  
4. Ops tab shows live Visa Pipeline Backlog (not Coming soon).  
5. Agent tab shows Visa Status counts for the representative tenant.  
6. Login as agent → `/dashboards/visa` API → 403.  
7. Public Home/Login/Services — no “Direct NUSUK & MOFA API sync” claims.

---

## 18. Rollback

1. Revert the web/docs/test files in §7.  
2. Optionally hide the Visa nav item; `/dashboards/visa` can remain as a harmless read endpoint.  
3. No DB rollback required.

---

**Stopped before T002-10** (Final Acceptance).
