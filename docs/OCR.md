# OCR — permission model & review gate (S1-01)

## Purpose

Document how OCR authorization works after Sprint 1 ticket **S1-01**. Workflow (upload → queue → extract → human review) is unchanged; only the **review** surface is permission-gated.

## Permission

| Key | Seed holders | Purpose |
|---|---|---|
| `REVIEW_OCR_QUEUE` | `SUPER_ADMIN`, `OPS_STAFF` | List review queue; override fields; approve; reject |

Checked by the existing global `PermissionsGuard` + `@RequirePermissions` — no parallel auth system.

## Route matrix

| Action | Route | Gate |
|---|---|---|
| Submit / enqueue | `POST /ocr/documents` | JWT (agents may submit) |
| Poll one document | `GET /ocr/documents/:id` | JWT + tenant scope |
| Review queue list | `GET /ocr/documents` | `REVIEW_OCR_QUEUE` |
| Override fields | `POST /ocr/documents/:id/override` | `REVIEW_OCR_QUEUE` + AuditLog `UPDATE` |
| Approve | `POST /ocr/documents/:id/approve` | `REVIEW_OCR_QUEUE` + AuditLog `APPROVE` |
| Reject | `POST /ocr/documents/:id/reject` | `REVIEW_OCR_QUEUE` + AuditLog `REJECT` |

## Implementation touchpoints

- `apps/api/src/ocr/ocr.controller.ts` — decorators  
- `apps/api/src/ocr/ocr.service.ts` — audit writes on review mutations  
- Seed: `Permission` + `RolePermission` (already present; no migration)  
- Tests: `apps/api/test/ocr-rbac.e2e-spec.ts`, OCR row in `rbac.e2e-spec.ts`

## Out of scope (later tickets)

- Frontend nav/RBAC for OCR Center (S1-05)  
- Full OCR happy-path e2e with stub provider (S2-09)  
- `autoAccept` policy (Sprint 3)
