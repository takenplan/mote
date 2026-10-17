# Final joint multi-user candidate — 2026-10-18

Status: T's fresh Central build and real local Codex acceptance passed. Its
complete `check:affected` command finished naturally with exit 1: the only failure
was an outdated scope-inventory surface string. All functional assertions and
cleanup after-hooks passed. The exact inventory-only correction then passed its
scope checker and four architecture guards; all four stages truncated by that
failed driver were independently completed with natural exit 0. These separate
results do not turn the original driver into a natural exit 0.

Earlier `e284df41`, R and S failures remain recorded below. This premerge report
is intended for `docs/validation/main-multiuser-joint-final-2026-10-18.md`.
The integration PR will record delivery and release readback separately; this
report does not declare a GitHub merge or release complete.

## Frozen source and actual verification

The current candidate T is
`6e4032e0ff7a31dbf6528d6703f5d9d8f0b1cc57`, tree
`508a09cb70ec9202aad6225372039446023ef4ad`. It commits eight production source
overlays and the new lifecycle regression. All targeted executions described in
the next section happened on **S plus those exact uncommitted overlays**, before
T was recorded; T must not replace their actual execution head in the receipts.
An independent nine-file byte comparison confirms the eight production files
and regression fixture match their subsequently committed T versions.

| Lane on T (`6e4032e0`) | Actual outcome |
| --- | --- |
| Fresh Central build | Natural exit 0; `/tmp/mote-main-multiuser-joint-build-6e4032e0-20261018.log`. |
| Fresh source-bound local Codex acceptance | Natural exit 0; 7/7 scenarios, two real Ask runs; 38.984 s. |
| Final `check:affected` against `origin/main` | Natural exit 1, session 11078; one inventory-string assertion failure, no functional or after-hook failures. |
| Exact inventory-only correction | Scope checker natural exit 0; architecture guards 4/4, natural exit 0. |
| Independently completed truncated stages | Root scripts 83/83; client 5/5; Central runner passed; Android natural exit 0 with all 25 tasks up-to-date. |

T has its own fresh build/live inputs. Its 706-file source/compiled manifest
remained identical before/after at SHA-256
`72f77a8bb1aebaf8075d93b269f0ac26830218ac7ad77f9afb29c37ac9f40459`.
Historical R's seven scenarios/two real Ask calls retain their own source and
are not counted as T calls. T's unchanged safe
[model receipt](main-multiuser-codex-live-6e4032e0-2026-10-18.json) and
[source/compiled manifest](main-multiuser-codex-live-manifest-6e4032e0-2026-10-18.json)
retain the actual execution identity.

The third frozen candidate S is
`3518706b68ece5781fb8813d5a5ad8c8dbaa22ad`, tree
`892fa9868776447df26c7ea308954d7ebc46558f`. Its only difference from R is the
four-line generated readiness-fixture correction in
`scripts/release/dev-log-retention.test.mjs` (three insertions, one deletion).
`npm run check:affected -- --base origin/main` exited naturally with code 1 in
session 26545, with log
`/tmp/mote-main-multiuser-joint-affected-3518706b-20261018.log`.
Its SHA-256 is
`2bf1820580d451442b9579098ce3cdfba6109ec4b027738c9f3aa7bb2c71c878`.

An exact comparison using the live script's input set found S's 706 runtime
source/compiled files identical to R's measured manifest,
`d9ed26082a549b14870556dd257ddaa9dd150fe3a35c353ce3e4c3b511d75d57`.
The live script is also identical at SHA-256
`da0a6bca29034263c417aaead7ea921aa07c058f5726ce6dd28a8a6fe7d3c051`.
R's fresh build and real local Codex receipt therefore remain applicable to S's
unchanged runtime inputs. Their actual execution head remains `bfc4cbdf`; no new
live run is asserted on S. The gate plan includes the changed fixture, but the
driver stopped before that root stage; the independent S root stage below
verified it.

The repaired runtime candidate R is
`bfc4cbdf05b9b8af98ae592828856efd09f1c3a3`, tree
`8777b57d8d260c5c98c112c1a06ad3f46ce5e46f`. It adds the three-file cleanup
repair below to the true joint merge `e284df41a4e495227d01034b532aa81181cc4d42`
(tree `b8fa7da3c2d3942831935fd4be3064865b8dfcd9`, parents `67429a61` and
`9e9f112c`). The merge combines the main-integration repairs with the
current-version-only shared recording/Agent-input changes.

