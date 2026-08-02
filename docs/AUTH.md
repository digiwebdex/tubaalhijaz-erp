# TUBA AL HIJAZ — Auth & Authorization (Phase 3)

## Endpoints

| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/auth/login` | public | `{email, password, portal?: agent\|supplier\|admin}` → `{accessToken, user}` + httpOnly refresh cookie (`tuba_rt`, Path from `REFRESH_COOKIE_PATH`, default `/auth`; production nginx `/api` prefix → `/api/auth`). Portal tab is enforced against the account's role. |
| POST | `/auth/register/agent` | public | Agent wizard fields (company, CR, owner, banking, 2 guarantors, reference agent). Creates Company(PENDING) + AgentProfile + BankAccount + Wallet + AGENT user. Returns `{companyId, applicationCode AGT-{year}-{serial}, verificationStatus, loginEmail, tempPassword?}`. |
| POST | `/auth/register/supplier` | public | `type: HOTEL\|TRANSPORT\|CATERING` + type-specific fields. Code `SUP-{HTL\|TRN\|CAT}-{serial}`. |
| POST | `/auth/refresh` | public (cookie) | Rotates the refresh token. Reuse of a rotated token revokes the user's whole token family (theft detection). |
| POST | `/auth/logout` | public (cookie) | Revokes the refresh token + clears the cookie. |
| GET | `/auth/me` | JWT | User + role + permissions + company (incl. live `verificationStatus` — the UI badge source). |
| GET | `/groups`, `/groups/:id` | JWT | Tenant-scoped automatically (see below). |
| GET | `/companies` | `APPROVE_COMPANIES` | Admin console list. |
| GET | `/companies/:id` | JWT | Staff any; tenants only their own. |
| PATCH | `/companies/:id/verification` | `APPROVE_COMPANIES` | State machine: `PENDING → UNDER_REVIEW \| REJECTED`, `UNDER_REVIEW → VERIFIED \| REJECTED`, `REJECTED → UNDER_REVIEW`, `VERIFIED ⇄ SUSPENDED`. REJECTED requires `reason`. Writes AuditLog. |

## Tokens

- **Access**: JWT (HS256, `JWT_EXPIRES_IN`=15m), payload `{sub, email, role, companyId, companyType}`, sent as `Authorization: Bearer`.
- **Refresh**: 96-char random secret, stored **sha256-hashed** in `RefreshToken` (expiry `JWT_REFRESH_EXPIRES_DAYS`=14d), delivered as httpOnly `SameSite=Lax` cookie scoped to `/auth`. Rotation-on-use with reuse detection.
- **Passwords**: argon2id (`argon2` package). Seed password for all demo users: `Demo@123`.
- Registration wizards have no password step (UI is frozen) → the API generates a temporary password and returns it **once** in the response; the success screen shows it. Replace with e-mail delivery when the notification engine lands.

## Roles & permissions (dynamic, DB-driven)

Roles: `SUPER_ADMIN, OPS_STAFF, FINANCE_STAFF, FLEET_STAFF, CEO_VIEWER, AGENT, SUPPLIER` (+ `DRIVER` for the driver app).
Permissions are **rows** (`Permission`, `RolePermission`) checked by a global `PermissionsGuard`
with a 60s cache — Super Admin's User & Role Management screen can re-assign without a deploy.
Endpoints declare `@RequirePermissions("KEY")`; nothing is hardcoded to role names except the
portal-tab sanity check at login.

### OCR permission model (`REVIEW_OCR_QUEUE`)

Seed holders: `SUPER_ADMIN`, `OPS_STAFF`. Agents must remain able to submit/poll their own jobs.

| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/ocr/documents` | JWT (any authenticated user) | Submit / enqueue OCR — **not** review-gated |
| GET | `/ocr/documents/:id` | JWT + tenancy | Poll status/result for own tenant — **not** review-gated |
| GET | `/ocr/documents` | `REVIEW_OCR_QUEUE` | Staff review queue list |
| POST | `/ocr/documents/:id/override` | `REVIEW_OCR_QUEUE` | Correct extracted fields; writes AuditLog |
| POST | `/ocr/documents/:id/approve` | `REVIEW_OCR_QUEUE` | Approve (+ passport → passenger); writes AuditLog |
| POST | `/ocr/documents/:id/reject` | `REVIEW_OCR_QUEUE` | Reject; writes AuditLog |

E2E: `apps/api/test/ocr-rbac.e2e-spec.ts` + OCR row in `rbac.e2e-spec.ts`.

