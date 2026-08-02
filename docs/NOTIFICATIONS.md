# TUBA AL HIJAZ — Notification Delivery (Phase 11)

Real delivery for the `SEND_NOTIFICATION` / `ESCALATE` jobs the Automation engine (Phase 10) queues.
Backend: `apps/api/src/notifications/`. Templates: `packages/shared/src/notifications.ts`.

```
Automation SEND_NOTIFICATION / ESCALATE ─┐
POST /notifications/test ────────────────┤─▶ NotificationsService.dispatch
                                          │      resolve recipient (lang/phone/email)
                                          │      resolve channels (explicit | event matrix | emergency=all 3)
                                          │      render template (DB override → shared catalog)
                                          │      create NotificationLog (PENDING) per channel
                                          ▼      enqueue BullMQ send job (priority)
                                   tuba-notify queue (VPS Redis, db3)
                                          ▼
                                   NotificationsWorker (concurrency 8)
                                   ├─ WHATSAPP → WASender API
                                   ├─ EMAIL    → SMTP (nodemailer) + PDF attachments
                                   └─ IN_APP   → /notifications WS push + persisted log
                                          ▼
                                   update status: DELIVERED | FAILED(+retry) | PENDING(skipped)
```

## Channels (env-driven; stub-safe when unconfigured)
- **WhatsApp** (`channels/whatsapp.channel.ts`) — WASender: `POST {WASENDER_API_URL}/send-message`,
  `Authorization: Bearer {WASENDER_API_KEY}`, body `{ to, text }`, response `{ success, data:{ msgId } }`.
  No key → SKIPPED (status stays PENDING). `providerId` = WASender `msgId`.
- **Email** (`channels/email.channel.ts`) — nodemailer SMTP (`SMTP_HOST/PORT/SECURE/USER/PASS/FROM`).
  Sends HTML + PDF attachments (voucher/invoice/statement `fileId`s pulled from storage). No host → SKIPPED.
- **In-App** (`notifications.gateway.ts`) — Socket.io namespace `/notifications`, rooms `user:<id>` +
  `tenant:<id>` from the **JWT only** (S2-02). Handshake requires `auth.token` (Bearer / `?token=` also
  accepted). Anonymous and query spoof of `userId`/`tenantId` are rejected. `NotificationLog` is the
  persisted bell history; the gateway pushes `notification` live. Same nsp-capture fix as Ops.

## Templates — bilingual, shared
`packages/shared/src/notifications.ts` holds the canonical bn/en catalog (Registration, Visa/Service
Update, Payment, Invoice, Voucher Ready, Group Completed, Daily Summary, Emergency, …) with `{{var}}`
placeholders. `renderTemplate(eventKey, lang, vars, override?)` interpolates. The delivery layer prefers a
DB `MessageTemplate` row (edited in the Notification Center) and falls back to the shared catalog.
Language = recipient's `preferredLang` (`User` / `Company`, default **bn**), overridable per dispatch.

## Retry / status
Each send is one BullMQ job (`attempts: 4`, exponential backoff). A hard failure throws → BullMQ retries;
the log records `status=FAILED`, `error`, `attempts`. A missing-credentials "skip" stays `PENDING`
(awaiting config, no retry). Success → `DELIVERED` + `sentAt` + `providerId`. The Notification Center log
screen surfaces Sent/Failed/Pending from these.

## Emergency
Highest-priority path: BullMQ job `priority: 1` (preempts normal `priority: 10`) so it jumps the queue and
the worker's concurrency sends **all three channels simultaneously**. A rule/dispatch with
`priority: EMERGENCY` and no explicit channel fans out to WhatsApp + Email + In-App. (Explicit `channels`
still win, so internal `ESCALATE` alerts stay In-App.)

## REST — `/notifications/*`
| Method | Path | Gate | Purpose |
|---|---|---|---|
| GET | `/notifications?limit=` | auth | Bell feed (caller's own + tenant) |
| GET | `/notifications/unread-count` | auth | Badge count |
| PATCH·POST | `/notifications/:id/read` · `/read-all` | auth | Mark read |
| GET·PATCH | `/notifications/events(/:key)` | MANAGE_SYSTEM_SETTINGS | Channel matrix |
| GET·PUT | `/notifications/templates` | MANAGE_SYSTEM_SETTINGS | Template CRUD |
| POST | `/notifications/test` | MANAGE_SYSTEM_SETTINGS | Real test send (drives the live check) |

## Frontend
ERPShell bell dropdown → REST feed + unread badge + mark-read/all; `notifySocket.ts` /
`useNotifyEvents` refreshes the bell on live `notification` + reconnect (S2-02).
AutomationNotifications NotificationsScreen → event matrix + template editor (route ComingSoon until Sprint 2 unhide).

## Tests
- `notifications.e2e-spec.ts` — bell / config / templates / test-send / emergency / in-app WS push (JWT)
- `notifications-ws-auth.e2e-spec.ts` (S2-02) — anon/invalid rejected; spoof rejected; receive + tenant isolation + reconnect
Channels run in stub mode in CI (no creds).

## Going live
Set in gitignored `apps/api/.env` (see `.env.notifications.example`):
`WASENDER_API_KEY`, `SMTP_HOST/PORT/USER/PASS/FROM`. Then
`POST /notifications/test { "phone":"+…", "email":"…", "eventKey":"AGENT_APPROVED" }` delivers for real.
