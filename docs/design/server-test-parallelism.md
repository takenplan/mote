# Server test parallelism

## Scope and review

The implementation owner and complete-check driver is `/root` in the
`codex/server-test-parallelism` worktree. The design baseline and pre-change HEAD
are `4fc433cd2f9f0f43c38c6afc70834ba19d9d5c6a`.

Plan P1 was independently approved before implementation by `/root/plan_review`
using Sol High. It covers mechanical partitioning of five Server suites,
unchanged fixture extraction, file-level concurrency, parity verification and
generated-fixture performance measurements. Independent source inspection by
`/root/test_inventory` subsequently confirmed registration and helper parity.

Delta P2 was independently **APPROVE**d by the same reviewer before its
implementation. It replaces the proposed custom subprocess wrapper with the
existing native Node test entry, removing only the fixed concurrency of four.
The wrapper and its experimental tests were discarded before publication.
Native Node retains ownership of test workers inside the existing check driver's
process group. No new subprocess lifecycle, platform requirement or environment
configuration is introduced.

## Original and intended journey

The developer invokes `npm test -w @mote/server`, directly or through
`npm run check:affected`. Shared and Agent builds remain prerequisites of the
complete check. Node discovers every top-level `test/*.test.ts`, starts an
isolated process per file with the tsx loader, executes each file's tests in
their original serial order and reports failures to npm and the check driver.
Tests create their own generated inputs, temporary storage and loopback services
and register cleanup. The driver continues to own interruption, cleanup,
locking, input identities and receipts.

Previously, only four files could run at once and large suites serialized many
independent journeys. The intended flow keeps that entire execution path while
allowing Node to select its normal CPU-based worker count and distributing the
large suites across more files. Explicit native `--test-concurrency` flags are
used for measurements. Tests inside a file do not become concurrent.

| Classification | Decision |
| --- | --- |
| KEEP | npm workspace entry, Node/tsx, process isolation, all registrations, names, options, parameter loops, assertions, deadlines, real restart/timing flows, fixture inputs and cleanup |
| CHANGE | Partition `file-processing` and `multiuser-ask`, `multiuser-memory`, `multiuser-processing`, `multiuser-connectors`; extract unchanged helper declarations and initializers; use Node's native worker default |
| REMOVE | Fixed four-worker limit and oversized serial file grouping |
| EXCEPTION | None; no production behavior, assertion, timeout or success criterion changes |
| UNKNOWN | Fastest stable worker setting and resource pressure, until measured on this host |

`plugin-control-journeys.test.ts` remains intact because an Android fixture reads
its generated worker source. The 61-second real periodic Insight check remains
real. Global clock, fetch and environment mocks retain file-process isolation.
Helper import paths are adjusted solely for their new directory; executable
initializers such as generated WAV buffer writes keep their order.

## Ownership, validation and resources

Only the implementation owner edits the five test families, their helper files,
the Server package test command and this documentation. Production modules,
shared packages, external contracts and the complete-check driver are outside
the change. Server and Web are the consumers selected by `check:affected` for
the package/helper changes; the normal shared contracts and central-runner
checks remain in that plan.

The parity audit compares complete original registration statements with the
multiset across all shards, and checks every nonregistration statement in the
helper with canonicalized module paths and original ordering. Registration-only
evaluation collects expanded names/options without executing any test body.
The five families contain 335 scenarios across 30 shards (previously five files).
Measured registration durations drive greedy balancing; parameterized loops stay
atomic and statements within each shard retain their original relative order.
Actual execution must then verify all
those scenarios, including cancellation, revocation, account separation,
restart, failure recovery, duplicate requests and late publication fences.

Performance runs use generated fixtures, one benchmark at a time, on an 18-core,
64 GiB host. Baseline and candidate use the same installed dependencies and Node
ABI. The frozen baseline's built Agent directory must resolve to the same real
module as `@mote/agent`; copying that directory creates duplicate runtime class
identities and is invalid benchmark preparation. Interrupted preparation runs
and their failures are preserved locally and excluded from timing claims.
Measurements must avoid other complete checks. Report wall time, process-tree
CPU and sampled aggregate RSS, together with test counts and failures.

Use a four-worker control when separating partitioning gains from concurrency
gains. Repeat finalist settings before claiming stable performance. Preserve
first failures; do not loosen existing deadlines to accommodate resource
pressure. Finish with the frozen candidate's full `check:affected` plan and
report its original receipt separately from benchmark runs. Physical devices,
personal content and live models are not part of this fixture-only change.
