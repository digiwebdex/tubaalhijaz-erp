# KNOWN ISSUES — TUBA AL HIJAZ ERP v2.0.1
Open items that support may encounter. None are v2.0.1 defects; classification per FINAL_GAP_REPORT. Feature-shaped items belong to v2.1.

## Operational prerequisites (verify these are handled in prod)
| ID | Item | Impact | Disposition |
|---|---|---|---|
| P-01 | Public no-auth Redis / test Postgres containers (`tuba-e2e-*`), firewall off | **Security — go-live blocker** | Must be closed on the live host (remove containers, `ufw enable`). |
| P-02 | Temporary UAT SUPER_ADMIN in prod DB (published password) | **Security — go-live blocker** | Disable/rotate on live DB. |
| OPS-SMTP | `SMTP_*` unset → reset/notification emails not delivered (recorded, not sent) | Users can't receive reset emails | Configure SMTP, or handle resets manually. |
| OPS-RATES | Rate-card tables empty → transport/visa/additional bookings unpriced | Bookings created without price | Seed real rate cards via `/rate-cards`. |

## Deferred behaviors (by design — v2.1 backlog, not bugs)
- OCR: only the **passport** parser is real; other document types not auto-extracted → use manual entry.
- No **Excel import UI** for passengers (import API exists; UI deferred).
- Transport pricing supports per-vehicle/per-trip; **route/per-seat** granularity deferred.
- **Hotel/Catering** not yet on rate-cards/override (transport/visa/additional only).
- **Multi-currency**: currency stored per booking; **FX conversion** not applied.
- **Net-30 / Corporate Credit** not enabled (wallet-prepaid only); architecture reserves the slot.

## Awaiting business decision (see FINAL_GAP_REPORT Category 3)
- Visa VAT treatment; whether hotel/catering adopt rate-cards; Net-30 terms; per-seat pricing policy; acceptable stale-token window.

---
## Remediation log — 2026-08-04 (Release Execution Phase 1)
- **P-01 CLOSED** — removed standalone test containers `tuba-e2e-redis` (0.0.0.0:56379) + `tuba-e2e-pg` (0.0.0.0:55432); no datastore ports publicly bound. See PRODUCTION_VERIFICATION_REPORT.md.
- **P-02 CLOSED** — 4 `uat.*` accounts set INACTIVE (incl. uat.admin Super Admin); reals untouched.
- **OPS-UFW (new, Warning)** — host firewall still inactive; no sensitive ports exposed, enable ufw (allow 22/80/443) as defense-in-depth. NB: UFW does not filter Docker-published ports — use DOCKER-USER for container ports.

---
## Deploy v2.0.1 (2026-08-04) — post-deploy findings
- **DATA-LEDGER-1 (Low, pre-existing, NOT a deploy defect)** — `LedgerEntry` has 1 orphan row (debit 50000, credit 0, no accountId) predating v2.0.1; GL SUM(debit)≠SUM(credit) solely because of it. Deploy wrote nothing to the ledger. Action: clean up the stray row (owner/finance) — separate from the release.
- **OPS-SMTP / OPS-UFW / OFFSITE** — still open per prior notes (email delivery, host firewall, backup offsite).
- Authenticated feature verification: pending owner execution via POST_DEPLOYMENT_VERIFICATION_EXECUTION.md.
