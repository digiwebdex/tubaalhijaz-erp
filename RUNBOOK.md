# TUBA AL HIJAZ — On-Call Runbook

The 2am doc. Live host: **`187.77.144.38`**, app dir **`/var/www/TUBAALHIJAZ`**, compose files in
`infra/`. All commands run **from `infra/`**: `cd /var/www/TUBAALHIJAZ/infra`.
Secrets are only in `infra/.env` (0600) — never in this file. Containers: `tuba-alhijaz-{api,web,postgres,redis,minio}-1`,
monitoring: `tuba-{prometheus,grafana,node-exporter,cadvisor,postgres-exporter,redis-exporter}`.

Shorthand: `dc='docker compose -f docker-compose.prod.yml'`

---

## 1. Deploy a release

**Normal path (CI/CD):**
1. Merge/push to **`main`** → GitHub Actions runs **test → build-push** (images to `ghcr.io/<owner>/tuba-alhijaz-{api,web}:<git-sha>`).
2. The **`deploy`** job pauses on the **`production` environment gate** → **click Approve** in the GitHub Actions run.
3. It SSHes in and runs `git pull` + `dc pull` + `dc up -d`. Watch it go green, then verify (§4).

**Manual fallback (CI down) — build on the box (current bootstrap, no registry yet):**
```bash
ssh <you>@187.77.144.38
cd /var/www/TUBAALHIJAZ && git pull --ff-only      # if a git clone; else re-sync source (git archive → extract)
cd infra
IMAGE_TAG=$(git rev-parse --short HEAD) docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps       # all healthy?
```
**Manual fallback — pull prebuilt images (once CI has pushed to GHCR):**
```bash
cd /var/www/TUBAALHIJAZ/infra
export REGISTRY=ghcr.io/<owner> IMAGE_TAG=<git-sha>
docker compose -f docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml up -d
```
The API applies DB migrations automatically on boot (`prisma migrate deploy`). **Migrations are forward-only** — see §2.

---

## 2. Roll back a bad deploy

Every image is tagged with its git SHA. Roll back = point at the previous tag and re-up (no rebuild):
```bash
cd /var/www/TUBAALHIJAZ/infra
docker images | grep tuba-alhijaz-api            # find the previous <sha> tag
sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=<previous-sha>/" .env
docker compose -f docker-compose.prod.yml up -d  # pulls/uses the old image
```
If that image isn't local (and not in GHCR), rebuild from the commit:
```bash
git checkout <previous-sha>
IMAGE_TAG=<previous-sha> docker compose -f docker-compose.prod.yml up -d --build
```
⚠️ **Code rollback is safe; a schema rollback is not.** If the bad release added a DB migration, rolling back the
code does **not** undo the migration. If the new migration broke data, **restore from backup (§3)** instead.

---

## 3. Backup & restore

### 3.0 Nightly backup (systemd)

- Script: `infra/backup.sh` (LF, executable `0755`) — real `pg_dump` → gzip → MinIO `tuba-backups/daily/` (+ `weekly/` on Sundays) → optional `OFFSITE_*`.
- Timer: `tuba-backup.timer` (daily ~02:00). Service: `tuba-backup.service`.
- Logs: `/var/log/tuba-backup.log`. Staging: `/var/backups/tuba/`.
- Manual run: `systemctl start tuba-backup.service` (or `cd infra && ./backup.sh`).
- Do **not** treat BullMQ `SYS_DAILY_BACKUP` JSON manifests as a DB dump — only the systemd/`backup.sh` gzip SQL is restorable.

### 3.1 Verify a dump (scratch DB — preferred before any prod restore)

```bash
FILE=$(ls -t /var/backups/tuba/tubaalhijaz-*.sql.gz | head -1)
PGU=$(grep ^POSTGRES_USER= /var/www/TUBAALHIJAZ/infra/.env | cut -d= -f2-)
docker exec tuba-alhijaz-postgres-1 psql -U "$PGU" -d postgres -c 'DROP DATABASE IF EXISTS tuba_restore_test;'
docker exec tuba-alhijaz-postgres-1 psql -U "$PGU" -d postgres -c 'CREATE DATABASE tuba_restore_test;'
gunzip -c "$FILE" | docker exec -i tuba-alhijaz-postgres-1 psql -U "$PGU" -d tuba_restore_test -v ON_ERROR_STOP=1
docker exec tuba-alhijaz-postgres-1 psql -U "$PGU" -d tuba_restore_test -c 'SELECT count(*) FROM "User";'
docker exec tuba-alhijaz-postgres-1 psql -U "$PGU" -d postgres -c 'DROP DATABASE tuba_restore_test;'
```

