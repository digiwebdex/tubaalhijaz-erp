# PRODUCTION INCIDENTS — TUBA AL HIJAZ ERP
Log every production incident. Newest first. Follow the Post-Go-Live triage order (reproduce → root cause → impact → classify → smallest fix → verify → document).

## Template (copy for each incident)
```
### INC-YYYYMMDD-NN — <short title>
- Detected: <when / how (alert, user report)>
- Severity: Sev1 (down/data-loss) | Sev2 (major degraded) | Sev3 (minor) | Sev4 (cosmetic)
- Reproduce: <steps>
- Root cause: <what>
- Class: Config | Data | User | Bug | Infra | Security | Deployment
- Impact: <who/what, how many, money/accounting touched?>
- Fix: <smallest change OR runbook/rollback action> → patch id if code (see PATCH_HISTORY)
- Verify: Browser [ ] API [ ] DB [ ] Regression [ ]
- Rollback: <how, if needed>
- Deployment impact: <restart? migration? none>
- Status: Open | Mitigated | Resolved | Closed
```

## Log
_(no incidents recorded)_
