# TUBA AL HIJAZ — RC Blocker Resolution

**Date:** 2026-07-31  
**Scope:** Production readiness blockers only (RC-01, RC-02, RC-03)  
**Not in scope:** Sprint 2 features, API/business-logic changes, notifications WS, dual expiry, monitoring stack  

**Prior report:** [`RELEASE_CANDIDATE_REPORT.md`](./RELEASE_CANDIDATE_REPORT.md) (NO-GO)  
**Companion ops:** [`RUNBOOK.md`](../RUNBOOK.md) §3 Backup & restore  

---

## Summary

| ID | Blocker | Result |
|---|---|---|
| **RC-01** | Backup service | **Resolved** — LF + `0755`; systemd SUCCESS; 34 KiB dump; scratch restore OK |
| **RC-02** | Secure cookies | **Resolved** — `COOKIE_SECURE=true` live; login sets `HttpOnly; Secure; SameSite=Lax`; local default remains false |
| **RC-03** | Production deployment prep | **Resolved** — images `rc1-20260731` built & deployed; notes + smoke checklist below |

---

## RC-01 — Repair backup service

### Changes
- Normalized `infra/backup.sh` to **LF** (removed CRLF that caused systemd `203/EXEC`).
- Set mode **`0755`** (executable).
- Confirmed `tuba-backup.timer` **enabled/active**; `tuba-backup.service` oneshot **SUCCESS**.
- Documented backup + restore in `RUNBOOK.md` §3 (scratch verify §3.1, prod restore §3.2).

### Verification (executed 2026-07-30 UTC)

| Check | Result |
|---|---|
| `file infra/backup.sh` | Bourne-Again shell script, UTF-8 text executable (**no CRLF**) |
| `systemctl start tuba-backup.service` | `status=0/SUCCESS` |
| Staging artifact | `/var/backups/tuba/tubaalhijaz-20260730-225037.sql.gz` — **34320 bytes** |
| MinIO upload | `local/tuba-backups/daily/…` (log: transferred 33.52 KiB) |
| Scratch restore | Loaded into `tuba_restore_rc_test`, queried `User`/`Company`, DB dropped |
| Log | `/var/log/tuba-backup.log` → `backup OK: … offsite=disabled` |

### Restore procedure (authoritative)

See **`RUNBOOK.md` §3**:

1. Prefer **§3.1 scratch DB** before any production restore.  
2. Production restore is **§3.2** (stop API → load dump → recreate DB → start API `--no-deps`).  
3. BullMQ `SYS_DAILY_BACKUP` JSON manifests are **not** restorable dumps.

### Manual ops

```bash
systemctl start tuba-backup.service
tail -20 /var/log/tuba-backup.log
ls -lt /var/backups/tuba/
```

---

## RC-02 — Enable Secure cookies

### Changes
- `infra/.env`: `COOKIE_SECURE=true` (prod HTTPS).
- `infra/.env.example`: remains `COOKIE_SECURE=false` with comment that production HTTPS must be `true`.
- **No auth code changes** — `AuthController` already uses  
  `config.get("COOKIE_SECURE", "false") === "true"` (default **false** for local/dev when unset).

### Local development behavior

| Environment | Setting |
|---|---|
| Local / `infra/.env.example` | `COOKIE_SECURE=false` (HTTP cookies work) |
| Code default if unset | `"false"` |
| Production `infra/.env` | `COOKIE_SECURE=true` |

### Verification

- Live API env after recreate: `COOKIE_SECURE=true`.
- Ephemeral smoke user login to `http://127.0.0.1:3210/auth/login` returned **200** with:

  `Set-Cookie: tuba_rt=…; Path=/auth; HttpOnly; Secure; SameSite=Lax`

- Smoke user deleted immediately after the check.
- HTTPS browser `curl` to the public hostname returned Cloudflare **1010** (bot challenge) — not an app failure; Secure flag was proven on the API response attributes above.
- Edge metrics still denied: `https://tubaalhijaz.com/api/metrics` → **404**.

---

## RC-03 — Prepare production deployment

### Version tags