### 3.2 Restore into production (destructive)

Backups: nightly gzip in **on-box MinIO** `tuba-backups/daily/` (14d) + `weekly/` (90d), staged in `/var/backups/tuba/`. (Off-VPS only if `OFFSITE_*` is set.)

```bash
cd /var/www/TUBAALHIJAZ/infra
# 0. STOP the api so nothing writes mid-restore
docker compose -f docker-compose.prod.yml stop api

# 1. get a dump — from local staging …
ls -lt /var/backups/tuba/                     # newest tubaalhijaz-YYYYMMDD-HHMMSS.sql.gz
#    … or from MinIO (creds read from .env):
MU=$(grep ^MINIO_ROOT_USER= .env|cut -d= -f2-); MP=$(grep ^MINIO_ROOT_PASSWORD= .env|cut -d= -f2-)
docker run --rm --network tuba-alhijaz_tuba -e MC_HOST_local="http://$MU:$MP@minio:9000" \
  -v /var/backups/tuba:/b minio/mc cp "local/tuba-backups/daily/<FILE>.sql.gz" /b/

# 2. recreate the DB and load the plain-SQL dump
PGDB=$(grep ^POSTGRES_DB= .env|cut -d= -f2-); PGU=$(grep ^POSTGRES_USER= .env|cut -d= -f2-)
docker exec tuba-alhijaz-postgres-1 psql -U "$PGU" -d postgres -c "DROP DATABASE \"$PGDB\";"     # DANGER
docker exec tuba-alhijaz-postgres-1 psql -U "$PGU" -d postgres -c "CREATE DATABASE \"$PGDB\";"
gunzip -c /var/backups/tuba/<FILE>.sql.gz | docker exec -i tuba-alhijaz-postgres-1 psql -U "$PGU" -d "$PGDB"

# 3. bring the api back
docker compose -f docker-compose.prod.yml up -d --no-deps api
```
Verify with §4. Always run §3.1 scratch restore first when unsure.

---

## 4. Something broke — look here first

- **Grafana** (dashboards, metrics): tunnel then browse — `ssh -L 3007:127.0.0.1:3007 <you>@187.77.144.38` → http://localhost:3007 (once nginx is live it's at `https://tubaalhijaz.com/grafana/`).
- **Health at a glance:** `docker compose -f docker-compose.prod.yml ps` — anything not `healthy`?
- **Logs:** `docker compose -f docker-compose.prod.yml logs -f <service>` (e.g. `api`, `postgres`, `redis`, `web`).
- **API alive?** `curl -s http://127.0.0.1:3210/health` → `{"status":"ok",...}`.

**Common failure points**
| Symptom | Check | Fix |
|---|---|---|
| API 500s "too many clients" / **Postgres conn exhaustion** | `docker exec tuba-alhijaz-postgres-1 psql -U tuba -d tubaalhijaz -c 'select count(*) from pg_stat_activity;'` vs `show max_connections;` (Grafana: `pg_stat_database_numbackends`) | `dc restart api` to drop leaked conns; longer term raise `max_connections` or add pgbouncer |
| Automations/notifications not firing / **BullMQ stuck jobs** | Grafana redis queue-depth (`tuba:tuba-automation:failed`/`:active` climbing) or `docker exec tuba-alhijaz-redis-1 redis-cli LLEN tuba:tuba-automation:wait`; automation UI → run history | `dc restart api` (restarts the workers); clear/retry failed jobs from the automation UI |
| Emails/WhatsApp not delivered / **WASender rate limit** | `dc logs -f api | grep -iE 'wasender|smtp'`; `NotificationLog` rows with `status=FAILED` | WASender 429 → BullMQ retries with backoff; if sustained, throttle send volume / re-check `WASENDER_API_KEY`; SMTP: verify `SMTP_*` creds |
| Site 502/blank via domain | `docker compose ps` (web/api up?) + `nginx -t && systemctl reload nginx` + Cloudflare status | restart the down container; confirm origin cert + CF SSL mode Full(strict) |
| Disk full (box runs at ~94%) | `df -h /` ; `du -sh /var/lib/docker/* /var/backups/tuba` | `docker builder prune -f`, drop old images; Prometheus is size-capped (512MB) so it self-limits |

---

## 5. Scaling — the plan (do NOT act; document only)

The box is **shared** (Coolify + Supabase + others), ~8 GB RAM, disk ~94%. Order of moves when undersized:

1. **Free disk first** — `docker builder prune`, remove dangling images/old tags. Cheapest win.
2. **Vertical scale** — resize the VPS (more RAM + disk + vCPU). No architecture change; raise the per-service
   `deploy.resources.limits` in `docker-compose.prod.yml` afterward. Do this before any re-architecture.
