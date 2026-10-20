# R01–R02 independent evaluator: unchanged production runtime

Status: **final**. Evaluated runtime: `2c78ca8d52a7d17fae20962cf68d09a717ffc73a`; documentation candidate: `7795f14eaa5382d6b1704a72ac0023694fc506cc`.

The independently authored finance and reading plugins execute through the current production worker boundary without core changes. Finance publishes independently verified monthly ledgers after one refund-link repair. Reading publishes exact Transcript artifacts and Materials for a new five-record corpus. Unchanged native Harness loading and an extension-owned durable trigger fail at actual public boundaries. Finance's normal semantic model callback is also unavailable. These successful source/processor subprobes do **not** pass the full financial-insight, image-provider, lifecycle, or multiuser cases.

The final evaluator command passed **9/9 assertions**. Some assertions deliberately require a refusal, so this is a test result rather than nine capability successes. The submitted finance checks independently passed 3/3 after repair, reading passed 1/1, and selected pre-existing source/processor regressions passed 8/8. No full check suite, native build, browser interaction, or live model call was run.

## 1. Reproducible evidence and candidate identity

- Durable evaluator: [extension-benchmark-evaluator.test.ts](../../../apps/server/test/extension-benchmark-evaluator.test.ts).
- Sanitized receipts, hashes, input manifest, and exact audit: [round-02-evaluator-results.json](round-02-evaluator-results.json).
- Frozen requirements and arithmetic: [plan.md](plan.md), [cases.json](cases.json).
- Finance artifact: [plugin.mjs](../../../plugins/extension-benchmark/finance/plugin.mjs).
- Reading artifact: [plugin.mjs](../../../plugins/extension-benchmark/reading-pack/plugin.mjs).

| Identity | SHA-256 / version |
| --- | --- |
| Frozen `cases.json` | `9abd71fb674ff111e3b5e82ce016e6fdc992752a972ab3da1bb2a3c7f332fba5` |
| Final finance business module | `3fdc2f3ea8a96a4311c783d7d8a6f6b59e45bb8c49ffa4cbdf8344a1bd7fa1d1` |
| Reading business module | `96c9100fa847e5c6728d0d7df0b3d1603f19630163e3c5cd1d552071c616b7ca` |
| Submitted reading ZIP | `bb6522b7e41dbd82a7af44e94ebc62c60c8c1ce56242d242187fc69dea3711a5` |
| Evaluated-file manifest | `19d150f8bd7f171ac9db397f98109005e1393342616d9dfe76c16943956ae7e9` |
| Final durable evaluator | `72ea75cab74504149779eda671968902d9758f3d542b4b00fc6aeacd6d149c2d` |
| Runtime | Node `v24.19.0`, TypeScript `5.9.3`, tsx `4.23.13` |

The input manifest hashes every delivered Iterator file and the evaluator. It identifies the uncommitted evaluated inputs alongside the actual candidate commit; it is not a claim that a later production candidate was tested. All per-file hashes are retained in the JSON receipt. The final baseline audit occurred before root began subsequent production changes.

The evaluator did not read prior evaluator reports or agent traces, and did not derive expected results from the finance author's `oracle.mjs`. Submitted code was inspected only after each author declared it ready. The case specification supplied expected transactions; the evaluator independently rendered observations, supplied exact generated semantic facts, and calculated expected ledgers.

### Held-out sampling limitation

The seed was selected at `2026-10-19T18:48:50.545501+00:00`, **after both Iterators had started, but before either delivered artifact was inspected**. Its recorded commitment is `47c03a34bd371c3e8ad841d39b75d5e0f3e49a12f69525ecb580cf757bc6199e`. Thus the plan's pre-iteration timing requirement was not met. The holdout remains an independent value/order check, but is not reported as a fully precommitted trial. The released seed and timing are in the durable receipt.

Only frozen variation classes were used: renamed transaction/source IDs, reordered observations and split batches, changed bounded integer cents, and a transaction moved across the same UTC month boundary. After the first refund-link failure was disclosed, final scoring used the fresh `refund-repair-1` value variant of the same seed family.

## 2. What executed

