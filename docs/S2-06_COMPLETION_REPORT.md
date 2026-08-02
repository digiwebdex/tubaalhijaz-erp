# S2-06 Completion Report — OCR End-to-End Test Coverage

**Date:** 2026-07-31  
**Status:** Done  
**Gap closed:** G-10 (also covers backlog S2-09)

---

## Summary

Added stub-provider OCR e2e covering upload → storage → `tuba-ocr` → extract → review → approve/reject → audit, plus queue retry, failed recovery (`validation.lastError` + `POST …/reprocess`), duplicate passport detection, and tenant isolation. Providers and extraction/approve business rules were not redesigned — only a minimal failure surface was added for ops recovery.

---

## Files changed

| Path | Change |
|---|---|
| `apps/api/src/ocr/ocr.service.ts` | Persist `validation.lastError` on process failure (rethrow for BullMQ); `reprocess()` |
| `apps/api/src/ocr/ocr.controller.ts` | `POST /ocr/documents/:id/reprocess` (`REVIEW_OCR_QUEUE`) |
| `apps/api/test/ocr-pipeline.e2e-spec.ts` | **New** full pipeline e2e (stub Vision/Gemini) |
| `apps/api/test/ocr-rbac.e2e-spec.ts` | Gate covers reprocess |
| Docs | `SPRINT_BACKLOG`, `IMPLEMENTATION_ROADMAP`, `FEATURE_STATUS_MATRIX`, `PRODUCT_MASTER_SPEC`, `GAP_ANALYSIS`, this report |

---

## API changes

| Endpoint | Change |
|---|---|
| `POST /ocr/documents/:id/reprocess` | **New** — re-enqueue PENDING docs after failure |

No changes to create / list / get / override / approve / reject contracts.

---

## Queue changes

| Queue | Change |
|---|---|
| `tuba-ocr` | **Reused** — same job name, attempts (3), backoff; reprocess adds another `OCR_PROCESS` job |
| New queues | **None** |

---

## Tests

| Case | Result |
|---|---|
| Passport upload → process → approve → passenger + APPROVE audit | ✅ |
| Visa OCR (generic extractor) | ✅ |
| Invoice OCR (amount + documentNumber hints) | ✅ |
| Reject + REJECT audit | ✅ |
| Queue retry after transient provider failure | ✅ |
| `lastError` persist + reprocess recovery + PROCESS audit | ✅ |
| Duplicate passport across OCR docs | ✅ |
| Tenant isolation (agent A vs B) | ✅ |
| REVIEW_OCR_QUEUE (agent/finance 403; ops list) | ✅ (+ `ocr-rbac`) |

---

## Risks

| Risk | Mitigation |
|---|---|
| Stub e2e ≠ live Vision/Gemini quality | Production providers unchanged; e2e locks orchestration/RBAC |
| Concurrent retries + reprocess race | Reprocess only when PENDING; success overwrites validation |
| `lastError` only in JSON (no FAILED status) | Intentional — no enum/business-status redesign |

---

## Rollback

1. Revert OCR service/controller + e2e commits.  
2. Redeploy API.  
3. No DB migration — no schema rollback.  
4. In-flight PENDING docs with `lastError` remain readable; harmless if endpoint removed.

---

## Stop

S2-06 only. Remaining Sprint 2 items (staging verify, payment-slip validation, etc.) untouched.
