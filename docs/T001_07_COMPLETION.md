# T001-07 Completion — OCR Nusuk Group-List → Group

**Task:** T001-07 (TRANSFORM-001)  
**Date:** 2026-08-01  
**Stop:** Do **not** start T001-08.

## Business Workflow

| | |
|--|--|
| **Business Owner** | Ops / OCR staff (`REVIEW_OCR_QUEUE`); Agent may submit image |
| **Trigger** | Upload Nusuk Groups List image with type `NUSUK_GROUP_LIST` when `ENABLE_NUSUK_GROUP_LIST_OCR=true` |
| **Input** | Groups List image/PDF via existing Uploads → `POST /ocr/documents` |
| **Processing** | Queue → extract (parser + Gemini JSON branch) → human review → approve |
| **Output** | Group created or updated with unique `nusukGroupNumber`; `OcrDocument.groupId` linked; AuditLog |
| **Next Department** | Mutamer Excel / Passport OCR into that Group (T001-05/06) |

## T001-07 Scope (from Transformation document)

> OCR Nusuk Group-List type + parser + approve→Group  
> Modify: schema OcrDocumentType; ocr.dto; parsers; gemini prompt branch; ocr.service approve; OCR Center mode  
> Change: Type `NUSUK_GROUP_LIST`; extract group number/name/consulate/pax/agent code/dates; on approve create/update Group via GroupsService using Nusuk uniqueness; link ocr.groupId  
> Feature flag recommended; flag off: type rejected/hidden; passport path unchanged

## Reuse Declaration

| | |
|--|--|
| **Reused** | OCR queue/processor/review/reprocess, Uploads/MinIO, GroupsService, RBAC `REVIEW_OCR_QUEUE`, AuditLog, Vision/Gemini providers, OCR Center |
| **Extended** | `OcrDocumentType`, parsers, gemini.client, ocr.service approve/create, OCR Center mode switch |
| **New modules** | **NONE** |

## Business Impact

**Before:** OCR approve only created Passengers; Nusuk group-list images had no type/parser/commit-to-Group path.  
**After (flag on):** Group List scan → review → approve opens or updates a Group by Nusuk number (duplicates blocked / update path). Flag off: type rejected and UI mode hidden. Passport OCR unchanged.

## Files / DB / Migration

| Item | Detail |
|------|--------|
| Migration | `20260801080000_ocr_nusuk_group_list` — `OcrDocumentType.NUSUK_GROUP_LIST` |
| Flag | `ENABLE_NUSUK_GROUP_LIST_OCR` (default off) |
| API | `GET /ocr/capabilities`; create/approve gate; approve→GroupsService |
| UI | OCR Center Passport \| Group List mode (when enabled) |

## API / UI / RBAC / Audit

- No parallel OCR API — same `/ocr/documents*` flow  
- RBAC unchanged (`REVIEW_OCR_QUEUE` for approve)  
- Audit APPROVE includes `mode` create\|update, `nusukGroupNumber`, `groupId`

## Tests

- Unit: `parsers.nusuk.spec.ts`  
- E2E: `ocr-nusuk-group-list.e2e-spec.ts` (flag off reject, create Group, update duplicate Nusuk, passport regression)  
- Regression: existing `ocr-pipeline` / `ocr-intake` / `ocr-rbac`

## Risks

- Create defaults `visaType=UMRAH`, `destination=MAKKAH_MADINAH` when not on image  
- If `REQUIRE_HAJI_WHATSAPP=true`, create may require WhatsApp (patch Group after, or disable that flag for OCR create)  
- OCR accuracy of Nusuk number — human review mandatory  

## Manual Verification

1. Set `ENABLE_NUSUK_GROUP_LIST_OCR=true`, restart API  
2. OCR Center shows Group List mode → scan → approve → Group with Nusuk number  
3. Re-scan same Nusuk → updates same Group  
4. Flag off → create rejected; mode hidden  
5. Passport scan still creates Mutamer  

## Rollback

Set `ENABLE_NUSUK_GROUP_LIST_OCR=false` (or unset). Enum value can remain. Redeploy prior UI if needed.