3. **Move the stateful services off-box** (the app is fully env-driven — only `.env` changes, no code):
   - **Postgres** first (biggest single point): managed PG or a dedicated DB host → update `DATABASE_URL`.
   - **Redis** → managed/dedicated → `REDIS_URL`. **MinIO** → dedicated host or real S3 → `MINIO_*`.
4. **Scale the API horizontally** — once Postgres/Redis are external, `api` and `web` are stateless: run multiple
   `api` replicas behind nginx `upstream` (round-robin). BullMQ workers scale the same way (shared Redis).
   Split the worker into its own process/replica if job volume dominates.

Rule of thumb: **free disk → resize → externalize Postgres → externalize Redis/MinIO → replicate API.**

---

## 6. Shipping a Figma design update

> **Prerequisites — not all provisioned yet.** This section is written to be followed as-is
> once the three items in §6.0 exist. Until then, only the *local* half (§6.1–6.2) works.

**The problem this solves.** `apps/web` started as a Figma Make export, but real API calls,
state management and WebSocket wiring now live *inside those same files*. A new export
therefore can **never** be copied over `apps/web` — that would silently delete the wiring.

**The model — a vendor branch.**

```
figma-baseline   ●───────────●  (pristine Figma exports ONLY, never wired)
                  \           \
staging            ●──●──●─────◆  ← merge: git 3-way-applies the DESIGN delta onto wired code
                                \
main                             ◆  ← promotion (approval-gated deploy to the live domain)
```

`figma-baseline` sits at the original import (`0f07548`) and is the ancestor of
`staging`/`main`. Its *page and component* files are byte-identical to the first export;
two files deliberately diverge because the monorepo requires it (`apps/web/package.json`
— workspace rename + `@tuba/shared` dep; `apps/web/src/app/lib/i18n.ts` — a re-export
shim so the API reuses the same strings for PDFs and notification templates). Those are
tracked as **`ADAPTED`** and must never be blind-copied from an export. So
`git merge figma-baseline`
gives a true 3-way merge: git applies design changes onto the wired files by itself and
raises conflicts **only** where a design change and our wiring touched the same lines.
That is the whole trick — reconciliation is a normal merge, not manual diffing.

### 6.0 One-time setup (do these once)

1. **GitHub remote** — the repo has never been pushed. `gh repo create`, push `main`,
   `staging` and `figma-baseline`, then add the secrets in `docs/CICD.md` plus the new
   `VITE_API_URL_STAGING` **variable**. Create two environments: `production`
   **with** required reviewers, `staging` **without**.
2. **Staging on the VPS** — a second checkout, its own env, its own compose project:
   ```bash
   git clone -b staging <repo> /var/www/TUBAALHIJAZ-staging
   cd /var/www/TUBAALHIJAZ-staging/infra
   cp .env.staging.example .env && chmod 600 .env    # fill secrets; leave SMTP_*/WASENDER_* BLANK
   docker compose -f docker-compose.prod.yml -f docker-compose.staging.yml -p tuba-staging up -d
   docker compose -f docker-compose.prod.yml -f docker-compose.staging.yml -p tuba-staging config --format json | head -c 120   # must say tuba-staging
   docker volume ls | grep tuba          # tuba-staging_* MUST be separate from tuba-alhijaz_*
   ```
3. **nginx + DNS for `staging.tubaalhijaz.com`** — Cloudflare A record (proxied) and a
   vhost proxying `/`→`127.0.0.1:8096`, `/api/`→`127.0.0.1:3211` (same WebSocket upgrade
   block as prod), **behind HTTP basic auth** (`htpasswd -c /etc/nginx/.htpasswd-staging tuba`)
   and `add_header X-Robots-Tag "noindex, nofollow" always;`.
   ⚠️ Check the Cloudflare **Origin Certificate covers `*.tubaalhijaz.com`** — if it was
   issued for the apex + `www` only, reissue it with the wildcard or staging will fail TLS.

### 6.1 Import the new export

```bash
scripts/figma-import.sh "/c/Users/DBL/Downloads/<new export>"          # read-only report
```
Read the report. It classifies every file:

| Class | Meaning | What you do |
|---|---|---|
| `FAST` | design changed, we never wired that file | merges cleanly, no action |
| `RECONCILE` | design changed **and** we wired it | **this is your work-list** |
| `WIRE-NEEDED` | brand-new screen | copy in, then wire it (§6.2) |
| `REMOVED` | gone from the export | check for a rename before deleting anything |
| `ADAPTED` | monorepo needs it to differ from Figma | never auto-copied; reconcile by hand using the diff command the report prints |
| `SKIPPED` | excluded by policy (`pnpm-workspace.yaml` — would shadow the root workspace) | nothing |
| `PRESERVED` | ours, the export doesn't ship it (`lib/api.ts`, `lib/opsSocket.ts`, `components/States.tsx`) | nothing — the overlay never deletes these |

