# Round 05 — independent evaluator

## Final disposition

**The frozen candidate is not accepted: G5 is FAIL, with reason `FAIL_HOST_STORAGE`.** Two distinct, newly created vaults suffered real SQLite corruption while the shipped server was admitting source inputs, before the submitted finance plugin was invoked. Their retained error records remain part of this result. A later complete replay passed all three executable test units; it does not clear those observed host failures or establish their cause. The root driver owns the affected check and has adopted this same G5 disposition. [Machine-readable receipt](round-05-evaluator-results.json), [first storage failure](round-05-evidence/hidden-run-02-host-storage-server.json), [second storage failure](round-05-evidence/hidden-run-04-host-storage-server.json).

The independent financial oracle did validate the unchanged submission's useful source and processor behavior. The plugin consumed all 43 generated originals, retained 23 transaction identities, computed **89,251 cents** for the selected month, published an actual Material with capture lineage, and staged a real text Transcript. Hidden-input executions also reached successful exact-version upgrade and abrupt-process restart/readback checks. The later archived replay completed the remaining bounded lifecycle checks. These successes establish specific implemented behavior; they do not satisfy the frozen complete insight, image-provider, native Harness or trigger cases. [Hidden run 1](round-05-evidence/hidden-run-01-config-order.json), [hidden run 3](round-05-evidence/hidden-run-03-ingress-scope.json), [completed published replay](round-05-evidence/published-final-evaluation-results.json).

| Measurement | Result | Denominator and interpretation |
| --- | --- | --- |
| Full-case NISR | **0/5** | E01, E04, E06, E10 and E11 were attempted; architectural failures remain in the denominator. |
| Frozen-probe NISR | **0/6** | Every frozen `requiredAssertionIds` list is retained. Four probes have useful partial coverage; two expose missing extension paths. |
| Full-case coverage | **5/12 attempted** | Seven cases remain NOT RUN, including the full E08 image-provider case. |
| Initial delivery / final complete-case success | **0/5 / 0/5** | One immutable Iterator submission; zero Iterator repair cycles. |
| Archived executable regression | **3/3 tests passed** | Calibration, boundary observations and final bounded sequence; this is not a capability success count. |
| Candidate G5 | **FAIL / FAIL_HOST_STORAGE** | Two observed host-storage failures, cause unresolved; a passing later run does not remove them. |

The root disposition of full E01 is **FAIL / NO_EXTENSION_POINT**, with **PARTIAL data-path coverage**: the required complete insight/query/UI extension journey is not available or demonstrated by the source/processor submission. E04 and E06 also fail their attempted public extension boundaries. E10 and E11 retain PARTIAL coverage, and neither is accepted through the hard gates. No storage failure is excluded as an external-environment BLOCKED trial. The public unit definitions and scoring rules remain those in [cases.json](cases.json) and [plan.md](plan.md).

## Independence, candidate and submission identity

The evaluator read only `AGENTS.md`, the public plan/cases, the plugin-authoring guide and the candidate commit before freezing the seed and every expected financial value at **2026-10-19T19:12:32.498803Z**. The fresh Iterator was assigned after that commitment and froze its first delivery at **19:31:32.197758Z**. Candidate and prior trial implementation code were not used to derive the oracle. The seed, generated transactions, observations and expected values were not disclosed to the Iterator before its frozen submission. [Seed commitment](../../../apps/server/test/fixtures/extension-final-evaluator/seed-commitment.json), [delivery hash record](../../../apps/server/test/fixtures/extension-final-evaluator/iterator-delivery-freeze.json).

