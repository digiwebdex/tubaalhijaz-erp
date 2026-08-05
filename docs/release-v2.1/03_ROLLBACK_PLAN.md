# 03 · ROLLBACK PLAN — v2.1

**Principle:** The v2.1 migration set is **additive and forward-compatible**, so the primary rollback is an **application rollback** (redeploy the previous release). The database can remain on the v2.1 schema — the older app ignores the new nullable/defaulted objects.

---

## 1. Rollback Triggers
- `/health` not 200 after API start, and not fixable within the window.
- Any **critical** smoke check fails (Doc 04): staff/agent login broken, approval action erroring, data corruption suspected.
- Migration failed or left the DB in an unexpected state.

## 2. Decision Matrix
| Situation | Action |
|-----------|--------|
| App broken, **migrations applied cleanly** | **App-only rollback** (§3). Leave DB on v2.1 schema. |
| Migration failed / partial | **DB restore** from pre-deploy backup (§4) + redeploy previous app. |
| Data integrity concern (bad writes) | **DB restore** to pre-deploy backup (§4). Accept loss of in-window writes. |

## 3. App-Only Rollback (preferred, fast)
1. Redeploy the **previous API build/image tag** (recorded in Doc 01 §1.5); start `node dist/main.js`.
2. Republish the **previous Web build** (atomic static swap); purge CDN.
3. `GET /health` → 200; run smoke Doc 04 against the OLD version.
4. Because v2.1 DDL is additive, the old app runs unchanged against the migrated DB. New tables/columns simply go unused.
5. Announce rollback; open an incident (Doc 07) to investigate the failed release.

> Safe because: no columns were dropped/renamed/retyped; new enums add values only; new tables are unreferenced by old code.

## 4. Database Restore (only if migration failed or data integrity is at risk)
1. Stop the API (prevent further writes).
2. Restore the **pre-deploy backup** taken in Doc 01 §1.2 to the production database.
3. Verify restore (row counts / key tables) against the backup manifest.
4. Redeploy the **previous** app version (API + Web).
5. `GET /health` 200 + smoke (Doc 04).
6. **Data loss note:** any writes made after the backup and before restore are lost — quantify and communicate.

## 5. Post-Rollback
- Confirm login (staff + agent), a group listing, and one approval read all work on the restored/old version.
- File incident (Doc 07) with: what failed, logs, migration status snapshot, decision taken.
- Do **not** re-attempt deploy until root cause is fixed and Go/No-Go (Doc 09) is re-run.

## 6. What NOT to do
- Do **not** hand-write down-migrations under pressure — additive schema does not require them.
- Do **not** drop the v2.1 tables/columns to "clean up" after an app-only rollback; they are inert and needed for the next attempt.
- Do **not** mix a partial DB restore with the new app.

## 7. Rollback Readiness Checklist (verify BEFORE deploy)
- [ ] Pre-deploy DB backup taken **and** restore-tested.
- [ ] Previous API image/build tag recorded.
- [ ] Previous Web build artifact retained.
- [ ] Access to DB restore tooling confirmed.
