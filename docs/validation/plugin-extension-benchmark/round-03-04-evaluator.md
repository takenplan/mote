# Round 3 and Round 4 independent evaluation

Status: Round 3 and Round 4 independent evaluation complete. The fresh Round 4 cancellation submission and a separately authored held-value/timing variation both passed on their first evaluator executions. This report does not claim the integration candidate's complete regression gate.

Machine-readable execution and scoring receipt: [round-03-04-evaluator-results.json](round-03-04-evaluator-results.json).

## 1. Outcome and scope

Round 3's new, independently authored meeting plugin installs but cannot pass instance check when its two runtime registrations have a different order from the matching manifest descriptors. The observed response is HTTP **409**, `conflict`. The same-order control executes both real source callbacks and publishes correct, traceable Materials. Passing the test that expects 409 reproduces an architectural failure.

Round 4 admits the **identical** meeting plugin and manifest with HTTP **200**. Both independently ordered component callbacks execute through the ordinary scoped host. Public Material reads recover the expected meeting total of **5,800 cents** and reference total of **3,975 cents**. This is evidence for the generic component-identity repair, without a plugin repair or a private adapter.

Both candidates also passed newly executed reruns of the released finance, reading, calibration, authority, lifecycle, and process-restart probes. These reruns establish regression behavior on each exact candidate. They are not fresh independently developed finance plugins or new undisclosed finance inputs. The released finance variant named `heldout` in the test is already disclosed for these rounds.

Round 4's fresh cancellation plugin also succeeds with an independently committed input/timing variation. A cancelled invocation receives its AbortSignal and its subsequent Material/event calls are rejected, while a simultaneous sibling in the same worker and the other user's invocation both publish exact new evidence. Independent source and processor results, disable/drain, stop, worker retirement and a real shipped-launcher restart also pass their declared slices. Full P10/P11 remain PARTIAL for the additional unexecuted branches.

The actual native Harness ABI and external durable-trigger attempts still fail. Full E01 also remains **FAIL / NO_EXTENSION_POINT**: a generated in-package semantic replacement exercises downstream publication, but the production semantic model path is unavailable. No actual Harness session, live model, native UI, or physical-device check is claimed.

## 2. Frozen candidates, execution, and artifact preservation

| Item | Round 3 | Round 4 |
| --- | --- | --- |
| Source candidate | `28792141303a5b74257906d7cde0545f90b51dfd` | `b3d956189ba81e4843e9ceacdec06bb7f30a352e` |
| Execution checkout | `mote-round3` | `mote-optimizer` |
| Original architecture baseline | `2c78ca8d52a7d17fae20962cf68d09a717ffc73a` | Same |
| Runtime | Node `v24.19.0` | Same |
| Plugin installation | Generated pinned release transport; actual digest verification, ZIP expansion, catalog, Accounts, Cordis/scoped registration, workers, tasks and persistence | Same |
| Meeting / reading network path | Authenticated loopback HTTP, normal `buildScopedApp` | Same |
| Released evaluator network path | Production-composition HTTP plus explicitly identified real shipped-process HTTP | Same |

The pre-execution meeting/reading inventory was identical across candidates: SHA-256 `2cedff2656caf7b9d3dd50e1a187b9e72ef9936ba6489f26e5cf1b99d0382c39`. Before either test ran, the evaluator copied each submitted `meeting-pack/trial.json` to preserve the original delivery evidence. The submitted test regenerates manifest, ZIP and trial files; only `trial.json` changed after execution. JavaScript, manifests, ZIPs and tests remained byte-identical.

