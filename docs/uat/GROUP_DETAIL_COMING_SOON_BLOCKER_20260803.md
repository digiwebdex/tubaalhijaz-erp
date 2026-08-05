# PRODUCTION BLOCKER — Group Detail Coming Soon (resolved)

**Date:** 2026-08-03  
**Scope:** Deployment / component wiring only — no new APIs or business logic  

---

## 1. Tab → route / component map

| Tab | SPA route | Shell screen | Lazy import | Detail renderer (source) |
|-----|-----------|--------------|-------------|--------------------------|
| (portal) | `/agent-portal` | `AgentPortal` | `lazy(() => import("./AgentPortal"))` in `routes.tsx` | — |
| Groups desk | same URL, local `screen=groups` | `AgentPortal.tsx` | `lazy(() => import("./AgentPortalGroups").then(m => ({ default: m.GroupsModule })))` | `GroupsModule` → `GroupDetailView` |
| Hotel | in-module `DetailTab="hotel"` | — | same Groups chunk | `GroupServiceTab` (`/services/hotel`) |
| Transport | `DetailTab="transport"` | — | same | `GroupServiceTab` (`/services/transport`) |
| Catering | `DetailTab="catering"` | — | same | `GroupServiceTab` (`/services/catering`) |
| Documents | `DetailTab="documents"` | — | same | `GroupDocumentsTab` (`GET /vouchers`) |
| Timeline | `DetailTab="timeline"` | — | same | `GroupTimelineTab` (`GET /audit-logs` if `ACCESS_AUDIT_LOGS`) |

No separate React Router path per tab — tabs are local state inside `GroupDetailView`.

---

## 2. Root cause

| Layer | Finding |
|-------|---------|
| Source (`AgentPortalGroups.tsx`) | Already wired to `GroupServiceTab` / Documents / Timeline — **no** `ComingSoonPanel` |
| Production web image | `tuba-alhijaz/tuba-alhijaz-web:esp07-20260803` (built ~2026-08-02 21:05) still contained **5×** `"coming soon"` + `"Hotel bookings"` in `AgentPortalGroups-DydTXVl3.js` |
| Mechanism | **Stale SPA deploy** — not a wrong route, feature flag, or wrong export. Nginx correctly served an old Vite chunk. |

---

## 3. Fix applied

1. Rebuilt web from current workspace (includes Groups tab wiring):  
   `tuba-alhijaz/tuba-alhijaz-web:group-tabs-20260803`
2. Set `infra/.env` → `WEB_IMAGE_TAG=group-tabs-20260803` (API left `esp06-20260802`)
3. `docker compose -f docker-compose.prod.yml up -d --no-deps web`
4. Verified running bundle: **0** `"coming soon"` / `"Hotel bookings"`; Bangla kit strings present (`নতুন অনুরোধ`, `এই মডিউল`)

### Mapping (old → new)

| Tab | Old (prod chunk) | New (live) |
|-----|------------------|------------|
| Hotel | `ComingSoonPanel` “Hotel bookings — coming soon” | `GroupServiceTab` |
| Transport | `ComingSoonPanel` “Transport — coming soon” | `GroupServiceTab` |
| Catering | `ComingSoonPanel` “Catering — coming soon” | `GroupServiceTab` |
| Documents | `ComingSoonPanel` “Group documents — coming soon” | `GroupDocumentsTab` |
| Timeline | `ComingSoonPanel` “Activity timeline — coming soon” | `GroupTimelineTab` or `ModuleNotConfigured` (agent without audit permission) |

### Files

| File | Role |
|------|------|
| `apps/web/src/app/pages/AgentPortalGroups.tsx` | Implemented tab bodies (already in worktree; baked into image) |
| `infra/.env` | `WEB_IMAGE_TAG=group-tabs-20260803` |
| Docker image | `tuba-alhijaz/tuba-alhijaz-web:group-tabs-20260803` |

Left intentionally (no agent/group API): Services `FlightComingSoon`, Agent Support shell, Super Admin AI/Workflow, Ops desks without backends.

---

## 4. Browser verification (post-deploy)

Agent `uat.agent@tubaalhijaz.local` → Group **Toki** (`GRP-1446-9470`)

| Tab | Coming Soon? | Search | Filter | Table / empty | Create | Cancel | Download | Verdict |
|-----|--------------|--------|--------|---------------|--------|--------|----------|---------|
| Hotel | No | Yes | Yes | Table + `HTL-2885` REQUESTED | Drawer **নতুন অনুরোধ** | **বাতিল** on row | — | **PASS** |
| Transport | No | Yes | Yes | Empty table | **নতুন অনুরোধ** | (no rows) | — | **PASS** |
| Catering | No | Yes | Yes | Empty table | **নতুন অনুরোধ** | (no rows) | — | **PASS** |
| Documents | No | Yes | — | Empty vouchers table | N/A (list/download only) | — | (no `fileId` rows) | **PASS** |
| Timeline | No | — | — | Bangla **এই মডিউল এখনও কনফিগার করা হয়নি।** (agent lacks `ACCESS_AUDIT_LOGS`) | Disabled | — | — | **PASS** |

Screenshots: `blocker-hotel-tab.png`, `blocker-hotel-create-drawer.png`, `blocker-transport-tab.png`, `blocker-documents-tab.png`, Timeline Bangla not-configured, Catering wired.

---

## 5. Final matrix

| Tab | Before | After | Ready |
|-----|--------|-------|-------|
| Hotel | FAIL Coming Soon | Functional services UI | **PASS** |
| Transport | FAIL Coming Soon | Functional services UI | **PASS** |
| Catering | FAIL Coming Soon | Functional services UI | **PASS** |
| Documents | FAIL Coming Soon | Vouchers list UI | **PASS** |
| Timeline | FAIL Coming Soon | Honest not-configured (agent) / audit when permitted | **PASS** |

**Overall:** Group Detail production blocker for these five tabs is **cleared** after web image redeploy + browser confirm. No API/schema changes.
