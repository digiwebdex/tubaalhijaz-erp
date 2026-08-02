# UAT Bug Register — TUBA AL HIJAZ ERP

**Sprint:** ESP-05  
**Environment:** _______________  
**Register owner (IT):** _______________  
**Opened:** _______________ **Frozen for Go-Live decision:** _______________

Related: [`UAT_TEST_CASES.md`](./UAT_TEST_CASES.md) · [`GO_LIVE_READINESS.md`](./GO_LIVE_READINESS.md)

---

## Severity definitions

| Severity | Definition | Go-Live impact |
|----------|------------|----------------|
| **Critical** | Blocks core business journey; data loss; security/tenancy breach; cannot login or process visa/group intake | **Must be 0** open |
| **High** | Major feature broken with no practical workaround for that department | **Must be 0** open |
| **Medium** | Impaired workflow; workaround exists; wrong label/UI only if it causes ops error risk | May **accept** with owner + target date |
| **Low** | Cosmetic, copy, minor UX; no business outcome risk | **Document** only |

---

## Status codes

`Open` · `Accepted` (Medium) · `Documented` (Low) · `Fixed` · `Retest PASS` · `Won't fix` · `Duplicate`

---

## Register

| Bug ID | Test ID | Title | Severity | Module | Status | Owner | Found | Target | Resolution / notes |
|--------|---------|-------|----------|--------|--------|-------|-------|--------|--------------------|
| BUG-001 | | | | | | | | | |
| BUG-002 | | | | | | | | | |
| BUG-003 | | | | | | | | | |
| BUG-004 | | | | | | | | | |
| BUG-005 | | | | | | | | | |
| BUG-006 | | | | | | | | | |
| BUG-007 | | | | | | | | | |
| BUG-008 | | | | | | | | | |
| BUG-009 | | | | | | | | | |
| BUG-010 | | | | | | | | | |

_Add rows as needed. Do not delete historical IDs — mark Duplicate/Won't fix._

---

## Detail template (copy per bug)

### BUG-___

| Field | Value |
|-------|-------|
| Test ID | |
| Title | |
| Severity | Critical / High / Medium / Low |
| Module | Agent / Ops / Visa / LS / Finance / CEO / Auth / Other |
| Steps to reproduce | |
| Expected | |
| Actual | |
| Screenshot / log ref | |
| Workaround | |
| Status | |
| Owner | |
| Linked commit / ticket | _(filled only when a later sprint fixes — not in ESP-05)_ |

---

## Totals (update at freeze)

| Severity | Open | Accepted | Documented | Fixed / Retest PASS |
|----------|-----:|---------:|-----------:|--------------------:|
| Critical | 0 | — | — | |
| High | 0 | — | — | |
| Medium | | | — | |
| Low | | — | | |
| **Total** | | | | |

**Go-Live gate from this register:** Critical open = 0 **and** High open = 0.

---

## Known accepted risks (pre-UAT — not bugs unless reproduced as defects)

Carry from `docs/releases/TRANSFORM_002_RELEASE_CERTIFICATION.md` / ESP-04 — do **not** re-file as Critical unless UAT proves a regression:

| Risk | Notes |
|------|-------|
| No live government visa API | Staff / Umrah Co updates only |
| MOFA Bill / Passport-Return flag defaults | Record flag in checklist |
| WhatsApp skip-safe | Channel may skip; still PASS if in-app/email policy OK |
| Thin production operational data | May need seeded UAT data |
| UI-12 legacy chrome on Fleet/OCR/Automation/Supplier | Cosmetic unless blocks journey |
| ESP-04 refresh cookie Path | Confirm deploy before blaming session bugs |
