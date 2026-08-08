# Mail deployment gate — required configuration (NOT YET SUPPLIED)

Status: **PENDING**. The reconciliation is complete, but the mail environment
cannot be deployed or tested until the values below exist. No credentials have
been invented or guessed.

## 1. Server-side environment variables
Set in `/var/www/TUBAALHIJAZ/infra/.env` (consumed by the `api` service).
Currently `SMTP_HOST`, `SMTP_USER` and `SMTP_PASS` are present but **empty**.

| Variable | Current | Required |
|---|---|---|
| `SMTP_HOST` | empty | Provider hostname, e.g. the SMTP relay endpoint |
| `SMTP_PORT` | `587` | `587` (STARTTLS) or `465` (implicit TLS) |
| `SMTP_SECURE` | `false` | `false` for 587, `true` for 465 |
| `SMTP_USER` | empty | SMTP account / API-key username |
| `SMTP_PASS` | empty | SMTP password / API key — never commit to git |
| `SMTP_FROM` | `TUBA AL HIJAZ <no-reply@tubaalhijaz.com>` | keep, or align with the verified sender |

The application reads these in `apps/api/src/notifications/channels/email.channel.ts`.
With `SMTP_HOST` unset the channel deliberately runs in stub mode and reports
SKIPPED — it does not fail, so a misconfiguration is silent. Verify explicitly.

## 2. DNS records (Cloudflare — tubaalhijaz.com)
None of these currently exist:
- **MX** — required to receive mail; absent today.
- **SPF** (TXT) — must authorise the sending provider, or outbound mail lands in spam.
- **DKIM** (CNAME/TXT) — per the provider's instructions.
- **DMARC** (TXT at `_dmarc.tubaalhijaz.com`) — currently NXDOMAIN.

## 3. Sender verification
`no-reply@tubaalhijaz.com` must be a verified sender/domain on the chosen provider.

## 4. Acceptance test once supplied
1. Populate the variables, recreate ONLY the `api` service.
2. Confirm the log line `email channel ready (<host>)` instead of the stub warning.
3. Trigger a real password-reset email and confirm delivery to an external inbox.
4. Confirm SPF/DKIM/DMARC all pass in the received message headers.
