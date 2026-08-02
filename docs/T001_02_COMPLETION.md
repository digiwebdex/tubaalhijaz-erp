# T001-02 Completion — Readiness Gates + PACKAGE Gate

**Task:** T001-02 (TRANSFORM-001)  
**Scope:** DB + API only (UI is T001-03)  
**Date:** 2026-08-01

## Summary

Extended the existing `Group` model and Groups API with four independent readiness booleans — `gateVisa`, `gatePackage`, `gatePayment`, `gateBill` — defaulting to `false`. `packageType` remains a separate field. Gate flips emit `group.gates.changed` for later notification wiring (T001-08). No architecture rewrite; WorkflowStage unchanged.

## Files

| Path | Change |
|------|--------|
| `apps/api/prisma/schema.prisma` | Four gate booleans on `Group` |
| `apps/api/prisma/migrations/20260801040000_group_readiness_gates/` | Additive migration |
| `apps/api/src/groups/groups.dto.ts` | Optional gate fields on create/update |
| `apps/api/src/groups/groups.service.ts` | Persist, audit, emit on change |
| `apps/api/src/automation/events.ts` | `GROUP_GATES_CHANGED` |
| `apps/api/test/groups-readiness-gates.e2e-spec.ts` | E2E coverage |
| `docs/T001_02_COMPLETION.md` | This note |

## API

- `POST /groups` / `PATCH /groups/:id` accept optional `gateVisa|gatePackage|gatePayment|gateBill` (boolean).
- `GET /groups`, `GET /groups/:id` return the four gates (defaults `false`).
- Changing any gate emits `group.gates.changed` (no notification rules required yet).

## RBAC / Tenancy

Unchanged: agents scoped to own groups; staff can PATCH any visible group.

## Rollback

1. Redeploy prior API image.  
2. Optional reverse migration: `ALTER TABLE "Group" DROP COLUMN "gateVisa"` (and the other three).  
3. Or leave columns unused (clients omit them; defaults false).

## Manual verification

1. `POST /groups` without gates → all four `false`.  
2. `PATCH` `{ "gateVisa": true, "gatePackage": true }` → persisted; `packageType` unchanged.  
3. AuditLog UPDATE includes gate before/after.  
4. Other-tenant agent PATCH → 404.
