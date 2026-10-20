# Server test file parallelism

Status: accepted, 2026-10-20.

## Context

The fixed four-file Server test pool leaves long serial suites on the critical
path. A file is also an imperfect resource unit: some generated-fixture tests
start many real OCR/model worker processes and hold physical calls concurrently.
Increasing the pool to every available CPU can make those journeys exceed
their unchanged deadlines.

## Decision

Partition nine independent suites into 48 balanced files while preserving every
test call, option, assertion, fixture and internal lifecycle. Extract unchanged
helpers; keep globals and mocks isolated by Node's process-per-file execution.

The npm workspace entry uses a small launcher for the same native Node/tsx
runner and `test/*.test.ts` discovery. Default file concurrency is
`max(4, min(availableParallelism(), 6))`; later native CLI arguments can override
it. The launcher inherits the caller's process group, forwards SIGINT/SIGTERM,
waits for the child to close and preserves its failure/signal result. The
existing complete-check driver owns locking, process-group cleanup and receipts.

This supersedes the fixed four-worker command and the interim unbounded native
default. It does not change production scheduling, test deadlines, assertions
or the physical capacity exercised inside any test. No compatibility path,
environment switch or second scheduler is added.

## Consequences

File-level parallelism can increase without weakening the real process and
recovery journeys. The default is bounded by measurements rather than total
CPU count: eight workers passed the focused stress cohort but failed a full
run; twelve workers failed the cohort. Native overrides remain useful for
different hosts and targeted measurements.

The [technical plan](design/server-test-parallelism.md) records the independent
approvals, superseded experiments and exact scope. The
[validation record](validation/server-test-parallelism-2026-10-20.md) separates
executed fixture checks, incomplete runs and historical timing references.