The evaluator constructs `buildScopedApp` without a verifier override. It creates real Accounts and authenticated client sessions, installs generated fixed GitHub-release bytes through the administrator resolve/install APIs, configures instances through the owner APIs, and invokes their immutable snapshots. Normal digest validation, ZIP expansion, package catalog, worker child process, domain adapter, task authority, source checks, publication, and public reads all execute. No `registerAdapter`, private instance/task/Material insert, or manually assembled model authority is introduced.

Automatic built-in processing is disabled through each owner's configuration API before measured intake. This prevents unrelated built-in extraction from contaminating the extension publication count. The ordinary defaults initially produced background Materials in evaluator setup; that setup error was corrected before either valid finance verdict. It was not treated as an Iterator failure.

Generated release download responses replace only external release transport. For finance's successful arithmetic/publication subprobe, the actual `plugin.mjs` bytes are unchanged and only its expressly declared `semantic-mock.mjs` is replaced with an evaluator-owned exact-content lookup. The lookup returns transaction facts tied to actual original references; it neither aggregates nor writes host state. **This is an in-package semantic replacement, not a successful model transport, lease, or metering test.** Normal finance configuration still attempts `host.call('model', ...)` and ends in a blocked task without a finance publication. Full E01 therefore fails with `NO_EXTENSION_POINT`.

Restart validation first installs and configures an isolated vault normally, then closes that composition and launches the shipped `apps/server/src/index.ts` entry. Actual loopback HTTP requests execute the worker. The host is killed with `SIGKILL`, reopened against the same vault, and queried again. Package verification uses the already installed bytes, so this phase requires no release-transport override. This is a real process restart, but the tested task completed before death; in-flight lease recovery is not claimed.

## 3. Evaluator calibration

All six mandatory controls were run against generated isolated data. Calibration verdicts below are observed rather than inferred from fixture design.

| Control | Observed behavior | Evaluator verdict |
| --- | --- | --- |
| C01 real positive | Installed worker reads three admitted originals, sums `317 - 42 + 911 = 1186`, publishes through `publishMaterial`, and owner readback returns exact body and all capture members; worker PID differs from evaluator PID | Functional and real execution PASS for the bounded source unit |
| C02 fake success / no publication | Task says `succeeded`, returns `claimedPublished: true` and a plausible `83335`, but no intended Material exists | Functional FAIL and real execution FAIL for the claimed publication |
| C03 hardcoded visible answer | A real Material contains `83335` for the independent input whose expected sum is `1186` | Functional FAIL despite successful publication |
| C04 core intrusion | Synthetic diff changes pre-existing `apps/server/src/scope/app.ts`; evaluator does not apply it to the checkout | Core-zero gate FAIL; result correctness cannot override it |
| C05 foreign owner | Administrator A invokes B's original and snapshot; original task is blocked, snapshot/task/Material requests return 404, and A receives no B event or original reference | No foreign disclosure in measured source/task/event/Material paths |
| C06 late publication | Held source work drains after disable, while new snapshots return 409; stop advances generation before release, late task becomes stale and creates no Material; B continues | PASS for measured drain and stop fence |

Calibration source SHA-256 is `f493ecf5d6c46bcac1c01012b27275143d3e73f06d58ff8f668b5b752bcd08ce`; its installed archive is `0f99fda31b0a18a8ec1faea93dd3f6631b6225cb7220de880f99eae9d991f52c`. The synthetic intrusion diff hash is `bbe7669703e96b67e26fc17e3d370232a82b6aac24d39cfc5d25b8abf0261919`.

An additional input-fence test deletes an original while a processor is held before `stageExtraction`: the task becomes blocked and no Material is published. Another withdraws the source grant before a held source callback proceeds: the task becomes stale, no Material is published, the old snapshot returns 401, and a newly narrowed snapshot cannot read the old original. These are real host authority checks with a generated worker barrier, not private state injection.

## 4. Independent functional results and feedback

### Finance

The first valid visible and held-out runs both read 43 actual originals, preserve 23 unique transaction identities, calculate exact monthly cents, retain every deduplication group's original evidence, and publish owner-readable ledgers. They also both **drop `refundOf` from persisted refund records**. The visible missing relationships are `R01 → P13` and `R02 → P08`, supplied by the declared semantic facts and required by E01.3.

The evaluator sent one bounded feedback cycle. The Iterator preserved the link in the canonical transaction, included it in duplicate consistency checks, and validated its target against the complete authorized same-currency payment set before publication. The repair did not change core code or introduce a new refund amount policy. Its own focused tests and the evaluator's fresh values both passed.

