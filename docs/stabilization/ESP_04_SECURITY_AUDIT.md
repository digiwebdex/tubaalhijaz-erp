# ESP-04 — Security & Permission Audit

**Sprint:** Enterprise Stabilization ESP-04  
**Date:** 2026-08-02  
**Type:** Audit + verified fixes only  
**Prerequisites:** `docs/releases/*`, `docs/stabilization/*`, `docs/ui/UI_12_CERTIFICATION.md`

Companion docs: [`PERMISSION_MATRIX.md`](./PERMISSION_MATRIX.md), [`SECURITY_SCORECARD.md`](./SECURITY_SCORECARD.md).

---

## STRICT RULES (observed)

- Audit only — no redesign, no features, no business-workflow changes  
- No database schema changes  
- No finance / visa / automation rule changes  
- Do not invent vulnerabilities — only verified findings  
- Backend authorization remains the sole security boundary; frontend RBAC is UX  

---

## 1. Scope

| Area | In scope | Out of scope |
|------|----------|--------------|
| Authentication (login, JWT, refresh, logout, `/auth/me`) | ✅ | MFA, SSO |
| Authorization (`PermissionsGuard`, `@RequirePermissions`) | ✅ | New permission keys |
| Frontend route UX gates (`RequireAuth`, `rbac.ts`) | ✅ | Redesign of nav |
| Multi-tenancy (`prisma.scoped`, ALS, company isolation) | ✅ | Schema redesign |
| Uploads / OCR / documents MIME & size | ✅ | ClamAV |
| Rate limiting (existing Throttler) | ✅ | New quotas |
| Audit logging (writes + read API) | ✅ | New audit product |
| Notifications WS / permission admin APIs | ✅ | Channel redesign |
| Cookies / HTTPS / secrets / env | ✅ | Infra rebuild |

**Roles checked:** Agent, Supplier, Staff (OPS / FINANCE / FLEET / CEO_VIEWER), Super Admin.

---

## 2. Security checks performed

| Check | Evidence | Result |
|-------|----------|--------|
| Global JWT guard | `JwtAuthGuard` APP_GUARD; `@Public()` opt-out | PASS |
| Tenant ALS seeded on auth | `JwtAuthGuard.seedTenant` → `prisma.scoped` | PASS |
| Permission DB lookup | `PermissionsGuard` + 60s cache; seed role matrix | PASS |
| Portal login mismatch | `AuthService.login` portal ↔ role / staff `companyId` | PASS |
| Refresh rotation + reuse revoke | `AuthService.refresh` | PASS |
| Refresh cookie HttpOnly / SameSite / Secure | `AuthController.setRefreshCookie` + `COOKIE_SECURE` | PASS (prod Secure) |
| Refresh cookie Path vs `/api` prefix | Code + `VITE_API_URL=…/api` | **FAIL → fixed** |
| CSRF | Bearer access + SameSite=Lax refresh; no cookie session for API | PASS (N/A pattern) |
| Frontend `RequireAuth` / `canAccessPath` | UX only; documented | PASS (UX) |
| Cross-tenant groups | e2e `rbac.e2e` / `auth.e2e` | PASS |
| Supplier fail-closed on agent models | `SUPPLIER_SCOPE` in `prisma.service` | PASS |
| Agent finance company lock | `AgentFinanceController.companyId()` | PASS |
| Upload MIME + magic-byte | `ALLOWED_MIME` + `validateUpload` | PASS |
| Upload size 10 MB | multer `MAX_BYTES` | PASS |
| Public upload (registration) | Documented; throttled 20/min | PASS (by design) |
| Upload confirm IDOR | confirmToken + ownership (S1-02) | PASS |
| OCR review RBAC | `REVIEW_OCR_QUEUE` on list/mutate | PASS |
| OCR submit file ownership | Previously missing | **FAIL → fixed** |
| SVG inline XSS on serve | `Content-Disposition: inline` for SVG | **FAIL → fixed** |
| Metrics public edge | nginx `deny` `/api/metrics` | PASS |
| Notify WS JWT rooms | `NotificationsGateway` | PASS |
| Rate limit auth | login 10/min, register 5/min | PASS |
| ValidationPipe whitelist | `setupApp` | PASS |
| JWT_SECRET default in production | `dev-secret` fallback | **FAIL → fixed** (boot refuse) |
| Audit read API | `@RequirePermissions("ACCESS_AUDIT_LOGS")` | PASS |

---

## 3. Verified findings

### F1 — Critical: Refresh cookie Path mismatch under nginx `/api` (fixed)

**Evidence:** Production `VITE_API_URL=https://tubaalhijaz.com/api`. Browser calls `/api/auth/refresh`. Cookie was set with `Path=/auth`. Per RFC 6265, `/api/auth/refresh` does **not** path-match `/auth`, so the refresh cookie is not sent on the public SPA origin.

