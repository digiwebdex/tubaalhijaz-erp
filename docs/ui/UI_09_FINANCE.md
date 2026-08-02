# TUBA AL HIJAZ — UI-09 Finance ERP

**Sprint:** UI-09  
**Status:** Complete  
**SSOT:** `docs/ui/UI_DESIGN_SYSTEM.md`, `UI_04_COMPONENT_STANDARD.md`, `UI_08_REPORTS.md`  
**Code:** `apps/web/src/app/pages/FinanceERP.tsx`  
**Scope:** Finance ERP UI only (no Website / Mobile / Reports redesign)

---

## 1. Objective

Redesign Finance ERP desks onto the Enterprise Component Kit while keeping:

- Existing finance APIs (`/finance/dashboard`, `/finance/entries`, `/finance/invoices`, `/finance/receipts`, `/finance/ar`, `/finance/ap`, `/finance/cash`, …)
- Accounting / ledger / voucher / invoice / payment logic unchanged
- RBAC (`FINANCIAL_REPORTS` path gate — UX only; API remains authority)
- No new KPI calculations

---

## 2. Layout (transactional desks)

```
Header
↓
Finance Summary (dashboard / AR-AP buckets / cash accounts)
↓
Quick Actions (dashboard only — navigate to existing screens)
↓
Search
↓
Filter
↓
ErpDataTable
↓
ErpPagination
↓
ErpDrawer
```

Screens on the kit pattern:

| Screen | Summary | Quick actions | Table + drawer |
|--------|---------|---------------|----------------|
| Dashboard | Existing `DashData` KPIs | Receipt / Payment / Invoice / Voucher → nav | Recent income entries |
| Income / Expenses | Totals from loaded entries | Add Entry | Create + detail drawers |
| Invoices | — | Refresh | Detail drawer (FinDoc + Mark Paid / PDF) |
| Receipts | — | Refresh | Detail drawer (FinDoc) |
| AR / AP | Aging bucket tiles | — | Entity drawer |
| Cash & Bank | Account tiles | — | Transaction drawer |

Ledger, Forex, Statements, P&L, BS, MOFA remain functional with prior chrome (no API/logic change).

---

## 3. Summary widgets (existing KPIs only)

From `GET /finance/dashboard` (`DashData`):

| Widget | Field |
|--------|-------|
| Cash Position | `cashPosition` |
| Revenue (YTD) | `totalRevenue` |
| Accounts Receivable | `accountsReceivable` |
| Accounts Payable | `accountsPayable` |
| Outstanding Due (90+) | `arAging.d90` |
| YTD Net Profit | `ytdNetProfit` |

**Not invented:** “Today’s Collection” / “Today’s Payment” are **not** on the dashboard API — UI shows YTD revenue and existing KPIs instead (see dashboard note copy).

---

## 4. Quick actions

Navigate only (no new create endpoints):

| Action | Target screen |
|--------|---------------|
| New Receipt | `receipts` |
| New Payment | `expenses` |
| New Invoice | `invoices` |
| Voucher | `income` |

Income/Expense **Add Entry** continues to use existing `POST /finance/entries`.

---

## 5. Shared components

| Component | Usage |
|-----------|--------|
| `ErpPageTemplate` | Page chrome |
| `ErpSearchBar` | Client-side search |
| `ErpFilterPanel` | Status / aging / credit-debit filters |
| `ErpDataTable` | Lists |
| `ErpPagination` | Page size 20 |
| `ErpDrawer` + `ErpForm` | Create/detail |
| `ErpButton` / `ErpStatusChip` | Actions / status |
| `erpToast` | Entry save / invoice pay / PDF errors |

**Delete:** No finance delete mutation is wired in this module. Future deletes must use `ErpDeleteDialog` only.

---

## 6. APIs reused (no changes)

| Endpoint | Screen |
|----------|--------|
| `GET /finance/dashboard` | Dashboard |
| `GET/POST /finance/entries` | Income / Expenses |
| `GET /finance/invoices` + `PATCH …/pay` | Invoices |
| `GET /finance/receipts` | Receipts |
| `GET /finance/ar` · `/finance/ap` | AR / AP |
| `GET /finance/cash` | Cash & Bank |

---

## 7. Responsive

- Summary / account grids: 2 → 3 → 6 columns
- Toolbar: stacks on mobile (`flex-col sm:flex-row`)
- Tables scroll horizontally inside kit; drawers use kit max width

---

## 8. Permissions

Unchanged: route `/finance-erp` gated by `FINANCIAL_REPORTS` in frontend RBAC. Backend guards remain source of truth.

---

## 9. Out of scope

- Website, Mobile apps  
- Reports / Executive dashboard (UI-08)  
- Database, accounting engine, ledger posting rules  
- New “today” collection/payment aggregations  

---

## 10. Rollback

Revert `apps/web/src/app/pages/FinanceERP.tsx` and remove `docs/ui/UI_09_FINANCE.md`. No migrations or API rollback required.