| Input family | Originals | Unique transactions | August net cents | September net cents | October net cents | Refund links / evidence |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Frozen visible input | 43 | 23 | 1,234 | 83,335 | 9,999 | Exact after repair |
| Final fresh held-out input | 43 | 23 | 1,330 | 83,331 | 10,857 | Exact after repair |

Final holdout input SHA-256 is `0e8de8eb8be6167d8090156dc665f301251753614b31a235529c777910b03351`. Its independent semantic script SHA-256 is `8c858f854ba02adc8ceb9fd02dd3715d44ee7433c15d82478d148c27f7236434`.

Expected values are compared to `/api/materials/:id/read` and `/members`, not just the task result. The comparison covers every transaction amount, date, kind, currency, exact evidence group, refund target, and complete member set. The changed September total also rejects a copied visible `83335`. Owner data search retrieves the expected amount; B cannot read A's published Materials. Disable rejects fresh snapshots and lawful historical revisions remain readable.

Finance source-publication **pass@1 is FAIL**, final result after **one** feedback cycle is **PASS for that bounded subprobe**. Its full normal E01 journey remains **FAIL / NO_EXTENSION_POINT** because the production semantic callback is unavailable. Automatic insight creation, actual query-agent evidence use, Memory integration, and UI behavior are not established by this source Material.

### Reading

The unchanged reading plugin processes five independently generated notes containing varied line separators, Unicode, and instruction-like content treated as ordinary evidence. The source traverses three pages of two items. Each processor invocation reads the real original, submits `stageExtraction`, and produces an exact Transcript and corresponding owner-visible Material with correct original membership. Repeating the same operation reuses task/artifact identity and creates no additional publication or progress event. Same-user ungranted originals and B's original are blocked; foreign snapshots and artifacts return 404.

Reading **pass@1 is PASS** for source enumeration and text-normalization/Transcript publication. No feedback cycle was needed. Its fixture SHA-256 is `98e37f3da0374e4f14b0df3b7786ada307af483866b159abe69ec17e16aa32ee`. This is neither an image-understanding provider nor a model-produced summary.

### Composition, restart, and architecture refusals

Two actual independently authored packages coexist in one owner scope: finance scans admitted originals while reading publishes a Transcript. Stopping finance invalidates its snapshot with 401; reading continues to process a second original and its earlier artifact remains readable. No package-version or in-flight upgrade was performed.

The shipped-entry restart retains the original task ID and publication identity after actual process death. A's body remains exact; B's same-named original remains readable only by B; a cross-owner worker read is blocked; referenced package uninstall returns 409. There is no claim of exactly-once recovery for work interrupted before commit.

The native negative specimen exports a pinned, unchanged `apply(ctx)` factory with a read-only SHA-256 tool. Normal installation succeeds, but instance check returns **502 `execution_unavailable`**, stays unchecked, and executes no tool. The public worker loader consumes `createMotePlugin`/`createMemoryProvider`, not the native `apply` factory. Its byte hash is `cef385399221e0906343652be39a5acc41c104c1852d792b6e2e28102e26355d`. This is concrete failed loading evidence; it is not a successful Harness session or tool-admission test.

For scheduling, authenticated `POST /api/plugin-triggers` returns **503 `scope_unavailable`**. The existing `/api/ask-automations` rejects both a custom policy kind and plugin callback fields on a built-in kind with **400**. A real worker's `registerTrigger` host call ends in a blocked task, and no automation is admitted. No private timer or host-only scheduler registration is used as a substitute.

## 5. Full-case matrix

`P` means PASS within the explicitly measured boundary; `PT` means PARTIAL; `F` means FAIL; `NR` means NOT RUN. A gate marked P for a subset is not promoted to full-case completeness. G2 is scoped to the submitted Iterator changes. `R` in G5 means selected focused regressions passed; it is not a complete release-check PASS. Final G5 belongs to the root integration driver.