| Identity | Frozen value |
| --- | --- |
| Candidate source commit | `88fb30af6cc70d369625f4b1350e78f01e207650` |
| Seed SHA-256 | `8a3b86447d7345d4067c9ab079f169fde271c883e0474eeeb088e2ce26a2d9b6` |
| Held-oracle file SHA-256 | `a0775299beb99949d1c280272f7db13c3720e42ce88eaf230f47693fd00a46e9` |
| Oracle-generator SHA-256 | `2ef1a91dcb8fade723315079850dd017b0d5d0b830c44d482afb3140573dbefd` |
| Submitted runtime-tree SHA-256 | `f7c8f2418be662234f4dc073a486950b7ea89e68ebae774ea46752ff630dfb3b` |
| Authored v1.0.0 ZIP SHA-256 | `ec28c770c69aa59215cf3e656bfbaaf63e3e9686fcd7966ef632cb0bd7a55de9` |
| Authored v1.1.0 ZIP SHA-256 | `835706709a116180c0088da971043e59f99fd644434b0e623338a745edf67682` |
| Iterator test SHA-256 | `517ef50201675e15cac69e88be38227e6b832c709f0940ddccfc1318b4bf76e7` |

The candidate checkout had no tracked diff. The Iterator added `final-pack` and a new test, with no business-source or existing-test changes. Every submitted package-file hash was checked before execution. The archived replay also checked 521 frozen source/package-manifest hashes and found them identical. Root optimizer edits already present in the candidate are accounted for separately; they are not counted as zero-edit work by this Iterator. [Core audit and submission map](round-05-evaluator-results.json), [source hash manifest](../../../apps/server/test/fixtures/extension-final-evaluator/frozen-production-sha256.json).

Three variants were sealed: `final-initial`, `reserve-repair-1` and `reserve-repair-2`. Only the first was used. Neither evaluator correction changed expected financial values or plugin bytes, and neither consumed an Iterator repair cycle. Repeated executions and the archived replay are not additional independent statistical trials. The fixtures are now public for regression use.

## Execution boundary and semantic substitution

The evaluator launched the shipped `apps/server/src/index.ts` in a real child process. It initialized real Accounts, authenticated A as an administrator, created an ordinary B account, and used normal HTTP configuration, ingress, snapshot, task, Material and artifact APIs. The host performed package resolution, ZIP digest verification, extraction, installation, worker execution, persistence and authority enforcement. No verifier-only app or evaluator domain adapter was installed. [Archived harness](../../../apps/server/test/fixtures/extension-final-evaluator/http-runtime.mjs).

Generated GitHub release responses replaced remote release transport. Only the submission's explicitly replaceable `semantic-mock.mjs` was replaced inside the evaluated ZIP; all other runtime files remained those of the frozen package. The replacement accepted the agreed public shape:

```js
normalize({ originalRef, sourceId, text }, { signal })
// => { observations: [{ transactionId, occurredOn, amountMinor,
//      currency, kind, evidenceId, refundOf? }] }
```

The local semantic service checked the actual authorized ref, source, exact UTF-8 Original text and its independently serialized SourceItem hash. It returned extraction facts for that one observation, or no transaction for noise. It supplied no totals, ledger, publication IDs or task results. The submitted source performed deduplication, refund linkage, month selection, arithmetic and real publication. The submitted processor read an actual Original and used the normal staging authority to persist its Transcript. The public mock contract does not establish live model quality or the unimplemented full model-resource/export journey. [Semantic service](../../../apps/server/test/fixtures/extension-final-evaluator/semantic-service.mjs), [independent comparisons](../../../apps/server/test/fixtures/extension-final-evaluator/finance-oracle.mjs).

The completed replay recorded **281 synthetic semantic requests, zero semantic-input errors and zero live model calls**. Its release-transport ledger contained ten generated release requests and no unmatched external `fetch` attempt. These are execution observations, not model-token or development-cost telemetry. [Observation summary](round-05-evidence/published-observation-summary.json).

## Financial oracle and observed output

The sealed transformation retained the public financial behavior while changing transaction/source/observation IDs, merchants, integer amounts, arrival order, refund references and timestamps around the same UTC month boundary. It retained the published 20 bank, 15 notice and 8 email observation family. The text serialization was generated source-labelled text plus JSON facts; this does **not** claim an additional real-bank CSV parser or live email interpretation test. [Published sealed inputs](../../../apps/server/test/fixtures/extension-final-evaluator/private-held-oracles.json).

