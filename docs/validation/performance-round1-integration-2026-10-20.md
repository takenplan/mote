# Performance round 1 integration validation

Evidence snapshot: **2026-10-21 (Asia/Shanghai)**. The failed full-load baseline is `ec89cdc92e2b8d76bd6c497d65fd7523b5e5bf13`: its normal complete affected run and subsequent full Server diagnostic both reproduced the original three blocking scenarios, two assertion failures and one timeout/cancellation. A later bounded joined-proof candidate, `4ac0f966a7c90ca70424d8a8717b6d2f965ad1e1`, has independent implementation approval and the same dedicated safety fixture passed 25/25 on both inputs; its fresh proof-read count reduction is established, while wall/CPU benefit remains **INCONCLUSIVE**. The later sections record its seven-consumer/build outcomes and root's new original-cohort result; complete combined acceptance remains separate. No complete check here passed. Focused Recording 12/12, default-six cohort 17/17 and six-file diagnostic 45/45 results remain bound to their recorded inputs and scopes.

This document preserves that dated evidence rather than serving as a live readiness flag. Final combined checks, original failures, later results and uncovered states for [PR #201](https://github.com/utopiafar/mote/pull/201), [PR #202](https://github.com/utopiafar/mote/pull/202), [PR #203](https://github.com/utopiafar/mote/pull/203) and the component version candidate are indexed in the public [integration PR #201](https://github.com/utopiafar/mote/pull/201). Those later results are not asserted here in advance. Exact-tag Release CI run reports and actual asset verification are indexed in the same PR; a workflow definition or a source merge is not a successful run, installation or deployment. This evidence arrangement allows the source document and versions to freeze before the final driver without rewriting the passed tree just to append PASS prose.

See [the approved integration scope](../design/performance-round1-integration-plan.md) for frozen module identities, ownership, main/PR194 boundaries and the real HTTP witness. The sections through the initial TaskExecution correction preserve earlier checkpoints; the later sections explicitly supersede their then-current status without changing the original failures.

## Module handoff evidence

| Module | Newly executed module evidence | Limits |
| --- | --- | --- |
| A | 59/59 focused tests and Server build | Generated 10k original-query comparison took about 121 seconds; documented budget exception |
| B | Generated extracted-selector/native SQLite observations; documentation checks | Design only; not actual ExecutionEngine or optimized implementation validation |
| C | Generated HTTP upload/export and SQLite investigation; documentation checks | Design only; no product export optimization or production WAL change |
| D | 85/85 focused tests, Web build and hidden current-login browser | Generated HTTP renderer fixture does not prove Server authentication |
| E | 229 focused tests, 2 account/ACK consumers, native/Desktop build and generated Electron smoke | Module smoke creates no window; production main startup/permissions are separate |
| F | 38/38 focused JVM tests after existing fixture prerequisites | No emulator, physical device, APK or live-model claim |

The independent handoff audit checked final HEAD/tree/commit/file identities, module scope, applicable approvals, remote draft PR heads and original cleanup receipts. All six inputs matched. These results remain **MODULE EVIDENCE**, not final driver `REUSED` tasks.

## Controller evidence

The controller independently installed dependencies and built shared prerequisites through the resource gate. The composed source candidate includes all frozen module patches, latest main, and the approved HTTP witness.

Newly executed at source candidate `f266d6acc65ea3e8d89f54729f82b91f11831c2f`: the complete latest `multiuser-memory-integration-domains.test.ts` suite passed **11/11**, with no skips/cancellations, in 54.154 seconds. This includes actual loopback HTTP Operations witnesses in both failed/paused continuation cases, plus due, retry, local cancel, global stop and restart states. Owned processes were cleaned and the resource lease was released. This is focused controller evidence, not a full-driver task reuse receipt.

Independent static composition review at the same SHA confirmed all 12 cherry-pick patches match their originals, all 49 module file blobs are preserved, and PR194 product code/documentation is unchanged. Removing the added witness leaves its original test byte-for-byte intact. The reviewer ran no tests.

## Earlier complete checks and diagnostic checkpoint

Two complete `npm run check:affected -- --base bcff7bab6109a7c99acde3decb5712a072e1b045 --head HEAD` attempts at `e0d9be2c9f92342e84a4172b159647f5bdf5d321` failed in Server with the same original three scenarios: **3,701 passed, two failed, one timed out/cancelled, nine skipped**. Both used the original default six Server file workers and completed cleanup. The driver run IDs are `da99d75d-d6de-41a4-827e-f09029674744` and `ede60a71-80cb-4670-b8f4-9c4513d1788f`.

The preceding eleven selected tasks passed in those attempts. The later Web/shared tests, release integration, central runner and Android unit task were **UNRUN**. These attempts are failed acceptance evidence; no task reuse is claimed.

Unmodified focused diagnostic runs passed the three scenarios serially and the related seventeen cases at both six and four workers. Those passes neither establish the full-suite cause nor justify changing the default concurrency. An independently approved bounded observer subsequently reproduced the three failures in a default-six Server run at `700b944439bfa5ad6d1e6e08ad7d3bb206b66c68` (1,401.010 seconds, confirmed cleanup). Original assertions, input scale, entry points, deadlines and physical resource lifetimes were preserved.

At that earlier checkpoint, independent diagnosis confirmed these immediate mechanisms:

- With separate listeners, B's understanding task had valid running authority and issued its first Messages/read_image request, but did not reach the second model request/held state within the original twelve-second wait. A requested tool call does not prove tool completion.
- With the reused listener, the original 120-second cancellation occurred while the raise-to-eight settings request was still pending. Lower-to-three and raise-to-eight took about 14.6 and 14.8 seconds; busy-listener nineteen/all-twenty states were not reached before cancellation. This does not establish a listener deadlock.
- In Recording, the injected runner had finished for r2 while subsequent media processing/publication still held the sole media unit; r1 had not reached its runner. The runner marker does not establish completion of the media adapter or physical resource release.

An independently approved earlier three-case CPU sample identified repeated live authorization as a product-path hotspot. Inclusive stack fractions overlap and are not additive. The sample passed at file concurrency one; it does not allocate the complete failing window or prove that round 1 introduced a regression.

## Bounded TaskExecution remediation

Commit `35ee36ad24212637ade523c77bfb73346e5a4aa7` adds fresh narrow reads in `TaskExecution.valid` and `modelCurrent`. A shared identity assertion retains the original checks and order. Generic full-row consumers, account closure, grant/epoch/revocation, model and lease/fence checks remain intact. No authority result is cached. This separately reviewed single-file remediation does not release the original round-two scheduling/proof plan.

Executed for that isolated source/input pair:

- Baseline and candidate each passed the same repaired dedicated safety fixture **5/5** and the nine necessary consumer files **68/68**, with no skipped/cancelled cases and confirmed cleanup.
- Independent implementation review found and resolved a new-test false positive and setup-failure cleanup gap. The final safety fixture was run on both original and candidate source; old mismatched benchmark evidence was superseded.
- Paired measurements used actual public account/task admission, held handlers and live authority validation: two generated owners, three rounds, six samples per input size, 200 calls per sample. Instrumented measurements were separated from the primary uninstrumented timings.

| Generated input | Original median per 200 calls | Candidate median | Observed reduction |
| --- | ---: | ---: | ---: |
| 1 KiB | 10.81 ms | 9.44 ms | 12.6% |
| 32 KiB | 16.05 ms | 12.28 ms | 23.5% |
| 256 KiB | 54.03 ms | 29.95 ms | 44.6% |

Both phases retained 2,800 total SQLite get calls, including 600 task-row reads, per 200 validations. Only returned task columns changed. Serialized result-byte counters are not heap allocation or physical I/O measurements. Original-before-candidate order, host load and GC limit these local results; they are not production P95 or whole-service gains.

At this stage, the unchanged original three scenarios produced **two PASS and one FAIL**, with no skipped/cancelled cases, in 170.82 seconds. Both OCR/listener scenarios reached their required states. Recording again failed `First audio must be physically held`. The owner stopped before the default-six cohort and did not repeat until PASS. All owned processes and leases were cleaned.

That checkpoint still left the post-runner and next-task preflight costs unresolved. A roughly four-second interval between the injected r2 runner marker and durable completion is derived from different clocks; it is not a precise allocation to file I/O, authorization, archive publication or task settlement. The six-second wait's nominal deadline was about 9,159 ms from scenario start; the approximately 9,624 ms failure/cleanup observation is not that deadline. The following independently reviewed changes and later observations retain that failure as historical evidence; they do not assign its entire interval to a single cause.

## Subsequent fresh-proof and engine-template corrections

The separately reviewed source changes `ee03cace48080597e120e7d1f3866a33384da526` and `c87b3ea023acde8d81db97b809220cc85c3d8108` are ancestors of `ec89cdc9`:

- `ee03cace` uses fresh narrow connector/plugin proof projections and reuses compiled statements. The actual current account, grant, binding, issuance and ledger checks remain; there is no cached authorization result or reduced durability contract. Its focused 38-test result and single matched proof-read measurements are isolated-source evidence. Its original plain Recording attempt still failed and is retained.
- `c87b3ea0` reuses the two fixed ExecutionEngine tick statement templates. An initial two-line variant passed 7/8 safety cases and failed the existing native-error/repair case; it was rejected. The final delta evicts a failed iterator's cached statement while preserving the original error. The same unchanged safety fixture then passed 8/8; the four necessary consumer files passed 34/34, including the unchanged 400-task fairness scale, and the Server build passed. Mandatory tick writes, full-row consumers, fresh read counts, claim/fence semantics and original iterator behavior remain.
- `ec89cdc9` synchronizes only the already approved `scope-inventory.json` fingerprint. Its product and test bytes match `c87b3ea0`; that metadata fact does not relabel earlier focused executions as new `ec89` runs or driver `REUSED` tasks.

Independent source/evidence review supported these bounded changes, not complete remediation of the full-suite failure or the original second-round scheduling/proof design. Old snapshots describing `ee03` as not integrated, or the final Recording file as 9/9, are superseded: the integrated source is as above, and the original raw TAP count is 12/12. The prior source failures and count correction remain separate records.

## Bounded local gains and their units

The TaskExecution table above retains its exact paired-input measurements. The following additional values are their original module/remediation executions, not newly measured integrated `ec89` performance. Source integration does not turn them into driver evidence reuse.

| Workload | Original → candidate observation | Required interpretation |
| --- | --- | --- |
| Current-head HTTP first page, limit 60 | Per owner 1k current + 1k historical: 93.72 → 7.56 ms; 10k + 10k: 11,844.91 → 33.44 ms | Two generated owners, same database and inputs, eight complete response comparisons. Single local observations, not medians, production P95 or an SLA. |
| Operations dependencies for 100 returned steps | 100 → 1 SQL reads; median 1.660 → 0.852 ms | Five rounds × 20 reads of the same state; each step's ordered first 100 dependencies preserved. Not whole scheduler latency. |
| Web typing with 100 already loaded answers | Ten inputs: 1,000 extra historical renders and Markdown parses → 0 | Measures extra historical work caused by typing, not initial render or browser INP. At 1/20 loaded answers the counts are 10/200 → 0. |
| Web attachment slice hashing | Two → one SHA call per slice | Whole-file hashing remains; byte-identical wire fixtures are 1 B, 4 MiB and 4 MiB + 17 B. No measured CPU-time, throughput or power saving. |
| Desktop `DirectoryCatalog.next(1)` full sweep | 1k: 16.59 → 5.57 ms; 6k: 315.96 → 21.45 ms; 12k: 1,023.58 → 37.77 ms | Generated real directories with constant stat metadata isolate the enumeration algorithm. Both versions make N stat calls and N+1 pages, with equivalent output/checkpoints. Not a 27× real-I/O or whole-sync claim. |
| Fresh connector/plugin proof methods | 3,000 calls each: `assertCurrent` 129.437 → 106.870 ms; `assertStoredBinding` 122.051 → 68.986 ms; `binding` 207.188 → 103.327 ms | One matched plain sample per version, using actual HTTP-admitted contexts; setup excluded. Local wall reductions 17.4%, 43.5%, 50.1%; fresh queries and ledger writes remain. Not overall Recording improvement. |
| Real blocked-capacity engine ticks | 2,000 ticks after 20 warmups, 12 waiting tasks: wall 733.579 → 283.197 ms; user+system CPU 746.302 → 296.284 ms | One matched generated workload: local wall −61.4%, CPU −60.3%. Observed calls remain 2,000 blocked + 8,000 candidate reads; prepares change 2,000/8,000 → 0/0 after warmup. No row or authority cache. |

The engine's instrumented wall comparison, 809.514 → 279.928 ms, is structural-count evidence rather than the primary timing comparison. Instrumented-minus-plain includes a negative candidate difference from run variation; it is not a measurement of total observer overhead. Uninstrumented counter zeros mean counters were disabled, not that no SQL calls occurred.

Additional count-only evidence has no elapsed-time or memory-saving claim:

- Desktop file checkpoint mode avoids the unused complete-checkpoint accessor in normal and actual recovery scans while retaining independent complete checkpoints for default/custom adapters.
- Desktop's three shared-image events use three blob reads/hashes in packed and nonpacked modes; disabled/enabled diagnostics make three/six base64 calls respectively while preserving payload and byte-accounting behavior. The generated Electron smoke observes one packed selection. These are candidate counts, not a frozen-original timing comparison.
- Android nonpacked selection opens only the selected first blob from eight generated blobs before payload construction, retaining exact retry payload, ACK, restart and order. This is JVM selector/queue/HTTP-consumer evidence, not real WorkManager, device power or elapsed-time evidence.

Host load, execution order, GC, cache state and single-host measurements limit portability. Local gains cannot be added together or converted to whole-service latency, production QPS/P95, browser INP, live-model cost or device power. C's export/WAL work remains baseline/design only; the original B scheduling/proof/organizer changes and the deferred D/E/F follow-ups are not implemented by these narrow corrections.

## Later focused original journeys

At `c87b3ea0`, one unfiltered invocation of the unchanged original Recording file passed **12/12**, no fail/cancel/skip, in 32.139 seconds with confirmed cleanup. It exercised the legal r2 → r1 → r3 ordering, actual r1 physical hold, all three canonical transcripts and three unique Materials while held, later-page discovery, one media unit, explicit release and final settlement.

The controller then newly executed the unchanged original default-six cohort: **17/17**, no fail/cancel/skip, reported TAP duration 71.113 seconds, with cleanup and resource release confirmed. The actual assertions include both owners' OCR/understanding states, reused listener, hot limit 3 → 8, nineteen-busy/all-twenty states, cancellation/late-publication boundaries, and the Recording states above. This is a focused cohort, not the 582-file Server selection or the complete 17-task driver. Neither focused success is relabeled as a new `ec89` execution, or used to erase earlier failures.

## Latest normal complete affected run

The controller's normal `check:affected` run `9fe0f968-fac8-4ee6-98b5-5303c45ce80c` used base `bcff7bab6109a7c99acde3decb5712a072e1b045` and source `ec89cdc92e2b8d76bd6c497d65fd7523b5e5bf13`. It finished on 2026-10-20 UTC after **1,545.257 seconds**, exit 1, with cleanup confirmed:

| Actual driver scope | Result |
| --- | --- |
| Eleven preceding tasks: environment, i18n, scope/release contracts, shared/diagnostics/Agent/Server/Web builds, Desktop typecheck and Desktop tests | PASS |
| Server, original default-six continuously replenished 582-file selection | **FAIL**; 3,727 tests: 3,715 passed, two failed, one timed out/cancelled, nine skipped; task 1,407.675 seconds |
| Web tests, shared tests, release integration, central runner, Android unit task | **UNRUN**; five tasks were not reached after the Server failure |

The same three blocking scenarios remained: independent OCR listeners, the reused OCR listener, and Recording's first-media hold. A timeout/cancelled case is not relabeled as a third assertion failure. All 17 driver tasks were selected; eleven passed, one failed and five were unrun. No task reuse or successful complete gate is claimed. The earlier gains consolidation captured this driver as RUNNING; the terminal receipt and raw log above supersede only that then-current status, not its historical measurements.

## Full Server observation at the same source

A separately approved diagnostic ran the real Server entry at `ec89cdc9`, with the original 582 files, default six workers and continuous replacement of finished files. Assertions, scale, entry points, 6-second/12-second waits, the 120-second file deadline and physical resource lifetime were unchanged. It naturally finished in **1,361.171 seconds**, exit 1, with **3,727 tests / 3,715 pass / two fail / one cancelled / nine skipped**. This reproduced the same blocking categories; it is diagnostic evidence, not a successful affected check.

Inputs matched the sealed identity before and after the run. The controlled observation helper was restored, source HEAD remained `ec89cdc9`, the working tree was clean, owned processes were cleaned and the resource lease released. All three target observers activated, exited and flushed; collection errors and overflow were zero. The observation did not change product code or authorize an optimization.

### Reached states and the original deadlines

| Scenario | State actually reached in this observation | State not established |
| --- | --- | --- |
| Independent OCR listeners | The initial-18 wait lasted 12.146 s. A's eight OCR/eight understanding calls and B's OCR were held; B understanding issued `read_image` before timeout. | B's second model request/held state was not reached. The final 2.989 s after `read_image` is a process window, not tool I/O service time. Later lower/raise/listener states were not run. |
| Reused OCR listener | Initial-18 was reached; lower-to-3 took 13.325 s and raise-to-8 took 10.987 s. The shared-listener wait began; the ninth A understanding actually issued `read_image` before native timeout cleanup. B's second round was held. | Busy-listener nineteen/all-twenty and later assertions were not reached. This advances beyond the preceding plain failure's issued-without-actual-request state, so the snapshots are not identical. |
| Recording | First-media wait lasted 6.041 s under the unchanged nominal six-second wait. Later-page search occurred and three recording works existed with media limit one. The r2 injected runner returned, but r2 media remained running/local-active without an outcome at cleanup; r1/r3 remained waiting, attempt zero. | r1 did not become physically held. Only two transcripts succeeded and the third was running; the all-three canonical transcripts/Materials while-held, explicit release and final settlement assertions were not reached. The 1.961 s after r2 runner return cannot be wholly assigned to r2 publication, ledger, adapter close or local-active retirement. |

The latest Recording state must not borrow the earlier plain run's three-successful-transcript snapshot or the focused passing file's reached states. Processing, Memory Material and Ask indexing tasks were genuinely active alongside Recording; the injected runner marker alone does not establish media adapter completion or physical slot release.

### CPU, event loop and native database evidence

The following increments use the first and last samples **inside** each phase and exclude uncovered endpoints. Process CPU includes all process threads. Event-loop active time is not CPU time; zero idle does not identify a specific native operation.

| Phase | Phase wall | Internally covered | User CPU | System CPU | Event-loop idle |
| --- | ---: | ---: | ---: | ---: | ---: |
| Independent OCR initial-18 | 12.146 s | 10.454 s | 2.952 s | 6.163 s | 0 |
| Reused listener initial-18 | 9.045 s | 7.651 s | 2.957 s | 3.954 s | 0 |
| Reused listener lower | 13.325 s | 12.995 s | 4.020 s | 6.469 s | 0 |
| Reused listener raise | 10.987 s | 10.228 s | 3.537 s | 5.529 s | 0 |
| Reused listener wait | 10.620 s | 9.997 s | 2.892 s | 5.211 s | 0 |
| Recording first-media | 6.041 s | 5.491 s | 1.116 s | 3.426 s | 6.57 ms |

These same-failure-window observations show sustained main-event-loop occupancy and more process system than user CPU in the sampled intervals. They do **not** establish whole-host CPU saturation, disk/fsync wait as the cause, or a per-JavaScript-stack allocation of system CPU. Zero `fsRead`/`fsWrite` resource counters do not prove absence of filesystem operations.

Within the short main-isolate profiles, URL-less native `get` self weights were about 71.7% for independent initial-18, 63.0–67.0% for the reused-listener phases and 64.0% for Recording. `run` and `exec` also had significant weight. These are sample-interval weights, not SQL counts, independent CPU percentages, database service times or removable work budgets. The profiles show JavaScript ancestry but do not observe SQLite internal execution, locks, page-cache/overflow access or kernel syscalls.

Source/cache mapping found one matching existing tsx cache for each reported call point using the sealed transform-key algorithm and current source identity; no recompilation or stale diagnostic line numbers were used. Direct V8 script bytes were not captured, so loaded-code identity remains an inference from the transform/cache match. Function-start coordinates cannot separate several SQL instructions inside the same method.

The bounded mapping establishes these distinctions:

- Account-enabled, task authorization, live TaskExecution and engine current-grant methods contain identifiable fresh SELECT sites. Their sampled native `get` weights total 5.522 s in independent initial-18 and 2.416 s in Recording first-media. Many already reuse compiled statements; these costs cannot simply be renamed repeated preparation.
- `PrivateSql.get`'s anonymous wrapper has one native `.get`, but SQL comes from the caller. Its 3.109 s/0.114 s weights in those windows cannot be assigned to one SELECT from the wrapper name alone.
- The connector ledger closure has one UPSERT `.run`, with 0.347 s Recording self weight. Mandatory transitions and FULL/fsync durability remain; that weight is not a write count or SQLite service-time allocation.
- Engine execute/claim `.exec` weights total 0.381 s for Recording and 1.022 s for independent initial-18. The methods include BEGIN/COMMIT/ROLLBACK, so those weights cannot be split further. Claim `.get` also includes INSERT ... RETURNING: not every native `get` is a read-only SELECT.

Inclusive authority, input and binding chains overlap and must not be added. Table/page behavior, actual row decoding, cache hits, lock/syscall costs and attribution to the dynamically running tasks remain unknown.

### Real neighboring work and observation limits

Lifecycle and one-second process samples confirm actual overlap with other original test files. The reused-listener phases continuously received new Processing/import/image/instance-change neighbors; Recording overlapped optional OCR and recording-revision files. Seven to nine files entering successively within a window does not mean more than six file workers were simultaneous.

The A current-head benchmark started about 73.1 s after Recording failure cleanup, and after all three failing windows. It cannot explain their concurrent load in this run; simply adding that benchmark to the former small cohort is not a causal test. Actual default-six neighboring load is established, but its causal contribution to target slowdown has not been isolated by a control. Aggregate process CPU/RSS observations do not establish whole-host CPU or memory saturation; no non-owned process was changed.

Sampling was delayed by the work under observation: maximum CPU/event-loop intervals were 2.308/2.364/1.467 s for the three targets, rather than uniform 250 ms coverage. The second profile ended about 0.303 s beyond its intended 45 s callback interval, and about 0.710 s of the final listener window lacked profile coverage. Profile clock-offset intersection widths were 9.14/19.22/8.48 ms; wall-anchor residuals were at most 1.362 ms. The 4.820/14.516/13.374 ms tails after the final profile sample were not assigned to any stack.

Observer callback wall totals were about 95.5/116.7/101.5 ms and include inspector control. External sampler wall was 107.586 s over the 1,361.171 s run and includes waiting for process samples. Neither number is total native-profiler overhead or extra target CPU/delay. There is no same-window unprofiled control, so complete observer perturbation remains unknown. Short intervals without a process sample are missing observations, not zero CPU. The diagnostic reproduces blocking categories but cannot retroactively allocate an earlier plain failure's entire budget.

## Open mechanism and final evidence responsibilities

The observation supports a bounded investigation of **fresh native SQLite authority-query execution cost and data layout**, not a product change. Small-row account queries also carry significant weight and require a control. Large-row access/overflow, shared native-call overhead, locks, syscalls and other explanations remain hypotheses for the full-suite slowdown. A fixture-only covering-index comparison is not authorization to add a production index, change schema, reduce checks/writes, alter FULL/fsync or relax deadlines.

A subsequent separately approved generated native-SQLite mechanism fixture completed with `COLLECTED_NOT_ACCEPTANCE`, matching pre/postflight inputs and confirmed cleanup. All three candidate query roles failed to select a covering plan, so the experiment stopped as `NON_DISCRIMINATING_PLAN_STOP`; its timings cannot establish covering-index gains. A short native sample from that synthetic fixture can establish only fixture mechanisms, not their contribution to the full failure windows. Detailed native-stack review and later diagnostic outcomes are indexed in [PR #201](https://github.com/utopiafar/mote/pull/201). No product correction or closure of the three blockers follows from that result.

### Correction of the synthetic fixture's mode equivalence

The generated mechanism fixture explicitly selected WAL/FULL from the legacy EvidenceStore setup. Treating that as the target scoped entry's mode was a baseline-equivalence error, also missed by its original pre-execution review. The original plan, review and generated results are retained; this correction is not retroactive approval or a rewrite of that evidence.

The real entry is `scopedCaptureFixture` → `buildApp` (the `buildScopedApp` alias) → `openScopeStorage`; Accounts, TaskAuthorization and TaskExecution share its database. `scope/storage.ts` sets neither journal mode nor synchronous. The original [C WAL plan](../design/performance-round1-C-wal-plan.md) already distinguished that entry from legacy Store, and its [historical native probe](../design/performance-round1-C-evidence.md) measured a new scoped database as DELETE/FULL on Node 26.11.1 / SQLite 3.53.4. Existing current-format databases may retain WAL. This is not a newly discovered omission from C's work.

The old fixture's WAL/FULL observations, PK query plans, non-discriminating index result and limited native stacks remain true for that generated configuration. Its read timings and stack distribution are **not an equivalent mode/cost baseline for the current scoped workload**. The real-stage observation below did not capture its connection PRAGMAs or per-Get connection identity, and its disposable database was cleaned. Historical DELETE/FULL evidence must not be relabeled as a new mode measurement in that run. No product journal mode, synchronous setting, checkpoint, source, backup or sidecar contract changed.

### Later real Recording six-file native observation

A separately approved observation at the same `ec89cdc9` source ran the original Recording phase file with its five actual Recording/optional-OCR neighbor files, default file concurrency six and unchanged assertions/deadlines. All six files started together; this was not the full selection's staggered ages or continuously replenished reader sequence. The external run naturally ended in **45.540 s**, **45/45 pass**, no fail/cancel/skip. Bounded input anchors matched before, during and after observation; the helper's original bytes were restored, owned cleanup and resource release were confirmed. These bounded anchors are not a driver-reuse identity or a complete affected-check receipt.

The real slow-first case retained processing enabled, three recordings over two pages and media limit one. After r2's injected runner, **r1 became physically held 3.367271 s into first-media wait**. All three canonical transcripts and three unique Materials were observed while r1 remained held, followed by explicit release and settlement. The two-second native capture was contained inside that actual first-media phase: external launch was about +54.6 ms and collection finished about +2,344.2 ms, before the phase ended at +3,367.3 ms. This successful window cannot replace the earlier full failure, in which r1 was not held and only two transcripts had succeeded.

The native main-thread report has **158 samples**, including **114 under `Statement::Get`**. Its disjoint leaf categories are:

| Main-thread category | Samples |
| --- | ---: |
| Get → pager shared-lock → stat | 39 |
| Get → pager shared-lock → fcntl | 26 |
| Get → pager shared-lock → pread | 6 |
| Get → pager shared-lock → fstat | 5 |
| Get → pager shared-lock → other | 1 |
| Get → end-read/unlock → fcntl | 10 |
| Other Get | 27 |
| Outside Get | 44 |

The shared-lock subtotal is **77**, not 78; 77 + 10 + 27 = 114 Get samples, and 114 + 44 = 158 main-thread samples. No overflow stack appeared in this sample. These are **sample counts, not CPU seconds, SQL counts or syscall durations**. `fcntl` does not by itself establish lock waiting. The report lacks per-sample timestamps and exact SQL/connection identity behind unknown JIT frames; Get cannot be assumed to mean an authorization SELECT or to exclude INSERT ... RETURNING. No cross-run address-to-source mapping was used.

The first-media phase's internally covered 3.342943 s contains process user CPU 1.478405 s, system CPU 1.713905 s and event-loop idle 3.923 ms; the right endpoint leaves 24.322 ms uncovered. Those process CPU increments include other threads and are distinct from the native main-thread sample counts. Observer callback wall was about 1.692 ms, excluding module loading and final flush; native sampling can pause the target, so total counterfactual perturbation remains unknown. The six-file sample establishes real pager read-transaction/file-metadata paths during a passing production-entry phase, not their causal share in the original full-suite failures or whole-host saturation.

### Later valid-only joined-proof candidate: approved source, inconclusive timing

The mode-retaining proposal subsequently produced the independently reviewed candidate **`4ac0f966a7c90ca70424d8a8717b6d2f965ad1e1`**, based on `ec89cdc9`. Its product diff changes only `scope/task-execution.ts` and `scope/task-authorization.ts`, plus the dedicated fixture; Accounts remains byte-identical. Only the `TaskExecution.valid` try body delegates to the fixed host-owned proof assertion. The original catch-to-false behavior, full grant decoding and strict JavaScript checks remain. Compiled statements execute fresh queries rather than caching proof results. No transaction, write, iterator, retry, journal mode, engine/model/fence/time boundary or standalone authorization path was added or changed by this product diff.

The same corrected frozen fixture was used on both baseline and candidate: **25/25 safety cases passed on each**, with actual production `buildApp`/HTTP admission, registered engine and currentness/service paths. The initial fixture's plain benchmark had completed its timed calls but failed during finish with `task_retry_invalid`: permitting execution before sequential awaited HTTP retries allowed a task to finish first. The explicitly released fixture correction authenticates real contexts before timing, retries both through the production service synchronously while permission is still held, then releases and drains. It retains exactly-one execute/commit, A/B controls, input scale and final oracles. The initial safety/pass and plain/fail artifacts remain historical and were not reused for the corrected comparisons. Corrected finish control does not establish HTTP retry coverage.

The counted window contains **100 public authority calls, 200 logical `valid` invocations and 100 domain callbacks**. Fresh proof `get` calls change **800 → 400**, or four → two per logical valid checkpoint. The account read stays late and fresh at **200**; model and other engine reads stay at **100 each**. The independent validation checkpoints around the domain callback and each PrivateSql authorization remain distinct. For this later candidate, the original fresh validation facts/boundaries are retained while SQL executions **inside** a checkpoint decrease; earlier `c87` statements about unchanged query counts refer only to that earlier measurement, not this joined-proof delta.

Both measured actual main connections reported **`journal_mode=delete`, `synchronous=2` (FULL), `isTransaction=false`**. Those are measurements of these two benchmark inputs only and do not establish any old diagnostic connection's mode. There were zero warmed statement preparations and zero instrumented Statement.run/all/iterate calls or observer errors/overflow in the counted window. `db.exec` was not wrapped: that zero is not a dynamic audit of every possible write. Static inspection of the measured synchronous path and the product diff adds no writes.

The original five-block timing decision remains **`STOP_BENEFIT_INCONCLUSIVE_UNDER_FULL_BLOCK_RANGE_INTERPRETATION`**:

| Plain metric per 100 public calls | Baseline median / complete range | Candidate median / complete range |
| --- | ---: | ---: |
| Wall | 13.382 ms / 12.918–16.007 ms | 12.165 ms / 11.955–15.209 ms |
| User + system CPU | 14.047 ms / 12.972–18.742 ms | 12.576 ms / 12.032–17.719 ms |

Every corresponding candidate block was lower, but complete ranges overlap and median differences are smaller than their full spreads. All five blocks, including the first, remain; there was no new repeat, adaptive scale or discarded warmup block. Counted timings are separate observations, not plain timing benefit. No demonstrated 9.1% speedup, syscall saving, whole-journey improvement or full-failure fix follows from these medians. Later safety or build success cannot change this timing conclusion.

The original benefit-dependent plan stopped. A **prospective bounded disposition delta**, explicitly approved in the same implementation-review chain, permits finishing the already named seven safety consumers and Server build based on the deterministic read-count reduction and bounded safety comparison. It does not retroactively change STOP, approve more benchmarking, authorize source variants, or establish performance benefit. The implementation review is `APPROVE` for the exact candidate and this bounded continuation; it is not final consumer, affected-check, integration, merge or delivery approval.

At the first implementation-review snapshot the seven files and Server build were **UNRUN**. After root explicitly released that bounded continuation, the unchanged seven-file command newly passed **28/28**, no fail/cancel/skip, and the Server build passed on clean `4ac0f966`. Both original resource receipts confirmed process-group cleanup and released leases. The same independent reviewer checked the raw results in the same review chain; this does not change the timing STOP. The 25-case result is not exhaustive equivalence: no deterministic overlapped-writer or previously established outside-transaction snapshot oracle was exercised, and not every optional-epoch/ownership/malformed-type combination was individually observed. These coverage limits remain explicit even when static source review supports the approved snapshot contract.

Root retained the candidate for deterministic fresh-read work reduction and fast-forwarded the original three commits into the integration branch. It then newly executed the unchanged original default-six six-file cohort on exact `4ac0f966`: **17/17 PASS**, no fail/cancel/skip, TAP **62.355 s** (external gated command **62.449 s**), stable clean inputs and confirmed cleanup. The original OCR/listener/hot3-to8 and Recording physical hold/three canonical transcripts and Materials/later page/media-one/release-settlement assertions were retained. This is a new focused result, not a complete Server or affected gate, a driver-reused task, a paired whole-journey speedup or proof of a single causal mechanism. The original three full-suite blockers still require final combined acceptance; the earlier complete failures remain failures. Historical failures, the old mode-equivalence error, the conservative timing STOP and prospective continuation approval remain separate evidence.

Final combined source/version identity, complete affected-check receipt, cleanup, required hidden Web current-login and Desktop entry results, original failures and later results are recorded in [integration PR #201](https://github.com/utopiafar/mote/pull/201). Later checks are not predeclared successful here, nor are earlier focused results silently reused. The public PR also indexes the exact `central-v0.0.91`, `desktop-v0.0.89` and `android-v0.0.90` Release CI run reports and actual artifacts; source publication alone does not install or deploy a product.

All described inputs are generated fixtures and isolated accounts. Physical devices, live models/embedding quality, real supplier accounts, production personal-profile startup, foreground permissions, real personal capture, installation and deployment are outside these results. Android JVM, generated Electron and headless browser evidence do not establish those separate checks. No real personal screenshots were collected or transmitted.
