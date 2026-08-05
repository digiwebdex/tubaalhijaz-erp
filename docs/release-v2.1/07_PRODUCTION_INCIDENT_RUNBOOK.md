# 07 · PRODUCTION INCIDENT RUNBOOK — v2.1

**Use when:** a monitoring alert (Doc 06) or user report indicates a production problem post-release.
**Prime directive:** stabilize first (restore service), diagnose second. Code is FROZEN — fixes are config/ops/rollback, not code edits, unless a formal hotfix is authorized outside this release.

---

## 0. Severity
| Sev | Definition | Response |
|-----|------------|----------|
| **SEV-1** | Platform down / login broken / data integrity at risk | Immediate; consider rollback (Doc 03) |
| **SEV-2** | Major feature broken (approvals erroring), workaround exists | Urgent; mitigate |
| **SEV-3** | Minor/isolated (one screen glitch, notification lag) | Normal; track |

## 1. First 5 Minutes (any incident)
1. Confirm scope: `GET /health`, can staff log in, is it one screen or the platform?
2. Check API logs for the timeframe; note the first error.
3. Check monitoring dashboards (error rate, DB, Redis).
4. Declare severity + start an incident log (timestamped actions).

---

## 2. Playbooks by Symptom

### 2.1 API down / `/health` not 200 (SEV-1)
- Inspect boot logs. Common causes: bad env var (DB/JWT/MinIO), DB unreachable, port conflict.
- If a bad config → fix env + restart. If not quickly fixable → **rollback app** (Doc 03 §3).

### 2.2 Login broken (staff or agent) (SEV-1)
- Verify `JWT_SECRET` set correctly (mismatch invalidates all tokens).
- Verify DB reachable and `User`/`Role` intact.
- Check `CORS_ORIGIN`/`WEB_ORIGIN`/`COOKIE_SECURE` for cookie-refresh failures.
- If regression from release → rollback (Doc 03).

### 2.3 Approvals / workflow erroring (SEV-2)
- Check the exact 4xx/5xx from `/groups/:id/approve` etc.
- `400 "Cannot approve from <state>"` is **correct** rule enforcement, not a bug (e.g. approving a finalized/returned group).
- 5xx → check logs for Prisma errors (missing column ⇒ a migration didn't apply → see 2.6).

### 2.4 Notifications failing (SEV-3 usually)
- Query `NotificationLog` FAILED reasons.
- WhatsApp all-FAILED + WaSender unconfigured = expected → configure WaSender (Config screen), then `retry-all-failed`.
- Provider outage → messages retry; not a rollback trigger.
- Never edit templates to "fix" delivery mid-incident unless it's a clear content error.

### 2.5 Impersonation issues (SEV-2)
- Banner not showing: user likely not in an active session, or `/admin/impersonation/active` failing — check logs.
- Session won't end: `POST /admin/impersonation/stop`; sessions also auto-expire at 30 min.
- Audit shows wrong actor: verify — expected record is *actual admin acting-as agent*.

### 2.6 Migration/schema mismatch (SEV-1)
- Symptom: Prisma "column/table does not exist" 500s.
- `npx prisma migrate status` → if v2.1 migrations pending/failed, the app was deployed ahead of the DB.
- Apply pending migrations (Doc 02) **or** rollback app to the pre-v2.1 version (Doc 03 §3). Do not hand-patch the schema.

### 2.7 Performance degradation (SEV-2/3)
- Check DB pool + slow queries; check Redis; check event-loop lag.
- Audit/Notification lists are paginated — a slow list usually means an index/DB issue, not app logic.

---

## 3. Rollback Decision
Invoke Doc 03 when: SEV-1 not resolved within the agreed window, data integrity is uncertain, or a migration/schema fault can't be safely fixed forward.

## 4. Communication
- SEV-1/2: notify Release Lead + owner immediately; post status updates at a fixed cadence.
- Record: symptom, impact, timeline, actions, resolution, follow-ups.

## 5. Post-Incident
- Write a short post-mortem (what, why, fix, prevention).
- Any needed code change goes to a **v2.1.x hotfix / v2.2 backlog** — the current RC stays frozen; changes require re-running Go/No-Go (Doc 09).

## 6. Key Facts (fast reference)
- Migrations are **manual** (`prisma migrate deploy`), additive, not auto-run on boot.
- v2.1 rollback is normally **app-only** (additive DDL is forward-compatible).
- Impersonation tokens: 30-min, non-refreshable.
- WaSender key stored **encrypted** (AES-256-GCM) in `IntegrationConfig`.
- Health: `GET /health`.