| Independent expectation | Value matched |
| --- | ---: |
| Originals consumed | 43 |
| Normalized transaction observations | 39 |
| Unique transaction identities | 23 |
| Noise observations | 4 |
| Repeated transaction observations | 16 |
| Payments in September | 19 |
| Refunds in September | 2 |
| Gross payments | 95,860 cents |
| Refund amount | 6,609 cents |
| Net | **89,251 cents** |

The comparison checked every retained transaction's cents, kind, normalized date, currency and explicit `refundOf`; exact monthly identity selection; every deduplication group's Original refs and source set; all 43 input Original/capture/hash records; and 43 real capture members on the published Material. The monthly ledger entries had to equal the matching complete transaction records. Expected values came from the sealed canonical records, never from the plugin's output. The result differs from the visible example's 83,335 cents. [First hidden financial result](round-05-evidence/hidden-run-01-config-order.json), [completed replay result](round-05-evidence/published-final-evaluation-results.json).

With the configured page limit of seven, the three source populations require 3/3/2 pages. The evaluator independently paged the actual stored originals and checked complete exact-ref consumption by the semantic seam. The plugin reported the expected page counts. Its precise host-RPC cursor sequence was not independently instrumented, so those reported counts are not presented as a host-call trace.

An identical host operation replay returned the same task and Material revision with no additional extraction calls. A and B deliberately shared instance, source, transaction and resulting Material IDs. An ID lookup returned each owner's own body: A retained the independently verified ledger while B's own result contained the generated 987,654,321-cent sentinel. A could not substitute B's task or snapshot, and the submitted processor's attempt to read B's Original was blocked. Normal A event observations contained no B task or sentinel. Foreign event-cursor substitution remains unexecuted. [Replay subchecks](round-05-evidence/published-final-evaluation-results.json).

## Lifecycle evidence and its limits

| Executed behavior | Observed result | Evidence provenance |
| --- | --- | --- |
| Source and text processor | Actual Material/capture lineage and persisted Transcript readback | Hidden first delivery; repeated in archived replay |
| Package v1.0.0 → v1.1.0 | Held old work returned v1.0.0 output; new snapshot and work used the distinct v1.1.0 digest | Hidden run 3; repeated in archived replay |
| Abrupt host restart | SIGKILL after actual publication, another PID over the same vault, same publication/task identity and revision after replay | Hidden run 3; repeated in archived replay |
| Disable and resume | Previously admitted task drained; new snapshot rejected; no automatic extraction or finance change over the disabled gap | Completed archived replay |
| Grant revocation | Held A task became stale, old snapshot returned 401, no late Material/revision; B and the independent processor continued | Completed archived replay |
| Independently valid stop | Fresh checked/enabled snapshot was held, then stopped; task stale and old snapshot rejected | Completed archived replay |
| Single-task cancellation | Task cancelled; no late Material/revision; same-worker source intake still returned a real duplicate receipt | Completed archived replay |
| Referenced uninstall | Real uninstall returned 409; lawful prior Material remained readable | Completed archived replay |

The completed process restart used PIDs **29055 and 29129**. It occurred after publication and before the evaluator's first task-result read; it does not prove the host was killed before task-completion persistence. The successful replay required **no retry request**. No host-binary upgrade was performed. Package version pinning and process restart are distinct observations. [Process receipt](round-05-evidence/published-final-process.json), [observation summary](round-05-evidence/published-observation-summary.json).

The cancellation calibration additionally made a real worker observe its AbortSignal and attempt a late publication. The host rejected it while a same-worker sibling successfully published. This strengthens the observed cancellation boundary, but it remains an independently generated calibration specimen, not a claim that the finance plugin itself attempted a malicious late callback. [Calibration result](round-05-evidence/initial-calibration-results.json).