| Lane on R (`bfc4cbdf`) | Actual outcome |
| --- | --- |
| Fresh `build:central` | Natural exit 0. |
| Source-bound real local Codex acceptance | Natural exit 0; 7/7 passed, including two completed real Ask runs (A and B); 39.649 s. |
| Second complete affected-component gate | **FAILED**; session 67674 exited naturally with code 1, after all component workspaces passed and two root readiness fixtures failed. |
| Separately executed client script stage | Natural exit 0; 5/5 passed, zero skips/cancellations; 946.639667 ms. |
| Separately executed Central runner stage | Natural exit 0; standalone JSON `status: passed`, not a TAP test count. |
| Separately executed Android unit stage | Natural exit 0; 362/362 tests across 76 suites, zero failures/errors/skips; Gradle `BUILD SUCCESSFUL in 54s`. |

The current T command and its separate follow-ups are recorded below. Independent
successful stages are not combined into a retrospective passing driver result
for R, S or T.

The earlier source has separate receipts:

| Lane on earlier source (`e284df41`) | Actual outcome |
| --- | --- |
| Fresh `build:central` | Exit 0. |
| Scope check | Exit 0. |
| Four-file joint recording smoke | 13/13 passed, no skips or cancellations; 36.634119875 s. |
| Source-bound real local Codex acceptance | 7/7 passed, including two completed real Ask runs (A and B); 39.567 s. |
| Complete affected-component gate on `e284df41` | **FAILED**, natural exit 1 in session 26808; Server fixture after-hook `ENOTEMPTY`, detailed below. |

The recording lane covers the joint current-revision, backup and deterministic
failure changes. Ordinary shorter/empty/unsupported transcript revisions withdraw
old speech from current projections while preserving history and original bytes.
Trusted audio backup does not admit automatic ASR; an explicit owner request
retains the existing processing path. Known returned in-process decoder format
failures settle only their exact physical receipts. Real HTTP uncertainty keeps
its no-replay/explicit-acknowledgement protections. Source-specific details remain
in the [recording revision report](main-multiuser-recording-revisions-2026-10-18.md),
[decoder report](main-multiuser-local-decoder-failure-2026-10-18.md) and
[shared-flow report](shared-business-flows-2026-10-18.md).


## Completed T gate and inventory-only follow-up

`npm run check:affected -- --base origin/main` completed naturally with exit 1
in session 11078 on T. The retained log SHA-256 is
`92d2a8758b991d41e9b7d3f005a9dd485ead33a8b7a0272472f446ef33acf4a9`.
The [full safe receipt](main-multiuser-final-affected-2026-10-18.json) records
all component summaries, source identity and the unique failure.

Bilingual checks covered 8,554 messages/call sites. Shared-library builds,
Desktop/Server/Web/Agent/Diagnostics/Shared typechecks and script typechecks
completed successfully before the test phase.

| Completed workspace | Actual T outcome |
| --- | --- |
| Desktop | 589 passed across 62 files, no failures/skips/cancellations; 78.79 s wall time (147.31 s cumulative test time). |
| Server | 3,075 total: 3,072 passed, one inventory assertion failed, two skipped, zero cancelled; 917,907.75025 ms. |
| Web | 583/583 passed, no skips/cancellations; 100,198.65725 ms. |
| Agent | 328 total: 327 passed and one existing installed-Codex opt-in skip; no failures/cancellations; 30,992.581084 ms. |
| Diagnostics | 5/5 passed in one file; 303 ms. |
| Shared | 195/195 passed, no skips/cancellations; 355.534125 ms. |

The workspace aggregate is 4,775 tests: 4,771 passed, one failed and three skipped,
with zero cancellations. Server's skips are the existing pinned-Python SourcePack
and macOS sandbox cases. The only failure was
`production scope inventory and transitive composition boundary are declared`
in `apps/server/test/scope-architecture.test.ts`, at 937.0725 ms. Its expected
`processing-imports` inline task-registration string lacked T's new `localWork`
wrapper. No functional or after-hook failure, `ENOTEMPTY`, hook-failure marker
or cancelled test appeared in this log.

The original held-review cancellation case passed in 1,798.528958 ms. The
pending-child case passed in 5,080.459 ms and failed-child retry in
10,455.885375 ms under its unchanged 20-second budget. All four new local-chain
lifecycle regressions also passed in the full run.

Only one surface string in `docs/design/scope-inventory.json` was corrected.
The registration's policy, owner, kind, resources and authorization remained
unchanged; no guard or allowlist was relaxed. The inventory is check metadata
with no runtime consumer. Production, test, dependency and compiled inputs
remained T's inputs, so this documentation-only change does not invalidate T's
functional/build/model receipts. The
[inventory correction receipt](main-multiuser-inventory-correction-2026-10-18.json)
records T plus that exact documentation overlay: scope checker natural exit 0
and architecture guards 4/4, no skips/cancellations, 1,968.569875 ms.

