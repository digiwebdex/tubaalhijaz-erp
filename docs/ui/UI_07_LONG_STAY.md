# TUBA AL HIJAZ — UI-07 Long Stay

**Sprint:** UI-07  
**Status:** Complete  
**SSOT:** `docs/ui/UI_DESIGN_SYSTEM.md`, `UI_04_COMPONENT_STANDARD.md`, `UI_06_VISA_DESK.md`  
**Code:** `apps/web/src/app/pages/OpsControl.tsx` → `LongStayScreen` / `LongStayDrawer`  
**Scope:** Long Stay UI only (no Finance / Reports / Website)

---

## 1. Objective

Replace legacy Long Stay side-panel chrome with the Enterprise Component Kit while keeping:

- `GET /ops/long-stays`  
- `PATCH /ops/long-stays/:id` (`registerHost`, `exitDate`)  
- Day-85 derived view (read-only stages / red card)  
- RBAC / permissions  

No Day-85 business-logic or automation changes.

---

## 2. Layout

```
Header (title + Refresh)
↓
Today's Long Stay Summary
↓
Quick Filters
↓
Search + Filter panel
↓
ErpDataTable
↓
ErpPagination
↓
ErpDrawer
```

---

## 3. Summary widgets

Counts from **existing row fields** on the loaded list (same pattern as the old red-card badge — no new formulas):

| Widget | Source |
|--------|--------|
| Host Complete | `hostComplete === true` |
| Day-85 Due | `day85.stage === "DUE"` |
| Day-90 Escalated | `day85.stage === "ESCALATED"` |
| Completed | `status === "COMPLETED"` |

Clicking a widget sets the matching quick filter.

---

## 4. Search & filters

| Control | Behavior |
|---------|----------|
| Search | `ErpSearchBar` — BN: `যাত্রীর নাম, হোস্ট অথবা ইকামা নম্বর লিখুন...` → host / iqama / group / code / hotel |
| Quick | All · Host Complete · Red cards · Approaching · Day-85 Due · Day-90 · Resolved · Completed |
| Host Complete | Filter panel Yes/No |
| Visa Type | Filter panel (LONG_STAY / UMRAH / HAJJ from `groupVisaType`) |
| Day-85 / Day-90 / Resolved | Quick filters (same board fields as prior `?day85=` stages / `red`) |

**Agent** filter is not invented — `ApiLongStay` has no agent field in the prior UI/API shape.

List is loaded once via `GET /ops/long-stays` (no query) so summary stays accurate; filters run client-side on the same fields the old `?day85=` query used.

---

## 5. Table

`ErpDataTable`: sticky header, compact rows, host + Day-85 + status chips, Open action, row click → drawer.

---

## 6. Drawer

`LongStayDrawer` tabs:

| Tab | Content |
|-----|---------|
| Summary | Group, hotel, host complete, Day-85 chip |
| Host | Name, Iqama, WhatsApp, Relation, Absher, Entry/Exit (entry/exit display); sticky **Save Host** → `PATCH` + `registerHost` |
| Day-85 | Read-only indicators (Red Card / Approaching / Due / Escalated / Resolved) + exit date resolve button → `PATCH { exitDate }` |
| History | Check-in/out, entry/exit, due, notified, resolvedBy |

Sticky footer: Cancel + Save Host (`ErpDrawerFooterActions`).

---

## 7. Empty / responsive

- Empty: Bangla title + hint + Refresh  
- Desktop / tablet / mobile: summary 2→4 columns; toolbar stacks; drawer ≤720px  

---

## 8. Tests

```bash
cd apps/web
pnpm run typecheck
pnpm run build
pnpm run test:erp
```

Manual: Ops Control → Long Stay → summary/quick filter → search → open drawer → Save Host / Record exit.

---

## 9. Rollback

Revert `apps/web/src/app/pages/OpsControl.tsx` Long Stay section + this doc. No migrations.