| Item | Value |
|---|---|
| Tag | **`rc1-20260731`** |
| API image | `tuba-alhijaz/tuba-alhijaz-api:rc1-20260731` |
| Web image | `tuba-alhijaz/tuba-alhijaz-web:rc1-20260731` |
| `infra/.env` | `IMAGE_TAG` / `API_IMAGE_TAG` / `WEB_IMAGE_TAG` = `rc1-20260731` |
| `VITE_API_URL` (baked) | `https://tubaalhijaz.com/api` |

### Build commands used

```bash
cd /var/www/TUBAALHIJAZ/infra
docker compose -f docker-compose.prod.yml build api
docker compose -f docker-compose.prod.yml build web
```

### Deploy commands used (one service at a time)

```bash
cd /var/www/TUBAALHIJAZ/infra
docker compose -f docker-compose.prod.yml up -d --no-deps api
# wait healthy
docker compose -f docker-compose.prod.yml up -d --no-deps web
```

### Live status after deploy

| Container | Image | Health |
|---|---|---|
| `tuba-alhijaz-api-1` | `tuba-alhijaz/tuba-alhijaz-api:rc1-20260731` | healthy |
| `tuba-alhijaz-web-1` | `tuba-alhijaz/tuba-alhijaz-web:rc1-20260731` | healthy |
| postgres / redis / minio | unchanged | healthy |

### Rollback (images)

```bash
cd /var/www/TUBAALHIJAZ/infra
# Example prior tags observed on host before RC:
#   api:web-m11   web:web-m17
API_IMAGE_TAG=web-m11 docker compose -f docker-compose.prod.yml up -d --no-deps api
WEB_IMAGE_TAG=web-m17 docker compose -f docker-compose.prod.yml up -d --no-deps web
# Then set matching tags in .env if you want compose defaults aligned.
```

Data rollback: `RUNBOOK.md` §3 (requires a valid `.sql.gz` from RC-01).

---

## Smoke checklist (post-deploy)

| # | Check | Expected | Observed |
|---|---|---|---|
| 1 | `curl -s http://127.0.0.1:3210/health` | `status:ok` | ✅ |
| 2 | `docker inspect` api/web health | healthy | ✅ |
| 3 | Images match `rc1-20260731` | yes | ✅ |
| 4 | `printenv COOKIE_SECURE` in api | `true` | ✅ |
| 5 | Login → `Set-Cookie` includes `Secure` | yes | ✅ (loopback) |
| 6 | `https://tubaalhijaz.com/api/metrics` | 404 | ✅ |
| 7 | `systemctl start tuba-backup.service` | SUCCESS | ✅ |
| 8 | Newest `/var/backups/tuba/*.sql.gz` ≫ 254 B | yes (~34 KiB) | ✅ |
| 9 | Scratch restore of dump | loads without error | ✅ |
| 10 | AGENT/OPS login via browser | session works | Operator to confirm (CF may block non-browser clients) |

---

## Files touched

| Path | Change |
|---|---|
| `infra/backup.sh` | LF normalization + `chmod 0755` |
| `infra/.env` | `COOKIE_SECURE=true`; image tags → `rc1-20260731` |
| `infra/.env.example` | Clarified COOKIE_SECURE local vs prod comment |
| `RUNBOOK.md` | §3 Backup & restore expanded (timer, scratch verify, prod restore) |
| `docs/RC_BLOCKER_RESOLUTION.md` | **This file** |

**Application source / APIs / business logic:** not modified.

---

## Explicitly deferred (not RC blockers for this pass)

- Notifications WebSocket authentication  
- Dual 06:00 fleet expiry dedupe (Sprint 2)  
- Monitoring compose bring-up  
- Sprint 2 Finance/Automation UI unhide  
- SoT doc stale rows / S1-08 phase-doc drift  

---

## Recommendation

RC blockers **RC-01 / RC-02 / RC-03 are closed** on this host. Re-run a focused Release Candidate check (backup + cookies + image tags + smoke) before calling GO; remaining High items from the prior RC report are optional waivers or Sprint 2.

---

*End of RC Blocker Resolution.*
