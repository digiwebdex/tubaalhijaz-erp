# T001-03 Completion — Group Foundation UI

**Task:** T001-03 (TRANSFORM-001)  
**Scope:** Agent Portal Groups + Ops Group Master UI (reuse existing Groups API)  
**Date:** 2026-08-01

## Summary

Extended the existing Group create wizard and detail view (Agent Portal) and Ops Group Master board to surface Nusuk Group Number, HAJJ visa type, Haji WhatsApp, consulate, package type, uploaded-by, and four readiness gates. No new Group module; no visual redesign of the ERP shell.

## Files

| Path | Change |
|------|--------|
| `apps/web/src/app/lib/group-foundation.ts` | Pure UX/payload helpers |
| `apps/web/src/app/lib/group-foundation.selftest.ts` | Self-test |
| `apps/web/src/app/pages/AgentPortalGroups.tsx` | Wizard sections, HAJJ, detail foundation panel |
| `apps/web/src/app/pages/OpsControl.tsx` | Group Master columns + edit modal |
| `apps/api/src/ops/ops.service.ts` | Additive `GET /ops/groups` projection |
| `apps/web/package.json` | `test:group-foundation` script |
| `docs/T001_03_COMPLETION.md` | This note |

## UI

- **Create:** Group Information / Package / Communication / Schedule sections; visa step includes HAJJ; WhatsApp UX for Hajj/Umrah.
- **Edit (Agent detail):** Group Foundation panel with gates checkboxes → `PATCH /groups/:id`.
- **Ops Group Master:** Nusuk, visa type, package, WhatsApp, uploaded by, readiness chips; Edit modal for staff.

## API / DB / RBAC

- API: only additive fields on existing `GET /ops/groups` mapper (no new endpoints).
- DB: none (T001-01/02 already shipped).
- RBAC: unchanged tenancy.

## Rollback

Redeploy prior web (and API if ops mapper rolled). UI ignores unknown fields if API is older.

## Manual verification

1. Agent → New Group → set Nusuk + WhatsApp → choose HAJJ → create.  
2. Open group → toggle Package Ready → Save → refresh shows gate.  
3. Create UMRAH without Nusuk still works.  
4. Ops → Group Master → see Nusuk/gates → Edit → flip Visa Ready.
