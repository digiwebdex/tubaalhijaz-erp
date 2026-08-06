# RELEASE HISTORY — TUBA AL HIJAZ ERP
Newest first. One row per production release.

| Version | Date | Type | Summary | Rollback target |
|---|---|---|---|---|
| **v2.0.1-p1** | 2026-08-04 | Web hotfix (patch) | Group-detail Foundation now a gated tab (Flights/other tabs no longer keep Foundation visible). UI-only, web container only; API unchanged. | web:v2.0.1 |
| **v2.0.1** | 2026-08-04 | Enterprise Completion release | Billing (rate cards + price-snapshot + override), unified BookingConfirmationService, self-service password reset, lead capture, security hardening (ops-authz, escalation guard, super-admin gating). 2 additive migrations. | previous prod image tags (recorded at deploy time) |

Supersedes: pre-completion baseline (HEAD ec66d51). Image tag shipped: `v2.0.1`.
