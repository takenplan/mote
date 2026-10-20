# Server test parallelism

The current decision is the measured six-worker cap in the
[ADR](../adr-server-test-parallelism.md). The
[validation record](../validation/server-test-parallelism-2026-10-20.md)
separates final checks from failed or incomplete experiments. The approval
history below retains the superseded plans rather than presenting them as the
current behavior.

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

P6 received explicit **APPROVE** from `/root/plan_review` using Sol High before
implementation, at original base `4fc433cd2f9f0f43c38c6afc70834ba19d9d5c6a`
and runtime head `4fe376b0202910f796ea5bb660e69314c9f243b2` (docs-only dirty).
The 8-worker stress cohort passed all 404 scenarios, but its first full run
hit the reused-listener Perception deadline at 120.365 seconds; the other
physical-eight-call case passed at 118.510 seconds. That full run was
interrupted and is incomplete. Its cleanup receipt also preserves an EPERM
and unconfirmed cleanup; a separate process/cwd/orphan audit found no remaining
owned test process before the retained lock was manually released. Neither
the receipt nor its incomplete elapsed time is promoted to a passed result.

P6 supersedes the unsafe 8/12 selection with a six-worker cap only. Root owns
that single constant change, documentation and the check driver. The formula,
native CLI override/discovery, process groups, signals, 120000 ms deadline,
397 original scenarios and their internal physical concurrency remain intact.
Required validation is the seven launcher regressions, source parity, the same
404-case stress cohort at six workers, then two full passing Server runs at
the frozen cap including the complete 13-task PR gate. Stability is unknown
until those results; no automatic fallback or assertion relaxation is added.

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
| UNKNOWN | Optimum on other hosts or future workloads; global optimum beyond the measured settings |

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
64 GiB host with Node 26.11.1 and this checkout's installed dependencies. The
8/12-worker stress comparison uses identical source and built outputs, guarded
by the common driver and an input digest. The unrelated Windsurf test run had
finished before these two formal stress runs; ordinary Mote background work
remained active as allowed by P5-M. Report wall time, child CPU time, sampled
process-tree CPU and RSS sum, together with test counts and failures. RSS sum
can count shared pages more than once.

The old frozen checkout is used for source parity, not a fresh timing control.
Its Agent path had initially resolved to a copied build, causing duplicate class
identities; interrupted preparation runs are preserved and excluded from timing
claims. No controlled attribution separates splitting gains from worker-count
gains or changing host load. The previous four-worker timing is historical only.

Repeat the final setting with the full native npm entry before claiming
stability. Preserve first failures; do not loosen existing deadlines to
accommodate resource pressure. Finish with the frozen candidate's full
[PR check plan](../development.md#pr-check-scope) and report its original receipt
separately from benchmarks. Physical devices, personal content and live models
are not part of this fixture-only change.

## Measured outcome

The six-worker cohort passed all 404 cases in 361.260 seconds. Full Server
runs at frozen runtime `2ae39ebb32c66aa51acbf18c55d5da5b4ea69139` then passed
in 1252.279 and 1238.976 seconds, each with 3653 passes and nine existing skips.
The second ran through the actual 13-task affected-component gate, which
passed all tasks in 1406.581 seconds with confirmed cleanup. Post-gate source,
dependency and built-output checks match the original run identities; these
are two executed full checks, with no reused benchmark task.

The default remains six. Eight and twelve showed that more simultaneous files
can breach existing physical-call deadlines; those failures remain in the
[validation record](../validation/server-test-parallelism-2026-10-20.md).
The historical 27m26s Server / 29m51s whole-gate figures are references with
unproved matching complete inputs, not controlled speedup attribution.

## P7: advisory performance budgets

Plan identity: **P7**, base/head before implementation
`54aea060f4731ed8300779dfdcc9002382622f04`. The owner selected option B:
documented budgets plus automatic warnings, without a timing-based failure gate.
Before implementation, `/root/plan_review` (Sol High) explicitly **APPROVED**
P7 at that exact base/head. The reviewed preimplementation section SHA-256 was
`5a97e24f12f349c4bdc62dfb35291f7867c83fe79a7db07700aa3cbe6b26285a`.
Acceptance includes native dash/underscore option aliases and quoted
`NODE_OPTIONS`, preserved stream errors and accurate partial-evidence labeling.

- **KEEP:** the actual npm → launcher → native Node/tsx entry, six-worker cap,
  discovery, file isolation, all test bodies/assertions/scales/deadlines, native
  failure and signal propagation, common-driver ownership and cleanup. There is
  no additional test execution, scheduling policy or lifecycle change.
- **CHANGE:** add a default native reporter which feeds the same events through
  Node's built-in `spec` reporter and then appends an advisory timing summary.
  Use native per-file `test:summary.duration_ms`, never sums of nested cases;
  individual completed tests use `details.duration_ms`, excluding suites and
  skipped/TODO cases. Ordinary-file budget is 60 seconds; individual-case
  reminder is 30 seconds. Thresholds do not change exit status or timeouts.
- **REMOVE:** none. No assertion, scenario, input volume or required check is
  removed. LOC/case counts and minimum concurrency are not new gates.
- **EXCEPTION:** explicit native reporter/destination options in argv or
  `NODE_OPTIONS` keep their original native behavior; default reporter injection
  is omitted. Document how to select the performance reporter explicitly.
  Long real journeys remain visible in warnings; document justified exceptions
  separately from the existing slow-file backlog, without blanket exemptions.
- **UNKNOWN:** timing remains sensitive to host contention, cache and concurrency.
  Reports state their observational/advisory meaning; a comparison records the
  reference environment and complete inputs. No regression claim from a single
  sample, and no automatic baseline reset or suppression.

Root exclusively owns `apps/server/test/run.mjs`, its launcher regressions, the
new reporter and focused reporter tests, this plan, `docs/development.md` and
one short principle/link in `AGENTS.md`. The inventory agent is read-only.
Existing ADR and validation evidence retain their original scope and provenance.

Validation: synthetic native event streams exercise exact thresholds, file vs
nested-case accounting, failed/skip/TODO handling, incomplete runs, ordering and
empty output without real 30/60-second waits. Generated launcher fixtures verify
the real default entry emits the report and preserves genuine failures, CLI
reporter/destination overrides (including `NODE_OPTIONS`), invalid options and
both existing signal/real-driver cleanup journeys. Then freeze the candidate
and run the actual affected-component gate once, requesting only driver-proven
receipt reuse for unchanged tasks. Root is the sole complete-check driver; no
new CPU sweep, foreground UI, personal data, device or live-model checks.

The main risks are reporter-stream errors/backpressure, counting nested durations
twice, native option interference, misleading timing comparisons and alert noise.
Use the public Node reporter/stream APIs; preserve stream errors and native
exit status. Keep warnings visible and documented rather than relaxing coverage.

Within P7, a read-only implementation review found that searching raw
`NODE_OPTIONS` could mistake reporter-like text inside an import path for a
reporter selection. The local correction tokenizes native double-quoted options
without changing the forwarded value. Synthetic quoted/escaped paths and a real
generated import path with spaces and reporter-like text cover this correction;
it changes no coverage or decision boundary and needs no new design approval.