The failed driver's `&&` chain did not execute the following stages. They were
run independently with the same T production/test inputs and completed naturally
with exit 0; these are separate stage results, not a replacement wrapper exit.
The [truncated-stage receipt](main-multiuser-truncated-stages-2026-10-18.json)
retains commands, hashes and cleanup checks.

| Independent T stage | Actual outcome |
| --- | --- |
| Root release/media/security/reset/proxy scripts | 83/83 passed, no skips/cancellations; 14,352.938959 ms. |
| Client script | 5/5 passed, no skips/cancellations; 607.635042 ms. |
| Central runner | Standalone JSON `passed`, no TAP test count; two noisy restarts and capacity/privacy/exit/signal/disk-failure assertions completed. |
| Android JVM unit command | Natural exit 0, `BUILD SUCCESSFUL in 4s`; all 25 tasks `UP-TO-DATE`, including the test task. No fresh 362-test execution is claimed. |

The Android XML execution totals remain specific to R's earlier actual run.
T's supplemental lane started clean; documentation-only overlays appeared during
it without changing the measured production/test bytes. Matching owned Node and
Gradle processes were absent afterward. Two pre-existing fixture directories
were preserved. No model, device, personal capture or foreground UI was used in
these supplemental checks.

Root separately ran documentation-only `check:affected -- --base T`: natural
exit 0 with `checks: []`. This verifies the documentation packaging scope; it
must not be reported as a rerun of T's full application command.

## Preserved unsuccessful complete-gate attempt

Session 26808 exited naturally with code 1 on `e284df41`; it was not interrupted.
The Server summary was 3,016 tests: 3,013 passed, one failed after-hook, zero
cancelled and two skipped, in 1,102,486.377 ms. The pending-child stale-conversation
case reached its cleanup hook; no business assertion failure was reported. Its
recursive fixture-directory removal then returned `ENOTEMPTY`. Remaining empty
originals/owner/work directories do not establish a precise late writer or a
reproduced production-close defect. The independently reproducible cleanup
side effect was repaired as described below; this failed gate is not reclassified
as passing.

| Workspace completed in this attempt | Actual result |
| --- | --- |
| Shared | 195 passed. |
| Agent | 328 tests: 327 passed, one existing opt-in installed-Codex skip; 31,081.002333 ms. |
| Server | 3,016: 3,013 passed, one after-hook failure, zero cancelled, two skips (pinned Python SourcePack and macOS sandbox); 1,102,486.377 ms. |
| Diagnostics | 5 passed. |
| Desktop | 589 passed across 62 files. |
| Web | 583 passed; 96,012.690208 ms. |

The existing failed-child retry case passed in 11.866516875 s within its unchanged
20-second observation window. Root release/scripts/client/Central-runner checks
and Gradle stages after the failing npm phase were not executed. They cannot be
inferred from the completed workspace summaries.

The `e284df41` recording smoke and real Codex results above remain successful
source-specific receipts. R's fresh build and real Codex acceptance have their
own receipts; its second complete gate and subsequent independent stages follow.

## Second failed driver attempt and previously truncated stages

`npm run check:affected -- --base origin/main` on R exited naturally with code 1
in session 67674. Bilingual checks (8,554 messages and call sites), shared-library
builds and workspace/script typechecks completed. The test summaries were:

| Stage completed in this attempt | Actual result |
| --- | --- |
| Server | 3,071 tests: 3,069 passed, zero failures/cancellations and two existing skips; 928,196.618959 ms. Its cleanup after-hooks completed. |
| Desktop | 589 passed across 62 files; 77.08 s. |
| Web | 583 passed; 99,588.274875 ms. |
| Agent | 328 tests: 327 passed and one existing opt-in installed-Codex skip; 31,031.418167 ms. |
| Diagnostics | 5 passed. |
| Shared | 195 passed; 393.311209 ms. |
| Root release/media/security/reset/proxy fixtures | 83 tests: 81 passed, two failed, zero skips/cancellations; 46,629.030167 ms. |

Both root failures were readiness timeouts in generated log-retention fixtures:
the older YAML target and incompatible upgrade/rollback cases still returned
only `{ok:true}` from `/api/health`. Production readiness deliberately requires
`mode: multiuser-auth`, `authentication: username-password`, storage epoch 5 and
protocol 2..2. A one-file correction to
`scripts/release/dev-log-retention.test.mjs` makes only the generated endpoint
return that current public readiness contract. Production readiness and the
fixture's capacity parser, capability markers, private configuration assertions,
process preservation, and upgrade/rollback-before-stop/backup/restore assertions
are unchanged. Independent read-only review found no weakened assertions.