Local/direct API (`:3210/auth/refresh`) still matched — which is why e2e passed.

**Fix:** `REFRESH_COOKIE_PATH` (default `/auth`). Production `infra/.env` → `/api/auth`. `clearCookie` uses the same path.

### F2 — High: OCR create accepted foreign `uploadedFileId` (fixed)

**Evidence:** `OcrService.create` loaded `UploadedFile` by id with **no** ownership check before enqueue. A tenant who obtained another company's file UUID could OCR that object's bytes into their own `OcrDocument` (PII leak). Group binding was already tenant-checked; file binding was not.

**Fix:** If `user.companyId` is set, require `uploadedById === user.sub` **or** `file.companyId === user.companyId`. Deny with 404. Staff unchanged.

### F3 — Medium: SVG served `inline` (fixed)

**Evidence:** `GET /uploads/:id/file` used `Content-Disposition: inline` for all MIME types including `image/svg+xml`, which can execute script if opened in a browser context.

**Fix:** Force `attachment` for SVG only; other types remain `inline`.

### F4 — Medium: Production boot allowed `JWT_SECRET=dev-secret` (fixed)

**Evidence:** `JwtModule` / `JwtStrategy` default to `"dev-secret"` if unset. Misconfigured production would mint forgeable tokens.

**Fix:** `main.ts` refuses start when `NODE_ENV=production` and secret is missing/`dev-secret`. Live `infra/.env` already has a strong secret.

---

## 4. Non-findings / accepted residual risk

| Item | Notes |
|------|-------|
| Public `POST /uploads` | Required for pre-auth registration wizards; size/MIME/throttle + optional JWT stamp |
| `API_KEY_ACCESS` seeded unused | No API-key module yet — dead key, not a hole |
| FE `EDIT_FINANCIAL_RECORDS` unused in UX gates | Backend still enforces on finance mutations |
| Access token in `sessionStorage` | XSS could steal access JWT (15m); refresh remains httpOnly — residual |
| No ClamAV | Magic-byte only — documented non-goal |
| PermissionsGuard 60s cache | Revokes may lag ≤60s — accepted |
| Platform staff unscoped Prisma | By design for cross-tenant ops |

---

## 5. Fixes applied (code)

| File | Change |
|------|--------|
| `apps/api/src/auth/auth.controller.ts` | `REFRESH_COOKIE_PATH` for set/clear cookie |
| `apps/api/src/ocr/ocr.service.ts` | Tenant file ownership on OCR create |
| `apps/api/src/uploads/uploads.controller.ts` | SVG → `attachment` |
| `apps/api/src/main.ts` | Refuse weak JWT secret in production |
| `infra/.env` / `.env.example` / staging example / `apps/api/.env.example` | Document + set cookie path |
| `apps/api/test/auth.e2e-spec.ts` | Assert cookie Path |
| `apps/api/test/ocr-intake.e2e-spec.ts` | Cross-tenant file OCR → 404 |
| `docs/AUTH.md`, `docs/PRODUCT_MASTER_SPEC.md` | Reflect cookie path + OCR ownership |

**Not changed:** Prisma schema, finance/visa/automation rules, business workflows, frontend features.

---

## 6. Remaining risks

1. **Deploy required** for F1: recreate API container so `REFRESH_COOKIE_PATH=/api/auth` is loaded; users must re-login (old Path cookies orphaned).  
2. Access JWT in `sessionStorage` remains XSS-sensitive (mitigate with CSP / no unsafe HTML — residual).  
3. Public upload abuse → storage cost (rate-limited, not eliminated).  
4. No malware AV beyond magic-byte sniff.

---

## 7. Tests

| Suite | Command | Intent |
|-------|---------|--------|
| Auth + tenancy e2e | `pnpm --filter api test:e2e -- auth.e2e-spec` | Login, refresh Path, isolation |
| RBAC matrix e2e | `… rbac.e2e-spec` | Role × module 200/403 |
| OCR RBAC e2e | `… ocr-rbac.e2e-spec` | Review gate |
| OCR intake e2e | `… ocr-intake.e2e-spec` | File ownership + group isolation |
| Web RBAC selftest | `pnpm --filter web test:rbac` | UX path matrix |

---

## 8. Rollback

1. Revert the listed source files.  
2. Remove `REFRESH_COOKIE_PATH` from env (defaults to `/auth`).  
3. Recreate API container.  
4. Force re-login if cookie Path changed.

---

## Final report (required)

1. **Scope** — §1  
2. **Security checks** — §2  
3. **Verified findings** — §3 (F1–F4)  
4. **Permission matrix** — [`PERMISSION_MATRIX.md`](./PERMISSION_MATRIX.md)  
5. **Fixes applied** — §5  
6. **Remaining risks** — §6  
7. **Tests** — §7  
8. **Rollback** — §8  