E10.4 is only partly covered: publication followed by restart and idempotent readback was observed, but interruption before task-completion persistence and recovery of an in-flight result were not established. Successful package removal/history, both users held across A's revocation followed by restart, and held image/processor deletion/configuration fencing were also not completed by this evaluator. Existing round regressions can be cited separately by the root driver; they are not relabelled as new hidden Round 5 observations.

## Preserved interruptions and attribution

| Execution | Outcome and attribution |
| --- | --- |
| Hidden run 1, `1792438651218` | Financial, text and owner-isolation subchecks passed. Evaluator sent a new package configuration with `desired:true` before checking that exact configuration; public prepare rejected it with 503 `config_prepare_failed`. This was an evaluator admission-order error. |
| Hidden run 2, `1792438924438` | Before plugin invocation, the real server failed in `ExecutionEngine.recover` with malformed schema / orphan `sqlite_autoindex_mp_file_reviews_1`. PID 27668 exited 1; the client observed ECONNRESET. **FAIL_HOST_STORAGE.** |
| Hidden run 3, `1792438968186` | Financial, text, isolation, upgrade and restart checks passed. After deliberately admitting one new SourceItem while the extension was disabled, the evaluator incorrectly treated that capture's normal host `processed:<captureId>` Material as forbidden extension output. This was an evaluator comparison-scope error. |
| Hidden run 4, `1792439074184` | Before plugin invocation, an originals request returned 503 `scope_unavailable`; PID 28271 exited 1 with `database disk image is malformed` in `ExecutionEngine.recover`. **FAIL_HOST_STORAGE.** |
| Archived replay, 19:47:38–19:48:35 UTC | Corrected evaluator, same frozen plugin/source bytes, three separate test units passed. This is recorded as a published regression, not another hidden attempt; it does not clear either storage failure. |

The first correction used the documented `desired:false → check → enable` order. The second permitted only the normal Material whose public origin matched the newly admitted capture, verified its exact text and member ref, and required every earlier Material ID/revision to remain unchanged. It also required zero new extension extraction calls. The oracle did not simply stop looking for late output or ignore arbitrary Material changes. Both earlier failed receipts are preserved. [Run 1](round-05-evidence/hidden-run-01-config-order.json), [run 2](round-05-evidence/hidden-run-02-host-storage.json), [run 3](round-05-evidence/hidden-run-03-ingress-scope.json), [run 4](round-05-evidence/hidden-run-04-host-storage.json).

The two storage failures occurred in separate fresh vaults and are not attributed to the finance business implementation. Their cause, and whether this is a newly introduced regression relative to an earlier host, remain unresolved. The root driver's separately scoped baseline investigation and affected check do not turn an unreproduced comparison into proof against the observed failures. No production change was made to obtain the successful replay.

## Calibration

All six independent controls actually executed before trusting the final observations. The core-intrusion control executed a synthetic diff audit without changing the checkout. The other controls used installed generated workers and real owner APIs. The archived test entry subsequently replayed them. [Initial calibration](round-05-evidence/initial-calibration-results.json), [published calibration](round-05-evidence/published-calibration-results.json).

| Control | Expected | Observed |
| --- | --- | --- |
| C01 real positive | Accept real publication and lineage | PASS; actual Material body and capture member read back |
| C02 plausible registry/task success only | Reject missing intended publication | FAIL as expected despite successful task status; publication delta zero |
| C03 visible answer hardcoded | Reject changed-input result | FAIL as expected; published 83,335 versus independently expected 83,352 cents |
| C04 synthetic core edit | Reject core intrusion | FAIL as expected for `apps/server/src/index.ts`; checkout unchanged |
| C05 foreign owner | No disclosure | PASS in exercised Original/snapshot/Material substitutions |
| C06 late publication | Reject stale callback | PASS; AbortSignal observed, late publish rejected, same-worker sibling succeeded |

