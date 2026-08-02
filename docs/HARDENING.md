# TUBA AL HIJAZ — Pre-deployment Hardening (Phase 14)

Security/robustness pass before any VPS work. Nothing here changes product behavior.

## 1. Integration tests for critical paths
- **`rbac.e2e-spec.ts` (68)** — the full RBAC matrix: 8 roles × 8 permission-gated modules, asserting
  200 where the role holds the permission and **403 everywhere else**, plus unauthenticated → 401, the
  finance write-gate (only `EDIT_FINANCIAL_RECORDS` may pay an invoice), and **tenant isolation**
  (an agent sees only its own company's groups; a cross-tenant fetch-by-id → 404).
- **`critical-path.e2e-spec.ts` (2)** — invoice→payment settlement (PAID + receipt + GL) and its
  audit trail; idempotent re-pay.
- Existing suites already cover the rest of the golden path: registration→approval
  (`registration-pipeline`), service→accept→voucher (`services-workflow`), completion→invoice
  (`finance`/`services-workflow`). Group-creation + passenger-OCR steps remain stubbed pending the
  Phase-5 module and are noted, not faked.

## 2. Input validation
Global `ValidationPipe` was already `{ whitelist, forbidNonWhitelisted, transform }`. Closed the
three endpoints that still took an inline/`Record` body with no DTO: payment-slip **review**
(`ReviewSlipDto`), invoice **pay** (`PayInvoiceDto`), and supplier **upload** metadata
(`SupplierUploadDto`). The supplier upload path also **now runs the magic-byte content scan** (it
previously bypassed `/uploads`).

## 3. Rate limiting (`@nestjs/throttler`)
Global `ThrottlerGuard` with a lenient 200/min DoS net, **skipped when `NODE_ENV=test`** (e2e hammers
the API from one IP). Tightened per-route: login **10/min**, register **5/min**, refresh 30/min,
every upload endpoint (`/uploads`, `/uploads/presign`, `/uploads/:id/confirm`, `/documents`, supplier upload) **20/min**.

### Upload confirm IDOR (S1-02)
- `POST /uploads/presign` issues a one-time `confirmToken` (sha256 stored in `UploadedFile.meta`); TTL matches presign URL (10 min).
- `POST /uploads/:id/confirm` requires that token. Owned uploads (JWT stamped on presign) also require the same user/company (or staff). Orphan/public wizard rows: token alone.
- Failures (bad/missing token, cross-tenant, unknown id) → **404** (no existence leak) except validation/expiry/size/scan → **400**.
- Every confirm attempt writes `AuditLog` (`module: Uploads`, `action: PROCESS`, `result: OK|DENIED`).
- Optional Bearer on `@Public()` upload routes is validated by `JwtAuthGuard` so ownership can be stamped.
- E2E: `apps/api/test/upload-confirm.e2e-spec.ts`.

### Ops WebSocket auth (S1-03)
- Namespace `/ops` uses Socket.IO middleware: valid access JWT required (`handshake.auth.token` preferred).
- RBAC: `VIEW_DASHBOARD` via existing `PermissionsGuard.roleHasPermission` (same seed matrix as REST `/ops/*`).
- Tenant isolation: JWTs with `companyId` (agents/suppliers) are rejected even if a permission were mis-assigned.
- Rejections logged at warn (`OpsGateway`); client sees `connect_error` / Unauthorized.
- Event names and `ops` room unchanged. Frontend `opsSocket.ts` sends JWT on connect/reconnect.
- E2E: `apps/api/test/ops-ws-auth.e2e-spec.ts` (+ JWT on socket in `ops.e2e-spec.ts`).

### Prometheus `/metrics` edge deny (S1-04)
- Keep `GET /metrics` on the API (prom-client + MetricsInterceptor) for scrapers.
- Host nginx (`infra/nginx/tubaalhijaz.com.conf`) denies `location ^~ /api/metrics` → **404** (not proxied).
- Prometheus scrapes `http://api:3210/metrics` on the docker network (`infra/monitoring/prometheus.yml`).
- API remains loopback-bound (`127.0.0.1:3210`); `/api/health` stays public and unchanged.
- Verify: `curl -sS -o /dev/null -w '%{http_code}\n' https://tubaalhijaz.com/api/metrics` → 404; docker-net scrape → 200.

## 4. Dependency audit
`pnpm audit` went from **17 vulns (8 high)** → **1 low**:
- **xlsx** (SheetJS prototype-pollution + ReDoS) — unused (Excel import is a future phase), **removed**.
  Re-add from the SheetJS CDN when that module is built (npm's xlsx is unmaintained).
- **vite** → 6.4.3 (dev-server file-read advisories; patched within the tested major 6).
- **react-router** → 7.18.1 (4 advisories; patched within v7). Overrides pinned to `^` so a future
  install can't silently jump to vite 8 / react-router 8.

## 5. Request logging + audit trail
- **`LoggingInterceptor`** (global): `METHOD path status durationMs user=…`, warn on 4xx, error on 5xx.
- **AuditLog** on sensitive actions — approvals were already audited (`companies`, supplier accept);
  added **financial transactions** (invoice `markPaid` → `PROCESS`, payment-slip `review` →
  `APPROVE`/`REJECT`, both recording the acting user) and **document deletion**
  (fleet `deleteDocument` → `DELETE`, capturing the removed doc).

## 6. Secrets
- No real `.env` is tracked; `apps/api/.env` + `apps/web/.env` are gitignored (verified).
- The three `*.example` files contain only placeholders (`CHANGE_ME`, empty values) — no real
  secrets. A repo-wide `git grep` for the VPS password / IP / private keys / cloud tokens found
  **nothing** in tracked source. (The only literal is the well-known MinIO local-dev default
  `minioadmin` as a config fallback in `storage.service.ts` — overridden by env in prod.)

> Test totals after this phase: **12 suites** — see the run report. `NODE_ENV=test` disables
> throttling for e2e; run the full suite `--runInBand`.
