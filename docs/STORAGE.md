# TUBA AL HIJAZ — File Storage & Document Vault (Phase 13)

Finalizes the object storage the earlier phases stubbed. Backend: `apps/api/src/storage/`,
`apps/api/src/uploads/`, `apps/api/src/documents/`.

## MinIO (S3-compatible)
- **Dev:** a local MinIO server (`127.0.0.1:9000`, console `:9001`, bucket `tuba-docs`). Binary at
  `C:\Users\DBL\minio\minio.exe` (+ `mc.exe`), data under `C:\Users\DBL\minio\data`. Start:
  `MINIO_ROOT_USER=minioadmin MINIO_ROOT_PASSWORD=minioadmin minio.exe server ./data --address 127.0.0.1:9000 --console-address 127.0.0.1:9001`.
  **Production MinIO is provisioned on the VPS in Phase 17.**
- `StorageService` picks the driver from env: **`MinioDriver`** when `MINIO_ENDPOINT` is set, else a
  local-disk fallback (CI/e2e without MinIO — so nothing breaks without it). `onModuleInit` ensures the
  bucket exists. Config: `MINIO_ENDPOINT/PORT/USE_SSL/ACCESS_KEY/SECRET_KEY`, `STORAGE_BUCKET`
  (gitignored `.env`; template in `.env.notifications.example` sibling values).
- Every upload flow from Phases 4–11 (registration wizard docs, vouchers, invoices, QR, backups)
  now persists to real MinIO with **no call-site change** — they all go through `StorageService.store`.

## Uploads — `/uploads`
- `POST /uploads` (multipart, public — wizard is pre-auth): size + mime allow-list **+ magic-byte
  content scan** (`validateUpload`) before accepting. Streams to MinIO.
- **Presigned direct browser→MinIO upload** (large files — office photos/scans, keeps big payloads
  off the API): `POST /uploads/presign {fileName, mimeType, kind}` → a PUT URL the browser uploads
  to directly + a pending `UploadedFile` id; then `POST /uploads/:id/confirm` verifies the object,
  scans its first bytes, and finalizes (size, `scanStatus: CLEAN`).
- `GET /uploads/:id/file` streams the object back (auth-scoped: tenants get their own, staff any).

## Content scanning (`storage/file-type.ts`)
Basic virus/type scanning = **magic-number validation**: the real leading bytes must match a recognized,
allow-listed type (PDF/JPEG/PNG/WEBP/TIFF/SVG) AND agree with the declared Content-Type. A file
claiming `image/png` but containing anything else is **rejected**. `scanBuffer` is the hook a real
ClamAV integration plugs into later; today the content check is the enforcement.

## Document Vault — `/documents`
Real query over all uploaded documents. Documents are **versioned by (companyId, kind)**: a new
upload of the same type **supersedes** the previous (prev `isLatest=false`) — it never overwrites, and
history is preserved.
- `GET /documents?kind=&expiringDays=` → latest version of each type (auto-scoped to the caller's
  company for tenants; staff see all / filter by `companyId`), with `version`/`versionCount`,
  `scanStatus`, and **expiry tracking** (`expiryDate` → `daysLeft` + `severity` EXPIRED/CRITICAL/
  WARNING/OK).
- `GET /documents/versions?kind=` → the full version chain, newest first.
- `POST /documents` (multipart: `file`, `kind`, `expiryDate?`) → stores a new version (validates,
  uploads to MinIO, marks the prior latest superseded — one transaction).
Schema: `UploadedFile` gained `version`, `isLatest`, `supersedesId` (self-relation), `expiryDate`,
`scanStatus` (migration `20260718200000`).

Surfaces: Agent Portal "Documents Vault" (own company) + Super Admin document review (all tenants).

## Tests — `documents.e2e-spec.ts` (6, against real MinIO)
Backend is MinIO; a multipart upload persists and round-trips byte-for-byte from the bucket;
content-type-spoofed + disallowed files are rejected; presigned direct upload + confirm; and a
second upload of a type creates version 2 (supersedes v1, v1 kept) with expiry + history. `mc ls`
confirms objects physically land in `tuba-docs`.

## Repo hygiene note
`apps/api/.gitignore` had an unanchored `uploads/` (for the local-disk output dir) that was **also
ignoring the `src/uploads/` module source** — so the uploads module had been untracked since Phase 4.
Fixed to `/uploads/` (anchored to the api root) and the module is now committed.
