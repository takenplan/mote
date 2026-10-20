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

Delta P2 received explicit **APPROVE** from the same independent reviewer
before implementation. It replaces the proposed custom subprocess wrapper with the
existing native Node test entry, removing only the fixed concurrency of four.
The wrapper and its experimental tests were discarded before publication.
Native Node retains ownership of test workers inside the existing check driver's
process group. No new subprocess lifecycle, platform requirement or environment
configuration is introduced.

Bounded resource delta P3 received explicit **APPROVE** from the same Sol High
reviewer for clean candidate `dd506be51d1418a213d85f656a238ffe9f9142ff`:
serialize the frozen original at four workers and the candidate at native 17
and explicit 34 workers through the existing common check lock. Cap this sweep
at 34 workers, preserve the first failure, inspect actual host memory pressure
and swap, and repeat the winning full setting before claiming stability. The
result identifies the fastest measured setting rather than a universal optimum.

P4 supersedes only P3's fresh old-four-worker timing run. Before any formal
benchmark started, the same reviewer gave explicit **APPROVE** to measuring
the frozen candidate at 17 and 34 workers, repeating the winning full setting
and retaining the complete PR gate. The previously reported 1646.112-second
four-worker result is historical context with unproved complete input identity;
it is not a reused task receipt or a controlled before/after comparison. This
avoids repeating that approximately half-hour run without removing candidate
coverage. That comparison was subsequently superseded by P5 below.

P5 received explicit **APPROVE** from `/root/plan_review` using Sol High,
before implementation, against original base `4fc433cd2f9f0f43c38c6afc70834ba19d9d5c6a`
and runtime head `dd506be51d1418a213d85f656a238ffe9f9142ff` (only this
design document was dirty). It supersedes the native 17/34 strategy: the
17-worker run produced two real Round 5 failures and was interrupted after
468.943 seconds. It is incomplete, not a successful full timing. The 34-worker
run never started. Raw failures and the interruption receipt are retained locally.

The bounded P5 scope adds six Perception history shards and four shards each
for recording revision parity, MCP query and MCP memory. Only the two
Perception registration loops over `[3,8]` and `[false,true]` may be partitioned
into one-binding loops; their complete calls, binding types/values, expanded
names/options and internal lifecycle order remain identical. It introduces a
minimal asynchronous launcher with inherited process group, the original
Node/tsx discovery and deadline, native concurrency overrides, and a default
cap selected from 8 or 12 after sequential stress measurements. Failure and
SIGINT/SIGTERM validation must use the real check driver with signal-resistant
worker/grandchild and an unrelated sentinel. The launcher never creates a new
session or process group.

Measurement-only `ps` snapshots run in their own short-lived sessions and are
awaited/reaped with sampling errors preserved. This prevents macOS's setuid
`ps` from temporarily making a driver-owned process group unsignalable; the
actual tests remain in the driver's group. Production check-driver code does
not change. Root owns splitting, documentation, measurement and the complete
check; `/root/test_inventory` uniquely owns the launcher, its regression tests
and the package test entry. This ownership delta P5-O1 was acknowledged by the
same reviewer before that implementation.

Required evidence is parity of all 397 scenarios, focused execution of the
62 newly moved scenarios and launcher lifecycle, sequential 8/12-worker stress
cohorts containing all nine families plus both failed Round 5 suites, archive
admission and the single long memory-import journey. Freeze the selected cap
and require at least two successful full Server runs, including the actual
13-task `check:affected` gate. No assertions, deadlines or success criteria
are relaxed. Historical four-worker timing remains reference only.

Measurement-only delta P5-M received explicit **APPROVE** from the same
reviewer before stress measurement. The common check lock serializes our runs,
but an unrelated Windsurf four-worker test run and normal real Mote background
processing can remain active. Record this external load without stopping it.
Results identify the fastest observed setting under that load; changing
background activity prevents a controlled quiet-host speedup/ranking claim.
The first added-family focused run is preserved as 60 passes and two
120-second Perception timeouts, not successful coverage of all 62 scenarios.

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
distributing the large suites across more files and selecting a measured cap
for Node's file workers through `test/run.mjs`. Explicit native
`--test-concurrency` flags remain available through `npm test -- ...`.
Tests inside a file do not become concurrent.

| Classification | Decision |
| --- | --- |
| KEEP | npm workspace entry, Node/tsx, process isolation, all registrations, names, options, binding values/types, assertions, deadlines, real restart/timing flows, fixture inputs and cleanup |
| CHANGE | Partition nine suites into 48 balanced shards; extract unchanged helper declarations and initializers; use a measured CPU-based worker cap with native overrides and inherited process-group ownership |
| REMOVE | Fixed four-worker limit and oversized serial file grouping; superseded unlimited native worker default |
| EXCEPTION | None; no production behavior, assertion, timeout or success criterion changes |
| UNKNOWN | Fastest stable worker setting and resource pressure, until measured on this host |

`plugin-control-journeys.test.ts` remains intact because an Android fixture reads
its generated worker source. The 61-second real periodic Insight check remains
real. Global clock, fetch and environment mocks retain file-process isolation.
Helper import paths are adjusted solely for their new directory; executable
initializers such as generated WAV buffer writes keep their order.

## Ownership, validation and resources

The owners named in P5 edit the nine test families, their helper files,
the Server launcher/package test command and this documentation. Production modules,
shared packages, external contracts and the complete-check driver are outside
the change. Server and Web are the consumers selected by `check:affected` for
the package/helper changes; the normal shared contracts and central-runner
checks remain in that plan.

The parity audit compares complete original registration statements with the
multiset across all shards, except the two approved parameter loops. It checks
every complete test-call hash together with its expanded name/options/mode and
enclosing loop binding declaration/type/value. It also checks every
nonregistration statement in the helper with canonicalized module paths and
original ordering. Registration-only evaluation never executes a test body.
The [parity inventory](../validation/server-test-split-parity-2026-10-20.json)
records 397 scenarios across 48 shards (previously nine files).
Observed registration durations guide greedy balancing; all other parameterized
loops stay atomic and statements within each shard retain their original order.
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
pressure. Finish with the frozen candidate's full [PR check plan](../development.md#pr-check-scope) and
report its original receipt separately from benchmark runs. Physical devices,
personal content and live models are not part of this fixture-only change.
