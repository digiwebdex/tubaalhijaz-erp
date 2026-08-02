# TUBA AL HIJAZ — UI-06 Visa Desk

**Sprint:** UI-06  
**Status:** Complete  
**SSOT:** `docs/ui/UI_DESIGN_SYSTEM.md`, `UI_04_COMPONENT_STANDARD.md`, `UI_05_GROUP_PASSENGER.md`  
**Code:** `apps/web/src/app/pages/OpsDepartments.tsx` → `VisaDesk` / `MutamerVisaBoard` / `MutamerVisaDrawer`  
**Scope:** Visa Desk UI only (no Long Stay / Finance / Reports redesign)

---

## 1. Objective

Replace legacy Mutamer Visa Desk chrome with the Enterprise Component Kit while keeping:

- `GET /ops/visa/mutamers` query params & counts  
- `POST /passengers/:id/visa-transition`  
- Allowed-edge pipeline logic  
- RBAC / permissions  
- Batch VisaRequest secondary view  

---

## 2. Layout

```
Header (title + Refresh + Batch Requests)
↓
Today's Visa Summary (existing counts)
↓
Quick Filters (pipeline state chips)
↓
Search + Filter panel
↓
ErpDataTable (+ bulk select, status chips, row Open)
↓
ErpPagination
↓
ErpDrawer (passenger detail)
```

---

## 3. Today's Visa Summary

Widgets map **only** to existing `counts` from the API (no new calculations):

| Widget | Count key |
|--------|-----------|
| Today's Pending | `NEW` |
| MOFA | `MOFA` |
| Embassy | `EMBASSY` |
| Passport | `PASSPORT_RETURNED` |
| Issued | `ISSUED` |
| Rejected | `REJECTED` |

Clicking a widget sets the same `visaState` filter as Quick Filters.  
MOFA completeness note (`mofaCompleteness`) remains informational (identity %, not Finance bill).

---

## 4. Search & filters

| Control | Behavior |
|---------|----------|
| Search | `ErpSearchBar` — BN placeholder: `যাত্রীর নাম, পাসপোর্ট নম্বর বা গ্রুপ নম্বর লিখুন...` → `q` |
| Pipeline | Quick filter chips → `visaState` |
| Embassy | text → `embassy` |
| Visa Type | UMRAH / HAJJ / LONG_STAY → `visaType` |
| Umrah Co | existing company list → `umrahCompanyId` |
| Priority | URGENT / HIGH / NORMAL / LOW → `priority` |
| Arrival | checkbox → `arrivingWithinDays=7` |

Group / Agent filters are **not** invented — they were not in the prior API query surface.

---

## 5. Table

`ErpDataTable`: sticky header, compact rows, large Open target, `ErpStatusChip` for visa state, bulk selection, row click opens drawer.

---

## 6. Drawer

`MutamerVisaDrawer` (`ErpDrawer`, max 720px) with tabs:

| Tab | Content |
|-----|---------|
| Summary | Passenger + passport summary; Open Group / Visa Request |
| Pipeline | Horizontal progress chips; allowed transitions; rejection reason field |
| Details | MOFA + Embassy + Visa No form fields; Long Stay **read-only** when `LONG_STAY`; History from existing timestamps |

**Sticky footer:** Cancel + **Save MOFA No** (`ErpDrawerFooterActions`) — same `visa-transition` + `completeMofa` contract as before.

Pipeline transitions use drawer fields (visa number / embassy ref / reject reason) instead of `window.prompt` where possible. Passport custody still uses a confirm dialog (not delete redesign). Batch queue view unchanged in purpose.

---

## 7. Pipeline display

Horizontal `ErpStatusChip` strip along  
`NEW → MOFA → EMBASSY → BIOMETRIC → SUBMITTED → PROCESSING → ISSUED → PASSPORT_RETURNED → COMPLETED`  
(+ rejected branch chip). **No business-rule changes.**

---

## 8. Empty / delete

- Empty: Bangla title + hint + Refresh primary action  
- Delete: not part of this desk; if needed elsewhere use `ErpDeleteDialog` only  

---

## 9. Responsive

| Breakpoint | Behavior |
|------------|----------|
| Desktop | 6-up summary; full table; 720px drawer |
| Tablet | Summary 3-col; toolbar stacks |
| Mobile | Summary 2-col; search/filter stack; drawer full width |

---

## 10. Tests

```bash
cd apps/web
pnpm run typecheck
pnpm run build
pnpm run test:erp
```

Manual smoke: Ops → Visa Desk → summary click → search/filter → open row → Pipeline transition / Save MOFA → Batch Requests toggle.

---

## 11. Rollback

Revert `apps/web/src/app/pages/OpsDepartments.tsx` and this doc. No migrations.
