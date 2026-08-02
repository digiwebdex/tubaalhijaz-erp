# S2-04 Completion Report — Enable Finance ERP

**Date:** 2026-07-31  
**Status:** Done  
**Gap closed:** G-06

---

## Summary

Staff Finance ERP is reachable at `/finance-erp`. Existing `FinanceERP.tsx` (live `/finance/*` APIs when authenticated; mock only when logged out) was wired into the router. No rewrite, redesign, or accounting-logic changes. Unauthorized roles are blocked by frontend UX (`FINANCIAL_REPORTS`) and by API `@RequirePermissions`.

---

## Audit (pre-change)

| Layer | Finding |
|---|---|
| Page | `apps/web/src/app/pages/FinanceERP.tsx` — full ERP; `useLive` → `/finance/*`; authed never falls through to mock |
| Route | Was `ComingSoon` at `/finance-erp` |
| Nav | `ERPShell` GLOBAL_MODS already includes Finance → `/finance-erp`; filtered by `filterModsByPermission` |
| RBAC (UX) | `rbac.ts` already maps `/finance-erp` → `FINANCIAL_REPORTS` |
| API | `FinanceController` — reads `FINANCIAL_REPORTS`, writes `EDIT_FINANCIAL_RECORDS` |
| DB | Existing finance models (Invoice, Ledger, Wallet, …) — unchanged |
| Seed roles | `SUPER_ADMIN`, `FINANCE_STAFF`, `CEO_VIEWER` hold `FINANCIAL_REPORTS`; `OPS_STAFF` / `AGENT` / `SUPPLIER` do not |

---

## Files changed

| Path | Change |
|---|---|
| `apps/web/src/app/routes.tsx` | `/finance-erp` → `<FinanceERP />` (was ComingSoon) |
| `apps/web/src/app/lib/rbac.selftest.ts` | Role matrix: admin/finance/ops/agent/supplier + mod filter |
| `apps/api/test/finance.e2e-spec.ts` | Dashboard gate: SUPER_ADMIN / FINANCE_STAFF 200; OPS / AGENT / SUPPLIER 403 |
| Docs | `SPRINT_BACKLOG`, `IMPLEMENTATION_ROADMAP`, `FEATURE_STATUS_MATRIX`, `PRODUCT_MASTER_SPEC`, this report |

---

## DB changes

None.

---

## API changes

None (existing `/finance/*` endpoints unchanged).

---

## UI changes

| Item | Detail |
|---|---|
| Route | ComingSoon removed for `/finance-erp` |
| Page | Existing FinanceERP (no component replacement) |
| Nav | Unchanged wiring — Finance mod now lands on live page for permitted users |
| Permissions | `RequireAuth` + `canAccessPath("/finance-erp")` → redirect unauthorized to `homePathForUser()` |

---

## Tests

| Suite | Coverage |
|---|---|
| `rbac.selftest.ts` | SUPER_ADMIN / FINANCE_STAFF allow; OPS_STAFF / AGENT / SUPPLIER deny; finance mod filter |
| `finance.e2e-spec.ts` | Same role matrix on `GET /finance/dashboard` |
| `rbac.e2e-spec.ts` (existing) | Full role × Finance P&L matrix |

---

## Risks

| Risk | Mitigation |
|---|---|
| Controllers misread SampleDataBanner charts as live | Banner already shown for non-connected chart series; statement/ledger paths are live |
| Ops staff bookmark `/finance-erp` | UX redirect + API 403 |
| Agents use staff FinanceERP instead of Agent Finance | Portal home + no `FINANCIAL_REPORTS`; agent finance stays under `/agent-portal` |

---

## Rollback

1. Revert `routes.tsx` to `priv(<ComingSoon />, "/finance-erp")`.  
2. Redeploy web image.  
3. No DB/API rollback required.

---

## Stop

S2-04 only. Automation unhide (S2-05) untouched.