| Artifact | Pre-execution SHA-256 | Post-execution result |
| --- | --- | --- |
| Meeting manifest | `f536c157169d0af86d7e2804bd0c0f389f205469e4a42639530b45955a5debbf` | Identical in both candidates |
| Meeting control manifest | `5b8ab0a19fdc1307ce93ebf594120a3ba206f0ba629e1969b81b49a67953fc3f` | Identical in both candidates |
| Meeting ZIP | `f62d7ead953e6ce15ca917391c7397fbdc2d309d6d524204522e437d6acfb67a` | Identical in both candidates |
| Meeting submitted test | `74600482dec872d44a5f985e6ea447785c190b95be1d55a48d89d10f9983482f` | Identical in both candidates |
| Reading manifest | `71e21d6887ca407b8783fb0df5da0888e9eb1c8cf80be438314516a71474c7f8` | Identical in both candidates |
| Reading ZIP | `bb6522b7e41dbd82a7af44e94ebc62c60c8c1ce56242d242187fc69dea3711a5` | Identical in both candidates |
| Reading submitted test | `8dd270b6a3e9ad3546908855067a223154848d05a1b10ad0d64075d657a55436` | Identical in both candidates |
| Released finance business JS | `3fdc2f3ea8a96a4311c783d7d8a6f6b59e45bb8c49ffa4cbdf8344a1bd7fa1d1` | Identical before/after both regression reruns |
| Released independent evaluator test | `72ea75cab74504149779eda671968902d9758f3d542b4b00fc6aeacd6d149c2d` | Identical before/after both regression reruns |

The supplemental regression inventory contains 28 files per candidate. No file in that inventory changed during either supplemental run. Detailed pre/post hashes and copied original/results logs are in the run directory `/workspace/scratch/8d97506698dc/evaluator-r34`.

### Actual commands and outcomes

Commands ran from the execution checkout in the candidate table. Local-worker and loopback execution used the authorized sandbox escalation. Complete affected/integration checks are owned by the root driver, not this evaluator.

```sh
# Round 3: the default mode deliberately expects the known composition rejection.
/opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin/node --import tsx --test --test-concurrency=1 apps/server/test/extension-benchmark-meeting.test.ts apps/server/test/extension-benchmark-reading.test.ts

# Round 4: identical plugin/test bytes, but successful independent composition is required.
MOTE_MEETING_REQUIRE_COMPOSITION=1 /opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin/node --import tsx --test --test-concurrency=1 apps/server/test/extension-benchmark-meeting.test.ts apps/server/test/extension-benchmark-reading.test.ts

# Executed independently in each checkout; report destination varies by round.
MOTE_FINANCE_REPORT=/workspace/scratch/8d97506698dc/evaluator-r34/r3-finance-trial.json /opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin/node --import tsx --test --test-concurrency=1 apps/server/test/extension-benchmark-evaluator.test.ts apps/server/test/extension-benchmark-finance.test.ts
MOTE_FINANCE_REPORT=/workspace/scratch/8d97506698dc/evaluator-r34/r4-finance-trial.json /opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin/node --import tsx --test --test-concurrency=1 apps/server/test/extension-benchmark-evaluator.test.ts apps/server/test/extension-benchmark-finance.test.ts
```

| Evidence ID | Candidate and files | Exit | Test count | Result | Runner duration |
| --- | --- | --- | --- | --- | --- |
| R3-MR | Round 3 meeting + reading | 0 | 4 | 4 pass, 0 fail | 14,410.534376 ms |
| R4-MR | Round 4 strict meeting + reading | 0 | 4 | 4 pass, 0 fail | 14,334.099247 ms |
| R3-REG | Round 3 released evaluator + finance | 0 | 12 | 12 pass, 0 fail | 65,000.473440 ms |
| R4-REG | Round 4 released evaluator + finance | 0 | 12 | 12 pass, 0 fail | 64,582.099181 ms |
| R4-CANCEL-SUBMITTED | Round 4 fresh submitted cancellation test | 0 | 1 | 1 pass, 0 fail | 12,509.683200 ms |
| R4-CANCEL-INDEPENDENT | Round 4 independent held-value/timing test | 0 | 1 | 1 pass, 0 fail | 13,486.507979 ms |

The two fresh cancellation commands ran from `mote-round4`, which has the same frozen source commit as `mote-optimizer`:

```sh
MOTE_CANCEL_REPORT_PATH=/workspace/scratch/8d97506698dc/evaluator-r34/r4-cancel-submitted-trial.json /opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin/node --import tsx --test apps/server/test/extension-benchmark-cancel.test.ts
MOTE_R34_EVALUATOR_REPORT=/workspace/scratch/8d97506698dc/evaluator-r34/r4-independent-cancel-trial.json /opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin/node --import tsx --test apps/server/test/extension-benchmark-r34-evaluator.test.ts
```