The corrected fixture ran as R plus that one uncommitted test overlay (SHA-256
`687d0cce66227ca4e7b5ed703e2b0317e312d2ec8607fdd187702fe580adf58a`):
8/8 passed, zero failures/skips/cancellations, 6,920.827375 ms. This targeted
result was historical evidence for that fixture correction. T's later complete
gate and inventory-only follow-up are recorded above and below.

The failing driver's `&&` chain did not execute the client script, Central runner
or Android stage. They were then executed independently on clean R and collected
even though the driver had failed. Client coverage passed 5/5. The isolated
Central runner verified two noisy restarts, private 0600 bounded logs, DEV
100 MiB/file and 300 MiB/family limits, explicit overrides, private-output
suppression, split-line flush, exit-code preservation, signal flush and child
termination on disk failure. Both script processes exited, their generated
fixture prefixes had no remaining directories, and no matching Node children
remained. They used generated data and no real Central/profile/model startup or
foreground window.

Android's `:app:testDebugUnitTest` task actually executed rather than being
up-to-date: 25 actionable tasks, 13 executed and 12 up-to-date; the XML totals
were 362 passed, zero failures/errors/skips across 76 suites. Its 351-file Android
source manifest stayed unchanged at
`bc45b01344fc8f4e99def834b8d7871d81a6979f90cc39a28f548e4c2bbe1963`.
The Gradle wrapper exited naturally and no owned temporary runtime remained; a
pre-existing Gradle daemon was preserved. No emulator, foreground UI, personal
capture or physical device was used. This is Android unit validation, not an
Android device journey.

## Third failed driver attempt on S and independent completion

Session 26545 ended naturally with exit 1. The failing Server case was
`held file term review cannot publish after file-cancel`: its fixture after-hook
called recursive `rmSync` and received `ENOTEMPTY`. No cancellation-fence business
assertion failure was reported. This cleanup failure is not evidence of an
authorization or business-data leak. At the end of S, the late writer and local
worker-close ordering were still under investigation. The later private trace
and T repair are recorded separately below; they do not reclassify S's outcome.

| Stage completed in S's driver | Actual result |
| --- | --- |
| Server | 3,071 tests: 3,068 passed, one failed after-hook and two existing skips; 1,026,017.861542 ms. |
| Desktop | 589 passed across 62 files; 78.14 s. |
| Web | 583 passed; 95,593.311709 ms. |
| Agent | 327 passed and one existing opt-in skip; 31,006.411209 ms. |
| Diagnostics | 5 passed. |
| Shared | 195 passed; 369.353291 ms. |

The driver's `&&` chain again stopped before root scripts and later stages. The
following original commands were run independently and sequentially on clean S,
continuing regardless of any earlier stage's outcome. Each exited naturally with
code 0; no workspace suite was rerun in this supplemental lane.

| Independent S stage | Actual result |
| --- | --- |
| `node --test scripts/release/*.test.mjs scripts/media-workers.test.mjs scripts/security-tests.mjs scripts/reset-mvp-vault.test.mjs scripts/journey-network-proxy.test.mjs` | 83/83 passed, zero failures/cancellations/skips; 13,620.854084 ms. |
| `node --import tsx --test scripts/client.test.ts` | 5/5 passed, zero failures/cancellations/skips; 653.600625 ms. |
| `node scripts/test-central-runner.mjs` | Standalone JSON `passed`; two noisy restarts, 553 ms noisy lane; capacity/privacy/exit/signal/disk-failure assertions completed. It has no TAP count or skip total. |
| Java 21 + local Android SDK, `apps/android/gradlew -p apps/android --no-daemon :app:testDebugUnitTest` | `BUILD SUCCESSFUL in 4s`; all 25 actionable tasks were `UP-TO-DATE`, including the test task. No new 362-test execution is claimed. |

The existing 362-test/76-suite XML totals belong to the earlier actually executed
R Android run. The S Gradle command verifies that its unchanged inputs retain
valid cached outputs; it must not be described as another execution of those
tests. All four supplemental logs have separate hashes below.

