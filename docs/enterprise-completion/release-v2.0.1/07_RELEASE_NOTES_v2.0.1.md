# TUBA AL HIJAZ ERP — RELEASE NOTES v2.0.1
Release: Enterprise Completion. Theme: **billing correctness, unified accounting, auth self-service, security hardening.** No breaking API changes. All DB migrations additive/backward-compatible.

## New features
- **Configurable rate cards** for Transport, Visa, and Additional Services — effective-dated masters with currency, unit (per vehicle/seat/person/service/trip), and active flag. Managed at **`/rate-cards`** (SUPER_ADMIN). No prices are hardcoded.
- **Price snapshotting** — every booking stores its computed price (unit, subtotal, 15% VAT, total, source rate-card) **at creation time**, so changing a rate card later never alters historical bookings or invoices.
- **Staff price override** — users with financial-edit permission can override a booking's computed price; the original price, new price, user, and reason are written to the audit log.
- **Unified booking confirmation** — supplier-accept and staff-confirm now run one shared service with **identical accounting**: same wallet deduction, same ledger postings, same invoice, same audit, both emit `booking.confirmed`. Wallet-prepaid is the default; insufficient balance returns a clear business error instead of silently confirming. Architected so a future Net-30/Corporate-Credit policy slots in without changing confirmation logic.
- **Self-service password reset** — "Forgot password?" on the login screen → email reset link (30-min single-use token) → set a new password; all existing sessions are revoked on reset.
- **Website lead capture** — the public Contact form now records enquiries into a staff-visible inbox.

## Security & correctness fixes
- Ops write endpoints now require an explicit ops-management permission (were reachable with view-only permission).
- User-management hardened: non-super-admins can no longer create, elevate to, or modify SUPER_ADMIN accounts.
- Super-admin console data now gated to super-admins only.

## Database
- Two additive migrations: `add_password_reset_token`, `billing_rate_cards` (new tables + defaulted/nullable columns; no drops/renames; auto-applied on API boot).

## Upgrade notes
- Rate-card tables start **empty** — transport/visa/additional bookings remain unpriced until real rate cards are entered. Seed them right after deploy.
- Password-reset/notification **emails require `SMTP_*`** to be configured; without it the flow is stub-safe (token/link recorded, not emailed).
- No client action required for existing sessions except users who reset their password.

## Known items (see FINAL_GAP_REPORT.md)
- Future enhancements: route/per-seat transport pricing, hotel/catering rate-cards + override, multi-currency FX conversion, non-passport OCR parsers, Excel import UI, Net-30 policy.
- **Production go-live prerequisites (owner/ops):** close the two live-host exposures (public no-auth Redis/test-PG; UAT super-admin), verified off-box backups, monitoring alerts.