If you ever hand-fix a file after a merge because the monorepo needs it different from
Figma, add it to `ADAPTED_PATHS` in the script so the next import doesn't clobber it.

Then commit the export onto the vendor branch:
```bash
scripts/figma-import.sh "/c/Users/DBL/Downloads/<new export>" --apply
```

### 6.2 Reconcile onto the wired code

```bash
git checkout staging
git merge figma-baseline
```
- **Clean merge** → go to §6.3.
- **Conflicts** → only in `RECONCILE` files. The rule for every hunk:
  **take the new Figma markup, keep our wiring.** Concretely: accept design changes to
  className/style/layout/copy; keep every `useState`/`useEffect`/`api.*` call, every
  `isLoggedIn()`/`demo` gate, the loading/error/empty states from
  `components/States.tsx`, and the `SampleDataBanner` placements.
  If a Figma change deletes an element our code binds to, the design wins — rewire it.
- **A genuinely new screen** is not a merge problem: copy the file in, then wire it
  following the same module pattern as its siblings (fetch via `lib/api.ts`, gate on
  `isLoggedIn()`, render `LoadingSkeleton`/`ErrorState`/`EmptyState`, never fall back
  to mock data for a signed-in user).

Then, **before pushing**, re-run the Phase 19 guardrail so a design import can't
reintroduce fabricated data or silently restyle wired pages:
```bash
cd apps/web && npx vite build          # apps/web has NO tsconfig — this is transpile-only, not a typecheck
```

### 6.3 Verify on staging

```bash
git push origin staging     # CI: test → build-push (:<sha> + :staging) → auto-deploy, NO approval
```
Watch the run, then check `https://staging.tubaalhijaz.com` (basic auth). Confirm the
changed screens, **signed in** — most Phase 19 fixes only appear for authenticated users.

### 6.4 Promote to production

```bash
git checkout main && git merge --ff-only staging && git push origin main
```
That triggers test → build-push (`:<sha>` + `:latest`) → **deploy pauses on the
`production` environment gate**. Approve it in the GitHub Actions run. Nothing reaches
`tubaalhijaz.com` until a human clicks approve.

> `--ff-only` is deliberate: it guarantees production is exactly the commit that was
> verified on staging. If it refuses, main has diverged — reconcile on staging first,
> never by merging main into itself.

### 6.5 Rollback

**Staging** — no rollback needed; it is disposable. Push a fix, or
`git reset --hard origin/main && git push --force-with-lease origin staging`.

**Production** — unchanged from §2 and **under 2 minutes**, because CI now persists the
deployed tag into `infra/.env`:
```bash
cd /var/www/TUBAALHIJAZ/infra
grep ^IMAGE_TAG= .env                                  # what's live now
sed -i "s|^IMAGE_TAG=.*|IMAGE_TAG=<previous-sha>|" .env
docker compose -f docker-compose.prod.yml up -d        # image already local — no rebuild, no pull
```
⚠️ Code rolls back; **a schema migration does not** (§2). If the bad release migrated the
DB, restore from backup (§3) instead.

### Safety invariants — why a bad staging push cannot reach the live domain

| Guard | Staging | Production |
|---|---|---|
| Branch | `staging` | `main` |
| Directory | `/var/www/TUBAALHIJAZ-staging` | `/var/www/TUBAALHIJAZ` |
| Compose project | `tuba-staging` | `tuba-alhijaz` |
| Volumes (project-prefixed) | `tuba-staging_pgdata` … | `tuba-alhijaz_pgdata` … |
| Ports | API 3211 · web 8096 · MinIO 9010/9011 | API 3210 · web 8095 · MinIO 9000/9001 |
| Deploy job | `deploy-staging`, `refs/heads/staging` only | `deploy`, `refs/heads/main` only |
| Approval | none (by design) | **required reviewer** |
| JWT secret | distinct → staging tokens invalid in prod | distinct |
| **Notifications** | `WASENDER_API_KEY`/`SMTP_HOST` **blank** ⇒ queued + logged, **never transmitted** | live |

The notification row matters most: staging runs against real-shaped data including real
phone numbers and emails. Both channels fail safe when unset — `whatsapp.channel.ts`
returns `SKIPPED` with no API key, `email.channel.ts` never creates a transport with no
`SMTP_HOST`. **Never populate those two variables in the staging `.env`.**
