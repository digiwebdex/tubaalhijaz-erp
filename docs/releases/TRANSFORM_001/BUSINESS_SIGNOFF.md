# TRANSFORM-001 — Business Sign-Off Checklist

**Program:** Customer Group Foundation  
**Authority:** Business Operation Map + Master Business Blueprint  
**Technical gate:** [TEST_REPORT.md](./TEST_REPORT.md) (smoke 10/10 · regression 65/65)  
**Do not start Transformation-002 until this sign-off is complete (or explicitly deferred).**

---

## 1. Purpose

Confirm that Operations can run **intake** without Excel as system of record:

Group Number → Mutamers → Readiness gates → Material notifications → Staff Group Master.

---

## 2. Business Acceptance Checklist

Initial each item after staging or prod-smoke demonstration.

### A. Group Number spine

| # | Criterion | Pass | Initials | Date |
|---|-----------|:----:|----------|------|
| A1 | Unique Nusuk Group Number when set; duplicate blocked | ☐ | | |
| A2 | Staff and Agent see the same group (scoped correctly) | ☐ | | |
| A3 | Internal Group code still generated (GRP-…) | ☐ | | |
| A4 | Groups without Nusuk still open (backward compatible) | ☐ | | |

### B. Visa type & communication

| # | Criterion | Pass | Initials | Date |
|---|-----------|:----:|----------|------|
| B1 | Hajj / Umrah / Long Stay selectable | ☐ | | |
| B2 | Haji WhatsApp capturable; enforcement flag understood (`REQUIRE_HAJI_WHATSAPP`) | ☐ | | |
| B3 | Consulate / uploaded-by visible where required for ops | ☐ | | |

### C. Readiness gates

| # | Criterion | Pass | Initials | Date |
|---|-----------|:----:|----------|------|
| C1 | VISA · PACKAGE · PAYMENT · BILL toggles persist | ☐ | | |
| C2 | Visible on Agent group view and Ops Group Master | ☐ | | |
| C3 | Ops can toggle gates inline on Group Master board | ☐ | | |
| C4 | Understood: PAYMENT/BILL are readiness signals — not full finance settlement | ☐ | | |

### D. Mutamer Excel

| # | Criterion | Pass | Initials | Date |
|---|-----------|:----:|----------|------|
| D1 | Business sample columns preview successfully | ☐ | | |
| D2 | Confirm import creates passengers in the Group | ☐ | | |
| D3 | Legacy short CSV still importable | ☐ | | |
| D4 | No mutamer login / portal created | ☐ | | |

### E. OCR

| # | Criterion | Pass | Initials | Date |
|---|-----------|:----:|----------|------|
| E1 | Passport OCR → Mutamer in selected Group works | ☐ | | |
| E2 | Attach OCR to existing Excel Mutamer works | ☐ | | |
| E3 | Passport approve without Group is blocked | ☐ | | |
| E4 | Group List OCR decision recorded: ☐ Off at go-live / ☐ On after SOP | ☐ | | |
| E5 | If On: human approve creates/updates Group by Nusuk; duplicates handled | ☐ | | |

### F. Notifications

| # | Criterion | Pass | Initials | Date |
|---|-----------|:----:|----------|------|
| F1 | Material intake events produce in-app / NotificationLog | ☐ | | |
| F2 | WA behaviour accepted (live if creds; skip-safe if not) | ☐ | | |
| F3 | Ops know how to disable AR-GRP-01…04 if too chatty | ☐ | | |

### G. Tenancy & safety

| # | Criterion | Pass | Initials | Date |
|---|-----------|:----:|----------|------|
| G1 | Cross-agent group access rejected | ☐ | | |
| G2 | Agent cannot open Ops Group Master API | ☐ | | |
| G3 | Rollback path understood ([ROLLBACK.md](./ROLLBACK.md)) | ☐ | | |

### H. Explicit non-goals acknowledged

| # | Item | Ack |
|---|------|:---:|
| H1 | Hotel / Transport / Finance engines not in this release | ☐ |
| H2 | Long Stay day-85 not in this release | ☐ |
| H3 | Transformation-002 not started from this package | ☐ |

---

## 3. Feature Flag Decisions (record at sign-off)

| Flag | Decision | Owner |
|------|----------|-------|
| `ENABLE_NUSUK_GROUP_LIST_OCR` | ☐ false (recommended go-live) · ☐ true | |
| `REQUIRE_HAJI_WHATSAPP` | ☐ false · ☐ true | |

---

## 4. Known Limitations Accepted

Signatories acknowledge limitations in [FINAL_ACCEPTANCE.md](./FINAL_ACCEPTANCE.md) §7–§8, including:

- OCR accuracy requires human review  
- WA optional without provider credentials  
- Gate toggles ≠ finance settlement  
- Group List OCR remains off until SOP  

| Accepted | Initials | Date |
|:--------:|----------|------|
| ☐ | | |

---

## 5. Residual Risks Accepted

| Risk | Accepted |
|------|:--------:|
| Group List OCR enabled too early | ☐ |
| Notify volume | ☐ |
| Parallel WorkflowStage vs gates | ☐ |
| Legacy groups without Nusuk | ☐ |

---

## 6. Formal Sign-Off

By signing, the parties accept TRANSFORM-001 for the stated environment and authorize production deployment per [DEPLOYMENT.md](./DEPLOYMENT.md) (or staging promotion).

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Operations Director | | | |
| Intake / OCR Lead | | | |
| Tech Lead | | | |
| Product / Program Owner | | | |

**Environment signed:** ☐ Staging · ☐ Prod-smoke · ☐ Production  

**Release tag / images:** ________________________________

---

## 7. Post-Sign-Off

1. File this completed checklist with the release  
2. Keep Group List OCR off unless §3 records **true** with SOP  
3. Do **not** open Transformation-002 workstreams from this acceptance unless Program Owner explicitly starts a new transformation document  