## Multi-tenant guard (global, not per-endpoint)

1. Raw middleware opens an `AsyncLocalStorage` store per request (`setup-app.ts`).
2. The global `JwtAuthGuard` validates the JWT and writes `{userId, roleKey, companyId, companyType}` into the store.
3. `PrismaService.scoped` is a client **extension** that reads the store on EVERY query:
   - `companyId` set (AGENT/SUPPLIER user) → injects `tenantId`/`companyId`/`supplierId` filters per model map, post-checks unique lookups (mismatch ⇒ 404/null), and force-stamps ownership on creates.
   - `companyId` null (platform staff) or no auth (public/system) → passthrough.
4. Services simply use `prisma.scoped.*` — impossible to "forget" tenancy on an endpoint.
   The raw `prisma.*` client stays available for auth/admin/system flows.

## Tests

`pnpm --filter @tuba/api test:e2e` — 20 integration tests (supertest against the seeded dev DB):
login success/failure/portal-mismatch, `/auth/me`, refresh rotation + reuse detection,
**tenant isolation** (Agent A's list scoped; Agent B gets 404 on A's group id; staff see all),
registration (agent + supplier), role-gated 403s, the full verification state machine
(including illegal-transition 400 and reject-reason requirement), and the live `/auth/me` badge.

## Frontend

`apps/web/src/app/lib/api.ts` — fetch client; access token in memory+sessionStorage, refresh via
cookie with single-flight auto-retry on 401.

### Permission-aware navigation (S1-05 — UX only)

- Helpers: `apps/web/src/app/lib/rbac.ts` (`hasPermission`, `canAccessPath`, `homePathForUser`, nav filters).
- Uses session `permissions[]` from login/`/auth/me`. Portals use `company.type` (AGENT/SUPPLIER).
- **Not a security boundary** — backend `@RequirePermissions` / tenancy remain authoritative.
- ERPShell module switcher, `RequireAuth path=…`, SuperAdmin/Dashboards sidebars, OCR approve/reject actions.
- Self-test: `pnpm --filter @tuba/web test:rbac`.

Wired screens (zero visual changes):
- **Login.tsx** — real `/auth/login` per portal tab; failures toast; also fixes the latent
  `setError`-undefined crash from the Figma export.
- **AuthOnboarding.tsx** — §01 login (real API + bilingual error box), §02 agent wizard
  (controlled fields, OCR-prefill preserved, real submit → real application code + temp
  password), §04 supplier wizard (same), §03 verification tracker (when a company user is
  signed in it shows their REAL live status/code/reason from `/auth/me`; demo chips still work).

---

# Phase 4 additions — Registration → Verification → Approval pipeline

| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/uploads?kind=<UploadKind>` | public (wizard pre-auth) | Multipart field `file`; 10 MB; PDF/JPG/PNG/WEBP/SVG/TIFF. Returns `{documentId, storageKey, bucket, …}`. Optional Bearer JWT is validated and stamps `uploadedById`/`companyId`. |
| POST | `/uploads/presign` | public (+ optional JWT) | Returns `{documentId, uploadUrl, confirmToken, confirmExpiresAt, …}`. Direct browser→MinIO PUT; finalize via confirm. |
| POST | `/uploads/:id/confirm` | public + **confirmToken** (S1-02) | Finalizes PENDING presign. Requires `confirmToken` from presign; owned rows also require matching JWT tenant/user; orphans (wizard) token-only. Cross-tenant / bad token → **404**. Audits OK/DENIED. TTL 10 min; max 10 MB. |
| GET | `/uploads/:id/file` | JWT | Streams the object; tenants only their own company's files, staff any. |
| PATCH | `/companies/:id` | `APPROVE_COMPANIES` | Company Management edit (name/nameBn/city/email/phone) + audit log. |
| GET | `/users` · POST `/users` · PATCH `/users/:id` | `MANAGE_USERS` | User management; create returns one-time `tempPassword`; self-deactivation blocked. |
| GET | `/audit-logs` | `ACCESS_AUDIT_LOGS` | Read-only platform audit trail (S2-01). Query: `from`/`to`, `user`/`actorUserId`, `action`, `module`, `entity`/`entityType`, `entityId`, `page`/`pageSize`, `sort`. Tenant JWTs rejected. Severity not stored. |
| GET | `/roles` · GET `/permissions` · PATCH `/roles/:key/permissions` | `MANAGE_USERS` | Live RBAC matrix; SUPER_ADMIN locked (lock-out protection); changes apply ≤60s (guard cache). |

**Document linking**: registration DTOs accept `tradeLicenseFileId, ownerIdFileId, officePhotoFileIds[], logoFileId, chequeFileId, depositFileId` (agent) / `tradeLicenseFileId, certificationFileId` (supplier) — unclaimed uploads get `companyId` stamped inside the registration transaction.

**Approval side-effects** (on VERIFIED/REJECTED): `AutomationRunLog` under rule `AGENT_REGISTRATION_APPROVAL` (falls back to seeded R01; auto-created if missing) + `NotificationLog` record for `AGENT_APPROVED`/`AGENT_REJECTED` with `status: PENDING` — real channel dispatch lands with the Notification Engine phase.

**UI wiring** (no visual changes): AuthOnboarding dropzones now open a real file picker and upload (`api.uploadFile`), keeping the empty→uploading→done visuals; SuperAdmin **Company Management** lists real companies with a review modal (full profile, guarantors, bank, documents w/ inline View, Approve/Reject with required reason, suspend/reactivate); **User & Role Management** lists real users (Add User modal w/ temp password, deactivate) and the permission matrix toggles persist via PATCH. All admin screens fall back to the prototype mock data when not signed in.

**Dev ports**: API binds `127.0.0.1:3210` explicitly — 3000/3010 are shadowed by other dev servers/IDE port-forwards on this machine (see memory).

---

# Phase 6 additions — Service request → fulfillment workflows

**State machine** (all five services share it): `REQUESTED → ASSIGNED (sent to supplier) → CONFIRMED (accepted) → VOUCHER_ISSUED → COMPLETED`, plus `REJECTED (reason required, re-assignable)` and `CANCELLED`. Role rules: agents create + cancel; suppliers accept/reject via `/supplier/*`; staff drive any legal transition (`PATCH /services/:service/:id/status`).

| Method | Path | Notes |
|---|---|---|
| GET | `/hotels` | Hotel catalogue for the request screen. |
| POST | `/services/{visa\|hotel\|transport\|catering\|additional}` | Agent create — DTOs mirror AgentPortalServices.tsx fields exactly. Hotel/transport/catering auto-route to a VERIFIED supplier of the matching type (hotel prefers the property's own supplier) → status ASSIGNED. Hotel computes nights + VAT-inclusive totals; catering prices the plan (35/85/140/200 SAR × pax × days). |
| GET | `/services/:service?groupId&status` · GET `/services/summary?groupId` | Lists with `voucher` join — powers the portal status trackers. |
| PATCH | `/services/:service/:id/status` | Staff transitions (agents: CANCELLED only); illegal jumps 400; REJECTED requires reason. |
| GET | `/vouchers?groupId` | Agent voucher list (tenant-scoped). |
| GET | `/supplier/bookings?status` | Unified hotel+transport+catering incoming list, normalized rows; supplier-scoped automatically. |
| POST | `/supplier/bookings/:service/:id/accept` | ASSIGNED→CONFIRMED, then the **Voucher Generator** runs: ensures a BRN (`BRN-{yr}-{serial}`, FULFILLED on issue), renders a branded A4 PDF via **pdf-lib** (`VCH-{yr}-{groupSerial}-{HOT\|TRA\|CAT}`), stores it through the Phase-4 storage interface, links `Voucher.fileId` + group, notifies the agent (PENDING record) → booking VOUCHER_ISSUED. |
| POST | `/supplier/bookings/:service/:id/reject` | `{reason}` mandatory → REJECTED + agent notification; ops can re-assign. |
| POST | `/supplier/bookings/:service/:id/upload?type=voucher\|invoice` | Multipart + typed meta fields (invoice: VAT 15% computed into meta). |
| GET | `/supplier/uploads?kind=VOUCHER\|INVOICE` | Supplier document shelves. |

**Tests**: `services-workflow.e2e-spec.ts` — full round trips for hotel (incl. cross-supplier isolation + PDF download), transport, catering (reject→re-assign→accept), visa + additional ops pipelines, supplier invoice upload. Suite total: 44 tests.

**UI**: AgentPortalServices.tsx (6 screens) + SupplierPortal.tsx wired to these endpoints with mock fallback for anonymous viewing; voucher Download PDF streams the real generated file. pdf-lib caveat: standard fonts are WinAnsi-only — text is sanitized (→ becomes ->).
