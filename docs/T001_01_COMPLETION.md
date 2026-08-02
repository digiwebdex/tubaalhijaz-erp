# T001-01 Completion — Group Nusuk Identity & HAJJ

**Task:** T001-01 (TRANSFORM-001)  
**Scope:** DB + API only (UI is T001-03)  
**Date:** 2026-08-01

## Summary

Extended the existing Groups module with Nusuk Group Number spine fields, `HAJJ` visa type, optional Haji WhatsApp (enforced when `REQUIRE_HAJI_WHATSAPP` is enabled), consulate / services value / uploaded-by metadata, CREATE/UPDATE audit logs, and uniqueness on Nusuk number. Internal `Group.code` is unchanged. No architecture rewrite.

## Files

| Path | Change |
|------|--------|
| `apps/api/prisma/schema.prisma` | `VisaType.HAJJ`; Group Nusuk/WA/consulate/services/uploadedBy |
| `apps/api/prisma/migrations/20260801030000_group_nusuk_hajj/` | Additive migration |
| `apps/api/src/groups/groups.dto.ts` | New fields + `HAJJ` |
| `apps/api/src/groups/groups.service.ts` | Persist, validate, unique conflict, audit |
| `apps/api/src/groups/groups.controller.ts` | Include `uploadedByUser` on list/get |
| `apps/api/test/groups-nusuk.e2e-spec.ts` | E2E coverage |
| `apps/api/.env.example` | `REQUIRE_HAJI_WHATSAPP` note |

## API

- `POST /groups` / `PATCH /groups/:id` accept: `nusukGroupNumber`, `hajiWhatsapp`, `consulate`, `servicesValue`, `uploadedByUserId`, `uploadedByLabel`; `visaType` may be `HAJJ`.
- Duplicate Nusuk → **409 Conflict**.
- `GET /groups`, `GET /groups/:id` return new columns + `uploadedByUser`.

## RBAC / Tenancy

Unchanged model: agent scoped to own company; staff must pass `tenantId` on create; no new permission keys.

## Rollback

1. Redeploy prior API image.  
2. Optional reverse migration: drop FK/index/columns; enum value `HAJJ` is left in place (Postgres cannot easily remove enum values).  
3. Or stop writing new fields (clients omit them).

## Manual verification

1. `POST /groups` as agent with only `name`/`destination`/`visaType:UMRAH` → 201, `nusukGroupNumber` null.  
2. Create with `visaType:HAJJ` + Nusuk + WhatsApp → 201 + AuditLog CREATE.  
3. Second create with same Nusuk → 409.  
4. Set `REQUIRE_HAJI_WHATSAPP=true`, create HAJJ without WhatsApp → 400.
