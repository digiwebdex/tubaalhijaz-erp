# Web UI Deployment Report — Enterprise UI to Production

**Date (UTC):** 2026-08-02  
**Operator task:** Deploy UI-01…UI-12 / ESP web source to production  
**Constraint observed:** No business-logic, API image tag, database, or migration changes  

---

## 1. Findings (why production served the old ERP UI)

| Fact | Detail |
|------|--------|
| Branch | `develop` @ `f11ed34` (tracks `origin/develop`) |
| UI source | Present on `develop` — Enterprise Kit (`apps/web/src/app/components/erp/*`), `OpsTodayDashboard`, `ExecutiveReportsDashboard`, `navConfig`, transformed desks |
| Production web image | `tuba-alhijaz/tuba-alhijaz-web:stable-20260731` |
| Image created | **2026-08-01T15:19:24Z** — **before** UI/ESP web work (source file mtimes **2026-08-02**) |
| Bundle shape (old) | Single `index-CNlLyogY.js` (~1.66 MB); **0** matches for `ErpPageTemplate` / `OpsToday` |
| Root cause | Web image was **never rebuilt** after UI-02…UI-12 / ESP-01…03 landed in source. ESP-06/07 updated **API** only (`esp06-20260802`). `WEB_IMAGE_TAG` stayed `stable-20260731`. |
| Nginx | Correctly proxies `/` → `127.0.0.1:8095` (web container). Not an nginx misroute. |
| Compose | `docker-compose.prod.yml` builds from `infra/Dockerfile.web` with `VITE_API_URL` bake — unused until rebuild. |

### UI-01…UI-12 existence on `develop`

| Sprint | In repo? | Form |
|--------|----------|------|
| UI-01 | Yes | Design SSOT docs (`UI_DESIGN_SYSTEM.md`, color/type/spacing/icon/a11y/component guide) |
| UI-02 | Yes | `navConfig.ts`, ERPShell / Super Admin nav |
| UI-03 | Yes | `OpsTodayDashboard.tsx` |
| UI-04 | Yes | `components/erp/*` kit |
| UI-05…UI-09 | Yes | Groups / Visa / Long Stay / Reports / Finance pages |
| UI-10 | Yes | Marketing pages |
| UI-11 | Yes | Mobile / responsive notes + shell |
| UI-12 | Yes | `UI_12_CERTIFICATION.md` |

---

## 2. Action taken

1. Built new image: `tuba-alhijaz/tuba-alhijaz-web:ui-20260803` from current `develop` source (`infra/Dockerfile.web`, `VITE_API_URL=https://tubaalhijaz.com/api`).  
2. Set `infra/.env` → `WEB_IMAGE_TAG=ui-20260803` (API tag left `esp06-20260802`).  
3. `docker compose -f docker-compose.prod.yml up -d web`  
   - Note: Compose also **recreated** the API container (same image `esp06-20260802`) because `web.depends_on: api: healthy`. No API image/tag/code change.

---

## 3. Before / after

| Item | Before | After |
|------|--------|-------|
| Web image | `stable-20260731` (`387e85037a48`) | **`ui-20260803`** (`c23222a95f17…` / running) |
| Entry JS | `index-CNlLyogY.js` (monolith) | `index-GAJZ3JXB.js` + `react-vendor` / lazy chunks |
| Asset count | 3 files under `/assets` | **40** files (route/vendor split) |
| `ErpPageTemplate` in bundle | Absent | Present (e.g. AgentPortal, Dashboards, Finance chunks) |
| `OpsTodayDashboard-*.js` | Absent | **Present** |
| API image | `esp06-20260802` | `esp06-20260802` (unchanged) |
| Edge | `/` → old SPA | `/` → new SPA hashes |

---

## 4. Git / branch

| Field | Value |
|-------|-------|
| Branch | `develop` |
| Commit | `f11ed34cf3da79dc2dd5e95e07f24e142a550541` |
| Remote | `origin/develop` (in sync at deploy time) |
| Tag context | `v2.0.0` exists on this history; web image was not rebuilt at tag time |

---

## 5. UI verification (post-deploy)

| Check | Result |
|-------|--------|
| `http://127.0.0.1:8095/` | 200 |
| `https://tubaalhijaz.com/` serves `index-GAJZ3JXB.js` | Pass |
| Chunks include OpsToday / FinanceERP / ErpDataTable | Pass |
| `ErpPageTemplate` string in shipped JS | Pass |
| `/api/health` | 200 |
| API image still `esp06-20260802` | Pass |
| `REFRESH_COOKIE_PATH` still `/api/auth` after API recreate | Pass (verified) |

**Browser tip:** Hard-refresh or clear cache if a client still shows the old `index-CNlLyogY.js` (Cloudflare/browser cache).

---

## 6. Rollback (web only)

```bash
cd /var/www/TUBAALHIJAZ/infra
sed -i 's/^WEB_IMAGE_TAG=.*/WEB_IMAGE_TAG=stable-20260731/' .env
docker compose -f docker-compose.prod.yml up -d web
```

---

## 7. Conclusion

Production was serving the **old ERP UI** because the **web Docker image was stale**, not because UI code was missing from `develop`. Deploying `ui-20260803` aligns production with the Enterprise UI source on `develop`.
