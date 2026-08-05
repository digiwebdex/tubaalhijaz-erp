# PRODUCTION VERIFICATION REPORT — TUBA AL HIJAZ
Date: 2026-08-04 · Host: 200.141.0.22 · Mode: **READ-ONLY** (no modify / no restart / no edit / no destructive command). Method: `docker ps/inspect`, `ss`, `ufw`, `iptables -S`, read-only `psql SELECT`, `redis-cli` read commands, `curl`/`openssl` reads.

## Verdict
**P-01 = STILL OPEN (Critical). P-02 = STILL OPEN (Critical).** Neither can be closed. Minimal remediation prepared below — **NOT executed; awaiting approval.**

> **Material discrepancy (read this first):** the release states "v2.0.1 is LIVE," but production is running the **pre-v2.0.1 build**. Latest applied migration = `20260801170000_longstay_day85`; the v2.0.1 tables (`TransportRate`, `PasswordResetToken`) **do not exist**; running images are `api:esp06-20260802` / `web:prod-audit-20260803b` (not `v2.0.1`). So v2.0.1's billing/rate-cards/unified-confirmation/password-reset are **not in production**. This is not a defect — it's a deployment-state fact you should confirm before any v2.0.1-dependent support work.

## Findings (classified)
| # | Area | Finding | Class |
|---|---|---|---|
| C1 | Redis exposure | `tuba-e2e-redis` published on **0.0.0.0:56379** (IPv4+IPv6), **no password** (`requirepass` empty; `PING`→`PONG` unauthenticated). Publicly reachable. | **CRITICAL** |
| C2 | Test PostgreSQL | `tuba-e2e-pg` published on **0.0.0.0:55432**, running 3 days. Publicly reachable test DB. Not intended for prod. | **CRITICAL** |
| C3 | Firewall | **UFW inactive**; iptables `INPUT` policy `ACCEPT` (no host filtering). Docker nat DNATs 55432/56379 from **any** interface → this is what makes C1/C2 world-reachable. | **CRITICAL** |
| C4 | UAT accounts | **`uat.admin@tubaalhijaz.local` = Super Admin, ACTIVE** in prod (known/published UAT password). Full-privilege backdoor. | **CRITICAL** |
| W1 | UAT accounts | 3 more UAT accounts ACTIVE in prod: `uat.ops` (Operations Staff), `uat.supplier` (Supplier), `uat.agent` (Travel Agent). 6 users total; 4 are UAT. | **Warning** |
| W2 | Redis (prod) | `tuba-alhijaz-redis-1` has **no `requirepass`** — but is **internal-only** (no host-published port; docker network only). Defense-in-depth gap, not an exposure. | **Warning** |
| W3 | SMTP | `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` **empty** → outbound email non-functional (password-reset/notification emails won't send). | **Warning** |
| W4 | Backup — offsite | Nightly dump OK but log shows **`offsite=disabled`** (`OFFSITE_*` unset). Backups exist in one location only. | **Warning** |
| W5 | Backup — restore | **No dedicated/tested restore job** (only `backup.sh`); restore is manual per rollback plan. No restore drill on record. | **Warning** |
| W6 | Memory | **Swap = 0 B** (7.8 GiB RAM, 5.7 GiB available now). No cushion under spike. | **Warning** |
| V1 | Release state | Running images/migrations are pre-v2.0.1 (see discrepancy box). | **Warning** |
| OK1 | Backup — jobs | `tuba-backup.timer` enabled+active (next Wed 02:04). Dumps present + **non-empty & growing** (42K→50K→53K); log "backup OK … 53657 bytes". No empty-gzip regression. | **OK** |
| OK2 | Workers/queues | No `bull:*` keys in prod Redis at inspection → **no failed-job backlog**; queues idle/empty. API healthy. | **OK** |
| OK3 | Monitoring | Prometheus targets **all `health:up`** (api, cadvisor, node, postgres, redis, prometheus). Grafana `database:ok` v13.1.1. All exporters up. | **OK** |
| OK4 | Containers | All prod containers **healthy**: web, api, postgres (2 wk), redis, minio, monitoring stack. `createbuckets` exited 0 (expected one-shot). | **OK** |
| OK5 | Disk | `/` 67% used (64G/96G, **32G free**). Healthy headroom. | **OK** |
| OK6 | CPU | Load 0.26 / 0.11 / 0.04. Idle-healthy. | **OK** |
| OK7 | SSL | Let's Encrypt cert CN `tubaalhijaz.com`, valid **Jul 7 → Oct 5 2026**, verify=0. `certbot.timer` active. | **OK** |
| OK8 | Domain | `https://tubaalhijaz.com` → **HTTP 200**; `/api/health` → **200**. TLS verified. | **OK** |
| OK9 | Cron | root crontab empty; `/etc/cron.d`: certbot, e2scrub, monarx, sysstat; systemd timers healthy incl. `tuba-backup`. | **OK** |

Scope note: `tuba-local-*` containers (pg:5533, redis:6499, minio:9500/9501) and `tuba-local-dev` (3310/5273) are the **isolated audit stack** — all bound **127.0.0.1 only** (loopback DNAT `-d 127.0.0.1/32`), not a public exposure. They are scratch, not prod.

## P-01 / P-02 status
- **P-01 (public no-auth datastores + firewall):** OPEN — C1, C2, C3. **Do not close.**
- **P-02 (UAT super-admin in prod):** OPEN — C4 (+ W1). **Do not close.**

## MINIMAL REMEDIATION PLAN — prepared, NOT executed (awaiting approval)
Each step is minimal, reversible where possible, and read-only-safe to review. **I will run none of these without explicit approval.**

### P-01 — close the public datastore exposure
1. **Remove the throwaway test containers** (they are the actual exposure; safe — they are e2e scratch, not prod data):
   `docker rm -f tuba-e2e-redis tuba-e2e-pg`
2. **⚠ Critical caveat:** enabling UFW alone will **NOT** close ports 55432/56379 — Docker publishes via the nat/DNAT chain and **bypasses UFW's filter rules**. Removing the containers (step 1) is the real fix. For host-level defense-in-depth, filter Docker traffic in the `DOCKER-USER` chain, e.g.:
   `iptables -I DOCKER-USER -i <public-iface> -p tcp -m multiport --dports 55432,56379 -j DROP` (moot once containers are gone).
3. **Enable the host firewall** for host services (SSH first to avoid lockout):
   `ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable`
4. **Verify after:** `docker ps | grep e2e` empty; `ss -ltnp | grep -E '55432|56379'` empty; `ufw status` active.

### P-02 — neutralize UAT accounts in prod (reversible; no delete)
1. **Disable all UAT accounts** (keeps rows; fully reversible):
   `UPDATE "User" SET status='INACTIVE' WHERE lower(email) LIKE 'uat.%';` (4 rows)
2. Priority target is `uat.admin@tubaalhijaz.local` (Super Admin). If any UAT login must be retained temporarily, at minimum **rotate its password** and demote from Super Admin.
3. **Verify after:** the read-only user query shows the 4 UAT rows `INACTIVE`; only `tokiullah55@gmail.com` remains an ACTIVE Super Admin.

### Warnings (lower priority; not go-live blockers — do on approval)
- **W3 SMTP:** set `SMTP_HOST/USER/PASS` in `infra/.env` (config; needs an API restart — separate approval).
- **W4 offsite:** set `OFFSITE_ENDPOINT/KEY/SECRET/BUCKET` in `infra/.env` to enable the B2/S3 copy already coded in `backup.sh`.
- **W5 restore:** add a `restore.sh` + perform one restore drill into a scratch DB (validates the dumps).
- **W2 redis auth:** set `requirepass` on prod redis + update the API `REDIS_URL` (config + restart).
- **W6 swap:** add a swapfile (e.g. 2–4 GiB) for spike protection.

## Recommendation
Because P-01 and P-02 are **both still open (Critical)**, **do not mark them closed.** Approve the P-01 + P-02 minimal remediation (above) first; I will re-run this read-only verification afterward and only then recommend closing them. Awaiting your approval — I will execute nothing until you give it.

---

# RE-VERIFICATION (post-remediation) — 2026-08-04, Release Execution Phase 1+2
Actions executed (approved, documented). Method: read-only verification around two scoped mutations.

## P-01 remediation — CLOSED
- **Evidence-before-removal:** e2e containers had NO compose project label (standalone `docker run`, 2026-07-31); NOT referenced in `docker-compose.prod.yml` or prod `.env`; prod API env points to internal `postgres:5432` / `redis:6379/3` (not e2e); their alias set on the prod network was empty `[]`; no established connections to `:56379`/`:55432`.
- **Action:** `docker rm -f tuba-e2e-redis tuba-e2e-pg` (only these two).
- **After:** no `tuba-e2e-*` containers; ports `56379`/`55432` no longer listening; publicly-bound listeners = `22, 80, 443` only; all prod containers healthy; `api/health`=200.
- **Status: C1, C2 CLOSED.** Residual: **C3/UFW still inactive** (out of Phase-1 scope) → downgraded to Warning `OPS-UFW` (no sensitive port exposed now; enable as defense-in-depth).

## P-02 remediation — CLOSED
- **Before:** 4 `uat.*` ACTIVE (incl. `uat.admin` = Super Admin) + 2 real (tokiullah55 Super Admin, iqshait Agent).
- **Precheck:** `UserStatus` enum = {ACTIVE, INACTIVE, SUSPENDED}; prod auth rejects non-ACTIVE at login (`auth.service.ts:48`) and refresh (line 100).
- **Action:** `UPDATE "User" SET status='INACTIVE' WHERE lower(email) LIKE 'uat.%' AND status='ACTIVE'` → 4 rows (uat.ops, uat.agent, uat.supplier, uat.admin). No deletes.
- **After:** active `uat.*` = 0; active UAT SUPER_ADMIN = 0; active super-admins = 1 (`tokiullah55@gmail.com`, real); reals untouched.
- **Status: C4, W1 CLOSED.** Residual note: an already-issued access token for `uat.admin` works until it expires (~15 min); refresh is blocked.

## Re-verification snapshot
Redis exposure: prod internal-only, no public port ✓ · Test PG: removed ✓ · Firewall: ufw inactive (Warning) · Open public ports: 22/80/443 ✓ · Docker services: all healthy ✓ · Workers/queues: 0 bull keys, no backlog ✓ · Monitoring: 0 targets down, Grafana ok ✓ · SSL: valid → Oct 5 2026 ✓ · Domain: 200 ✓ · Health: api 200 ✓

## GATE RESULT
**P-01 = CLOSED. P-02 = CLOSED.** (Residual Warning OPS-UFW is not a go-live blocker.) Cleared to proceed to Phase 3 pending deployment-mechanism confirmation.
