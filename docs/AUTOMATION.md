# TUBA AL HIJAZ — Automation Engine (Phase 10)

A real **rule + queue engine**, not scattered `if`-statements. Backend: `apps/api/src/automation/`.
Frontend: `AutomationNotifications.tsx` (Rules + Log screens wired to real CRUD/history).

```
service does its job ──emit──▶ EventEmitter2 ──▶ AutomationDispatcher
                                                      │ match enabled rules on eventKey
                                                      │ evaluate conditions
                                                      ▼
                                              BullMQ queue (VPS Redis, db3)
                                                      ▼
                                              AutomationProcessor (worker)
                                              ├─ SEND_NOTIFICATION  ├─ GENERATE_QR
                                              ├─ GENERATE_INVOICE   ├─ GENERATE_PDF
                                              ├─ GENERATE_VOUCHER   ├─ RUN_BACKUP
                                              └─ ESCALATE     ──▶ AutomationRunLog
```

The emitting service knows nothing downstream. **Approving an agent emits `agent.approved`; a
seeded rule (R01) queues the welcome notification.** Add/replace behaviour by editing rules — no
service code changes.

## Infrastructure
- **Redis**: reused the VPS Redis 7 (`187.77.144.38`, localhost-bound) over a plink tunnel
  `-L 6399:127.0.0.1:6379`, **dedicated db3** + BullMQ key prefix `tuba` (isolated from other apps on
  the box). `REDIS_URL` in gitignored `.env`. Worker connections use `maxRetriesPerRequest: null`.
- **BullMQ** queue `tuba-automation`; worker runs in-process (can split to its own process later,
  same queue + Redis, no code change). `@nestjs/event-emitter` registered globally with `wildcard`.

## Domain events (`src/automation/events.ts`)
`agent.registered` · `agent.approved` · `agent.rejected` · `supplier.registered` · `group.created`
· `group.completed` · `passenger.ocr.completed` · `group.import.completed` · `service.status.changed`
· `booking.confirmed` · `invoice.generated` · `voucher.generated` · `document.expiring`.

Emitted today from: **CompaniesService** (approve/reject → `agent.approved`/`agent.rejected`),
**InvoiceService** (`invoice.generated`), **ServicesService** (`service.status.changed`,
`booking.confirmed`, `voucher.generated`), and the scheduled expiry sweep (`document.expiring`).
`group.created` / OCR / Excel-import events are catalogued and ready — they fire when those modules
land (Groups CRUD + OCR are still pending from Phase 5); until then the manual test endpoint fires them.

## Rules (`AutomationRule`)
`eventKey` (machine trigger) + `conditions` (structured `[{path,op,value}]`, all AND, evaluated against
the event payload) + `actions` (structured `[{type, params}]`). `cronExpr` for schedule-driven rules.
Legacy string actions are display-only and ignored by the engine. Seeded live rules:
| code | event | action(s) |
|---|---|---|
| R01 | agent.approved | SEND_NOTIFICATION (welcome, EMAIL) |
| AR-INV-01 | invoice.generated | GENERATE_PDF + SEND_NOTIFICATION |
| AR-VCH-01 | voucher.generated | GENERATE_QR |
| AR-DOC-EXP | document.expiring | ESCALATE |
| AR-GRP-01 | group.created | SEND_NOTIFICATION (dormant until Groups CRUD) |
| AR-BKG-01 | booking.confirmed | GENERATE_VOUCHER (disabled — Phase 6 already issues on accept) |

## Actions (`src/automation/actions.ts` + processor)
- **SEND_NOTIFICATION** → creates a `NotificationLog` (real record; WhatsApp/email channel send is
  still stubbed → `PENDING`, lands with the Notification Engine phase).
- **ESCALATE** → EMERGENCY-priority `NotificationLog`.
- **GENERATE_QR** → `qrcode` PNG → object storage → `UploadedFile` (meta.qr, linked to voucher).
- **GENERATE_PDF** → `pdf-lib` document → storage → `UploadedFile`.
- **GENERATE_INVOICE** → delegates to `InvoiceService.autoInvoiceOnCompletion`.
- **GENERATE_VOUCHER** → delegates to `ServicesService.ensureVoucher`.
- **RUN_BACKUP** → `pg_dump` if available, else a logical JSON manifest snapshot → storage
  `UploadedFile` (meta.backup). `params.cloud` routes to the cloud bucket.

Every job attempt writes an `AutomationRunLog` (`eventKey`, `action`, `jobId`, `status`, `durationMs`,
`message`). Retries: 3 attempts, exponential backoff. A "not applicable" outcome logs `WARN` (no retry);
a real failure logs `ERROR` and retries.

## Scheduled jobs (BullMQ repeatable, `upsertJobScheduler` → idempotent)
- **Daily backup** `0 2 * * *` (SYS_DAILY_BACKUP) · **Cloud backup** `0 3 * * 0` (SYS_CLOUD_BACKUP)
- **Expiry sweep** `0 6 * * *` (SYS_EXPIRY_ESCALATION): runs the Phase-9 watchdog (in-app alerts) **and**
  emits `document.expiring` per CRITICAL/EXPIRED item → the escalation rule raises EMERGENCY alerts.
  (This consolidates Phase-9's in-process cron onto BullMQ.)

## REST — `/automation/*` (gated `CONFIGURE_WORKFLOWS`)
| Method | Path | Purpose |
|---|---|---|
| GET | `/automation/overview` · `/catalog` | Rollup + event/action catalog (rule-builder dropdowns) |
| GET·POST | `/automation/rules` | List (filter category/enabled/eventKey) / create |
| GET·PATCH·DELETE | `/automation/rules/:id` | Detail / update / delete |
| PATCH | `/automation/rules/:id/enabled` | Toggle |
| GET | `/automation/runs?ruleId=&limit=` | Run-log history (newest first) |
| POST | `/automation/test` | Fire a domain event by hand — the real path (dispatcher→queue→worker) |

## Tests — `automation.e2e-spec.ts` (7)
Gate; catalog + seeded rules; rule CRUD; **event → queued job → worker → run log + notification**
(agent.approved → R01 → SEND_NOTIFICATION); GENERATE_QR stores a PNG; RUN_BACKUP stores an artifact;
conditions gate a rule (pax<10 skipped, pax≥10 fires). `registration-pipeline` now asserts the welcome
notification arrives **asynchronously via the engine** (polling) — proof approval is rule-driven, not
hardcoded. Jobs are async (queue + tunnel) so assertions poll. Full suite: **86 tests**.

> Run the full e2e suite with **`--runInBand`** (shared DB + Redis over one tunnel each).
