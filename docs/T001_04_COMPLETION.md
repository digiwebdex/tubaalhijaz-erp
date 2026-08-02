# T001-04 Completion — Mutamer Intake Preparation

**Task:** T001-04 (TRANSFORM-001)  
**Scope:** Passenger DB + API foundation for future Mutamer Excel (T001-05)  
**Date:** 2026-08-01

## Business Impact

**Before:** Passenger stored name/passport/nationality/gender/dob/phone/seat and operational status flags only. Business Excel columns (Main/Sub EA, biometric, MOFA, mutamer type, age, visa status wording) had nowhere to land. Bulk API accepted only the short legacy shape.

**After:** Same `Passenger` model (no duplicate customer entity) holds nullable Mutamer foundation fields. Create/bulk/PATCH accept and return them. Business visa labels map into existing `visaStatus` enum. Excel column contract metadata is documented in code for T001-05. Excel upload/OCR/notifications are **not** implemented here.

## Files

| Path | Change |
|------|--------|
| `apps/api/prisma/schema.prisma` | Mutamer columns on `Passenger` |
| `apps/api/prisma/migrations/20260801050000_passenger_mutamer_fields/` | Additive migration |
| `apps/api/src/groups/passengers.dto.ts` | Optional Mutamer fields |
| `apps/api/src/groups/passengers.service.ts` | Persist, map labels, audit |
| `apps/api/src/groups/passengers.controller.ts` | Pass `AuthUser` into update/delete |
| `apps/api/src/groups/mutamer-excel.contract.ts` | Column map + visa label helpers |
| `apps/api/test/passengers-mutamer.e2e-spec.ts` | E2E |
| `docs/T001_04_COMPLETION.md` | This note |

## API

- `POST /groups/:id/passengers` and `…/bulk` accept optional Mutamer fields.
- `PATCH /passengers/:id` updates them; `visaStatusLabel` maps to `visaStatus` when recognized.
- Legacy payloads without new keys still succeed.

## UI / RBAC / DB

- UI: none (T001-05).  
- RBAC: unchanged tenancy.  
- DB: additive nullable columns + indexes on `mofaNumber`, `subEaCode`.

## Rollback

Redeploy prior API; optionally drop the new columns. Or leave unused (clients omit fields).

## Manual verification

1. `POST` passenger with only legacy fields → 201, Mutamer cols null.  
2. `POST` with Main EA / Sub EA / MOFA / `visaStatusLabel: "Visa Not Issued"` → PENDING + label stored.  
3. `PATCH` `{ "visaStatusLabel": "Visa Issued" }` → APPROVED.  
4. Duplicate passport → 400.  
5. AuditLog CREATE/UPDATE under module `Passengers`.
