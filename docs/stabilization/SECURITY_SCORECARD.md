# Security Scorecard — ESP-04

**Date:** 2026-08-02  
**Sprint:** Enterprise Stabilization ESP-04  
**Detail:** [`ESP_04_SECURITY_AUDIT.md`](./ESP_04_SECURITY_AUDIT.md) · [`PERMISSION_MATRIX.md`](./PERMISSION_MATRIX.md)

Scoring: **PASS** = verified OK · **FIXED** = verified issue remediated this sprint · **RESIDUAL** = accepted risk · **N/A** = not applicable to current architecture.

| Area | Score | Notes |
|------|-------|-------|
| Authentication (login / portal) | PASS | argon2; portal↔role; inactive blocked |
| JWT access validation | PASS | passport-jwt; expiry enforced |
| JWT secret hygiene (prod) | FIXED | Boot refuses `dev-secret` when `NODE_ENV=production` |
| Refresh token rotation / reuse | PASS | Family revoke on reuse |
| Refresh cookie flags | PASS | HttpOnly; SameSite=Lax; Secure when `COOKIE_SECURE=true` |
| Refresh cookie Path (`/api` prefix) | FIXED | `REFRESH_COOKIE_PATH=/api/auth` in prod env |
| CSRF | PASS | Bearer API + Lax cookie; no classic cookie session CSRF surface |
| Session / logout | PASS | Cookie clear + DB revoke |
| Global API JWT guard | PASS | `APP_GUARD` + `@Public` |
| RBAC `PermissionsGuard` | PASS | DB-backed; 60s cache (residual lag) |
| Frontend route guards | PASS | UX only (`RequireAuth`) — not SoT |
| Tenant isolation (Agent) | PASS | `prisma.scoped` + e2e |
| Company isolation (Supplier) | PASS | Fail-closed maps |
| Staff cross-tenant (intentional) | PASS | Permission-gated unscoped |
| OCR review permissions | PASS | `REVIEW_OCR_QUEUE` |
| OCR file ownership on submit | FIXED | Cross-tenant `uploadedFileId` → 404 |
| Upload MIME / magic-byte | PASS | PDF/JPEG/PNG/WEBP/SVG/TIFF |
| Upload size limit | PASS | 10 MB |
| Upload confirm IDOR | PASS | Token + ownership (S1-02) |
| File serve SVG XSS | FIXED | SVG forced `attachment` |
| Rate limiting | PASS | Global 200/min; auth/uploads tighter |
| Input validation | PASS | ValidationPipe whitelist / forbid unknown |
| Audit log write | PASS | Sensitive modules write `AuditLog` |
| Audit log read | PASS | `ACCESS_AUDIT_LOGS` |
| Notification permissions | PASS | Admin APIs gated; WS JWT rooms |
| Metrics exposure | PASS | Public edge 404; scrape on docker net |
| HTTPS / cookie Secure assumption | PASS | Prod `COOKIE_SECURE=true` |
| Secrets in repo | PASS | Live secrets gitignored; examples use placeholders |
| ClamAV / MFA / API keys | RESIDUAL | Explicit non-goals |
| Access token in sessionStorage | RESIDUAL | XSS window ≤ JWT TTL |

---

## Headline

| Metric | Value |
|--------|-------|
| Verified findings this sprint | **4** (F1–F4) |
| All remediable findings fixed in code/env | **Yes** |
| Schema / business-rule changes | **None** |
| Invented / speculative vulns reported | **None** |

**Verdict:** Security posture **PASS** after applying ESP-04 verified fixes. Production must **recreate the API container** (and re-login users) for the refresh-cookie Path fix to take effect at the edge.
