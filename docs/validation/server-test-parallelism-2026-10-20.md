# Server test parallelism validation — 2026-10-20

This report records the original parallelism checkpoint. Later advisory budgets,
functional/optional entry separation, latest-main integration and Memory recovery
changes have separate [final integration evidence](pr-168-189-191-integration-2026-10-20.md).

## Candidate and scope

Original source: `4fc433cd2f9f0f43c38c6afc70834ba19d9d5c6a`.
Final runtime candidate: `2ae39ebb32c66aa51acbf18c55d5da5b4ea69139`.
Later documentation edits do not change the runtime inputs.

Nine suites become 48 files. All 397 original registrations retain their
complete test-call text, names, options, loop binding declarations/types/values,
helper ordering and canonical import targets. Only two Perception registration
loops are partitioned into one-binding loops. The
[independent parity inventory](server-test-split-parity-2026-10-20.json)
records the per-file hashes at `4fe376b0`; the only later runtime change is the
launcher cap from eight to six. Seven new launcher regressions cover discovery,
native overrides/failures, PID-targeted signals, and real check-driver cleanup
of resistant workers/grandchildren while preserving an unrelated sentinel.

The [ADR](../adr-server-test-parallelism.md) records the decision; the
[technical plan](../design/server-test-parallelism.md) records preimplementation
approvals P1–P6 and the scope of superseded experiments.

## Host and method

- macOS 27.0.1 arm64, Node 26.11.1, npm 11.20.0; 64 GiB RAM.
- 18 available CPUs: system performance levels report 6 `Super` and 12
  `Performance` cores. No CPU affinity is changed.
- Lockfile SHA-256:
  `22c87d68306fa770b5a1b1b18071a827044d4415d2d84837683556d77225d5a3`.
- One driver uses the existing shared repository lock. Formal stress runs are
  sequential; an unrelated four-worker test run finished before them. Normal
  real Mote background processing remains active. No personal data or services
  are stopped, read for test inputs, or used as fixtures.
- Samples are taken every two seconds. CPU seconds are child resource usage
  including small measurement overhead; mean occupied cores is CPU/wall time.
  Sampled CPU percentages are lifetime process averages. RSS is a process sum
  and can count shared pages more than once. No swap increase was observed in
  the completed stress runs.

## Concurrency sweep

The identical 404-case cohort contains all nine moved families, both Round 5
release/evaluator suites, the 100000-revision archive admission suite, and the
single thousand-original background import journey. Assertions, timeouts and
internal physical concurrency are unchanged.

| File workers | Result | Wall seconds | Child CPU seconds | Mean cores | Sampled peak CPU | Peak RSS sum |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 6 | 404 pass | 361.260 | 1618.530 | 4.48 | 614.7% | 6.46 GiB |
| 8 | 404 pass | 352.050 | 1940.702 | 5.51 | 845.6% | 6.80 GiB |
| 12 | 403 pass, 1 timeout cancellation | 298.121 | 2011.165 | 6.75 | 1113.6% | 9.80 GiB |

Eight workers were only nine seconds faster than six in this cohort and did
not survive the full suite: the reused OCR listener case took 120.365 seconds
and timed out, while the other physical-eight-call case passed at 118.510
seconds. The full eight-worker run was stopped and is **incomplete**. Its
elapsed time is not a full-suite speed measurement. Twelve workers exceeded
the same unchanged 120-second deadline in the non-reuse case.

At six workers, those two physical cases took 96.15/87.49 seconds in the cohort
and 93.40/100.74 seconds in the first full run. Their hot 8→3→8 transition,
eighteen held A/B calls, busy reused listener and late-cancellation fences were
not replaced by simplified timing fixtures.

Stress receipts: `270a81cc-a81f-4756-abdd-5b5ad274ae80` records the passed eight
and failed twelve tasks; `1cb6c3de-d820-4d69-874d-878963cc2384` records the passed
six-worker cohort. Both confirm cleanup. These are benchmark evidence, not
reused PR-gate tasks.

