# TUBA AL HIJAZ — Legacy Component Report

**Sprint:** UI-12 (verification)  
**Date:** 2026-08-02  
**Rule:** Report only — do **not** delete or rewrite automatically.  

SSOT: `UI_04_COMPONENT_STANDARD.md`, `UI_COMPONENT_GUIDE.md`.  
Enterprise Kit path: `apps/web/src/app/components/erp/*`.

---

## 1. Definition of “legacy” (this audit)

| Pattern | Expected replacement |
|---------|----------------------|
| Raw `<button>` primary CTAs / `ActionBtn` | `ErpButton` |
| Raw `<table>` / `TH` helpers | `ErpDataTable` |
| Ad-hoc inputs / `FInput` / `FF` | `ErpForm` / `ErpField` / `ErpInput` / `ErpSelect` |
| Split-panel / custom side sheets | `ErpDrawer` |
| Ad-hoc status pills / `Chip` / `SBadge` | `ErpStatusChip` |
| Page chrome without template | `ErpPageTemplate` + Search / Filter / Pagination |

Marketing pages (Home, Services, About, Contact) use the **marketing surface** (`#F4F1EC`) — not counted as ERP legacy failures.

---

## 2. Kit adoption matrix

| Page / module | Kit | Classification |
|---------------|-----|----------------|
| `AgentPortalGroups.tsx` | Yes | **Kit** |
| `OpsDepartments.tsx` (Visa) | Yes | **Kit** |
| `OpsControl.tsx` Group Master + Long Stay | Yes | **Kit** (other Ops desks may still be custom) |
| `FinanceERP.tsx` dashboard, income, expenses, invoices, receipts, AR, AP, cash | Yes | **Partial** (see §3) |
| `ExecutiveReportsDashboard.tsx` | Yes | **Kit** |
| `AgentPortal.tsx` Dashboard + Profile | Yes | **Partial** |
| `OpsTodayDashboard.tsx` | No erp import | **Custom (UI-03)** |
| `Dashboards.tsx` shell + legacy boards | No erp import | **Partial** (hosts kit + legacy tabs) |
| `AgentPortalFinance.tsx` | No | **Legacy** |
| `AgentPortalServices.tsx` | No | **Legacy** |
| `FleetERP.tsx` | No | **Legacy** |
| `SuperAdmin.tsx` | No | **Legacy** |
| `OCRCenter.tsx` | No | **Legacy** |
| `AutomationNotifications.tsx` | No | **Legacy** |
| `SupplierPortal.tsx` | No | **Legacy** |
| `Login.tsx` / `AuthOnboarding.tsx` | N/A | Auth surfaces (outside desk kit) |
| Marketing Home/Services/About/Contact | N/A | Marketing SSOT |

**Files that import `../components/erp`:** 6 page modules listed in UI_12_CERTIFICATION §3.1.

---

## 3. Legacy findings by file

Counts are approximate (`<table` occurrences / helper density) from static search on 2026-08-02.

### High priority (staff / portal desks still on legacy chrome)

| File | Signals | Notes |
|------|---------|-------|
| `FleetERP.tsx` | Many `<table>` (~7), `ActionBtn`-style helpers | Full module not in UI-05…UI-11 scope |
| `SuperAdmin.tsx` | `<table>` (~4) | Custom admin chrome |
| `SupplierPortal.tsx` | `<table>` (~4), form helpers | Portal not kit-migrated |
| `AgentPortalFinance.tsx` | `<table>` (~5), `FF`/`FInput`/`SBadge` | Payments wallet still custom |
| `AgentPortalServices.tsx` | Heavy `FInput`/`SubmitBtn`/`StatusTracker` | Visa/hotel/transport forms |
| `OCRCenter.tsx` | `<table>` | Advanced Tools |
| `AutomationNotifications.tsx` | `<table>` | Advanced Tools |
| `FinanceERP.tsx` | Residual `<table>` / `ActionBtn` / `TH` / `Amt` on Ledger, Forex, Statements, P&L, BS, MOFA | Primary desks kit; secondary legacy |
| `OpsControl.tsx` | Some `<table>` outside Group/Long Stay | Ziyarah and other desks |
| `OpsDepartments.tsx` | Minor residual helpers | Core desk kit |
| `AgentPortal.tsx` | Documents vault custom rows; unused `KPICard` helpers | Dashboard kit |

### Medium / intentional

| File | Notes |
|------|-------|
| `OpsTodayDashboard.tsx` | UI-03 custom KPI/queue UI — documented alternative to list-desk template |
| `Dashboards.tsx` | Tab host; legacy boards remain for non-executive tabs |
| `DesignSystem.tsx` | Living reference — route currently ComingSoon |

### Marketing (exclude from ERP kit debt)

`Home.tsx`, `Services.tsx`, `About.tsx`, `Contact.tsx`, `Nav.tsx`, `Footer.tsx`, `HeroBackdrop.tsx`.

---

## 4. Duplicate / parallel component dialects

| Dialect | Location | Overlaps kit |
|---------|----------|--------------|
| `ActionBtn` / `TH` / `Amt` / `Chip` | `FinanceERP.tsx` | ErpButton / ErpDataTable / ErpStatusChip |
| `FInput` / `FSelect` / `FF` / `SubmitBtn` | `AgentPortalServices.tsx`, `AgentPortalFinance.tsx` | ErpForm controls |
| `SBadge` / `ExpiryTag` | Agent portal files | ErpStatusChip |
| `KPICard` (unused on dashboard) | `AgentPortal.tsx` | Summary tiles pattern |
| shadcn `components/ui/*` | Present in repo | **Not imported by `app/pages/*`** in this audit (good) |

---

## 5. Layout standard gaps

Pages that do **not** follow Title → Action → Search → Filter → Table → Pagination → Drawer:

- All **Legacy** rows in §2  
- Finance: Ledger, Forex, Statements, P&L, BS, MOFA  
- Ops Today (by design)  
- Login / Onboarding / ComingSoon  

Sticky save bar: present on kit drawers via `ErpDrawerFooterActions` where wired (Groups, Long Stay host save, Finance entry create). Missing on legacy forms.

---

## 6. Language mixed-label debt

| Area | Issue |
|------|-------|
| Kit desks | Generally BN/EN via `useLang` |
| Fleet / Super Admin / OCR / Automation / Supplier | Predominantly English UI strings |
| Agent Finance / Services | English-first labels; Finance module gained BN tabs in UI-10 |
| FIN_NAV / AGENT_NAV English `label` fields | Shell may show EN item labels unless `labelBn` supplied via global nav |

---

## 7. Recommended migration order (future work — not UI-12)

1. Agent Finance + Services  
2. Finance secondary screens  
3. Fleet  
4. Supplier Portal  
5. OCR + Automation + Super Admin polish  
6. Optional: Ops Today light kit header only  

**Do not remove** legacy helpers until each screen is migrated and tested.
