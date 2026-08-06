# PATCH HISTORY — TUBA AL HIJAZ ERP v2.0.x
Every production code/config fix on the v2.0.1 line. Each must be minimal, backward-compatible, regression-tested, documented. Newest first.

## Template
```
### v2.0.1-pN — <title>  (YYYY-MM-DD)
- Incident: INC-… (if any)
- Root cause: <what>
- Files affected: <paths>
- Change: <the minimal fix>
- Risk: Low | Med | High — <why>
- Backward compatible: Yes/No
- Verify: Browser [ ] API [ ] DB [ ] Regression [ ]
- Rollback: <redeploy prev tag / revert commit>
- Deployment impact: <restart / migration / none>
- Version bump: v2.0.1-pN (bug) | v2.0.2 (security)
```

## Log
_(no patches issued — v2.0.1 as released)_

### v2.0.1-p1 — Flights tab (and all group tabs) kept the Foundation panel visible  (2026-08-04)
- Incident: BUG report — "Flights tab is not functional."
- Root cause: In `GroupDetailView` (AgentPortalGroups.tsx) the `GroupFoundationPanel` was rendered as `{live && <GroupFoundationPanel/>}` — **ungated by the active tab** — so it stayed on screen under every tab. Clicking Flights layered the flights panel *below* the still-visible Foundation screen; it read as "Flights not switching."
- Fix (minimal, UI-only): made **Foundation a real tab** — added `"foundation"` to `DetailTab`, added it as the first `TABS` entry (default tab), and gated the panel with `{tab === "foundation" && …}`. Aligned the flights empty-state title to "No flights added yet."
- Files affected: `apps/web/src/app/pages/AgentPortalGroups.tsx` (5 edits). No API/schema/other-module changes.
- Risk: **Low** — single file, UI-only; TypeScript clean; no backend/DB/API change. Default landing view now = Foundation tab (same panel shown on open as before, just replaceable).
- Backward compatible: Yes (no API/schema/contract change).
- Verify: Browser [x] (Foundation hidden on Flights + all 6 other tabs; returns on Foundation tab; 2 flights load from Group Flight API into table; empty state renders; no Add-Flight for read-only agent; 0 console/page errors) · tsc [x] (web typecheck exit 0) · API [x] (GET /groups/:id → flightInfos) · Regression [x] (all tabs switch cleanly, no console errors).
- Out of scope (→ v2.1 backlog, NOT a bug): expected-behavior #3 "Add Flight button for permitted roles" needs a create-flight API that does not exist (agent portal is read-only; flights are assigned by Ops).
- Rollback: restore `/root/tuba-local-bak/AgentPortalGroups.tsx.bak-flights`.
- Deployment impact: **Not deployed** (per instruction). Web-only change → to ship: rebuild web image + `up -d web` (no migration, no API rebuild). Prepared + locally verified in the isolated stack; awaiting deploy approval.

  **DEPLOYED 2026-08-04** — web-only. Image `tuba-alhijaz-web:v2.0.1-p1` (2d4e032c1c03); container `b5a18ab95252` (healthy). API untouched (`v2.0.1`, not restarted). Rollback target `web:v2.0.1` (ef95b62e3878). Verify: web healthy ✓; fix present in served bundle `AgentPortalGroups-*.js` ("No flights added yet." present, "No flights assigned" gone) ✓; home + /services + /about + /contact → 200 ✓; home browser 0 console errors ✓; api/health 200 (untouched) ✓. Authenticated tab click-through on prod not run (no prod agent credential); identical source browser-verified locally (Foundation hidden on Flights + all tabs, 2 flights load, empty state, 0 console errors) and the exact verified chunk is the one served.