## Full execution

| Entry | Result | Server wall time | Receipt |
| --- | --- | ---: | --- |
| `npm test -w @mote/server` with native TAP/measurement reporters | 3662 tests: 3653 pass, 9 skip, 0 fail/cancel | 1252.279 s (20m52s) | `5b5953b2-1771-4220-82a5-f3bef472de6d` |
| `npm run check:affected -- --base 4fc433cd` | All 13 tasks passed; Server 3662 tests: 3653 pass, 9 skip, 0 fail/cancel | 1238.976 s (20m39s) | `3a5cc650-3466-4833-a988-58fd83b5fc92` |

The first full run confirms stable inputs, exit zero and cleanup. It used
5210.832 child CPU seconds (mean 4.16 cores), sampled peak 670.2% CPU and
9.60 GiB RSS sum, with no sampling errors. The second full run's two physical
OCR cases passed at 94.05/101.04 seconds.

The complete gate took 1406.581 seconds (23m27s). All 13 tasks were newly
executed: four preflights, Shared/Agent/Server/Web builds, Server/Web/Shared
tests, release integration and central-runner. Its counted test suites contain
102 release-contract, 3662 Server, 619 Web, 198 Shared and 37 release-integration
tests: **4618 total, 4609 pass, 9 skip, 0 fail/cancel**. Central-runner also
passed. No passed or incomplete benchmark was reused as gate evidence.
The original receipt confirms stable inputs and cleanup; its SHA-256 is
`6358089f2f91ef839cd2896c2c64f8721b9328a63e13ebbd9dc626de404009de`.

Post-gate verification reproduced the original full benchmark fingerprint
`d0a5f1835b03767ed41bede95fc05e086ed7a24980c927609b3f3a0a1e475d7a`,
including source, installed dependencies, built Server/Agent/Shared/Diagnostics
bytes and measurement definitions. The npm-run source/environment identity
also matches the real gate's
`3fa0cefae6ba4a1fe10b96ef3b5155bd74b4608ebe72ba0787a1cf5ca3febed8`.
The direct-Node driver's source identity is separately
`17585143260ce5673e3f3c3059a19d2c0adc354baa2d099c367d38efaa7d1e26`:
npm prepends its lifecycle binary paths, so different entry environments do
not imply different source. Each entry was checked in its own environment.

The historical four-worker gate finished at 03:30:15 UTC, receipt
`87ab7bf9-ce98-4a80-a898-87a290fed710`: Server 1646.112 seconds (27m26s), whole
gate 1791.128 seconds (29m51s). The first new full Server run is 393.833 seconds
shorter than that record; the second is 407.136 seconds shorter. The old receipt
does not establish matching complete inputs, and background load/cache state
differs. This is a historical timing
reference, **not a controlled before/after speedup** or reusable gate evidence.

## Preserved failures and limits

The earlier native seventeen-worker experiment used interim head `dd506be5`,
produced two real Round 5 failures and was interrupted. It is not a completed
timing, and thirty-four workers were never run. Initial copied-build class
identity failures in old-checkout preparation are excluded from timing data.
An added-family eight-worker focused run had 60 passes and two cancellations;
those physical cases subsequently passed alone before formal stress testing.

Interruption also exposed EPERM during process-group cleanup. The original
full-eight receipt `4a8afaf8-b982-4c82-b677-2be19dfa532c` preserves
`cleanupConfirmed:false` and the retained lock. A separate process/cwd/orphan
audit found no remaining owned test processes before manual lock release;
unrelated tools/worktrees were preserved. The receipt was not rewritten as
clean. Measurement-only OS snapshots now use separately reaped sessions;
focused failure, injected sampling error, SIGINT and SIGTERM probes preserved
errors, cleanup receipts and unrelated processes. Production check-driver
source is unchanged.

All execution here uses generated fixtures and loopback providers. No personal
screenshots, physical-device checks, real-model acceptance, native client UI,
container checks or cross-platform/CI success are claimed.
