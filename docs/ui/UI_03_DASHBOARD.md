# TUBA AL HIJAZ — UI-03 Operations Dashboard

**Sprint:** UI-03  
**Status:** Complete  
**SSOT:** [UI_DESIGN_SYSTEM.md](./UI_DESIGN_SYSTEM.md), [UI_02_NAVIGATION.md](./UI_02_NAVIGATION.md)  
**Scope:** `/dashboards` Operations Today view only — no desk/form/table redesign  

---

## 1. Objective

Transform the default dashboard into an **Operations Dashboard** that answers one question:

> **আজ আমাকে কী কাজ করতে হবে?**

Not an analytics / developer metrics board.

---

## 2. Code

| File | Role |
|------|------|
| `apps/web/src/app/pages/OpsTodayDashboard.tsx` | New Operations Today UI |
| `apps/web/src/app/pages/Dashboards.tsx` | Default tab = `today`; legacy boards kept as secondary |
| `apps/web/src/app/lib/useDash.ts` | Shared auth-guarded GET helper |
| `apps/web/src/app/lib/rbac.ts` | `DASH_NAV_PERMS.today` → `VIEW_DASHBOARD` |

**APIs reused (no new endpoints):**

- `GET /dashboards/visa`
- `GET /dashboards/finance`
- `GET /dashboards/agent`
- `GET /dashboards/supplier`
- `GET /notifications?limit=10` (activity)

---

## 3. Layout

1. **Header** — আজকের কাজ / Today’s Work + refresh  
2. **Quick Actions** — existing routes only (`/ops-control`, `/ops-departments`, `/finance-erp`, portals)  
3. **Today’s Work** — max **6** large cards  
4. **আরও দেখুন** — expands readiness, activity, alerts (+ CEO finance summary)  

Visual: soft borders, no gradients, large spacing, Bangla default.

---

## 4. Widget mapping

| Card | Source field | Drill-down |
|------|--------------|------------|
| Visa Pending | `backlog.notIssued` | `/ops-departments` |
| Embassy Pending | `pipeline.EMBASSY` | `/ops-departments` |
| Passport Return | `pipeline.PASSPORT_RETURNED` | `/ops-departments` |
| MOFA Pending | `issuedTotal − issuedWithMofa` | `/ops-departments` |
| Long Stay | `longStay.tracking \| total` | `/ops-control?tab=longstay` |
| Day-85 | `longStay.due` | `/ops-control?tab=longstay` |
| Collection / Expense / Due | finance KPIs + AR aging | `/finance-erp` |
| Agent groups / pax / visa / pay | `/dashboards/agent` | `/agent-portal` |
| Readiness gates | `gates.*` | `/ops-control?tab=groups` |
| Alerts | due / rejectedOpen / PASSPORT_RETURNED | existing modules |
| Activity | notification feed | — |

---

## 5. Role views (existing permissions)

| Persona | Detection | Primary widgets |
|---------|-----------|-----------------|
| **Agent** | `company.type === AGENT` | My Groups, Passengers, Visa, Payments |
| **Supplier** | `company.type === SUPPLIER` | Bookings, invoices, upcoming |
| **Finance** | `FINANCIAL_REPORTS` without ops admin tools | Collection, Expense, Due |
| **Visa / Ops** | `VIEW_DASHBOARD` staff (default) | Six visa/LS work cards |
| **CEO** | Finance **and** ops/admin tools | Ops six + finance under আরও দেখুন |

No new RBAC keys.

---

## 6. Secondary tabs

Legacy boards (Visa detail, Finance, Ops, CEO, Dispatch, boards, Agent/Supplier views) remain reachable via secondary shell tabs — not removed, demoted from default.

---

## 7. Responsive

- 1 → 2 → 3 column work-card grid (`sm` / `xl`)  
- Quick actions wrap  
- Same content on tablet/mobile  

---

## 8. Tests

| Check | Result |
|-------|--------|
| Web typecheck | Required PASS |
| Web build | Required PASS |
| `test:rbac` | Updated for `today` nav key |

---

## 9. Risks

| Risk | Note |
|------|------|
| Persona heuristic | Maps permission packs → views; edge roles may look like “visa” or “finance” |
| Activity = notifications | No dedicated ops activity API — reused in-app notification log |
| Coming Soon on legacy tabs | Old boards may still show Coming Soon widgets; default Today does not |

---

## 10. Rollback

Revert `OpsTodayDashboard.tsx`, `useDash.ts`, `Dashboards.tsx` wiring, `rbac.ts` `today` key, and this doc. No DB/API rollback.
