# TUBA AL HIJAZ — UI-05 Group & Passenger

**Sprint:** UI-05  
**Status:** Complete  
**SSOT:** `docs/ui/UI_DESIGN_SYSTEM.md`, `UI_COMPONENT_GUIDE.md`, `UI_04_*`  
**Scope:** Group + Passenger screens only (no Visa Desk / Long Stay / Finance / Reports)

---

## 1. Objective

Replace legacy Group / Passenger chrome with the Enterprise Component Kit while keeping APIs, RBAC, validation, OCR/CSV intake, and workflows unchanged.

---

## 2. Screens

### Agent Portal — Groups (`AgentPortalGroups.tsx` → `GroupsModule`)

| Flow | Pattern |
|------|---------|
| List | `ErpPageTemplate` → Search → Filter → `ErpDataTable` → `ErpPagination` |
| Create | 4-step wizard: গ্রুপ তথ্য → প্যাকেজ → যাত্রী → নিশ্চিত করুন |
| Detail | Existing tabs; Passengers tab uses kit; delete via `ErpDeleteDialog` |

**Create wizard**

1. **গ্রুপ তথ্য** — name, destination, foundation fields (Nusuk, WhatsApp, consulate, company)  
2. **প্যাকেজ** — visa type, package, dates, capacity, notes  
3. **যাত্রী** — info only (Manual / OCR / CSV after create)  
4. **নিশ্চিত করুন** — review + `POST /groups` then open detail  

No random create modal; passenger add after create uses drawer / existing OCR+CSV modals.

### Agent Portal — Passengers (group detail → Passengers tab)

| Layer | Component |
|-------|-----------|
| Header + primary Add | `ErpPageTemplate` + `ErpButton` |
| Search | `ErpSearchBar` (BN: `নাম, পাসপোর্ট নম্বর অথবা গ্রুপ নম্বর লিখুন`) |
| Filter | `ErpFilterPanel` (visa status) |
| Table | `ErpDataTable` (select, status chips, row actions, sticky header) |
| Pagination | `ErpPagination` |
| Manual add | `ErpDrawer` + `ErpForm` + sticky `ErpDrawerFooterActions` |
| Details | `ErpDrawer` (read-only summary) |
| Delete | `ErpDeleteDialog` only |

OCR (`OcrIntakeModal`) and CSV (`CsvImportModal`) remain specialized overlays — same APIs.

### Ops Control — Group Master (`OpsControl.tsx` → `GroupMaster`)

Staff readiness board on the same kit layout:

- Header / Refresh  
- Search + Filter (ops status)  
- `ErpDataTable` with inline gate toggles (still `PATCH /groups/:id`)  
- Foundation edit → `ErpDrawer` (not centered modal)  
- Pagination  

Staff “Passengers” nav continues to alias Group Master (unchanged routing).

---

## 3. Kit inventory used

`ErpPageTemplate`, `ErpSearchBar`, `ErpFilterPanel`, `ErpDataTable`, `ErpPagination`, `ErpDrawer`, `ErpDrawerFooterActions`, `ErpForm` / `ErpField` / `ErpInput` / `ErpSelect` / `ErpTextarea`, `ErpButton`, `ErpStatusChip`, `ErpDeleteDialog`, `erpToast`

---

## 4. Non-goals (unchanged)

- Database / Prisma  
- REST contracts  
- Backend permissions / tenancy  
- Visa Desk, Long Stay, Finance, Reports  
- Automation, OCR pipeline internals, notification pipeline  

---

## 5. Empty & delete copy

- Empty: Bangla title + hint + primary action (e.g. নতুন তৈরি করুন)  
- Delete: only `ErpDeleteDialog` (no `window.confirm`)  

---

## 6. Responsive

| Breakpoint | Behavior |
|------------|----------|
| Desktop | Full table + drawer |
| Tablet | Toolbar stacks (`flex-col sm:flex-row`); table horizontal scroll |
| Mobile | Same stack; compact row actions; drawer full-height |

---

## 7. Tests

```bash
cd apps/web
pnpm run typecheck
pnpm run build
pnpm run test:erp
```

Manual: Agent Group list → New Group wizard (4 steps) → Passengers tab (search/filter/add drawer/delete dialog); Ops Group Master edit drawer + gate toggle.

---

## 8. Rollback

Revert `apps/web/src/app/pages/AgentPortalGroups.tsx`, `apps/web/src/app/pages/OpsControl.tsx`, and this doc. No migrations.
