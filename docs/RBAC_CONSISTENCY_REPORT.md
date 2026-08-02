# RBAC Consistency Report — Frontend ↔ Backend

**Date:** 2026-07-31  
**Scope:** Read-only audit of permission keys used by SPA UX gates vs API seed + `@RequirePermissions`.  
**Sources of truth:**
- Backend catalog: `apps/api/prisma/seed.ts` (and matching `seed.prod.ts`) `Permission.key`
- Backend enforcement: `@RequirePermissions("…")` under `apps/api/src/**`
- Frontend catalog / gates: `apps/web/src/app/lib/rbac.ts` (`P`, `PATH_ANY_OF`, `SA_NAV_PERMS`, `DASH_NAV_PERMS`) + `OCRCenter.tsx` (`hasPermission(P.REVIEW_OCR_QUEUE)`)

**Reminder:** Frontend RBAC is UX only. Backend remains the authorization boundary.

---

## 1. Verdict (summary)

| Check | Result |
|---|---|
| Orphan frontend permissions (used in FE, missing in BE seed) | **None** |
| Frontend permission typos (string ≠ seed key) | **None** |
| Duplicate permission names (same key, conflicting aliases) | **None** |
| Backend permissions never used by frontend gates | **2** (`EDIT_FINANCIAL_RECORDS`, `API_KEY_ACCESS`) — see §4 |
| Backend permissions seeded but unwired on controllers | **2** (`ACCESS_AUDIT_LOGS`, `API_KEY_ACCESS`) — see §5 |
| Declared in FE `P` but unused in any FE gate | **2** (`EDIT_FINANCIAL_RECORDS`, `API_KEY_ACCESS`) |

Every frontend gate string that participates in hide/redirect logic matches an existing seeded backend permission key exactly.

---

## 2. Backend permission catalog (seed)

Canonical keys from `seed.ts` / `seed.prod.ts` (11):

| # | Key |
|---|---|
| 1 | `VIEW_DASHBOARD` |
| 2 | `MANAGE_USERS` |
| 3 | `APPROVE_COMPANIES` |
| 4 | `FINANCIAL_REPORTS` |
| 5 | `EDIT_FINANCIAL_RECORDS` |
| 6 | `CONFIGURE_WORKFLOWS` |
| 7 | `REVIEW_OCR_QUEUE` |
| 8 | `ACCESS_AUDIT_LOGS` |
| 9 | `MANAGE_SYSTEM_SETTINGS` |
| 10 | `API_KEY_ACCESS` |
| 11 | `MANAGE_FLEET` |

No duplicate keys in the seed list.

---

## 3. Frontend permission catalog (`P` in `rbac.ts`)

| FE `P.*` member | String value | In BE seed? |
|---|---|---|
| `VIEW_DASHBOARD` | `VIEW_DASHBOARD` | ✅ |
| `MANAGE_USERS` | `MANAGE_USERS` | ✅ |
| `APPROVE_COMPANIES` | `APPROVE_COMPANIES` | ✅ |
| `FINANCIAL_REPORTS` | `FINANCIAL_REPORTS` | ✅ |
| `EDIT_FINANCIAL_RECORDS` | `EDIT_FINANCIAL_RECORDS` | ✅ |
| `CONFIGURE_WORKFLOWS` | `CONFIGURE_WORKFLOWS` | ✅ |
| `REVIEW_OCR_QUEUE` | `REVIEW_OCR_QUEUE` | ✅ |
| `ACCESS_AUDIT_LOGS` | `ACCESS_AUDIT_LOGS` | ✅ |
| `MANAGE_SYSTEM_SETTINGS` | `MANAGE_SYSTEM_SETTINGS` | ✅ |
| `API_KEY_ACCESS` | `API_KEY_ACCESS` | ✅ |
| `MANAGE_FLEET` | `MANAGE_FLEET` | ✅ |

- **Orphans:** none (every FE key ⊆ BE seed).  
- **Typos:** none (exact match).  
- **Duplicates:** none (`P` keys and values are 1:1 unique).

No raw permission string literals elsewhere in `apps/web/src` (gates go through `P.*`).

---

## 4. Frontend gate usage matrix

| Permission | Path / nav / action (UX) | Used in FE gate? |
|---|---|---|
| `VIEW_DASHBOARD` | `/dashboards`, `/ops-control`, `/ops-departments`, `/workflow-map`; most `DASH_NAV_*` | ✅ |
| `MANAGE_USERS` | `/super-admin` (any-of); SA nav `dashboard`, `users` | ✅ |
| `APPROVE_COMPANIES` | `/super-admin` (any-of); SA nav `dashboard`, `companies` | ✅ |
| `FINANCIAL_REPORTS` | `/finance-erp`; `DASH_NAV.finance` | ✅ |
| `EDIT_FINANCIAL_RECORDS` | — (only appears in `rbac.selftest` fixture) | ❌ **declared, unused in gates** |
| `CONFIGURE_WORKFLOWS` | `/automation`; `/super-admin` (any-of); SA `workflows`, `automation` | ✅ |
| `REVIEW_OCR_QUEUE` | `/ocr-center`; SA `ocr`; OCR approve/reject/override UI | ✅ |
| `ACCESS_AUDIT_LOGS` | `/super-admin` (any-of); SA nav `audit` | ✅ |
| `MANAGE_SYSTEM_SETTINGS` | `/super-admin` (any-of); SA `dashboard`, `ai-engine`, `notifications`, `settings` | ✅ |
| `API_KEY_ACCESS` | — | ❌ **declared, unused in gates** |
| `MANAGE_FLEET` | `/fleet-erp` | ✅ |