The controls calibrate real publication, false success, changed-input arithmetic, ownership and cancellation observations. They do not prove every branch of the more detailed finance comparator is free of defects. Two calibration harness construction mistakes—Material identity and an expected-status default—were corrected before the successful calibration receipt; these are evaluator friction, not Iterator repairs.

## Frozen full cases, probes and gates

| Full case | Coverage / disposition | Incomplete requirement |
| --- | --- | --- |
| E01 financial insight | PARTIAL data path; **FAIL / NO_EXTENSION_POINT** full-case disposition | E01.3 complete insight outcome; E01.4 normal query and Library/insight UI journey |
| E04 native Harness | **FAIL / NO_EXTENSION_POINT** | Actual unchanged native loading check rejected; native tool/session and later lifecycle unavailable |
| E06 periodic extension policy | **FAIL / NO_EXTENSION_POINT** | Actual public custom-policy admission rejected; no scheduler callback |
| E10 coexistence/upgrade/recovery | **PARTIAL**, hard gates not accepted | E10.4 in-flight recovery remains unproved despite successful post-publication readback; E10.5 successful removal followed by lawful history |
| E11 owner isolation | **PARTIAL**, hard gates not accepted | E11.3 event-cursor substitution; E11.4 both-held revoke/restart; E11.5 model/export/restore |
| E02, E03, E05, E07, E08, E09, E12 | **NOT RUN** | Their complete user journeys were not attempted |

The authenticated capability API reported only source and processor invocation capabilities as registered. The unchanged generated native `apply(ctx)` module's bytes were preserved through real package installation, but its actual check returned **502 `execution_unavailable`**. The custom automation-policy admission returned **400 `invalid_request`**. These are concrete failures of the public paths attempted, not native-tool execution or external-environment blockers. [Boundary evidence](round-05-evidence/initial-boundary-results.json).

| Frozen probe | Status | Useful observed subpath | Frozen assertions still incomplete |
| --- | --- | --- | --- |
| P01_SOURCE | **PARTIAL** | Ledger, evidence, real source publication and source-generation revocation | E01.3 complete insight outcome |
| P02_PROCESSOR | **PARTIAL** | Text Original → real Transcript → readback | E08.1 image origins; E08.2 image provider/products; E08.4 held-image/processor fence |
| P10_LIFECYCLE | **PARTIAL** | Coexistence, exact versions, covered lifecycle/restart and referenced-uninstall rejection | E10.4 in-flight recovery; E10.5 successful removal/history |
| P11_ISOLATION | **PARTIAL** | Actual owners and colliding selectors; exercised generation isolation | E11.3 event cursor; E11.4 both-held revoke/restart |
| P04_HARNESS | **FAIL** | Concrete unchanged native-module check rejection | Supported native session/tool path absent |
| P06_TRIGGER | **FAIL** | Concrete custom-policy admission rejection | Supported contributed trigger path absent |

P02's successful text subpath does not make the full E08 case attempted or passed. Likewise, P01's ledger does not silently remove the insight requirement. The six frozen probe units have **zero PASS, four PARTIAL and two FAIL**, so neither “2/6” nor “4/6” is an appropriate frozen-probe success rate here.

| Gate | Independent disposition |
| --- | --- |
| G1 functional | Complete declared full-case/probe requirements are not satisfied. |
| G2 core zero | PASS for the Iterator: zero core-source/existing-test edits, no private runtime imports or evaluator domain adapter. |
| G3 authority | PASS for exercised selectors and callback fences; PARTIAL for the wider frozen requirements. |
| G4 lifecycle | PASS for the executed bounded sequence; PARTIAL for the complete required lifecycle journeys. |
| G5 regression | **FAIL / FAIL_HOST_STORAGE**, irrespective of the later passing replay. Root owns the full affected-check evidence. |
| G6 actual execution | PASS for real source Material and text Transcript outcomes; complete insight/native/trigger outcomes not established. |

The [receipt](round-05-evaluator-results.json) contains separate case-by-gate and probe-by-gate matrices, first-delivery and final numerators/denominators, and every observed subcheck. None of the attempted units is accepted through all hard gates.

