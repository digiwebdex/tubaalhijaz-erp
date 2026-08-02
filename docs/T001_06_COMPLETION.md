# T001-06 Completion — Passport & OCR Intake Integration

**Task:** T001-06 (TRANSFORM-001)  
**Scope:** Integrate existing OCR into Customer Intake (Passport → Mutamer)  
**Date:** 2026-08-01  
**Stop:** Do **not** start T001-07 (Nusuk group-list OCR).

## Reuse Declaration

| Category | Items |
|----------|--------|
| **Modules reused** | OCR (`apps/api/src/ocr/*`), OCR queue/processor, OCR Center UI, Uploads/MinIO, Passengers, Groups, AuditLog, Notifications/events (`passenger.ocr.completed`), RBAC `REVIEW_OCR_QUEUE`, Vision/Gemini providers, parsers/MRZ |
| **Modules extended** | `ocr.service` / `ocr.dto` / `ocr.controller` (approve attach + messaging), `OCRCenter.tsx`, `AgentPortalGroups.tsx`, `UploadKind` enum |
| **New modules** | **NONE** |

## Business Impact

**Before**  
Passport OCR could submit without a clear Group contract in UX; approve created a Passenger but duplicate Excel Mutamers hit a hard create failure with little guidance; uploads with `kind=PASSPORT` fell back to `OTHER`; Agent Portal still carried “OCR coming soon” dead UI; intake status (OCR linked) was invisible on the Mutamer list.

**After**  
Passport OCR is an intake rail into the same Group/Mutamer spine: Group required on approve; create Mutamer **or** attach OCR to an existing Mutamer (Excel twin); Group + Passenger links auditable; OCR readiness badge on Agent Portal passenger list; OCR Center copy states “Passport → Mutamer (requires Group)”. No new OCR engine, provider, or parallel API.

## Files Changed

| Path | Change |
|------|--------|
| `apps/api/prisma/schema.prisma` | `UploadKind.PASSPORT` |
| `apps/api/prisma/migrations/20260801070000_upload_kind_passport/` | Additive enum value |
| `apps/api/src/ocr/ocr.dto.ts` | `ApproveOcrDto.passengerId` |
| `apps/api/src/ocr/ocr.service.ts` | Group validate; approve create/attach; get/list group+passenger; audit; age from DOB |
| `apps/api/src/ocr/ocr.controller.ts` | Comment clarity |
| `apps/web/src/app/pages/OCRCenter.tsx` | Intake copy, Group column, attach action |
| `apps/web/src/app/pages/AgentPortalGroups.tsx` | OCR badge; remove coming-soon; menu copy |
| `apps/api/test/ocr-intake.e2e-spec.ts` | E2E suite |
| `docs/T001_06_COMPLETION.md` | This note |

## Database / Migration

- Additive only: `ALTER TYPE "UploadKind" ADD VALUE IF NOT EXISTS 'PASSPORT'`
- No new tables; reuses `OcrDocument.groupId`, `Passenger.ocrDocumentId`

```bash
pnpm --filter @tuba/api exec prisma migrate deploy
# 20260801070000_upload_kind_passport
```

## API Changes (extend existing)

| Endpoint | Change |
|----------|--------|
| `POST /uploads?kind=PASSPORT` | Stores `UploadKind.PASSPORT` |
| `POST /ocr/documents` | Validates `groupId` tenancy; CREATE audit; returns `groupId` |
| `GET /ocr/documents` | Includes `group {id,code,name}`, `_count.passengers` |
| `GET /ocr/documents/:id` | Includes `group`, `passengers[]` |
| `POST /ocr/documents/:id/approve` | PASSPORT requires Group; `passengerId` → attach mode; clearer errors; richer audit |

No new OCR routes. Excel import unchanged (T001-05).

## UI Changes

- OCR Center: “Passport → Mutamer (requires Group)”; Group column; Attach vs Create
- Agent Portal Groups: Passport OCR → Mutamer (bound to current group); OCR badge on rows
- Removed unused “Passport OCR coming soon” modal

## RBAC

- Unchanged: `REVIEW_OCR_QUEUE` for override/approve/reject/list/reprocess
- Agents still submit + poll; tenancy via `prisma.scoped`

## Audit

- CREATE on OCR submit (intake metadata)
- APPROVE with `mode` (`create`\|`attach`), `groupId`, `groupCode`, `passengerId`
- Passenger UPDATE on attach (`ocr_attach`)
- Existing REJECT / OVERRIDE retained

## Tests

`apps/api/test/ocr-intake.e2e-spec.ts`:

- Upload kind PASSPORT  
- Approve without group → clear error  
- Approve with group → Mutamer + link + audit  
- Attach to existing Mutamer (no overwrite of Excel fields)  
- Tenancy (foreign group → 404)  
- REVIEW_OCR_QUEUE regression  
- Review queue group attachment  

Also re-run `ocr-pipeline` / `ocr-rbac` for regression.

## Risks

- Attach requires exact passport match — intentional (no silent overwrite)  
- Duplicate create blocked when `duplicateOfPassengerId` set — ops must use Attach  
- Nusuk group-list OCR is **T001-07**, not this task  

## Manual Verification

1. Agent Portal → group → Passport OCR → upload → ops approve with group → Mutamer appears with OCR badge  
2. Import Mutamer via Excel → OCR same passport → Attach (not Create)  
3. Approve passport without group → error mentions Mutamer/Group  
4. Agent without `REVIEW_OCR_QUEUE` cannot approve  
5. AuditLog shows APPROVE with mode/group  

## Rollback

1. Redeploy prior API/web  
2. Enum value `PASSPORT` can remain (harmless)  
3. Clients omit `passengerId` → prior create-only approve behaviour (minus clearer duplicate error)  

## Out of scope (T001-07+)

- `NUSUK_GROUP_LIST` type / approve → Group  
- New OCR providers or prompt redesign  
- Excel engine changes  