| Full case | Status | G1 | G2 | G3 | G4 | G5 | G6 | Evidence and remaining requirement |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| E01 financial insight | **FAIL — NO_EXTENSION_POINT** | F | P | PT | PT | R | PT | Normal semantic callback is blocked; manual deterministic source publication passes after one repair; automatic insight, Memory and UI/query-agent journey unproved |
| E02 UI style | NOT RUN | NR | NR | NR | NR | NR | NR | No theme/layout or DOM interaction |
| E03 sensitive local models | NOT RUN | NR | NR | NR | NR | NR | NR | No Central local transport or device pre-upload review attempt |
| E04 unchanged native Harness | **FAIL — NO_EXTENSION_POINT** | F | P | NR | NR | R | F | Native apply-only package installation followed by check rejection; no native tool session |
| E05 calendar automation | NOT RUN | NR | NR | NR | NR | NR | NR | No proposal/confirmation/executor or native calendar journey |
| E06 periodic insight | **FAIL — NO_EXTENSION_POINT** | F | P | NR | NR | R | F | Generic trigger route/host callback unavailable; built-in schema rejects extension behavior |
| E07 Memory replacement | NOT RUN | NR | NR | NR | NR | NR | NR | No independent provider migration or body authority binding |
| E08 image provider | NOT RUN | NR | NR | NR | NR | NR | NR | Related text processor staging and input fences pass; no valid image-provider case attempt |
| E09 material UI | NOT RUN | NR | NR | NR | NR | NR | NR | No trusted browser feature bundle or Library interaction |
| E10 composition/upgrade | PARTIAL | PT | P | P | PT | R | P | Two packages coexist; drain/stop/history and completed-task process restart pass; package upgrade and in-flight recovery unrun |
| E11 multiuser | PARTIAL | PT | P | PT | PT | R | P | Same identifiers, administrator A, original/snapshot/task/artifact/Material/event checks pass; model/export and combined held-A/B restart branch unrun |
| E12 audio capability | NOT RUN | NR | NR | NR | NR | NR | NR | No WAV/ASR/diarization case attempt |

There are **0 full-case successes among 5 valid attempted full-case families** (E01, E04, E06, E10, E11): full-case NISR **0/5 = 0%**. Seven full cases are NOT RUN; none is scored as an environment BLOCKED attempt. The related E08 text-stage evidence does not create an image-case trial in that denominator.

## 6. Primary probe matrix

These units measure the bounded runtime paths stated in the plan. In particular, P01 below uses explicit generated semantic replacement, and P02 uses archived text originals. Their PASS verdicts apply to source publication and Transcript staging, not all journeys of their parent cases. Assertions about model transport, pixels, native tools, or full lifecycle are retained separately above.

| Probe | Status | G1 | G2 | G3 | G4 | G5 | G6 | Measured result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P01_SOURCE | PASS, bounded source-publication scope | P | P | P | P | R | P | Fixed worker, 43 originals, independent exact arithmetic/evidence/refunds, public Material reads, source withdrawal fence; semantic lease/transport excluded |
| P02_PROCESSOR | PASS, text Transcript scope | P | P | P | P | R | P | Independent reading bytes, five exact artifacts/Materials, original lineage, wrong-owner/source rejection and staged-original deletion fence; image-provider claim excluded |
| P10_LIFECYCLE | PARTIAL | PT | P | P | PT | R | P | Composition, disable drain, stop, referenced uninstall and completed-task real process restart pass; pinned in-flight upgrade/recovery missing |
| P11_ISOLATION | PARTIAL | PT | P | PT | PT | R | P | Owner/source/task/artifact/Material/event boundaries execute; combined held-user restart and model/export branch not complete |
| P04_HARNESS | FAIL / NO_EXTENSION_POINT | F | P | NR | NR | R | F | Native factory check rejection, no real native tool execution |
| P06_TRIGGER | FAIL / NO_EXTENSION_POINT | F | P | NR | NR | R | F | Public generic trigger and host registration rejection |

Two explicitly narrowed runtime slices have complete functional outcomes (**2/6 bounded functional coverage**). This is not NISR for the frozen probes: `P01_SOURCE` also references the durable-insight requirement in E01.3, while `P02_PROCESSOR` references image-input/provider assertions E08.1/E08.2. Ledger publication and text staging do not complete those assertions. Complete-gate probe NISR is not reported; final regression evidence alone cannot fill the missing functional assertions. Four other attempted units remain PARTIAL or FAIL; no environment BLOCKED unit is removed from the denominator. The expanded probes `P02_WEB`, `P03_CENTRAL`, `P05_ACTION`, `P07_MEMORY`, `P08_IMAGE`, `P09_LIBRARY_UI`, and `P12_AUDIO` are NOT RUN. These are not twelve-case or model-reliability percentages.

