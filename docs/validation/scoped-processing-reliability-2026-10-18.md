# Scoped processing reliability validation — 2026-10-18

Decision: [scoped processing reliability](../adr-scoped-processing-reliability.md)
and [cross-client resource waiting](../adr-task-recovery-and-execution-budgets.md).

## Required journeys

| Journey | Important transitions and evidence |
| --- | --- |
| Shared worker capacity | Multiple accounts/originals share one physical worker; independent workers can progress. Busy is waiting, without consuming failed attempts or processing time. |
| Queue lifecycle | Restart before issuance resumes waiting; cancellation, configuration change and revoked authority prevent old dispatch/publication. |
| Execution-fact receipts | Exact authenticated request lookup, duplicate submission, worker restart, response loss, and no result-body persistence. Unknown is never inferred to be nonexecution. |
| Memory service fairness | Continuous extraction still allows ready review/publication; account fairness and consistency lock remain. |
| Safe diagnosis | Validation/tool/timeout/internal failures retain fixed safe causes, without arbitrary messages, original content or credentials. |
| Independent accounting | Multiple queries under one lease, failed queries with known usage, replacement cumulative samples, duplicate receipts, interrupted fragments and successful checkpoint reuse. |
| Recording authorization | Empty instance setup, authorize/reauthorize, complete device link, pending/expiry/cancel/reload and account isolation. |
| Dependency delivery | Supported fixed CLI versions are prepared by deployment; offline contracts and missing/wrong runtime behavior are checked separately from real login. |

## Execution results

Implementation and verification are in progress. No result in this document
claims physical-device, real-account authorization or live-model validation.
All automated inputs must be generated fixtures and isolated loopback services.
Historical data is not repaired or replayed.