S was unchanged and clean before and after these four commands. No matching
client/runner Node or Gradle processes remained; client/runner temporary fixture
prefixes had no residual directories. Two log-retention fixture directories
pre-dated this lane (birth times 01:19Z/06:27Z versus its root log's 19:22Z)
and were left untouched. The lane used no physical device, model, personal
capture or foreground UI. Completion was reported before private instrumented
reproduction began.

The three-file R fix still resolves the independently confirmed cleanup-created
parent defect and retains its RED/GREEN evidence. S's later after-hook failure
showed that worker closure and temporary-directory timing were not yet fully
resolved. The subsequent T repair has its own source identity and targeted
evidence below. T's completed gate had an inventory-only failure, followed by
separate successful correction checks. None of these supplemental results
reclassifies S as passing.

## Explicit local-chain shutdown repair in T

A private instrumented rerun of the original S file-cancel case passed 1/1 in
3,763.7965 ms but observed the local SDK child continuing session-persistence
`mkdir` after the domain/app close path. A raw `processing.review` handler,
workspace and child were still present at fixture deletion; child filesystem
cleanup overlapped the parent's removal, and the child/workspace/raw handler
settled afterward. This confirms a shutdown/temporary-directory race, **not a
precise reproduction of the original `ENOTEMPTY`**. It is separate from R's
already confirmed cleanup-created-parent defect.

T adds host-only `TaskRun.localWork` registration around abort-controlled local
Agent/Harness work and the complete associated workspace/finalizer chain. Ask,
Memory and processing/import/review consumers register those boundaries; the
processing analysis/image boundary includes final I/O completion and pin release.
TaskExecution first closes the engine to revoke/abort attempts, then drains only
registered local chains before service/DB closure. Kind disposal similarly drains
its own local registrations. Late registrations after shutdown cannot execute.

| Supersession scope | Decision |
| --- | --- |
| KEEP | Immediate cancellation, terminal state and revoked publication authority; issued/unknown calls still need owner confirmation before replay. |
| CHANGE | Drain explicitly registered cooperative local chains and their workspace/child/finalizer cleanup before host close returns. |
| REMOVE | The assumption that the cancellation wrapper's completion proves physical local cleanup has finished. |
| EXCEPTION | Unregistered arbitrary remote handlers remain outside the drain; a request deliberately ignoring abort cannot hold shutdown indefinitely or gain replay authority. |
| UNKNOWN | Forced process termination, OEM background behavior and physical-device cleanup were not verified. |

The final new fixture is byte-identical for RED/GREEN at SHA-256
`71672c01f8f29f4c2c350a89094e622f6c1e1857348003cacf5a130e360af9de`.
RED used an isolated `git archive` of S plus that test (its old-source fallback is
test control, not a production compatibility path). GREEN used actual S plus the
eight production overlays and test. The receipt records all eight hashes and
confirms they were unchanged afterward; no execution is relabelled as T.

| Targeted lifecycle lane | Actual result |
| --- | --- |
| Final HTTP-fixture RED | Natural exit 1; four tests, one passed and three expected failures; zero skips/cancellations; 3,881.148083 ms. |
| Same-fixture GREEN | Natural exit 0; 4/4 passed, zero skips/cancellations; 2,709.785417 ms. |
| Existing consumers, no instrumentation | Natural exit 0; 12/12 passed, zero skips/cancellations; 15,798.507958 ms. The original Ask retry passed in 10,257.111833 ms within its unchanged 20-second budget; pending-child passed in 4,863.169291 ms. |
| Original file-cancel GREEN trace | Natural exit 0; 1/1 passed in 3,494.605916 ms, retaining its assertions and budgets. |

The four new cases prove immediate owner cancellation/revocation while local
finally is held; engine-close completion plus one `setImmediate` turn without
premature TaskExecution close; real app close followed by direct vault removal;
and an actual generated loopback HTTP request deliberately ignoring abort that
does not delay close or clear its issued outcome. Restart remains blocked until
explicit owner confirmation. Two independent profiles verify host and A/B owner
isolation, ordinary successful cleanup and refusal of late local work; this adds
no concurrent-schedulers-on-one-vault deployment claim. The old app-close-only
case already passed and is not used as the decisive RED, because other modules'
shutdown latency can hide early TaskExecution completion.

The corrected trace order on 2026-10-17 UTC was child exit at 19:32:14.086,
workspace completion at 19:32:14.090, raw handler completion at 19:32:14.091,
TaskExecution close completion at 19:32:14.091, DB-close admission at 19:32:14.094
and fixture removal at 19:32:14.097. At the host/DB boundaries the observed raw-handler,
workspace, child and filesystem pending counts were zero; fixture removal had
only its own removal pending. There were zero non-fixture filesystem calls after
DB close. Instrumentation reports JavaScript thread IDs, not native libuv thread
IDs. It uses generated transport and no real model call.

The [shared lifecycle receipt](main-multiuser-local-cleanup-regression-2026-10-18.json) is SHA-256
`c5c881fc6397d4f0d35965fc9a256241845323bfda975e40ceba18c487cfa83e`;
the [GREEN trace receipt](main-multiuser-local-cleanup-trace-2026-10-18.json) is
`c669e4d76b311f2439475072080eb65029f59c6674ef996936479d22f771bb0c`;
and the [12-consumer receipt](main-multiuser-local-cleanup-consumers-2026-10-18.json) is
`8751b9dd0d6b167b848acac09cd3558f8c45986cf0e8cad5ff4dcd1db3120567`.
Generated vaults and owned test processes were cleaned up; the isolated RED
source was removed without changing its linked dependency directories. No sleep,
removal retry, existing timeout increase, model call or physical capture was
added. T's separate fresh real-model lane passed. Its complete gate later
finished with the single inventory assertion failure described above; that
outcome is measured directly rather than inferred from these targeted results.

## Earlier noncreating cleanup repair and targeted provenance

The confirmed defect is that cleanup called a creating directory validator:
after an ancestor vault directory had already been removed, `cleanWork`,
`cleanUpload` or `cleanStage` could recreate its empty parent directories.
The earlier after-hook's exact late writer was not traced; the targeted
reproduction establishes this side effect, not the precise causal chain of that
`ENOTEMPTY` occurrence or a general production shutdown failure.
That successful narrow fix did not remove the later worker-close race seen on S;
T addresses the registered-local-chain boundary with the separate evidence above.

R changes only `apps/server/src/private-storage.ts`,
`apps/server/src/scope/originals.ts` and the new
`apps/server/test/original-cleanup-lifecycle.test.ts`. The directory validator's
default creating behavior remains; its explicit noncreating mode checks existing
directories without `mkdir`. Cleanup validates every existing ancestor and target
with the same ownership, no-symlink, descriptor identity and directory checks,
and returns when a path is absent. Stage cleanup checks its exact owner-bound
parent before any missing-path return. Existing workspace authorization and SQL
receipt handling remain in place. Engine/app-close cancellation, uncertain paid
execution protection and the existing pending-child assertions are unchanged;
there is no removal retry or timeout relaxation.

These targeted runs occurred **before R was committed**. RED used `e284df41`
plus the new regression fixture, without a production overlay. GREEN and the six
selected existing consumers used `e284df41` plus exactly the three source/test
overlays recorded by hash in the cleanup receipt. They must not be relabelled as
executions on `bfc4cbdf`.

| Targeted run | Actual outcome |
| --- | --- |
| RED, original cleanup behavior | Natural exit 1; 54 nodes, 33 passed and 21 failed (19 leaf assertions plus two parent nodes); 965.653167 ms. |
| GREEN, noncreating cleanup | Natural exit 0; 55/55 nodes passed; 603.968625 ms. The additional node verifies the default creating mode and explicit noncreating contract. |
| Selected existing consumers | Natural exit 0; 6/6 passed; 6,747.288916 ms, across `multiuser-ingress.test.ts`, `multiuser-ask.test.ts` and `content-storage.test.ts`. |

The new fixture covers missing vault/ancestor/area/entry combinations, linked and
dangling paths, existing cleanup, sibling and A/B isolation, stage parent
validation, and late workspace-finally cleanup after vault removal and revoked
authorization. The selected consumers cover original/workspace paths, revocation
between preparation and admission, admission failure, domain deletion physical
receipts, pending-child stale retirement, and linked-content decryption rejection.
All fixtures are generated. The new tests make no model calls; the selected Ask
case uses its generated loopback provider. Their processes exited and their
generated fixture directories were removed. These are targeted checks, not an
additional full-gate or physical-device claim. The [cleanup receipt](main-multiuser-original-cleanup-2026-10-18.json) retains exact commands,
source/test hashes and individual logs; its SHA-256 is
`28471165c323b35a4f53f38b516fe4dd390b60d0b58178db848a096794c8e07c`.

## Current T real local Codex acceptance

The original live script ran on T with the local `codex-app-server`, requested
`gpt-6.1-sol`, low reasoning and default service tier. All seven scenarios passed
with two actual Ask runs, in 38.984 s. A completed in 18.405 s and B in 15.854 s;
each used one model turn, selected `search_context`, `material_catalog` and
`material_read`, and returned one canonical citation. These selections belong to
this T run rather than an earlier tool table.

The scenarios cover host/model discovery, real HTTP upload/background indexing,
A/B canonical reads and isolation, rebuilt-host history, ordinary-revision stale
answer/Work retention, and explicit A deletion with B as a control. All five
hosts and listeners were closed and the generated vault removed. The source and
compiled-input count was 706 before and after, with unchanged SHA-256
`72f77a8bb1aebaf8075d93b269f0ac26830218ac7ad77f9afb29c37ac9f40459`.
The safe JSON is SHA-256
`38fba2b5d6a14ec54ebdd0aee118c567e4166625f77bb01284142322877fec72`.
Provider-internal wire/request counts and monetary cost remain unobservable;
the recorded request counter of zero is not interpreted as zero model calls.
This does not establish general semantic-recall or billing completeness.

## Earlier R local Codex scope and provenance

On R, the provider was the locally installed `codex-app-server`, requested model
`gpt-6.1-sol`, low reasoning and default service tier. The seven cases cover
current host/model discovery; real HTTP file upload and background indexing;
actual model-selected canonical evidence reads for A and B with citations and
isolation; host-rebuild history retention; ordinary revision retaining a stale
answer and saved Work link; and explicit deletion erasing A's saved answer with
B as a positive control. There were two real Ask runs in total; history reads
and rebuilds did not replay them. This is not a measurement of general semantic
recall or provider billing completeness. Provider-internal request count and
monetary charge remain unverified; a reported zero request counter does not mean
that no model was called.

R's A run selected `search_context` and `evidence`; B selected `search_context`,
`material_catalog` and `material_read`. Each returned one canonical citation.
These are the tools observed in this receipt; an earlier run's selections are
not substituted for them.

R's before/after manifests contain 706 source and compiled input files with the
same SHA-256, `d9ed26082a549b14870556dd257ddaa9dd150fe3a35c353ce3e4c3b511d75d57`.
All five opened hosts were closed, listeners were closed and the generated vault
was removed. The earlier `e284df41` manifest also contained 706 files, with its
own unchanged before/after SHA-256,
`a20b9f3656489a3a4f9e14b5ce00213972319190b5bc96a8d363f61a418d985f`.
Sanitized receipts record absence checks for credentials, raw fact excerpts and
home paths; those checks are not assertions that such data was present, and
ambiguous raw manifest flags are not copied here.

The earlier immutable long-input Codex receipt remains evidence for its recorded
execution head and the five Agent hashes matching corrective source `3753e30e`.
Only 3/5 of those files match this joint candidate; retained main types/history/
task-context changes prevent treating all five as identical final-main inputs.
That earlier native turn proves its long-input path, not the complete joint
candidate. The `e284df41` and R receipts supply separate joint evidence.

| Retained local evidence | SHA-256 |
| --- | --- |
| `/tmp/mote-main-multiuser-joint-build-20261018.log` | `cb454c58b72f747a4d93e2de4945beea5b48fd945baccd12b84cd71cfba01256` |
| `/tmp/mote-main-multiuser-joint-recording-smoke-20261018.log` | `f5d58ec5586ce63db9bf91934f8b889a8edbdd036e661681155c1e8d994d00b6` |
| `/tmp/mote-main-multiuser-codex-live-e284df41-20261018.json` | `afa228926d6a2660f127513bbda5a3e7e9c16e1acb4190cc75e08538384c95ff` |
| `/tmp/mote-main-multiuser-joint-affected-e284df41-20261018.log` (failed) | `e44673efe7d5df6a0e15b7aad628647e8a2e2dbe24e56d2728239c3f28ea8700` |
| `/tmp/mote-original-cleanup-lifecycle-receipt-20261018.json` | `28471165c323b35a4f53f38b516fe4dd390b60d0b58178db848a096794c8e07c` |
| `/tmp/mote-main-multiuser-joint-build-cleanup-20261018.log` (R) | `a5da02fc8865e3781497e098def397e31f8d090cfcf05f35218eac79ac9f9c53` |
| `/tmp/mote-main-multiuser-codex-live-bfc4cbdf-20261018.json` (R) | `43fde56505d87022c8c92f07b81157bdc0efa16e5a85c6440db233b0f5186e20` |
| `/tmp/mote-main-multiuser-codex-live-bfc4cbdf-20261018.log` (R) | `618f3027a2a070785e396951f855ec5682072ace1dda01e976a5b893f7643d0e` |
| `/tmp/mote-main-multiuser-joint-affected-bfc4cbdf-20261018.log` (R, failed) | `7333479facffe14773c7849d457fce128bd1fd6b47597ade9becaedf122212de` |
| `/tmp/mote-main-multiuser-joint-affected-3518706b-20261018.log` (S, failed) | `2bf1820580d451442b9579098ce3cdfba6109ec4b027738c9f3aa7bb2c71c878` |
| `/tmp/mote-dev-log-retention-health-fixture-green-20261018.log` (R + test overlay) | `9f1525b17c89496e44a22baf92b91b4121af5c8b00f36fc23a096649381141d0` |
| `/tmp/mote-main-multiuser-client-bfc4cbdf-20261018.log` | `87e2e2fa859623e0e772618be63741efced5ef2cf888ec305267bbdef208be5e` |
| `/tmp/mote-main-multiuser-central-runner-bfc4cbdf-20261018.log` | `b03c8e3ce52c508d428bea0f2d2a821c3818c04bddbaab82bc447ae353e6d9e6` |
| `/tmp/mote-main-multiuser-android-unit-bfc4cbdf-20261018.log` | `2b96ebba0d0bea28bc7c53d2cf15d80d4527fe1540bd53e5143347e52eac3a77` |
| `/tmp/mote-main-multiuser-android-unit-bfc4cbdf-20261018-receipt.json` | `896a2689d3365677db7139a7bb5125374b1c76129f1d38b6268248dae2acfa04` |
| `/tmp/mote-main-multiuser-root-scripts-3518706b-20261018.log` | `07a9285c68443929adbacd109e5b4a36a882c6c4c0562b55779f64b3b2c884a1` |
| `/tmp/mote-main-multiuser-client-3518706b-20261018.log` | `91ff3f1fe884edf2514cb9b20b63b48fe37c4f825a84b041cf94f9ae0018ebf1` |
| `/tmp/mote-main-multiuser-central-runner-3518706b-20261018.log` | `5b91822512f9703e4ef2259b6155a752dc1ef5195d728dbd7254a33373ea0fae` |
| `/tmp/mote-main-multiuser-android-unit-3518706b-20261018.log` | `a3c101fe451afa15db0a3b0f4fcef7020e785ef863e4761599c6da18f4172c45` |
| `/tmp/mote-local-cleanup-shared-lifecycle-receipt-20261018.json` | `c5c881fc6397d4f0d35965fc9a256241845323bfda975e40ceba18c487cfa83e` |
| `/tmp/mote-local-cleanup-trace-3518706b-20261018/green-receipt.json` | `c669e4d76b311f2439475072080eb65029f59c6674ef996936479d22f771bb0c` |
| `/tmp/mote-local-cleanup-trace-3518706b-20261018/consumers-green-receipt.json` | `8751b9dd0d6b167b848acac09cd3558f8c45986cf0e8cad5ff4dcd1db3120567` |
| `/tmp/mote-main-multiuser-joint-build-6e4032e0-20261018.log` (T) | `15c7a9b05c684b3bbbe2f443cea7ef462b5ab927e8d18810bc56a52dbf911a15` |
| `/tmp/mote-main-multiuser-codex-live-6e4032e0-20261018.json` (T) | `38fba2b5d6a14ec54ebdd0aee118c567e4166625f77bb01284142322877fec72` |
| `/tmp/mote-main-multiuser-codex-live-6e4032e0-20261018.log` (T) | `a470bd2ba96c4b72912b6a67892aad5444119ab8ccd5e7860ecac89a76fc27f2` |
| `/tmp/mote-main-multiuser-joint-affected-6e4032e0-20261018.log` (T, inventory-only failure) | `92d2a8758b991d41e9b7d3f005a9dd485ead33a8b7a0272472f446ef33acf4a9` |
| [T full safe receipt](main-multiuser-final-affected-2026-10-18.json) | `f82ec6def363c4098aac46acaae559e0e11f5dfd2c8dfa44899e9446e97ada82` |
| [T truncated-stage receipt](main-multiuser-truncated-stages-2026-10-18.json) | `3ed9bf6eb4eb782fc92e24d3648ad29612c48c2abf41a0ded8c3ac829d52b7b1` |
| [Inventory correction receipt](main-multiuser-inventory-correction-2026-10-18.json) | `092739bd3d3a5d613817577aff6b9c03826b4dff1ebfbf9d225d85f1aa4db647` |

## Final documentation and delivery rule

A later documentation-only commit may carry these receipts only while the tested
runtime, dependency, test/tool and compiled inputs remain identical to the frozen
candidate. Keep each actual execution SHA, overlay identity and manifest above;
do not relabel the runs as occurring on a later documentation commit. Any relevant
input change requires fresh affected checks and journey evidence. Preserve the
failed attempts and T's actual natural exit 1 alongside the successful focused
correction and separately completed stages. This document records premerge
validation; the integration PR will record target-main ancestry and release/tag,
workflow and asset readback separately.

## Known MVP gaps and unverified scope

The [business-flow audit](../audits/business-flow-parity-2026-10-18.md) remains
applicable: F02 usage fragments/attribution are incomplete; F03 configured
retention periods and archive capacity limits are not enforced; F04 original/
Material candidate retrieval is FTS/literal, without a scoped vector/hybrid
producer. These are current capability gaps, not excluded old-version
compatibility. F10's stale-tail subcase, F12 history/equality and F13 deterministic
settlement repairs do not close every audit item. Canonical recording/Memory
product shape and restore-only enablement decisions retain their separate scope.

All acceptance data is generated. This joint lane did not validate physical
Mac/Android devices, OEM background behavior, real screen capture or system
permission prompts, supplier recording accounts/OAuth, OCR/ASR accuracy, general
retrieval quality, public deployment or download-to-install release journeys.
Earlier native/container/fixture receipts retain their own source and boundaries;
they are not automatically re-executed evidence for this joint candidate.