The meeting file contributes one parent test and two child tests: **three test-runner passes, not three passed feature cases**. On Round 3, one of these child tests positively confirms the architectural failure. Calibration likewise passes when it rejects a convincing false positive. Aggregate runner counts are not capability percentages.

## 3. Independent observations

### Meeting composition and durable readback

The source oracle is outside the installed ZIP. Three meeting records have commitments `2375 + 1825 + 990 + 610 = 5800` cents. The reference record contains `3100 + 875 = 3975` cents. Reads verify the expected decision/reference text, owner sentinel, totals and capture members with original references. Worker PIDs differ from the test process.

The Round 3 trial creates the independently ordered package first. Its instance check returns 409, so neither independent-order callback executes. A separate control changes only manifest version/order and uses the identical ZIP. Both control components then execute for authenticated A and B under colliding source, instance, item, batch and Material identifiers. Reading A after B's publications preserves A's bodies. A's attempt to invoke B's snapshot returns 404. An ungranted source task is blocked. Disabling A closes new snapshot admission; stopping A invalidates its old snapshot; B continues publishing after both actions.

Round 4 executes all of that control evidence and additionally enables the independently ordered instance, invokes `meeting.notes.summary` and `meeting.references.summary`, polls durable tasks to `succeeded`, and reads the actual Material bodies. The generated trial's literal `round: 3` and abbreviated original candidate metadata come from the unchanged test; this report binds its execution to the independently recorded Round 4 candidate. Those embedded labels must not be used to misidentify the run.

### Released financial and processor regressions

Each candidate independently consumes 43 originals representing 23 unique transactions. The visible-input September total is 83,335 cents. The released value/order/month-boundary variant produces 83,331 cents for September. The evaluator verifies exact original lineage, transaction evidence and refund identities; `missingRefundLinks` is empty. It separately records the production model path as blocked and semantic transport as **not executed**. The deterministic semantic replacement is the only semantic output in this probe.

The independently varied released reading probe creates five originals across three source pages, commits five exact Transcript artifacts and five normal Materials, checks source/capture lineage, and finds no duplicate publication for repeated operations. Foreign-user and ungranted-source reads are blocked. A separate held processor attempt released after deleting its original becomes blocked with zero Materials. A held source attempt released after grant withdrawal becomes stale with zero Materials; its old snapshot returns 401 and a fresh narrowed grant still blocks the removed source.

The original reading submission additionally exercises disable/drain, snapshot release, worker retirement, owner readback, and rebuilding the normal host over the same directory. That particular close/reopen happens inside one process and is reported as **in-process lifecycle**, even though its test title contains “restart.”

### Actual process restart, coexistence and authorization

R3-REG and R4-REG separately launch the shipped `apps/server/src/index.ts`. They complete a source publication, kill that Central process with SIGKILL, reopen the same vault in a second Central process, repeat the original operation and recover the identical task ID and Material ID with the exact persisted body. B's retained snapshot can read B's original, while administrator A still receives 404 for B's task and a blocked result for B's original. Referenced package uninstall returns 409. The second process exits cleanly on SIGTERM.

This proves restart after a **completed** operation. It does not prove recovery of an in-flight operation, exact package-version upgrade during held work, or historical survival after a later successful package removal.

The released coexistence probe installs independently authored finance and reading packages, executes both, stops only finance, observes its old snapshot return 401, and then successfully processes a second reading original through the surviving worker. This proves independent package disposal for that pair. It does not establish a version upgrade.

### Native Harness and durable trigger rejection

Both fresh meeting trials package an unchanged generated `apply(ctx)` module and install it through the ordinary release path. Instance check returns **502**, `execution_unavailable`. The stronger released evaluator repeats this with an unchanged native checksum-tool factory; check also returns 502 and the instance remains unchecked. The native factory byte digest is `cef385399221e0906343652be39a5acc41c104c1852d792b6e2e28102e26355d`. No rewrite to `createMotePlugin` or private tool bridge is used.

Both candidates reject `POST /api/plugin-triggers` with **503**, `scope_unavailable`. The released evaluator additionally tries the custom policy through `/api/ask-automations`, tries an extra external callback on the built-in `insights` kind, and invokes `registerTrigger` through the real worker. The HTTP attempts return **400** and the worker attempt is **blocked**; no automation is created.

