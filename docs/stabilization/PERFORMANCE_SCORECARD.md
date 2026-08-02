# ESP-03 — Performance Scorecard

**Date:** 2026-08-02  
**Target:** Improve runtime performance without behavior change.

| Area | Before | After | Verdict |
|------|--------|-------|---------|
| Main JS payload | 1× ~1.76 MB (~474 kB gz) | Split; entry ~index+react ≈ **142 kB gz** | **Improved** |
| Route isolation | None | Lazy routes for all ERP/portals | **Improved** |
| Charts weight | In main | Separate `charts-*` (~108 kB gz) on demand | **Improved** |
| Agent heavy desks | Eager with AgentPortal | Lazy Groups/Finance/Services | **Improved** |
| Dashboard tabs | Eager Ops Today + Executive | Lazy on tab | **Improved** |
| Table re-renders | Always | `ErpDataTable` memoized | **Improved** |
| Images | Eager decode default | `lazy` / `async` defaults | **Improved** |
| Total installed JS bytes | ~1.76 MB | ~1.78 MB | Neutral (split overhead) |
| API / RBAC / business | — | Unchanged | Pass |
| New libraries | — | None | Pass |

## Score (heuristic)

| Criterion | Score /10 |
|-----------|-----------|
| Bundle strategy | 8 |
| Lazy loading coverage | 8 |
| Render hygiene | 6 (kit table only; page-level memo not blanket) |
| Measurement discipline | 8 |
| Risk control | 9 |

**Overall:** **7.5 / 10** — solid first-load win; further gains need profiling (React Profiler) + optional dep prune.

## Residual risks

- Brief Suspense skeleton on first visit to a lazy route.  
- Offline / flaky network: chunk fetch failure needs browser reload (same as any SPA split).  
- Inline column `cell` / `rowKey` lambdas still defeat memo unless parents stabilize references.

## Next optional (not ESP-03)

- React Profiler pass on Finance / Ops Control list desks.  
- Dynamic `import('recharts')` inside chart widgets only.  
- Remove unused package.json deps (MUI) after install-size audit.
