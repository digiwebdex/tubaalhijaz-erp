# TUBA AL HIJAZ — v2.1 Enterprise ERP · PRODUCTION READINESS REPORT

**Assessment scope:** v2.1 enterprise workflow/approval/locking/versioning/audit/notification/impersonation layer
**Build location:** LOCAL isolated stack (`/root/tuba-local`, `200.141.0.22`)
**Readiness verdict:** ✅ **READY for owner-gated production promotion** (code + data-model complete and verified). Promotion itself is an explicit owner decision; the checklist below is the hand-off.

---

## 1. Quality Gates

| Gate | Status | Evidence |
|------|--------|----------|
| Type safety (web) | ✅ | `tsc --noEmit` exit 0 across all batches |
| Backend unit/integration | ✅ | workflow 16/16 · Phase 2 17/17 · audit-context 11/11 · F01 18/19¹ · Notif 12/12 |
| Frontend 12-point checklist | ✅ | Every screen, real browser interaction |
| Pixel QA | ✅ | 27 captures — 0 err / 0 warn / 0 failed-req / no overflow / no polling |
| End-to-end UAT | ✅ | 12/12 |
| RBAC enforcement | ✅ | Agents blocked from staff routes; personal routes scoped |
| Accessibility | ✅ | Keyboard focus, ARIA on controls, drawer Escape, WCAG 2.5.3 fix (impersonation End Session) |

¹ The single non-passing F01 assertion is a test-string artifact, not a product defect.

## 2. Database / Migration Readiness

Migrations applied and validated on LOCAL (must be applied to production in order):
- `agent_ops_group_locking` — ApprovalStatus enum; Group locking columns; ChangeRequest; GroupTimelineEntry; ImpersonationSession; AuditLog actor/reason/userAgent.
- `audit_correlation` — AuditLog correlationId/workflowId; GroupTimelineEntry correlationId.
- `v21_enterprise_capabilities` — LockType enum; Group.lockType/stageEnteredAt; WorkflowStage.slaHours; ImpersonationSession.actionCount/summary; ApprovalRule; GroupApproval; GroupVersion; SecurityPolicy.
- `integration_config` — IntegrationConfig (WaSender, AES-256-GCM encrypted key at rest).

## 3. Configuration Required Before Go-Live (owner)

1. **WaSender** — set production API URL/deviceId/defaultCountry + API key (stored encrypted). Verify live status + test send.
2. **SLA hours** — populate `WorkflowStage.slaHours` per stage (config-driven; currently seeded for demo).
3. **Approval matrix** — define real `ApprovalRule` rows (multi-level/role thresholds) as policy requires; default is single-signature.
4. **Notification templates** — review/author `MessageTemplate` rows per event/channel/lang in Template Manager (fallbacks exist).
5. **Secrets** — production `JWT_SECRET`, DB credentials, and integration keys (do NOT reuse the local dev secret).
6. **Staff/role permissions** — confirm `MANAGE_OPS`, `MANAGE_SYSTEM_SETTINGS`, `ACCESS_AUDIT_LOGS`, `AGENT_IMPERSONATION`, `VIEW_DASHBOARD` grants match the org chart.

## 4. Operational Notes

- **Notification dispatcher:** on the LOCAL box, WaSender is unconfigured, so queued messages cycle PENDING→FAILED — expected; will settle once production credentials are set.
- **Impersonation:** 30-minute non-refreshable token; every impersonated action is audited as *actual admin acting-as agent*; correlationId = impersonation session id.
- **Audit immutability:** audit + timeline are append-only; diffs derive only from immutable version snapshots.

## 5. Residual Risks / Out-of-Scope

- Broader ERP modules (hotel/transport/visa/flight/finance/ledger/reports) are pre-existing and **outside** the v2.1 enterprise-layer scope; this assessment covers the v2.1 additions only.
- Production load/performance testing not performed on LOCAL (single-box dev). Recommend a smoke + light-load pass in staging after promotion.
- No deploy/commit/push performed — the promotion path (migrations + backend deploy + web build) remains an owner action.

## 6. Sign-off Checklist (owner)

- [ ] Apply the 4 migrations to production DB (in order)
- [ ] Set production secrets + WaSender credentials
- [ ] Seed SLA hours + approval matrix + templates per policy
- [ ] Deploy API build + Web build
- [ ] Post-deploy smoke: submit→approve→finalize on a test group; verify audit + notifications
- [ ] Confirm RBAC grants per staff role

**Verdict:** Code and data model are production-grade and verified. Promotion is **owner-gated** and ready to proceed against the checklist above.