These are executed **FAIL / NO_EXTENSION_POINT** probes. An actual admitted Harness-session tool invocation and an actual contributed durable scheduling callback remain NOT RUN because no supported admission path was established. They are not environment blockers, and the passing negative assertions are not feature passes.

## 4. Gates and full-case boundaries

The following table reports probe-level behavior. G5 is limited to focused regression evidence here; the root driver supplies the complete integration regression result. `PARTIAL` never enters a full-case success numerator.

| Probe | Round 3 | Round 4 final focused evidence | Gate evidence and remaining boundary |
| --- | --- | --- | --- |
| P01_SOURCE | PASS for released financial source-publication unit; fresh meeting control also executes | Same, plus independent meeting composition executes | G1/G2/G3/G6 pass for exact admitted source publication and readback. Full E01 semantic/automation path fails. |
| P02_PROCESSOR | PASS for declared extraction unit | Same | Real original reads, staged Transcript, durable artifact/Material, source and user fences, held deleted-original rejection. Full image understanding not run. |
| P10_LIFECYCLE | PARTIAL; independent meeting descriptor order also fails | PARTIAL; descriptor order repaired and fresh per-task cancellation passes | Coexistence, pause/drain, stop, late-write fence, completed-task process restart and referenced uninstall tested. R4 additionally proves cancellation reaches one invocation while its same-worker sibling continues. Exact-version and in-flight upgrade/recovery missing. |
| P11_ISOLATION | PARTIAL | PARTIAL, with fresh simultaneous A/B cancellation and stop evidence | Real A/B and administrator A; colliding identifiers, originals, snapshots, tasks, events, Materials and restart tested. Fresh R4 cancels/stops A while B is running. Coupled in-flight restart and full model-resource/export branches remain unverified. |
| P04_HARNESS | FAIL / NO_EXTENSION_POINT | FAIL / NO_EXTENSION_POINT | G1/G6 fail at native factory check. Actual native session/lifecycle remains NOT RUN. G2 passes. |
| P06_TRIGGER | FAIL / NO_EXTENSION_POINT | FAIL / NO_EXTENSION_POINT | G1/G6 fail at public trigger admission. Scheduled execution/recovery remains NOT RUN. G2 passes. |

| Full case | Round 3 | Round 4 final focused evidence | What remains outside the observed success |
| --- | --- | --- | --- |
| E01 Financial insight | FAIL / NO_EXTENSION_POINT | Same | Source-only fixture success does not provide the production semantic or external automatic-insight path. |
| E02 UI style | NOT RUN | NOT RUN | Theme/layout and draft/focus/navigation retention not exercised. |
| E03 Sensitive local models | NOT RUN | NOT RUN | Neither restricted Central model transport nor client pre-upload extension is validated. |
| E04 Native Harness plugin | FAIL / NO_EXTENSION_POINT | Same | Native factory admission fails; real Harness session never starts this plugin. |
| E05 Calendar automation | NOT RUN | NOT RUN | No action/confirmation/delivery or OS calendar result. |
| E06 Periodic insight | FAIL / NO_EXTENSION_POINT | Same | No supported external durable-trigger admission; no contributed due callback. |
| E07 Memory replacement | NOT RUN | NOT RUN | No independent Memory body authority/migration/rollback test. |
| E08 Image provider | NOT RUN | NOT RUN | No image inputs or new image provider were attempted. The successful text extraction and deletion fence remain bounded P02 evidence and do not enter the full E08 denominator. |
| E09 New material UI | NOT RUN | NOT RUN | Material APIs are read; trusted Library card/detail/panel/action is not executed. |
| E10 Composition/upgrade | PARTIAL with observed composition defect | PARTIAL | Two-package coexistence and some lifecycle paths execute; package-version and in-flight transitions remain open. |
| E11 Multiuser | PARTIAL | PARTIAL | The tested data/task/event boundaries hold; full model-resource/export and concurrent-held restart branches remain open. |
| E12 Audio capability | NOT RUN | NOT RUN | Text Transcript staging is not WAV/ASR/diarization validation. |