### Backend permissions never used by frontend (for UX gating)

| Key | Notes |
|---|---|
| `EDIT_FINANCIAL_RECORDS` | Heavily used on API write paths; **no** FE hide/disable for “Mark Paid” / slip confirm yet (FinanceERP still ComingSoon / unwired). Present in `P` for future S2. |
| `API_KEY_ACCESS` | Seeded; no API routes and no FE UI. Listed in `P` but unused. |

### Non-permission FE gates (not RBAC keys — intentional)

| Gate | Mechanism | Notes |
|---|---|---|
| `/agent-portal` | `company.type === "AGENT"` | Tenancy UX from session; agents have `permissions: []` |
| `/supplier-portal` | `company.type === "SUPPLIER"` | Same |

These are **not** orphan permissions; they are company-type checks, not `Permission.key` values.

---

## 5. Backend `@RequirePermissions` usage vs seed

| Seed key | Used on controllers? | Controllers / areas |
|---|---|---|
| `VIEW_DASHBOARD` | ✅ | `ops.controller`, `dashboards.controller`; Ops WS handshake |
| `MANAGE_USERS` | ✅ | `users.controller` |
| `APPROVE_COMPANIES` | ✅ | `companies.controller` |
| `FINANCIAL_REPORTS` | ✅ | `finance.controller` (reads/reports) |
| `EDIT_FINANCIAL_RECORDS` | ✅ | `finance.controller`, `agent-finance.controller` (mutations) |
| `CONFIGURE_WORKFLOWS` | ✅ | `automation.controller` |
| `REVIEW_OCR_QUEUE` | ✅ | `ocr.controller` (list/override/approve/reject) |
| `ACCESS_AUDIT_LOGS` | ❌ | Seeded; **no** audit-log read API yet (G-03) |
| `MANAGE_SYSTEM_SETTINGS` | ✅ | `notifications.controller` (admin events/templates/test) |
| `API_KEY_ACCESS` | ❌ | Seeded; no API-key module |
| `MANAGE_FLEET` | ✅ | `fleet.controller` |

---

## 6. Cross-layer gaps (FE vs BE enforcement)

| Permission | FE UX | BE enforce | Gap |
|---|---|---|---|
| `ACCESS_AUDIT_LOGS` | Hides SA “Audit Logs” | No audit read routes | FE ahead of API (stub screen OK) |
| `EDIT_FINANCIAL_RECORDS` | Not gated in UI | Enforced on finance writes | FE lag — add disable/hide when Finance UI unhides (S2) |
| `API_KEY_ACCESS` | Unused | Unused | Dead seed key until product exists |
| `MANAGE_SYSTEM_SETTINGS` | SA settings/notifications/ai stubs | Live on notification admin APIs | Partial — UI stubs vs live APIs |
| `REVIEW_OCR_QUEUE` | Route + action hide | Review routes gated | ✅ Aligned (submit/poll remain JWT) |
| `VIEW_DASHBOARD` | Ops/dashboards paths | Ops REST + dashboards + WS | ✅ Aligned |

---

## 7. Duplicate / reuse notes

- **No duplicate permission names** (no two keys mapping to the same concept with different spellings).
- **Intentional reuse:** `VIEW_DASHBOARD` gates many ops/dashboard surfaces; `MANAGE_SYSTEM_SETTINGS` gates several SA stubs — same key, multiple UI entry points (not a consistency defect).
- **Self-test only:** `EDIT_FINANCIAL_RECORDS` in finance fixture inside `rbac.selftest.ts` does not constitute a production FE gate.

---

## 8. Recommendations (documentation only — not implemented)

1. When Finance ERP unhides (S2-04), gate destructive actions with `EDIT_FINANCIAL_RECORDS` and keep list/views on `FINANCIAL_REPORTS`.  
2. Either wire `ACCESS_AUDIT_LOGS` on a future `GET /audit-logs` (G-03) or keep the SA item as ComingSoon until then.  
3. Keep or remove `API_KEY_ACCESS` from FE `P` when product scope is clear — currently harmless but unused.  
4. Optionally add a CI check that `Object.values(P)` ⊆ seed permission keys (prevent future typos).

---

## 9. Method

1. Listed seed keys from `apps/api/prisma/seed.ts`.  
2. Collected all `@RequirePermissions("…")` strings under `apps/api/src`.  
3. Collected all `P.*` definitions and references under `apps/web/src` (gates + OCR + selftest).  
4. Set-diffed FE↔BE for orphans, unused, typos, duplicates.

**No application code was modified for this report.**
