# TUBA AL HIJAZ — CI/CD (Phase 16)

Workflow: `.github/workflows/ci-cd.yml` (GitHub only reads workflows from the **repo-root**
`.github/workflows/` — not from `/infra`).

## Pipeline
```
push → main  ┌─ test ───────────────────────────────────────────────┐
             │  install · build shared · prisma generate · lint       │
             │  (typecheck) · spin up postgres/redis/minio via the    │
             │  infra compose · migrate · seed · e2e (178 tests) ·     │
             │  build api + web                                        │
             └───────────────────────┬───────────────────────────────┘
                                     ▼ (main only)
             ┌─ build-push ──────────────────────────────────────────┐
             │  buildx → push ghcr.io/<owner>/tuba-alhijaz-{api,web}  │
             │  tags: <git-sha> + latest  (GITHUB_TOKEN, no secret)   │
             └───────────────────────┬───────────────────────────────┘
                                     ▼
             ┌─ deploy  ── environment: production (MANUAL APPROVAL) ─┐
             │  ssh VPS → git pull → docker compose -f                │
             │  docker-compose.prod.yml pull && up -d                 │
             └───────────────────────────────────────────────────────┘
```
Pull requests run the **test** job only. `build-push` and `deploy` run **only on push to `main`**.
The **deploy** job is pinned to the `production` GitHub Environment — configure it with a required
reviewer and every deploy waits for a manual click (auto-deploy later, once the pipeline is trusted).

## Repo secrets to create  (Settings → Secrets and variables → Actions → **Secrets**)
| Name | What it is |
|---|---|
| `VPS_SSH_HOST` | VPS IP / hostname (e.g. `187.77.144.38`) |
| `VPS_SSH_USER` | deploy username on the VPS — use a **dedicated non-root `deploy` user**, not root, not your session |
| `VPS_SSH_KEY` | the **private** deploy key (ed25519). Its public half goes in that user's `~/.ssh/authorized_keys`. Generate a NEW key just for CI — do not reuse a personal key. |
| `VPS_SSH_PORT` | *(optional)* SSH port if not `22` |
| `GHCR_TOKEN` | a PAT with **`read:packages`** so the VPS can `docker login ghcr.io` and pull the images. *Not needed if you make the GHCR packages public* (then delete the login line). |

## Repo variables to create  (same page → **Variables**, not secrets)
| Name | What it is |
|---|---|
| `VITE_API_URL` | the **public** origin the browser uses to reach the API — baked into the web image at build (e.g. `https://api.tubalhijaz.com` or `http://187.77.144.38:3210`). Not secret. |

**No secret is needed to push images** — GHCR push uses the built-in `GITHUB_TOKEN` with
`permissions: packages: write` (already in the workflow).

## One-time setup you do
1. **Create the GitHub repo and push** — the project has no remote yet:
   ```bash
   gh repo create <owner>/tuba-al-hijaz --private --source=. --push
   # or: git remote add origin git@github.com:<owner>/tuba-al-hijaz.git && git push -u origin main
   ```
2. **Environment gate:** Settings → Environments → **New environment `production`** → enable
   **Required reviewers** (add yourself). This is the manual-approval gate on the deploy job.
3. **Add the secrets + variable** above.
4. **GHCR visibility:** after the first `build-push`, the packages appear under your account →
   set them **public** (simplest) or keep private + provide `GHCR_TOKEN`.

## VPS prerequisites (for the deploy step to work — Phase 17 sets these up)
- Docker + `docker compose` installed; the `VPS_SSH_USER` is in the `docker` group.
- The repo cloned at **`/var/www/TUBAALHIJAZ`** (the deploy does `git pull` to refresh the compose files).
- **`/var/www/TUBAALHIJAZ/infra/.env`** present with the **real** prod values (DB/MinIO/JWT secrets,
  `WEB_ORIGIN`, `VITE_API_URL`, `COOKIE_SECURE=true`, …). `REGISTRY` + `IMAGE_TAG` are exported by the
  deploy script (`ghcr.io/<owner>` + the git SHA), so `docker compose pull` fetches the CI-built images.

## Rollback (Phase 20 will formalize)
Every image is tagged with its git SHA, so a rollback is: on the VPS set `IMAGE_TAG=<previous-sha>`
and `docker compose -f docker-compose.prod.yml up -d` (no rebuild).

## Lint note
There's no ESLint config in the repo; the **lint gate is the API TypeScript typecheck**
(`tsc --noEmit`, added as `@tuba/api`'s `lint` script). Add ESLint later if you want style rules too.
