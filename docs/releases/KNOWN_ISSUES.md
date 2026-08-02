# Known Issues — TUBA AL HIJAZ ERP v2.0.0

**As of:** 2026-08-02 · tag `v2.0.0`  
**Rule:** Document only — no inventing defects. Sourced from ESP-04/05/06 and release verification.

Severity: **Critical** · **High** · **Medium** · **Low** · **Accepted**

---

## Open / conditional (process & DR)

| ID | Severity | Issue | Status |
|----|----------|-------|--------|
| KI-01 | High (process) | Human UAT not executed/frozen; `docs/uat/UAT_SIGNOFF.md` unsigned | Open — execute ESP-05 pack |
| KI-02 | High (process) | TRANSFORM-001/002 business sign-off signatures pending | Open — department forms |
| KI-03 | High (DR) | Offsite backup (`OFFSITE_*`) disabled — on-box + MinIO only | Accepted until configured |
| KI-04 | Medium (DR) | Destructive production restore drill not run (scratch restore OK) | Deferred ≤30 days |
| KI-05 | Medium | Host swap = 0B — OOM risk under memory spike | Accepted / improve |
| KI-06 | Low | e2e containers (`tuba-e2e-pg` / `tuba-e2e-redis`) may remain Up | Cleanup when idle |
| KI-07 | Low | Docker image/build cache disk use elevated | Periodic prune |
| KI-08 | Low | Web image tag lags API ESP-06 tag (`stable-20260731` vs `esp06-20260802`) | Rebuild web when shipping next UI/bundle drop |

---

## Accepted product limitations

| ID | Severity | Issue | Notes |
|----|----------|-------|-------|
| KI-10 | Accepted | No live MOFA / Nusuk / Absher government API | Staff / Umrah Co updates only |
| KI-11 | Accepted | MOFA Bill / Passport-Return / Group-list OCR behind flags (default off) | SOP-gated |
| KI-12 | Accepted | UI-12 conditional — Fleet / OCR / Automation / Supplier / some Finance secondary still legacy chrome | Not journey-blocking by default |
| KI-13 | Accepted | WhatsApp may skip-safe on host | In-app/email fallback |
| KI-14 | Accepted | Thin production operational data | Early ops |
| KI-15 | Accepted | `API_KEY_ACCESS` seeded unused | No API-key product |
| KI-16 | Accepted | Access JWT in `sessionStorage` (XSS window ≤ TTL) | Refresh remains httpOnly |
| KI-17 | Accepted | No ClamAV — magic-byte upload scan only | Documented non-goal |
| KI-18 | Accepted | Schema migrations forward-only | Restore dump if reverse needed |

---

## Resolved in v2.0.0 line (do not re-open without regression)

| ID | Issue | Resolution |
|----|-------|------------|
| was F1 | Refresh cookie Path `/auth` vs browser `/api/auth` | `REFRESH_COOKIE_PATH` + API `esp06-20260802` |
| was F2 | OCR foreign file IDOR | Ownership check on create |
| was F3 | SVG inline disposition | `attachment` for SVG |
| was F4 | Prod `JWT_SECRET=dev-secret` | Boot refuse in production |

---

## Reporting new issues

Use [`docs/uat/UAT_BUG_REGISTER.md`](../uat/UAT_BUG_REGISTER.md) during UAT, or IT incident process per [`OPERATIONS_RUNBOOK.md`](./OPERATIONS_RUNBOOK.md).
