# Failed-child retry performance regression

Run date: 2026-10-18 (Asia/Shanghai).
Status: the isolated K retry case passed; the later final integration candidate
and full regression are recorded separately in the
[main integration report](main-multiuser-integration-2026-10-17.md).

## Scope and unchanged behavior

The existing generated-provider case, `failed real child retries only its own
model branch while successful checkpoints remain single-use`, had exceeded its
20-second completion poll in earlier broad regression attempts. These isolated
runs measured that same case without another regression host, renderer, build
or emulator running alongside it.

The [original test](../../apps/server/test/multiuser-ask.test.ts) remained byte
identical in all three runs: SHA256
`69dd7b1efdf533e50901551d478b78413e1b0332361f2f7c83ef1ea6cd89e5e9`.
Its 20,000 ms completion poll, Node's 120,000 ms test timeout and file concurrency
of four were unchanged. The assertions still require:

- The actual Harness parent completes successfully.
- The successful child starts once and the failed child starts twice.
- The successful sibling's durable checkpoint, result, state and attempt count
  remain exactly equal across the other child's retry.
- Exactly one conversation turn is persisted.

Case duration includes fixture initialization and final assertions. A case can
therefore take more than 20 seconds overall while its completion poll succeeds.

## Source and consumed artifacts

Each driver extracted an exact `git archive` of its frozen source into a private
temporary directory. It refused tracked production, test, package or tooling
differences against that source. No install or build occurred inside these
diagnostics. The runtime was Node `v26.11.1`.

| Candidate | Commit | Tree |
| --- | --- | --- |
| J, both diagnostic runs | `8be07ac9c1a01534b60f72d6694c994a17ed0324` | `04e01b0d99d2b365de303a45d7914cc8ff04f92c` |
| K, concentrated repairs | `53446e69c00ab5a64707fdd9f28f65f4532e7ce2` | `07f25cd1650e1e77fe4dff7bdd7216e95587932d` |

The consumed workspace outputs were identical across all three runs: 144 files
under `packages/shared/dist`, 53 under `packages/agent/dist`, three under
`packages/diagnostics/dist`, and `package-lock.json`. The sorted path-to-file-hash
manifest, serialized as compact JSON, has SHA256
`6f8f624243faeca4e4e3c3a81ca6d873dd8752fe0a61acaa053f03be74933c81`.
Each driver verified the same 201 artifact hashes again after its test finished.
The full manifests are retained in the private run receipts.

K combines the MVP compatibility cleanup, retained-history source checks without
unused display-status enrichment, and fixed-query prepared-statement reuse.
This comparison measures their combined effect; it does not attribute the whole
improvement to a single patch. It does not validate later development-server
bootstrap changes or a subsequent integration candidate.

## Actual outcomes and measurement limits

| Run | Natural result | Case duration | Driver duration | Observation |
| --- | --- | --- | --- | --- |
| First J | Exit 0; 1/1 passed, no skips or cancellations | 20.475 s | 22.687 s | CPU profile and event-loop timing only. The first HTTP observer captured zero requests because it filtered out the actual provider pathname. No observed provider count is claimed for this run. |
| Second J | Exit 1; original completion poll failed | 20.894 s | 22.621 s | Additional SQLite/HTTP observer; parent remained `running` after its second `delegation_read`. Six Harness fragments were ready; 16 provider requests were observed before timeout. This is a failed diagnostic, not passing evidence. |
| K | Exit 0; 1/1 passed, no skips or cancellations | 9.623 s | 11.818 s | Same observer as second J. All original assertions passed, with six Harness fragments and all 17 provider requests observed. |

The first J run proves that the original behavior could complete in isolation,
but with little timing margin. Adding observation has overhead; the second J
failure must not be described as a clean, uninstrumented baseline failure.
The second J and K observers are byte identical: SHA256
`f78831daa81a11b4bbc00a0eb84b37375899029da2bfaf41396721d748402e30`.

The corrected observer records only loopback POST pathnames, timings and status
codes. It never reads HTTP headers, bodies, SQL bind arguments or result rows.
The generated provider's actual pathname was `/v1/v1/messages`, which explains
the first observer's zero count. K observed 54 loopback POST requests, all
settled; 17 were provider requests, with 16 status-200 responses and the single
expected status-400 failed-child response. Provider responses totaled 8.488 ms,
with a maximum of 2.235 ms. The six `/_ready` requests identify the six actual
Harness fragments. Second J observed 52 settled loopback POST requests and 16
provider responses, totaling 9.335 ms; its timeout preceded the seventeenth
provider request.

