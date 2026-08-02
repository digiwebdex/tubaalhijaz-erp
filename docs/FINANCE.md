# TUBA AL HIJAZ — Finance ERP (Phase 7)

Backend: `apps/api/src/finance/`. Wires FinanceERP.tsx (13 staff screens) and AgentPortalFinance.tsx (6 agent tabs).

## Design principles
- **Ledger is append-only.** No mutable running-balance column that could drift. Sub-ledger running balance is computed at read time with a SQL **window function** `SUM(credit − debit) OVER (ORDER BY date, createdAt ROWS UNBOUNDED PRECEDING)`.
- **Double-entry GL.** `LedgerService.postJournal` refuses to write unless Σdebit == Σcredit. P&L and Balance Sheet are **real aggregations over the GL** (`ChartAccount` × `LedgerEntry` GENERAL), never hardcoded.
- **Wallet is money-critical.** `Wallet.balance` is authoritative but every mutation runs in a transaction with `SELECT … FOR UPDATE` (serializes concurrent deductions), writes a `WalletTransaction` with `balanceAfter` (audit), and mirrors an `AGENT` sub-ledger line. Deductions are **idempotent by (refType, refId)**. Negative balances are allowed (recorded debt).
- **Two intentionally-separate representations:** the agent prepaid wallet (AGENT sub-ledger) vs. GL revenue — so completing a service both deducts the wallet AND recognizes revenue without double-counting the P&L. Invoice-based AR aging and GL-based Balance Sheet are likewise different sources answering different questions.

## Automation hooks (the "rules" formalized in Phase 10)
- **Auto-deduct on confirmation** — supplier `accept` (→ CONFIRMED) calls `WalletService.autoDeductForBooking(tenantId, totalAmount, …)`. Idempotent; never blocks the accept.
- **Auto-invoice on completion** — `ServicesService.transition` on `COMPLETED` calls `InvoiceService.autoInvoiceOnCompletion(service, id)`: creates the Invoice + items, posts the GL journal (Dr AR / Cr Revenue + VAT Payable), creates the Income entry, renders the PDF (pdf-lib) and links `Invoice.fileId`. Idempotent via `(sourceType, sourceId)`.

## Endpoints

### Staff — `/finance/*` (gated: FINANCIAL_REPORTS read, EDIT_FINANCIAL_RECORDS write)
| Method | Path | Purpose |
|---|---|---|
| GET | `/finance/dashboard` | Cash / AR / AP / YTD net profit / margins / AR-aging / balanced |
| GET | `/finance/entries?kind=income\|expense` · POST `/finance/entries` | Income & Expenses screens; **create posts a balanced GL journal** |
| GET | `/finance/ledger/entities?type=agent\|supplier` | Ledger entity dropdown |
| GET | `/finance/ledger?type=agent\|supplier&companyId=` | Sub-ledger with window-function running balance |
| GET | `/finance/ledger?type=gl` | General ledger (double-entry, by account) |
| GET | `/finance/ar` · `/finance/ap` | Aging buckets 0-30 / 31-60 / 61-90 / 90+ (AR from outstanding invoices; **AP FIFO over supplier sub-ledger**) |
| GET | `/finance/cash` | Bank accounts + recent transactions (derived from GL cash accounts) |
| GET | `/finance/currencies` · `/finance/currencies/convert` · POST `/finance/currencies` | Multi-currency (SAR base); convert via SAR |
| GET | `/finance/invoices(/:id)` · POST · PATCH `/finance/invoices/:id/pay` | Invoices + PDF (`fileId`) + mark-paid (records receipt, settles AR in GL) |
| GET | `/finance/receipts` | Receipts with allocations |
| GET | `/finance/statements?type=&companyId=` | Statement (sub-ledger view) |
| GET | `/finance/pl` · `/finance/bs` | Profit & Loss / Balance Sheet — real GL aggregations |

### Agent — `/agent-finance/*` (strictly scoped to the caller's own company)
| Method | Path | Purpose |
|---|---|---|
| GET | `/agent-finance/wallet` · `/wallet/transactions` · `/wallet/pending` | Balance + pending charges, wallet ledger (balanceAfter), outstanding invoices |
| POST | `/agent-finance/payment-slips` (multipart) · GET | Upload slip (stays PENDING) / list |
| GET | `/agent-finance/statement` · `/agent-finance/documents` | Own sub-ledger; financial documents hub |
| GET | `/agent-finance/payment-slips/review-queue` · PATCH `/…/:id/review` | **Finance-staff** review → confirming a slip credits the wallet exactly once |

## Chart of accounts (seed)
Assets 1001-1510 · Liabilities 2101-2400 · Equity 3000-3100 · Revenue 4001-4005 · COGS 5001-5004 (plSection COGS) · OpEx 6001-6005 (plSection OPEX). The seed posts a balanced season of journals so P&L is meaningful and the **Balance Sheet balances exactly** (Assets 6,606,750 = Liabilities 1,516,750 + Equity 5,090,000).

## Tests
`finance.e2e-spec.ts` (14): permission gate, running-balance correctness, GL double-entry, **wallet idempotent deduction**, tenant isolation, payment-slip→wallet-credit, **auto-invoice-on-completion (PDF+GL+income, idempotent)**, mark-paid, AR/AP bucket sums, P&L totals/margins, **balanced Balance Sheet**, SAR conversion, expense→GL. Full suite: **58 tests**.
