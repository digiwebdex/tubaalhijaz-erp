# 02 · DATABASE MIGRATION PLAN — v2.0.1
Postgres 16 (container `tuba-alhijaz-postgres-1`, internal-only). Migrations apply **automatically on API container boot** (`Dockerfile.api` CMD: `prisma migrate deploy && node dist/main.js`) — `migrate deploy` is idempotent and forward-only.

## New migrations in v2.0.1 (2 — both ADDITIVE & backward-compatible)
| Migration | Effect | Risk |
|---|---|---|
| `20260803195529_add_password_reset_token` | CREATE TABLE `PasswordResetToken` (+ index). | None (new table). |
| `20260803211614_billing_rate_cards` | CREATE enums `RateUnit`,`TripType`,`VisaProcessingType`; CREATE tables `TransportRate`,`VisaRate`,`AdditionalServiceRate`; ADD `currency TEXT NOT NULL DEFAULT 'SAR'` to Hotel/Catering/Transport/Visa/Additional; ADD nullable price-snapshot columns (`unitPrice, subtotal, vatAmount, totalAmount, rateCardId, priceOverridden, priceOverrideReason`) to Transport/Visa/Additional. | Low — new tables + nullable / defaulted columns only. No data rewrite, no column drops/renames. |

**Backward compatibility:** every change is additive. The *previous* API image runs fine against the new schema (Prisma selects named columns; the `currency` default fills on insert). This is what makes rollback safe (see 03).

## Pre-migration
1. **Backup (mandatory):**
   ```bash
   systemctl start tuba-backup.service && tail -1 /var/log/tuba-backup.log
   ls -lh /var/backups/tuba | tail -2
   ```
2. Confirm current applied migrations (optional):
   ```bash
   docker exec tuba-alhijaz-postgres-1 psql -U tuba -d tubaalhijaz -t -A -c \
     "SELECT migration_name FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 3;"
   ```
   Expected latest before v2.0.1: `20260801170000_longstay_day85`.

## Execution
No manual step — migrations run when the new API container boots (Runbook §5). To pre-apply manually instead:
```bash
docker compose -f docker-compose.prod.yml run --rm api pnpm exec prisma migrate deploy
```

## Post-migration verification
```bash
docker exec tuba-alhijaz-postgres-1 psql -U tuba -d tubaalhijaz -t -A -c \
  "SELECT to_regclass('public.\"PasswordResetToken\"'), to_regclass('public.\"TransportRate\"'), to_regclass('public.\"VisaRate\"'), to_regclass('public.\"AdditionalServiceRate\"');"
docker exec tuba-alhijaz-postgres-1 psql -U tuba -d tubaalhijaz -t -A -c \
  "SELECT count(*) FROM information_schema.columns WHERE table_name='TransportBooking' AND column_name IN ('currency','unitPrice','rateCardId');"   -- expect 3
# accounting invariant sanity:
docker exec tuba-alhijaz-postgres-1 psql -U tuba -d tubaalhijaz -t -A -c \
  "SELECT (coalesce(sum(debit),0)=coalesce(sum(credit),0)) FROM \"LedgerEntry\" WHERE \"accountId\" IS NOT NULL;"   -- expect t
```