| Synchronous SQLite operation | Second J count | Second J native time | K count | K native time |
| --- | ---: | ---: | ---: | ---: |
| `prepare` | 1,497,243 | 6,820.340 ms | 14,953 | 262.175 ms |
| `get` | 1,443,503 | 7,886.139 ms | 1,133,474 | 4,471.030 ms |
| `run` | 71,814 | 574.752 ms | 55,230 | 432.697 ms |
| `all` | 27,397 | 226.728 ms | 18,147 | 140.826 ms |
| `exec` | 454 | 144.817 ms | 442 | 146.683 ms |

Preparation count fell by **99.0013%**. K still performed **1,133,474 fresh
`get` calls**: compiled-statement reuse did not become a row or authorization
result cache. All calls continue to bind their current owner, grant, run or
lease identity and execute against current SQLite state. Fixed synchronous host
queries own their statements privately; active iterators and mutable statement
options are not shared through the cache. Finalized statements may be prepared
again after a database object is reopened; query execution errors are not
converted into cache misses.

The first J CPU profile identifies finite nested authority work rather than
model response latency as the dominant cost. Its `UserContextAuthority.assert`
subtree sampled 13.751 s, `Ask.current` 10.559 s, `history.run` 8.008 s and
`history.validate` 7.676 s. These subtrees overlap and must not be added together.
The execution engine's `tick` subtree sampled 0.357 s. Each private SQL access
rechecks account/task identity, execution and model leases; repeated history
validation also constructed repositories and requested display status. The
second J operation counters confirm the resulting large number of synchronous
reads and compilations. No timeout was increased and no authority assertion was
removed from the original retry case to obtain K's passing result.

## Evidence and cleanup

Private evidence directories use generated data only:

- First J: `run-20261017T163453Z-066fc6/evidence`.
- Second J: `run-20261017T163736Z-657355/evidence`.
- K: `run-20261017T165022Z-7f594b/evidence`.

| Evidence | SHA256 |
| --- | --- |
| First J `test.log` | `16aedc7067f8ed4becdcdc05a1d286eada15927e79f2f80cd3f120e23a34c0fb` |
| First J `receipt.json` | `d135d63abbe64d103ee07fbd87a29954c47a51824a6969b2d64619cf0bed2c2b` |
| Second J `test.log` | `708669f27cb30e845be2775328a5fc98b5c864187ff6f377558af3a270530e3b` |
| Second J `receipt.json` | `d8f3f83f20a160a50c74e51d4850ec09a17bfd308af73e5b4895a18fa7927877` |
| K `test.log` | `86852e76e59dc4e6dda732c3d9c63ce822f3eb7a1f0d0c32891bd8178c0fdecd` |
| K `receipt.json` | `cf167ff6997e2e84935888f52972444fcbcea4b8f83acd980e25ff514f8fa34f` |
| K SQLite counters | `9f1b3cc7e6473aa4d2147b94212bee9514b7854152fe4368eecb27200f0533e6` |
| K HTTP timeline | `5a18491f4bbe9928330416546bc4141497e318ed3bd3c6c44684643923c8b125` |
| K CPU profile | `0e75dd7cc6d13be48d47378d9e47b578e59b53e74e676ff6955673c3fd1cf096` |
| K comparison summary | `71d5cce9c665c64625acf24a3aafe14f8b5e779725cddd83e3b25ceb438c31a7` |

All three drivers exited naturally, without invoking their outer watchdog.
The original fixture teardown closed its application and generated provider;
each driver's unique fixture directory was then removed. Owned process groups
50687, 52044 and 56173 were inspected after completion and had no remaining
members. No shared process, database, user device or pre-existing resource was
cleaned up by these diagnostics. The consumed artifact hashes remained unchanged.

These runs used deterministic generated model transport to create the precise
failed-child branch through the real Harness. They are **not live-model
validation**. Later checks using the local Codex server, broader regression and
delivery to `main` require their own source-bound receipts; they are not implied
by this isolated K result.
