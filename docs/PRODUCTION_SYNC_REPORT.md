# Production Sync Report — Stable Deployment Synchronization

**Date (UTC):** 2026-07-31T05:14:44Z  
**Scope:** Deploy current workspace images to production only. No new features.

---

## Versions

| Item | Previous | New |
|------|----------|-----|
| Image tag | `rc1-20260731` | `stable-20260731` |
| API image | `tuba-alhijaz/tuba-alhijaz-api:rc1-20260731` | `tuba-alhijaz/tuba-alhijaz-api:stable-20260731` |
| Web image | `tuba-alhijaz/tuba-alhijaz-web:rc1-20260731` | `tuba-alhijaz/tuba-alhijaz-web:stable-20260731` |
| API image ID | `87bbd1d6b440` | `36fe6ff32d42` |
| Web image ID | `aef9b4355ffc` | `0dac9623bf4f` |

### Commit SHA

This host workspace is **not a git repository** (no `.git`). Provenance uses a content fingerprint written at build time:

| Field | Value |
|-------|-------|
| Content SHA (12) | `b833ee71ea9a` |
| Provenance file | `SOURCE_REVISION` |
| Built at (UTC) | `2026-07-31T05:03:27Z` |

```
tag=stable-20260731
content_sha12=b833ee71ea9a
built_at_utc=2026-07-31T05:03:27Z
previous_tag=rc1-20260731
```

### Deployment configuration

Updated in `infra/.env`:

- `IMAGE_TAG=stable-20260731`
- `API_IMAGE_TAG=stable-20260731`
- `WEB_IMAGE_TAG=stable-20260731`

Backup of prior env: `infra/.env.bak.rc1-20260731.20260731050327`

### Running containers (verified)

| Service | Container | Image | Status |
|---------|-----------|-------|--------|
| API | `tuba-alhijaz-api-1` | `tuba-alhijaz/tuba-alhijaz-api:stable-20260731` | healthy |
| Web | `tuba-alhijaz-web-1` | `tuba-alhijaz/tuba-alhijaz-web:stable-20260731` | healthy |

---

## Smoke results

**Outcome: 23 PASS / 0 FAIL** (ephemeral smoke users removed after tests)

### Required surfaces

| Capability | Result | Evidence |
|------------|--------|----------|
| Finance ERP | PASS | Web bundle contains `/finance-erp`; `GET /finance/invoices` 200 for finance staff |
| Automation Admin | PASS | Web bundle contains `/automation`; `GET /notifications/events` 200 for admin |
| OCR reprocess endpoint | PASS | `POST /ocr/documents/:id/reprocess` live (404 for missing id; route mounted) |
| Audit Log UI | PASS | Web bundle calls `/audit-logs`; `GET /audit-logs?pageSize=5` 200 for admin |
| Notification WebSocket authentication | PASS | Anon handshake rejected; JWT via `auth.token` connects to `/notifications` |
| Documents Vault | PASS | UI label present; `GET /documents` 200 |
| Upload confirmation | PASS | Presign returns `confirmToken`; confirm without token → 400 |
| RBAC behavior | PASS | Agent denied finance / automation / audit / OCR reprocess (403); ops denied audit |

### Detailed checks

```
PASS|api_image=tuba-alhijaz/tuba-alhijaz-api:stable-20260731
PASS|web_image=tuba-alhijaz/tuba-alhijaz-web:stable-20260731
PASS|health
PASS|https_public
PASS|Finance_ERP_UI
PASS|Finance_ERP_API
PASS|Finance_RBAC_agent_denied
PASS|Automation_Admin_UI
PASS|Automation_Admin_API
PASS|Automation_RBAC_agent_denied
PASS|OCR_reprocess_endpoint
PASS|OCR_reprocess_RBAC
PASS|Audit_Log_UI
PASS|Audit_Log_API_admin
PASS|Audit_RBAC_agent_denied
PASS|Audit_RBAC_ops_denied
PASS|Documents_Vault_UI
PASS|Documents_Vault_API
PASS|Upload_presign
PASS|Upload_confirmToken_returned
PASS|Upload_confirm_requires_token:400
PASS|Upload_confirm_bad_token_obscured_404
PASS|Notification_WS_JWT_auth
```

Notes:

- Finance staff role includes `ACCESS_AUDIT_LOGS` by design; audit denial was validated with agent and ops (no audit permission).
- Invalid upload `confirmToken` returns **404** (not found) rather than 403 — capability-obscuring behavior; missing token returns **400**.

---

## Rollback steps

Previous images remain on the host (`:rc1-20260731`).

```bash
cd /var/www/TUBAALHIJAZ/infra

# Option A — restore tagged env backup
cp .env.bak.rc1-20260731.20260731050327 .env

# Option B — set tags manually
# IMAGE_TAG=rc1-20260731
# API_IMAGE_TAG=rc1-20260731
# WEB_IMAGE_TAG=rc1-20260731

docker compose -f docker-compose.prod.yml up -d --no-deps api web

# Verify
docker compose -f docker-compose.prod.yml ps
docker inspect tuba-alhijaz-api-1 --format '{{.Config.Image}}'
docker inspect tuba-alhijaz-web-1 --format '{{.Config.Image}}'
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3210/health
```

Expected after rollback: images tagged `rc1-20260731`, API health `200`.

---

## Stop condition

Stable deployment synchronization is complete. No additional features were implemented in this change.
