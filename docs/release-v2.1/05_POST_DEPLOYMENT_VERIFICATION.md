# 05 · POST-DEPLOYMENT VERIFICATION — v2.1

**Goal:** After smoke passes, confirm the full v2.1 enterprise layer behaves correctly in production and the frozen business rules hold. Mirrors the LOCAL UAT that passed 12/12.
**When:** within the observation window, on a **disposable test group** (never a live customer group for destructive steps).

---

## 1. Full Lifecycle (the UAT, in production)
Run on a test group; expect each step:

| # | Action | Expected |
|---|--------|----------|
| 1 | Submit | 201 → `PENDING_APPROVAL`, `submittedAt` set |
| 2 | Approve | 201 → `APPROVED` + **SOFT lock** + new SHA-256 signature |
| 3 | Raise change request (locked) | 201; CR `PENDING` |
| 4 | Unlock (admin) | 201 → `RETURNED`, unlocked, return reason stored |
| 5 | Re-submit | 201 → `PENDING_APPROVAL` |
| 6 | Approve again | 201 → `APPROVED` + **new** signature (counted since latest submit) |
| 7 | Finalize | 201 → **HARD lock** |
| 8 | Approve after finalize | **400** — FINALIZED integrity upheld |
| 9 | Versions + timeline | versions accumulate; timeline shows APPROVED/LOCKED/CHANGE_REQUESTED/SUBMITTED chain |
| 10 | Audit trail | APPROVE entries present with correct actor |
| 11 | Notifications | lifecycle notifications generated across enabled channels |

## 2. Frozen Business Rules — spot verification
- **Configurable matrix:** with no matching `ApprovalRule`, single signature approves; with a multi-signature rule, group stays `PENDING_APPROVAL` until threshold met.
- **Signature freshness:** after a return→resubmit, a prior signature does not satisfy the new cycle (counted since `submittedAt`).
- **Immutable versions:** diffs (`/versions/:a/diff/:b`) derive only from snapshots.
- **Soft vs Hard lock:** soft is admin-unlockable; **hard lock is Super-Admin-only** and FINALIZED is never bypassed.
- **Bulk approval:** each group in a bulk run gets its own timeline + audit + notification + signature (engine not bypassed).
- **SLA:** dashboard classifies OVERDUE/AT_RISK/ON_TIME/NO_SLA from `WorkflowStage.slaHours`.
- **Impersonation:** starts with mandatory reason; banner + watermark show; every impersonated action audited as *actual-admin acting-as agent*; auto-expires at 30 min.
- **Notification inbox:** shows only the caller's own + tenant messages.

## 3. Screen-by-screen sanity (staff)
`/agent-operations` · `/audit-center` · `/approvals` · `/sla-dashboard` · `/wasender-config` · `/notification-center` · `/template-manager` — each: renders, 0 console errors, filters/search work, primary action responds.
Agent: `/inbox` and `/my-workflow` reachable and scoped.

## 4. Configuration (business policy — do this before real usage)
- [ ] **WaSender**: production URL/deviceId/defaultCountry + API key set (encrypted). Live status green; test send delivered.
- [ ] **SLA hours**: `WorkflowStage.slaHours` populated per stage per policy.
- [ ] **Approval matrix**: real `ApprovalRule` rows defined (levels/roles/thresholds) — default is single-signature.
- [ ] **Notification templates**: reviewed/authored per event/channel/lang in Template Manager (fallbacks exist otherwise).
- [ ] **RBAC grants**: `MANAGE_OPS`, `MANAGE_SYSTEM_SETTINGS`, `ACCESS_AUDIT_LOGS`, `AGENT_IMPERSONATION`, `VIEW_DASHBOARD` match the org chart.

## 5. Data integrity
- Existing (pre-v2.1) groups load without error (new columns default sensibly).
- No orphaned/erroring rows in Audit Center or Notification Center.
- Finance/GL (from prior release) still balances (regression guard).

## 6. Result
- [ ] Lifecycle 11/11 · [ ] Business rules spot-checks pass · [ ] All screens sane · [ ] Config seeded · [ ] Data integrity OK
- Verifier: __________  Time: __________  → hand to Monitoring (Doc 06).
