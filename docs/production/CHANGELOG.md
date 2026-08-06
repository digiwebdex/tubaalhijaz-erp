# CHANGELOG — TUBA AL HIJAZ ERP
Format: Keep a Changelog style. Semantic-ish: v2.0.x = patch/security, v2.1 = features, v3 = breaking.

## [Unreleased — v2.0.1 patch line]
- **v2.0.1-p1** (DEPLOYED 2026-08-04, web-only): Fix group-detail tabs keeping the Foundation panel visible under Flights/other tabs; Foundation is now a proper tab. UI-only. See PATCH_HISTORY.

## [2.0.1] — 2026-08-04
### Added
- Configurable, effective-dated **rate cards** (Transport / Visa / Additional) with admin UI at `/rate-cards`.
- **Price snapshotting** on every booking at creation (unit, subtotal, 15% VAT, total, source rate-card) — historical bookings immutable to later rate changes.
- **Staff price override** with full audit (original, new, user, reason).
- **Unified booking confirmation** — supplier-accept and staff-confirm share one service with identical accounting (wallet deduction, ledger, invoice, audit, `booking.confirmed` event); wallet-prepaid default; insufficient balance returns a clear business error.
- **Self-service password reset** (email link, 30-min single-use token, session revocation on reset).
- **Website lead capture** into a staff-visible enquiries inbox.
### Security
- Ops write endpoints now require an explicit ops-management permission.
- Non-super-admins can no longer create, elevate to, or modify SUPER_ADMIN accounts.
- Super-admin console data gated to super-admins only.
### Database
- Migrations `20260803195529_add_password_reset_token`, `20260803211614_billing_rate_cards` (additive; auto-applied on API boot).
### Notes
- Rate-card tables ship empty — seed real cards post-deploy or transport/visa/additional stay unpriced.
- Reset/notification emails require `SMTP_*`; stub-safe without.
