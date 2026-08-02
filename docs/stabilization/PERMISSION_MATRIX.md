# Permission Matrix — ESP-04

**Date:** 2026-08-02  
**Sources:** `apps/api/prisma/seed.ts` (+ `seed.prod.ts`), `@RequirePermissions` under `apps/api/src`, `apps/web/src/app/lib/rbac.ts`  
**Authority:** Backend DB permissions + tenancy. Frontend gates are UX only.

---

## 1. Permission catalog (seed)

| Key | Super Admin | OPS | Finance | Fleet | CEO Viewer | Agent | Supplier | Driver |
|-----|:-----------:|:---:|:-------:|:-----:|:----------:|:-----:|:--------:|:------:|
| `VIEW_DASHBOARD` | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — |
| `MANAGE_USERS` | ✅ | — | — | — | — | — | — | — |
| `APPROVE_COMPANIES` | ✅ | ✅ | — | — | — | — | — | — |
| `FINANCIAL_REPORTS` | ✅ | — | ✅ | — | ✅ | — | — | — |
| `EDIT_FINANCIAL_RECORDS` | ✅ | — | ✅ | — | — | — | — | — |
| `CONFIGURE_WORKFLOWS` | ✅ | ✅ | — | — | — | — | — | — |
| `REVIEW_OCR_QUEUE` | ✅ | ✅ | — | — | — | — | — | — |
| `ACCESS_AUDIT_LOGS` | ✅ | — | ✅ | — | ✅ | — | — | — |
| `MANAGE_SYSTEM_SETTINGS` | ✅ | — | — | — | — | — | — | — |
| `API_KEY_ACCESS` | ✅ | — | — | — | — | — | — | — |
| `MANAGE_FLEET` | ✅ | — | — | ✅ | — | — | — | — |

Agent / Supplier / Driver seed with **empty** permission sets. Portal access is by `company.type` + JWT tenancy, not permission rows.

---

## 2. API enforcement map

| Module / route family | Permission (or gate) | Tenancy |
|----------------------|----------------------|---------|
| `GET /dashboards/*`, `GET /ops/*` | `VIEW_DASHBOARD` | Staff unscoped aggregates |
| Ops WebSocket | JWT + `VIEW_DASHBOARD` | Rooms from JWT |
| `GET/PATCH /fleet/*` | `MANAGE_FLEET` | Staff |
| `GET/… /finance/*` (reads) | `FINANCIAL_REPORTS` | Staff |
| Finance mutations (pay, etc.) | `EDIT_FINANCIAL_RECORDS` | Staff |
| `GET/POST /agent-finance/*` (agent) | JWT + `companyType===AGENT` | Forced own `companyId` |
| Agent slip review queue | `EDIT_FINANCIAL_RECORDS` | Staff |
| `/automation/*` | `CONFIGURE_WORKFLOWS` | Staff |
| `/users`, `/roles` | `MANAGE_USERS` | Staff |
| `/companies` admin | `APPROVE_COMPANIES` | Staff |
| OCR list / override / approve / reject / reprocess | `REVIEW_OCR_QUEUE` | Staff (+ scoped where used) |
| OCR `POST /ocr/documents`, `GET :id` | JWT only | `scoped` + **file ownership (ESP-04)** |
| `/audit-logs` | `ACCESS_AUDIT_LOGS` | Platform audit table |
| Notification admin events/templates/test | `MANAGE_SYSTEM_SETTINGS` | Staff |
| Notifications WebSocket | JWT | `user:` / `tenant:` from JWT only |
| `/groups`, passengers, services (agent paths) | JWT | `prisma.scoped` + defence-in-depth |
| Supplier portal APIs | JWT + supplier checks | `SUPPLIER_SCOPE` fail-closed |
| `/auth/*` login/register/refresh/logout | `@Public` + throttle | — |
| `POST /uploads`, presign, confirm | `@Public` + throttle | Confirm token + ownership |
| `GET /uploads/:id/file` | JWT | Company match (staff any) |
| `/metrics` | `@Public` | Edge nginx denies `/api/metrics` |
| `/health` | `@Public` | — |

`API_KEY_ACCESS`: seeded; **no** controller wiring (unused product key).

---

## 3. Frontend UX path matrix (`PATH_ANY_OF` / portals)

| Path | UX gate | Backend SoT |
|------|---------|-------------|
| `/agent-portal` | `company.type === AGENT` | JWT + scoped APIs |
| `/supplier-portal` | `company.type === SUPPLIER` | JWT + supplier APIs |
| `/dashboards`, `/ops-control`, `/ops-departments`, `/workflow-map` | `VIEW_DASHBOARD` | Same |
| `/fleet-erp` | `MANAGE_FLEET` | Same |
| `/ocr-center` | `REVIEW_OCR_QUEUE` | Same |
| `/finance-erp` | `FINANCIAL_REPORTS` | Same (+ `EDIT_*` on writes) |
| `/automation` | `CONFIGURE_WORKFLOWS` | Same |
| `/super-admin` | any of MANAGE_USERS / APPROVE_COMPANIES / MANAGE_SYSTEM_SETTINGS / ACCESS_AUDIT_LOGS / CONFIGURE_WORKFLOWS | Per sub-API |

---

## 4. Multi-tenancy expectations

| Actor | May see |
|-------|---------|
| Agent A | Only company A's groups, passengers, OCR docs, wallet, invoices, uploads stamped to A |
| Agent B | Disjoint from A — cross-id → **404** |
| Supplier | Own bookings/catalog via `supplierId`; agent-owned models fail-closed |
| Platform staff | Cross-tenant (unscoped) where permission allows |
| Unauthenticated | Public auth + registration uploads only |

---

## 5. FE ↔ BE consistency notes (ESP-04)

| Item | Status |
|------|--------|
| All FE `P.*` keys ⊆ seed | ✅ |
| `ACCESS_AUDIT_LOGS` wired on API | ✅ (`audit.controller`) — older `RBAC_CONSISTENCY_REPORT` §5 outdated |
| `EDIT_FINANCIAL_RECORDS` FE gate | ❌ unused in SPA hide/disable (BE still enforces) |
| `API_KEY_ACCESS` | Unused FE + BE |

---

## 6. Method

1. Read seed `ROLES` / `PERMS`.  
2. Grep `@RequirePermissions` / `@Public` / `companyId(` guards.  
3. Cross-check `rbac.ts` path maps.  
4. Confirm e2e matrices in `rbac.e2e-spec.ts`, `ocr-rbac.e2e-spec.ts`, `auth.e2e-spec.ts`.  