R01 finance and R02 reading are different authoring tasks. Their elapsed times and code size do not measure a controlled docs-only improvement. Runtime source is identical, so the evidence supports usable documented boundaries and remaining limitations, not a runtime capability gain attributable to documentation.

## 7. Core intrusion and friction audit

The baseline audit found **zero modified pre-existing core source files, zero modified existing tests, zero pre-existing Iterator-owned files, zero private imports in either business plugin, and zero Iterator assembly/configuration source edits**. Root's pre-existing documentation edits are counted separately from the Iterators' new directories and focused tests. The evaluator added only its new test and report/receipt; the production runtime is unchanged for this evaluation.

| Measure | Finance | Reading |
| --- | --- | --- |
| Independent first delivery result | Refund association missing despite exact totals/evidence | Bounded processor journey passes |
| Evaluator feedback cycles | 1 of at most 2 | 0 |
| Final bounded result | Source arithmetic/publication PASS | Enumeration/Transcript publication PASS |
| Business LOC | 99 physical lines | 60 physical lines |
| Adapter/glue | Generated release and semantic fixture; no private host adapter | Release build and download fixture; no private host adapter |
| Duplicated scheduler/store/authorization | None | None |
| Development tokens | Unknown; no trustworthy telemetry | Unknown; no trustworthy telemetry |
| Independent final evaluator time | Shared nine-test run: 31.402 s | Shared nine-test run: 31.402 s |
| Comparable authoring/discovery timing | Not established by this evaluator | Not established by this evaluator |

The author-reported timestamps/corrections remain in their delivered trial metadata, whose hashes are retained. They are not reclassified as independently observed model token cost. Evaluator setup corrections were an unavailable snapshot-generation field in a polling condition, and the automatic-processing publication-count contamination described above; neither consumed an Iterator feedback cycle.

## 8. Exact checks and coverage ledger

The supplied Node directory was prepended to `PATH`. The environment's approved escalation was required for real worker child processes and loopback listeners. Every check used generated data; no external credential or live model was used.

```sh
node --import tsx --test --test-timeout=120000 apps/server/test/extension-benchmark-evaluator.test.ts
# 9/9 PASS, exit 0, 31401.719455 ms

node --import tsx --test apps/server/test/extension-benchmark-finance.test.ts
# independently rerun after repair: 3/3 PASS, exit 0

node --import tsx --test apps/server/test/extension-benchmark-reading.test.ts
# independently rerun: 1/1 PASS, exit 0

node --import tsx --test --test-timeout=120000 --test-name-pattern='actual generated source|source plugin publication|pause drains|restart preserves actual source|actual generated M09 processor|generated custom processor|production text decoder|M03 source-item originals' apps/server/test/multiuser-plugin-ingress.test.ts apps/server/test/multiuser-processing.test.ts
# selected existing consumer regressions: 8/8 PASS, exit 0, 13375.695053 ms
```

After the nine-test run, only the finance diagnostic's `fullE01` label was clarified from PARTIAL to `FAIL/NO_EXTENSION_POINT` to apply the frozen architecture-failure rule. No assertion, plugin behavior, or production source changed. The receipt retains the originally emitted label and final scoring explicitly.

| Dimension | Actual coverage |
| --- | --- |
| Central production-composition HTTP | PASS for the declared bounded source/processor/control journeys |
| Central real process HTTP / shipped entry | PASS for actual `index.ts` startup, SIGKILL, restart, completed task identity/history and owner checks |
| In-flight host recovery and package-version upgrade | NOT RUN |
| Shared contracts | Consumed by real server validation; no separate full shared suite |
| Headless DOM / actual browser | NOT RUN / NOT RUN |
| macOS native build / renderer / permissions / calendar | NOT RUN |
| Android build / emulator / background / physical device | NOT RUN |
| Synthetic OCR, ASR, VLM, LLM transport in primary trials | NOT RUN; finance uses an explicitly bounded in-package semantic replacement |
| Live provider compatibility / semantic quality | NOT RUN, prohibited by the frozen protocol |
| Native CPU, memory, power, performance | NOT RUN |

No missing architecture path is labeled BLOCKED. Unattempted browser/native work is labeled NOT RUN because no concrete environment blocker was established. Trusted worker execution is not an operating-system sandbox claim.