No full case passes in this report. There are **0 complete successes / 5 valid attempted full-case families** in each round (E01, E04, E06, E10, E11), and seven NOT RUN families. E08 is not counted as an attempted full case because no image inputs or new image provider were attempted; all text extraction evidence remains in P02. The two narrowed source/extraction slices give **2 / 6 bounded functional coverage**; P10/P11 are PARTIAL and P04/P06 FAIL. These are not complete frozen probes: P01 also references durable insight (E01.3), and P02 references image capture/upload and provider assertions (E08.1/E08.2). Complete-gate probe NISR is not reported; neither the focused regressions here nor final G5 can fill those missing functional assertions. Round 3's 16 and Round 4's 18 passing runner tests include negative assertions, calibrations and subtests, and are not the numerator for either metric.

### Separate hard-gate ledger

`P` means PASS for the declared unit, `F` FAIL, `p` PARTIAL, and `—` NOT RUN. `R` means focused regression evidence exists, while final G5 belongs to the root's complete check. These symbols apply to both rounds unless explicitly split.

| Declared probe unit | G1 functional | G2 core zero | G3 authority | G4 lifecycle | G5 regression | G6 real execution |
| --- | --- | --- | --- | --- | --- | --- |
| P01 source publication, retained readback and grant boundary | P | P | P | P for source slice | R | P |
| P02 extraction, lineage and input/publication fence | P | P | P | P for extraction slice | R | P |
| P10 full frozen lifecycle probe | p | P | P for tested scope | p | R | p |
| P11 full frozen isolation probe | p | P | p | p | R | p |
| P04 native Harness | F | P | — | — | R | F |
| P06 durable trigger | F | P | — | — | R | F |
| Independent meeting order, R3 → R4 | F → P | P | P in successful runs | p | R | F → P |
| Fresh R4 single-call cancellation plus overlapping sibling | P | P | P | P for cancellation slice | R | P |

| Full-case unit, both rounds | G1 | G2 | G3 | G4 | G5 | G6 |
| --- | --- | --- | --- | --- | --- | --- |
| E01 | F | P | p | p | R | p |
| E02 | — | — | — | — | — | — |
| E03 | — | — | — | — | — | — |
| E04 | F | P | — | — | R | F |
| E05 | — | — | — | — | — | — |
| E06 | F | P | — | — | R | F |
| E07 | — | — | — | — | — | — |
| E08 | — | — | — | — | — | — |
| E09 | — | — | — | — | — | — |
| E10 | p | P | p | p | R | p |
| E11 | p | P | p | p | R | p |
| E12 | — | — | — | — | — | — |

### G2: Iterator intrusion audit versus Optimizer baseline change

The meeting plugin uses four local business modules (62 physical lines), only relative bundled imports and `node:crypto`, and only advertised host RPC methods. Reading uses one 60-line module and the public worker API. Neither includes a private app import, custom adapter, scheduler, database, authorization implementation, model router, or pre-existing core edit. The submitted tests import the ordinary `buildScopedApp` root; their release transport supplies only pinned bytes. Iterator core-business edits: **0**. Private plugin imports: **0**. Added adapters: **0**.

The fresh cancellation package has 108 physical lines in its four business modules plus a 28-line observation/wait helper. Its 19-line release packaging script is outside the ZIP. It uses only bundled relative modules, Node crypto and Node filesystem calls for plugin-owned diagnostic markers. The markers are observation records, not a task store or authority gate. The independent evaluator only reads them. It never writes a release marker, calls a plugin function directly, supplies a worker factory, or registers an adapter. Business bytes and the five files inside the ZIP remained unchanged.

Round 3's accepted generic host changes expose `GET /api/plugins/host-capabilities` through the normal current-user service. The endpoint truthfully lists the registered `source` and `processor` invocation capabilities; unavailable enums stay unavailable. Round 4's accepted generic changes are per-call AbortSignal forwarding and matching complete component descriptors by identity, with duplicate/missing/extra/drift rejection. These Optimizer source changes belong to the candidate baseline and are counted separately from Iterator zero intrusion. Their new unit tests are corroborating regression evidence, not substitutes for the real product executions in this report.

## 5. Fresh Round 4 cancellation evaluation

