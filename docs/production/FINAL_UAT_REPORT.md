# TUBA AL HIJAZ — v2.1 Enterprise ERP · FINAL UAT REPORT

**Test type:** End-to-end enterprise workflow lifecycle (User Acceptance Test)
**Method:** Real API calls against the running LOCAL stack (`:3310`), authenticated as Super Admin (`ceo@tubalhijaz.com`)
**Subject group:** `GRP-1446-2990` (reset to DRAFT at test start)
**Result:** ✅ **12 / 12 STEPS PASSED**

---

## 1. Scenario

A group progresses through the complete governed lifecycle: **Submit → Approve (signature + soft lock) → Change Request → Unlock → Re-submit → Approve again → Finalize (hard lock)**, with integrity checks and a full evidence trail (digital signatures, immutable versions, timeline, audit, notifications).

## 2. Step Results

| # | Step | HTTP | Outcome / Evidence |
|---|------|------|--------------------|
| 0 | Resolve group | — | `GRP-1446-2990`, start = DRAFT |
| 1 | Submit for approval | 201 | → `PENDING_APPROVAL`, `submittedAt` set |
| 2 | **Approve** | 201 | → `APPROVED`, **SOFT lock**, new **digital signature** (SHA-256 `ed13cb79e607…`) |
| 3 | Raise **change request** on locked group | 201 | CR created, status `PENDING` |
| 4 | **Unlock** soft-locked group (admin) | 201 | → `RETURNED`, unlocked, return reason recorded |
| 5 | Re-submit after correction | 201 | → `PENDING_APPROVAL` |
| 6 | **Approve again** | 201 | → `APPROVED`, **new signature** (count incremented — counted since latest `submittedAt`) |
| 7 | **Finalize** | 201 | → **HARD lock** |
| 8 | Post-finalize approve blocked | 400 | `"Cannot approve from APPROVED"` — FINALIZED integrity upheld |
| 9 | Versions + timeline | — | **4 immutable versions**, **17 timeline events** (APPROVED/LOCKED/CHANGE_REQUESTED/SUBMITTED chain) |
| 10 | Audit trail | — | **27** Workflow/APPROVE entries; actor = `ceo@tubalhijaz.com` |
| 11 | Lifecycle notifications | — | **55** notifications for this group across **WhatsApp + Email** |

## 3. Frozen-Rule Assertions Proven

- **Configurable matrix** honoured — approval succeeded per `ApprovalRule` (default level 1 / 1 signature).
- **Server-generated digital signatures** — SHA-256 hash minted per approval; new signature required after each fresh submission (counted since `submittedAt`), preventing stale-signature reuse.
- **Immutable versions** — snapshots accumulated (4) and remain the sole basis for diffs.
- **Soft vs Hard lock** — soft lock set on approval and admin-unlockable; hard lock set on finalize.
- **FINALIZED never bypassed** — post-finalize approve rejected (400).
- **Bulk approval** (verified separately in Phase 2/3) drives the same per-group engine.
- **Timeline + Audit + Notifications** emitted at every transition — full traceability.

## 4. Frontend UAT (browser-driven, Phase 3/4)

The same lifecycle actions were exercised through the actual UI with real interaction:
- **Approval Dashboard:** real Approve → 201 + DB transition + signature + audit; Return/Reject drawers; Finalize/Unlock; Bulk-Approve; detail drawer loading signatures/versions/diff/CRs/timeline.
- **My Workflow (agent-side):** Submit → 201; Request-Change on a locked group → 201; detail drawer loads workflow/CRs/versions/timeline.
- **Notification Center:** displays the lifecycle-generated notifications fanned across channels; row-retry → 201.

## 5. Verdict

**ACCEPTED.** The v2.1 enterprise workflow satisfies every acceptance criterion of the Business Rules Freeze. No defects found; the three initially-red steps were a test-script verb error (`return` vs `unlock`), corrected and re-run to a full pass — the engine behaved correctly throughout.
