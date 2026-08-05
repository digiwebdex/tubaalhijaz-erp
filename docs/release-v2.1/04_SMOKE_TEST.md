# 04 · SMOKE TEST — v2.1 (run immediately after deploy)

**Goal:** Fast (~5 min) confirmation that the release is alive and the critical paths work. Any **CRITICAL** failure → abort / rollback (Doc 03).
**Auth:** use a real staff (super-admin) account and one agent account. Replace `$API` / `$WEB` with production origins.

---

## A. Platform health (CRITICAL)
| # | Check | Expected |
|---|-------|----------|
| A1 | `GET $API/health` | HTTP 200 |
| A2 | API process/logs | started, no crash loop, no unhandled exceptions on boot |
| A3 | `GET $WEB/` (app shell) | 200, app loads, no white screen |
| A4 | `prisma migrate status` | 0 pending (all v2.1 migrations applied) |

## B. Authentication & RBAC (CRITICAL)
| # | Check | Expected |
|---|-------|----------|
| B1 | Staff login (super-admin) | 200 + token; `/auth/me` returns role + permissions |
| B2 | Agent login | 200 + token; lands in agent context |
| B3 | Agent → `/approvals` | redirected to `/agent-portal` (blocked) |
| B4 | Agent → `/inbox`, `/my-workflow` | reachable, scoped to own data |

## C. Core v2.1 read paths (CRITICAL)
| # | Check | Expected |
|---|-------|----------|
| C1 | `GET $API/groups` | 200, returns groups with `approvalStatus`/`locked`/`lockType` |
| C2 | Open `/approvals` | table renders, 0 console errors |
| C3 | Open `/sla-dashboard` | 4 SLA cards + table render |
| C4 | Open `/audit-center` | audit rows render |
| C5 | Open `/notification-center` | count cards + history render |

## D. One governed write (CRITICAL) — use a disposable test group
| # | Check | Expected |
|---|-------|----------|
| D1 | Submit a DRAFT group | 201 → `PENDING_APPROVAL` |
| D2 | Approve it | 201 → `APPROVED` + SOFT lock + a new digital signature |
| D3 | Audit Center shows the APPROVE entry | actor = the approver |

> Leave the test group approved (or clean it up per policy). Do not finalize a real customer group during smoke.

## E. Integrations (NON-CRITICAL — note, don't block on WaSender if intentionally deferred)
| # | Check | Expected |
|---|-------|----------|
| E1 | WaSender Config screen | loads; shows connection status |
| E2 | WaSender test send (if configured) | delivered (or clear error if creds pending) |
| E3 | Notification Inbox | loads; mark-read works (PATCH 200) |

## F. Frontend integrity (CRITICAL)
| # | Check | Expected |
|---|-------|----------|
| F1 | Browser console on 3 key screens | 0 errors |
| F2 | Network tab | no failed requests, no rapid polling |
| F3 | Mobile width (~390px) | no horizontal page overflow |

---

## Result
- **PASS** = all CRITICAL green → proceed to Post-Deployment Verification (Doc 05).
- **FAIL** (any CRITICAL red) → **abort & rollback** (Doc 03), open incident (Doc 07).

Signed: __________  Time: __________
