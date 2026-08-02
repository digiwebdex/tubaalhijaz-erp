# T001-05 Completion — Enterprise Mutamer Excel Import Engine

**Task:** T001-05 (TRANSFORM-001)  
**Scope:** Controlled Mutamer Excel/CSV import (preview → confirm → transactional commit)  
**Date:** 2026-08-01  
**Stop:** Do **not** start T001-06 (OCR passport UX).

## 1. Business Impact

**Before:** Agents mapped CSV locally in the browser and posted `/passengers/bulk` with no server-side workbook contract, no duplicate-import fingerprint, and no confirm-before-write gate for Excel business columns.

**After:** Mutamer import is a controlled workflow: upload → validate workbook → business + duplicate checks → preview (no DB write) → explicit confirm → all-or-nothing transaction → audit + summary. Supports business Mutamer sheets and legacy 7-column templates. Max **1000** rows per import. No silent overwrite.

## 2. Files Changed

| Path | Change |
|------|--------|
| `apps/api/prisma/schema.prisma` | `MutamerImportRun` model + `Group.mutamerImportRuns` |
| `apps/api/prisma/migrations/20260801060000_mutamer_import_run/` | Additive migration |
| `apps/api/src/groups/mutamer-excel.contract.ts` | Header resolution, business/legacy mode, max rows |
| `apps/api/src/groups/mutamer-import.dto.ts` | Preview + commit DTOs |
| `apps/api/src/groups/mutamer-import.service.ts` | Import engine |
| `apps/api/src/groups/passengers.controller.ts` | `import/preview`, `import/commit` routes |
| `apps/api/src/groups/groups.module.ts` | Register `MutamerImportService` |
| `apps/api/src/setup-app.ts` | JSON body limit **15mb** for 1000-row payloads |
| `apps/api/package.json` | `exceljs` dependency |
| `apps/web/src/app/pages/AgentPortalGroups.tsx` | Existing import modal → preview/confirm UX |
| `apps/api/test/mutamer-import.e2e-spec.ts` | E2E suite |
| `docs/T001_05_COMPLETION.md` | This note |

## 3. Database Changes

New table `MutamerImportRun`:

- `groupId`, `tenantId`, `fileName`, `fileHash` (sha256)
- `rowCount`, `successCount`, `importedById`, `createdAt`
- `@@unique([groupId, fileHash])` — duplicate-import guard

No changes to `Passenger` columns (reuses T001-04 fields).

## 4. Migration

```bash
pnpm --filter @tuba/api exec prisma migrate deploy
# migration: 20260801060000_mutamer_import_run
```

## 5. API Changes

| Method | Path | Behavior |
|--------|------|----------|
| `POST` | `/groups/:groupId/passengers/import/preview` | Parse CSV/XLSX, validate, duplicates; **no writes** |
| `POST` | `/groups/:groupId/passengers/import/commit` | Requires `confirm: true`; transactional write |
| `POST` | `/groups/:groupId/passengers/bulk` | Unchanged (legacy JSON path) |

Preview body: `{ fileName, csvText? \| contentBase64?, format?: csv\|xlsx\|auto }`  
Commit body: `{ fileName, fileHash, confirm, force?, passengers[] }`

## 6. UI Changes

Reused existing Agent Portal **Import** modal (no second screen):

- Accepts `.xlsx` and `.csv`
- Calls preview API → shows valid / invalid / warnings / duplicates
- Confirm → commit API
- Business + legacy CSV template downloads
- Nothing written until confirm

## 7. Import Workflow

1. Upload Excel/CSV  
2. Validate workbook (headers + mode)  
3. Read rows (≤1000)  
4. Business validation (`mutamer-excel.contract.ts`)  
5. Duplicate detection  
6. Preview result (no DB)  
7. User confirmation (`confirm: true`)  
8. Import in `$transaction`  
9. AuditLog + `MutamerImportRun` + `group.import.completed` event  
10. Summary (`imported`, `failed: 0`)

## 8. Validation Rules

- Always required columns: Passenger/Mutamer Name, Passport, Nationality  
- Business mode (Main/Sub EA or Visa Status present): Main EA code, Sub EA code, Visa Status/Type  
- Legacy mode: Gender required  
- Business gender blank → default MALE + warning  
- Age, dates, capacity checks  
- Group taken from URL `groupId` (not Excel)

## 9. Duplicate Rules

| Code | Meaning |
|------|---------|
| `DUP_PASSPORT_FILE` | Same passport twice in file |
| `DUP_MOFA_FILE` / `DUP_MOFA_DB` | MOFA clash |
| `DUP_VISA_FILE` / `DUP_VISA_DB` | Visa number clash |
| `DUP_EXCEL_ROW` | Identical row fingerprint |
| `DUP_PASSPORT_GROUP` / `DUP_PASSPORT_TENANT` | Already registered |
| `DUPLICATE_IMPORT` | Same `fileHash` already imported into group |

Do **not** silently overwrite. `force: true` on commit is the only override for same file hash.

## 10. Audit

On successful commit, `AuditLog`:

- `module: Passengers`, `action: CREATE`, `entityType: MutamerImport`
- After payload: importer email, time, file, hash, group, row/success/failed counts

## 11. RBAC

Reuses existing passenger/group tenancy (`prisma.scoped` + company check). No new permission keys. Cross-tenant preview → 404.

## 12. Tests

`apps/api/test/mutamer-import.e2e-spec.ts` (11):

- Validation (no write)  
- Duplicate passport/MOFA/visa/row  
- Preview → confirm → audit  
- Duplicate import blocked  
- Duplicate in group blocked  
- Rollback (code collision → no partial write)  
- **1000-row** import success  
- Legacy CSV + bulk regression  
- Tenant isolation  

## 13. Performance

- 1000-row CSV preview+commit verified in e2e (~0.4s commit path in test env)  
- JSON body limit raised to 15mb  
- `createMany` inside one transaction

## 14. Risks

- Very wide XLSX with formulas may stringify oddly (handled via ExcelJS cell value unwrap)  
- `force` re-import can re-insert if passports were deleted but hash retained — still re-checks live passport clashes  
- Commit trusts client-supplied `passengers` from preview but **re-validates** duplicates/capacity server-side

## 15. Manual Verification

1. Agent Portal → group → Import → upload business CSV → preview counts → Confirm  
2. Re-upload same file → blocked as duplicate import  
3. Upload file with duplicate passport → cannot commit  
4. Legacy template still imports  
5. Check AuditLog for `MutamerImport`  
6. Confirm `MutamerImportRun` row exists for file hash  

## 16. Rollback

1. Redeploy prior API/web  
2. Optionally: `DROP TABLE "MutamerImportRun";` and remove migration entry  
3. Or leave table unused (clients stop calling import routes)

## Out of scope (T001-06+)

- Passport OCR UX  
- Nusuk group-list OCR  
- New Passenger/Customer/Upload/OCR modules  
- Parallel import screens  