The evaluator committed a new seed at **19:05:04 UTC**, before inspecting the fresh cancellation plugin or its output and before its **19:11:33 UTC** first delivery. Commitment: `85d768e3c76aef33116a0824197f182835e2fddf5fd361ec4fb7bf088d819aa0`. The commitment record fixes public behaviors: per-invocation cancellation, denied late publication, surviving same-worker sibling, colliding A/B identity isolation, worker stop, and honest process-restart classification. Allowed held variations are generated Unicode/CRLF content, same-name identifiers, per-invocation delays and cancellation order. The seed is specific to this Round 4 evaluation; it is not retrospectively claimed to predate the Round 3 Iterator. The seed is now released in the independent test; no later round may label it undisclosed.

The declared processor text rule comes from the Iterator's public contract: `Extracted: ` followed by the original item text, then its SHA-256. The independent evaluator computes the hash from actual original bytes and first compares the decoded item text to its own generated input. It does not use the plugin's claimed checksum as its oracle. Source verification checks that every exact supplied body occurs once, that the full output length contains only the declared owner label, bodies and separators, and that public capture members equal the actual ingress receipts. Source page ordering is not invented as an additional contract.

| Frozen fresh artifact | SHA-256 | After both evaluator executions |
| --- | --- | --- |
| Cancel manifest | `4d14f2ce1abc463f9636b16f9995ed6228f5b7cc8bf09e3013607dd1380a3011` | Identical |
| Cancel ZIP | `f4e054fa8211acc8a2eb2bf47baea1be1c52ac74b47646399bdb7bcd15605c0e` | Identical |
| Submitted cancellation test | `75dbabbee6b01610d47725f57849d8a88b2b1729922fa18f96cb4d7751ba7826` | Identical |
| New independent evaluator test | `55138e5e20d5524a212451e528e51f633684bc1c317852ecb9dc2cef01730353` | Same bytes in integration and frozen execution checkout |
| Independent generated input/timing manifest | `107757aeae379049e70043173b82c3eb02ac3cf6e0f60471961ac1024995deeb` | Frozen for this trial |

The submitted test independently reran from **19:12:44.024Z** to **19:12:55.369Z**, with exit 0 and one passing test. It executes a real child process calling the normal `buildScopedApp`, then stops and restarts that child over the same vault. This is an actual process lifecycle test, while its launcher differs from `index.ts`. It verifies real source/extraction reads, cancellation, sibling/A/B isolation, stop and history, native factory 502, custom trigger manifest/policy 400 and worker trigger RPC blocked.

The new [independent evaluator test](../../../apps/server/test/extension-benchmark-r34-evaluator.test.ts) ran its substantive trial from **19:18:16.818Z** to **19:18:28.207Z** and passed on its first execution. It reads the exact frozen manifest/ZIP instead of reassembling plugin code. Setup uses the normal host for installation and actual Account APIs; after closing that setup host, every measured cancellation and lifecycle interaction goes through the real shipped `apps/server/src/index.ts` listening on loopback.

The new inputs contain five A-owned originals, three B-owned originals, Unicode and mixed line endings, fresh source/instance/revision identifiers, and identical publication and operation keys across users. The independent source readback covers three A source pages, `2 + 2 + 1`, and exact capture membership. Administrator A cannot read B's task or invoke B's snapshot; a worker request for B's original is blocked.

At cancellation, both sibling tasks are explicitly observed `running`. The same-worker sibling has a **1,747 ms** delay, B a **2,066 ms** delay, and the evaluator cancels after a further **88 ms** overlap. A's worker PID **18774** reports `signalAborted: true`; the observation arrives **29 ms** after the cancellation request began. The marker reports the owned timer cleared, its listener removed and no owned waits pending. Those are plugin-owned cleanup observations corroborated by code inspection, not a native memory/listener-count measurement. Both attempted late host methods, `publishMaterial` and `emit`, reject with `AbortError`. The target Material remains 404 and A's Material/event totals contain only the lawful sibling publication. The sibling retains PID 18774; B retains its separate PID **18781**. Their identical Material IDs resolve to different correct owner bodies.

The processor consumes a selected original with independently calculated SHA-256 `7dda8bcfe110b2e0ae3bdb084f45b470bb722534fdd346926b5d805ab4fbeb2f`, persists the exact Transcript payload and normal Material text, and preserves capture lineage. B's attempt to read the resulting artifact returns 404. This proves the declared deterministic extraction behavior. It does not prove a held processor invocation specifically cancelled at its final publication boundary; the separately rerun deleted-original processor fence remains the evidence for that distinct input-revocation branch.