## Friction and coverage ledger

The Iterator made **zero repair cycles** and zero core edits. Independent counting found 220 nonblank lines across `plugin.mjs`, `source.mjs`, `processor.mjs` and `originals.mjs`; 15 nonblank lines in the default semantic mock; and 53 in `release.mjs`. These counts include comments and exclude generated fixture JSON, the version constant, host/test harness and documentation. They are not compared to earlier-round LOC measured under a different convention. Authoring/discovery elapsed time, development tokens and development cost are **unknown/null**. The first successful hidden finance invocation took 1,877 ms; this is execution timing, not authoring time. [Friction receipt](round-05-evaluator-results.json).

The archived test run took 57.91 seconds overall: calibration 15.52 seconds, boundaries 3.41 seconds, and final sequence 38.80 seconds. Three passed executable tests do not mean three independently successful extension capabilities. Boundary tests intentionally assert the recorded unavailable outcomes. [Phase receipts](round-05-evidence/published-calibration-phase.json), [boundary phase](round-05-evidence/published-boundaries-phase.json), [final phase](round-05-evidence/published-final-phase.json).

| Surface | Coverage in this evaluator |
| --- | --- |
| Shipped Central process, actual HTTP and scoped production composition | EXECUTED |
| Actual host termination/restart | EXECUTED |
| Synthetic semantic-model protocol | EXECUTED |
| Shared contract/full affected suites | Root-owned; not newly claimed by this evaluator |
| Headless DOM or actual browser interaction | NOT RUN |
| macOS native build/device/rendering/capture/calendar | NOT RUN |
| Android build/emulator/physical device | NOT RUN |
| Image-provider or audio full case | NOT RUN |
| Live model/provider semantic quality | NOT RUN |
| Native resource/performance measurements | NOT RUN |

## Reproduction and final handoff

The complete replay entry, required helpers and now-public sealed fixtures are archived in the repository. They do not depend on the original scratch path and do not write tracked reports during normal execution. [Thin test entry](../../../apps/server/test/extension-benchmark-final-evaluator.test.ts), [runner and instructions](../../../apps/server/test/fixtures/extension-final-evaluator/README.md).

```sh
node --import tsx --test --test-concurrency=1 apps/server/test/extension-benchmark-final-evaluator.test.ts
```

For strict frozen-source reproduction, prefix the command with `R5_REQUIRE_FROZEN_SOURCE=1`. Normal CI records differences from the 521 source hashes and still executes the same behavioral assertions, so the regression does not permanently forbid future host changes. Frozen plugin hashes and the financial oracle are always enforced. Each phase has its own temporary output directory and timeout. The historical generator is retained for commitment provenance; `run.mjs` is the replay entry.

The successful archived replay used exact frozen source bytes. After that run, the only test-harness maintenance change made source-identity enforcement explicit-only and left default CI as a behavioral regression; it did not alter the input oracle, plugin checks or required outcome assertions. The root's supplemental server stage executed the final default mode on its separately frozen integration candidate: calibration, boundaries and final sequence all passed. The original affected check had stopped at the earlier Agent stage, so the server results are explicitly supplemental. Both pre-switch and final evaluator-code hash maps are retained. [Executed archive hashes](round-05-evidence/archive-first-replay-code-sha256.json), [final evaluator hashes](round-05-evidence/final-evaluator-code-sha256.json), [root validation record](final-validation.md).

The root started its full affected check on integration commit `fe15cbd5e7aba9b53e3d664f7470a85107428013`, tree `3eee98ad87917b53b82238b0ef5dc54918422646`, after this evaluator's code freeze. Its check result is reported separately and cannot erase the observed storage failures. This evaluator makes no native, browser, live-model, full-suite or subsequent repair claim beyond the evidence recorded here.

Root's final read-only scoring review made the already stated E10.4 recovery limitation explicit in both missing-assertion lists. It changed no execution receipt, source, fixture, score or gate disposition.
