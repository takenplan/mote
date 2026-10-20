# Server test performance budgets — 2026-10-20

The owner selected advisory warnings (option B). Ordinary-file budget: 60 s;
individual-case reminder: above 30 s. These do not change test exit status,
assertions, input scale, deadlines or lifecycle coverage. The policy and explicit
long-scenario reasons live in the [development guide](../development.md#test-performance-budget).
The bounded preimplementation review is [P7](../design/server-test-parallelism.md#p7-advisory-performance-budgets).

## Existing observations, not automatic exemptions

The first complete six-worker run at runtime `2ae39ebb32c66aa51acbf18c55d5da5b4ea69139`
observed 574 Server files. File wall-time p50/p90/p95/p99 was
4.81/38.58/52.73/83.03 s. Seventeen files exceeded 60 s; 28 completed cases
exceeded 30 s. These are observations from the earlier full run, not a rerun
with the new reporter and not a controlled regression threshold.

| File under `apps/server/test/` | Seconds | Follow-up |
| --- | ---: | --- |
| `memory-import-background.test.ts` | 175.47 | Explicit thousand-original journey; preserve complete scale and intermediate states |
| `multiuser-perception-history.test.ts` | 100.74 | Explicit physical-call concurrency/lifecycle scenario |
| `multiuser-perception-history-02.test.ts` | 93.40 | Explicit independent-listener concurrency/lifecycle scenario |
| `request-admission.test.ts` | 86.70 | Existing performance debt; necessary scale alone is not a duration exemption |
| `multiuser-memory-process.test.ts` | 83.45 | Existing performance debt |
| `image-processing.test.ts` | 83.03 | Existing performance debt |
| `multiuser-ask.test.ts` | 73.63 | Explicit 61-second periodic case; other cases remain subject to budget |
| `imports.test.ts` | 69.37 | Existing performance debt |
| `memory-pipeline.test.ts` | 68.81 | Existing performance debt |
| `import-uploads.test.ts` | 67.32 | Existing performance debt |
| `gmail.test.ts` | 66.32 | Existing performance debt |
| `multiuser-perception-history-04.test.ts` | 64.65 | Explicit declared-kind concurrent execution scenario |
| `scoped-memory-parity.test.ts` | 64.31 | Existing performance debt |
| `multiuser-restored-future-authority.test.ts` | 64.24 | Explicit real post-restore periodic trigger |
| `query-large-lineage-http.test.ts` | 63.81 | Existing performance debt |
| `multiuser-history-retention.test.ts` | 62.29 | Existing performance debt |
| `memory-delegation.test.ts` | 60.38 | Existing performance debt |

The declared-kind limit-three case is also an explicit long scenario (31.93 s)
although its file remained below 60 s. Explicit scenarios continue to appear in
every report; there is no allowlist that suppresses their warnings.
The earlier [parallelism validation](server-test-parallelism-2026-10-20.md)
records source/environment identity and original full-run receipts.

## New reporter validation

Focused command:

```sh
node --import tsx --test apps/server/test/performance-reporter.test.ts apps/server/test/test-runner.test.ts
```

All 15 tests passed in 9.217 s on the final focused run, with no skips, failures
or cancellations.
Coverage includes exact threshold boundaries, nested-duration accounting,
failed/skip/TODO/suite handling, incomplete evidence, full warning lists,
single event consumption, built-in spec output and stream-error propagation.
Generated real-launcher fixtures cover the default report, native underscore
reporter/destination arguments, quoted `NODE_OPTIONS`, reporter-like text inside
an actual generated import path, invalid reporter pairing,
genuine test failure and both signal/real-driver cleanup journeys.

The frozen candidate's affected-component gate is pending.