The evaluator then disables A during an admitted delayed callback, sees new snapshot admission return 409 and allows the authorized callback to drain. It starts another held A callback while B is also running, stops A, observes the A worker die and the task become stale, and verifies no late Material. B completes in its original worker. Referenced uninstall remains 409 and A's existing source/processor history remains readable.

Finally, the real Central process PID **18746** exits cleanly on SIGTERM and PID **18838** opens the same vault. Exact source and processor readbacks survive; the cancelled task stays cancelled; administrator A still cannot fetch B's task; B's repeated completed operation returns the same task and Material; a new B invocation executes in a fresh worker. The test does not claim recovery of an interrupted task or a package-version upgrade. All ten frozen plugin/test/release artifacts remain byte-identical after both fresh-package runs. No plugin repair or feedback cycle was needed.

## 6. Friction and coverage ledger

Round 3's first evaluator-observed successful same-order readback was `2026-10-19T19:05:34.923Z`, 3,848 ms after that test began. Round 4's corresponding control readback was `2026-10-19T19:05:35.594Z`, 3,522 ms after its test began. These measure test-execution readback latency for generated local data. They are not development duration, exact publication commit time, model latency, or performance comparisons. Source-development and discovery duration and development tokens are unknown. No development-token estimate is fabricated.

Round 3 meeting pass@1 for independent-order composition is FAIL. Its same-order control pass does not repair that verdict. Round 4 uses unchanged meeting business bytes and passes the independent-order regression on its first evaluator execution. The observed improvement follows a host candidate change, not an extra independent statistical replicate.

The fresh cancellation submission and the new independent value/timing variation both pass@1 for their stated source/extraction/cancellation/lifecycle slices, with **zero repair cycles**. This does not turn either into a full E10 or E11 pass. The fresh plugin's first evaluator-observed source success was **19:12:49.409Z**, about 5.385 seconds after the submitted trial began. Development tokens and total Iterator development time remain unknown.

Physical line counts below are inventory measurements, including comments and blank lines. They are not normalized complexity scores or a comparison of development efficiency across different businesses.

| Package | Business module lines | Observation/wait helper lines | Manifest lines | README lines | Private adapter/glue lines |
| --- | --- | --- | --- | --- | --- |
| Meeting | 62 | 0 | 34 | 123 | 0 |
| Reading | 60 | 0 | 42 | 108 | 0 |
| Cancellation | 108 | 28 | 42 | 134 | 0 |

| Coverage dimension | Executed status |
| --- | --- |
| Normal Central composition and actual authenticated loopback HTTP | PASS for the described generated fixture journeys |
| Shipped Central process termination/restart | PASS after completed work; in-flight recovery NOT RUN |
| Real package verification, installed worker callbacks and persistence | PASS for declared source/processor units |
| Shared UI/headless DOM/actual browser | NOT RUN |
| Mac native build, renderer, capture permissions, real calendar | NOT RUN |
| Android compile/unit/emulator/background lifecycle/physical device | NOT RUN |
| OCR/ASR/VLM transport | NOT RUN |
| LLM semantic output | Deterministic in-package replacement only in finance; real semantic transport NOT RUN |
| Live provider compatibility/model quality | NOT RUN; live calls prohibited by protocol |
| Native CPU/memory/power or performance | NOT RUN |

No commit, PR, core edit, private adapter, UI operation, live model request or external message was performed by this evaluator.

### Reproduction sources

- Frozen [plan](plan.md) and [case matrix](cases.json).
- Submitted [meeting](../../../apps/server/test/extension-benchmark-meeting.test.ts), [reading](../../../apps/server/test/extension-benchmark-reading.test.ts), and [cancellation](../../../apps/server/test/extension-benchmark-cancel.test.ts) tests.
- Released [independent evaluator regressions](../../../apps/server/test/extension-benchmark-evaluator.test.ts) and [finance trial](../../../apps/server/test/extension-benchmark-finance.test.ts).
- Fresh [independent cancellation evaluator](../../../apps/server/test/extension-benchmark-r34-evaluator.test.ts).
- Public [plugin authoring contract](../../plugin-authoring.md); normal [scoped application](../../../apps/server/src/scope/app.ts) and [shipped launcher](../../../apps/server/src/index.ts).
