# 06 · MONITORING CHECKLIST — v2.1

**Observation window:** first **60 minutes** heightened watch, then **24 hours** elevated, then steady-state.
**Owner:** on-call engineer. Escalate per Doc 07.

---

## 1. Platform Health
| Signal | Where | Green | Alert |
|--------|-------|-------|-------|
| API liveness | `GET /health` | 200 | any non-200 / timeout |
| API process | host/pm2/orchestrator | running, no restart loop | repeated restarts |
| Error rate | API logs / APM | ~baseline | sustained 5xx spike |
| Event loop / latency | APM | stable | p95 latency climbing |
| DB connections | Postgres | within pool | pool exhaustion / refusals |
| Redis | `redis` ping | reachable | connection errors |
| Object storage | MinIO/S3 | reachable | upload/download failures |

## 2. Auth & Sessions
- Login success rate (staff + agent) at baseline; no spike in 401/403.
- Refresh-token flow working (no mass forced logouts).
- **Impersonation**: sessions start/stop cleanly; none exceed 30 min (auto-expire); each has audit + a stop summary.

## 3. v2.1 Workflow Signals
- Approvals succeeding (201s), not erroring.
- `GroupApproval` (digital signatures) being written on approve.
- `AuditLog` growing with correct actors; no write failures.
- `GroupVersion` snapshots created on the expected transitions.
- No unexpected lock states (e.g., FINALIZED groups being mutated → should be impossible).

## 4. Notifications
- **NotificationLog** status distribution — watch FAILED rate.
  - If WaSender not yet configured, WhatsApp will FAIL by design → confirm this is expected, then configure.
  - After WaSender configured: DELIVERED rate should be healthy; investigate persistent FAILED.
- Dispatcher (@nestjs/schedule) running; no retry storm; `retry-all-failed` not looping.
- Inbox unread counts sane (no runaway growth).

## 5. Frontend
- No surge of client errors (if client error reporting exists).
- Static assets served (no 404s on JS/CSS chunks after CDN swap).
- Spot-check 2–3 screens for console errors during the window.

## 6. Business KPIs (sanity, not alerting)
- Groups moving through submit→approve at expected volume.
- SLA dashboard not unexpectedly all-OVERDUE (would indicate a clock/config issue).

## 7. Thresholds → Action
| Condition | Action |
|-----------|--------|
| `/health` down > 2 min | Incident (Doc 07) → consider rollback (Doc 03) |
| 5xx error rate 3× baseline for 5 min | Incident; investigate logs |
| Login failure spike | Incident; check JWT_SECRET / auth service |
| NotificationLog FAILED climbing (WaSender configured) | Investigate provider/creds; not a rollback trigger by itself |
| DB pool exhaustion | Scale/limit; investigate slow queries |

## 8. Quick Queries (read-only)
```sql
SELECT status, count(*) FROM "NotificationLog"
  WHERE "createdAt" > now() - interval '1 hour' GROUP BY 1;
SELECT action, count(*) FROM "AuditLog"
  WHERE "createdAt" > now() - interval '1 hour' GROUP BY 1 ORDER BY 2 DESC;
SELECT count(*) FROM "ImpersonationSession" WHERE "endedAt" IS NULL;  -- active impersonations
```

## 9. Exit Criteria (stand down heightened watch)
- [ ] 60 min: health stable, no critical alerts, smoke/post-deploy green.
- [ ] 24 h: error rates at baseline, notification delivery healthy, no rollback needed.
