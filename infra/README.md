# TUBA AL HIJAZ — Containerized stack (`/infra`, Phase 15)

The whole stack in Docker: **api · web (nginx) · postgres · redis · minio**, with named volumes so
restarts never lose data, healthchecks on every service, and all config via `infra/.env`.

## Quick start
```bash
cd infra
cp .env.example .env          # then edit the CHANGE_ME secrets
make prod                     # builds + tags images with the git SHA, then up -d
# equivalent: IMAGE_TAG=$(git rev-parse --short HEAD) docker compose -f docker-compose.prod.yml up -d --build
```
Then:
- Web (SPA):        http://localhost:8080
- API:             http://localhost:3210/health
- MinIO console:   http://localhost:9001  (login = MINIO_ROOT_USER / MINIO_ROOT_PASSWORD)

`docker compose up` (no `-f`) uses `docker-compose.yml` (dev), which additionally exposes
Postgres :5432 and Redis :6379 to the host and doesn't auto-restart.

The API container runs `prisma migrate deploy` on boot, so the schema is created automatically.
The database starts **empty** — to load demo data, seed from the host (the prod image is devDep-free):
```bash
DATABASE_URL="postgresql://<user>:<pass>@localhost:5432/tuba_al_hijaz?schema=public" \
  pnpm --filter @tuba/api db:seed
```

## Images
- **`Dockerfile.api`** — multi-stage. Builder installs the pnpm workspace, builds `@tuba/shared`,
  runs `prisma generate`, and `nest build`s the API. The runner installs **prod-only** deps
  (`prisma` was moved to `dependencies` so its CLI is present for `migrate deploy`), copies the built
  `dist` + prisma schema, regenerates the client for the linux engine, and boots
  `migrate deploy && node dist/main.js`. Base `node:22-slim` (+ `openssl` for Prisma).
- **`Dockerfile.web`** — multi-stage. Builder produces the static Vite SPA; the runner is
  `nginx:1.27-alpine` serving it with an SPA fallback (`nginx.web.conf`). `VITE_API_URL` is a
  build ARG (Vite inlines it), defaulting to `http://localhost:3210`.

## Why the web is a separate origin (not one nginx proxying everything)
The requirement offered "own nginx container OR the main nginx layer." **We serve the SPA from its own
nginx container and point the browser at the API on a separate origin (`VITE_API_URL`), rather than
reverse-proxying the API under the web origin.** Reason: the SPA's client-side routes **collide** with
API paths — the SPA has `/dashboards`, `/automation`, `/ops-control`, and the API has `/dashboards/*`,
`/automation/*`, `/ops/*`. A single-origin nginx would have to disambiguate overlapping top-level paths
(brittle), or the API would need a global `/api` prefix (breaks the 178-test suite and the frozen
frontend's URLs). Separate origins + CORS (already configured, `CORS_ORIGIN=${WEB_ORIGIN}`) is clean and
needs zero code change. On the VPS (Phase 17) a single front nginx can still terminate TLS and route
`web.` / `api.` subdomains (or `:8080` / `:3210`) to these two containers.

## Data persistence (named volumes)
| volume | mounted at | holds |
|---|---|---|
| `pgdata` | postgres `/var/lib/postgresql/data` | the database |
| `redisdata` | redis `/data` | BullMQ jobs + AOF |
| `miniodata` | minio `/data` | **all uploaded files** — documents, vouchers, invoices, QR, backups |
Restarts / `docker compose down` keep the data. Only `docker compose down -v` wipes it.

**MinIO is the single source of truth for files.** The API's local-disk driver is inactive whenever
`MINIO_ENDPOINT` is set (always, in compose), so there is deliberately **no** second on-disk file
store / `uploads` volume — that would drift out of sync with MinIO. Everything file-related lives on
`miniodata`.

## Image tags + resource limits
- **Deterministic tags:** the api/web images are tagged `tuba-alhijaz/{api,web}:${IMAGE_TAG}`.
  `make prod` / `make dev` set `IMAGE_TAG` to the short git SHA, so every build is addressable — which
  is what CI/CD (Phase 16) pushes and what a rollback (Phase 20) pins to. Unset ⇒ `latest` (prod) / `dev`.
- **Resource limits** (`deploy.resources.limits`, enforced by `docker compose` v2) keep the single VPS
  from OOM-ing under load: postgres 768M / redis 256M (+ `--maxmemory 200mb allkeys-lru`) / minio 512M /
  api 768M / web 128M, with per-service CPU caps. Tune in the compose files as the box grows.

## Healthchecks
postgres `pg_isready` · redis `redis-cli ping` · minio `/minio/health/live` · api `GET /health` ·
web `GET /`. The API waits (`depends_on: condition: service_healthy` / `service_completed_successfully`)
for postgres, redis, and the one-shot `createbuckets` (which creates the `tuba-docs` bucket) before it
starts, so boot ordering is deterministic.

## Env wiring
All configuration lives in **`infra/.env`** (gitignored; template `.env.example`). Compose substitutes
`${VAR}` and passes the API its runtime env; nothing is hardcoded in the compose files. Service-to-service
addresses use container DNS (`postgres`, `redis`, `minio`) — only host-facing ports are published.

## Notes / follow-ups
- Image size: the runner reinstalls prod deps rather than pruning in place — correct and cache-friendly,
  not minimal. A `pnpm deploy` slim pass is a later optimization.
- Pin `minio/minio` / `minio/mc` to a dated release tag for reproducible prod (using `:latest` here).
- Set `COOKIE_SECURE=true` and real secrets on the VPS; put TLS in front (Phase 17).
