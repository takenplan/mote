# Main PR integration regression — 2026-10-17

This receipt covers main-targeted PRs #143 and #145–#148. It combines appearance,
Lark/Gmail evidence stability, historical-answer retention and derived-cache
Memory retention. PR159 targets `codex/mote-multiuser-integration` and has its own
source, gate and native/browser receipts; none of its results is counted here.

## Source and integration

Original base: `6272a9b51ec92cc4c32e2ff1a1eeb4fa38b142ed`.
Complete-driver candidate:
`47bacc7a861ce387d2e8f0eca446c711c4ccd9e0`, tree
`2c388243b724cbddb001a99de47ac8090846bb03`. All five original PR heads were
independently verified as ancestors. The later Android historical-answer
consumer correction and its generated host fixture are identified and validated
separately below; the other runtime inputs remain unchanged. Documentation-only
successors do not invalidate those executions.

| PR | Original reviewed head | Integration commit |
| --- | --- | --- |
| [#143 appearance](https://github.com/utopiafar/mote/pull/143) | `ce0c7e211ad1b6f8c2742c9e5862c4f496b9f7ff` | `c15bc24e905056f3c278aad967398fbd272837fd` |
| [#145 Lark evidence stability](https://github.com/utopiafar/mote/pull/145) | `abf61f1b993bf3cd9e980fd5533741832bae1df8` | `4f0305e659d4fa73abb898c795a0943c9ab9373a` |
| [#146 historical answers](https://github.com/utopiafar/mote/pull/146) | `2435f44e76e48da9adbdad5e3c0774821bc564e0` | `cf0292052539f3d205847dedadb31f1b6c83e984` |
| [#147 Gmail evidence stability](https://github.com/utopiafar/mote/pull/147) | `9dc47305f639169be94ff4b361d04fb67f3b3912` | `23c56ad82d7bf8191e4277a59c964d783c0d6603` |
| [#148 cache/Memory retention](https://github.com/utopiafar/mote/pull/148) | `d966759d18d01c7c9a2ad179144e96849abc2caa` | `1b0e114d0e036e149adb559e0b513e32d3a6c19f` |

The joint HTTP regression exposed a real boundary gap: replacing or evicting a
context artifact retained answer prose but omitted the historical-answer notice
and snapshot expiry. The final production correction is
`2e44c2c3f2e8be525c8e89f0d65b8b8c6739555b`. It persists the complete ordinary
invalidation lifecycle as SQLite SQL, installed before artifact deletion while
lineage remains available. It preserves historical prose and privacy receipts,
marks influenced answers stale, withdraws summaries and operational products,
and expires frozen conversation snapshots. Exact immutable replay does not
delete the artifact; explicit original deletion keeps its destructive cascade.
Optional schema owners refresh the trigger after installing their table groups;
savepoints protect standalone and nested trigger replacement.

Two test-only appearance fixes preserve the original acceptance assertions:
`6a610312871043762b89492086b2d67b7d0a22d2` waits for complete, typed fixture
connection JSON; `b7b73d3d84b9af5ddfcb1d50cd7e3e9737ebe9f3` observes the real
synchronous appearance bootstrap before checking the held application module.
Neither injects a scheme or color, changes CSP, nor relaxes expected first-frame
values. The second wait accounts for Chromium's speculative preload scanner
requesting the module before the preceding bootstrap has executed.

The privacy test correction
`4880182704401995017a3f6f05d483ee271587c1` replaces its retired empty
environment-file selector with an isolated generated `mote.yaml`. The fixture
still removes inherited `MOTE_*` configuration and uses only its own loopback
synthetic model. No production privacy policy or model selection changed.

Detailed failure, lifecycle and repeat instructions are retained in the
[joint cache/history report](context-cache-history-integration-2026-10-17.md),
[offline SQLite-writer report](context-history-sqlite-portability-2026-10-17.md),
[history matrix](../testing-evidence-history-retention.md), and
[appearance record](cross-platform-appearance.md).

## Complete affected-component driver

The required entry point is:

```sh
npm run check:affected -- --base origin/main
```

The recorded `origin/main` input is the original base above. This selects
`check:local` (translation, library builds, all workspace/script typechecks and
tests) followed by the original Android `:app:testDebugUnitTest` command. Test
concurrency, time limits and the 1,000-original Memory fixtures are unchanged.

After the SQL correction, the first complete driver naturally passed every
TypeScript/script stage, then exited **1** at the final Gradle setup because no
Android SDK location was selected. No JVM method ran in that failed Gradle
invocation. Those completed stages are actual passes; the whole driver remains
a failed run. Log: `/tmp/mote-merge-sql-final-gate.log`.

| Stage in that completed TypeScript/script portion | Actual result |
| --- | --- |
| Desktop | 456 pass; 0 fail |
| Server | 1,963 pass; 0 fail; 1 existing conditional skip; 1,964 total |
| Web | 475 pass; 0 fail; 0 skip |
| Agent | 317 pass; 0 fail; 1 existing conditional skip; 318 total |
| Diagnostics / Shared | 5 / 193 pass; 0 fail |
| Root script tests / client tests | 81 / 4 pass; 0 fail |
| Central runner | Natural exit 0; generated bounded-output and lifecycle checks pass |
| Android stage | SDK setup failure before test execution; driver exit 1 |

JDK21 and the SDK were then explicitly selected. The unchanged original Gradle
command naturally exited **0** in 66 seconds, with **25 tasks executed**. The
actual XML contains **71 suites / 333 tests / 0 failures / 0 errors / 0 skips**.
This is a fresh JVM run, not a cached pass. Log:
`/tmp/mote-merge-android-sdk-ready.log`. It closes the isolated SDK prerequisite;
it does not retroactively change the previous driver exit or replace the final
complete-driver result.

The same original-base complete driver was restarted with JDK21 and an explicit
SDK and **naturally exited 0**, completing at `2026-10-17T14:06:29+00:00`. Its final results
were Desktop456, Server1,963 plus one conditional skip, Web475, Agent317 plus
one conditional skip, Diagnostics5, Shared193, root scripts81 and client4;
Central runner passed. Android completed successfully with 25 up-to-date tasks,
reusing the separately executed 333-test JVM run above. No failed or skipped
stage was converted into a pass.

The final complete driver validated runtime source `47bacc7a861ce387d2e8f0eca446c711c4ccd9e0`
against original base `6272a9b51ec92cc4c32e2ff1a1eeb4fa38b142ed`.
The complete closed log `/tmp/mote-merge-complete-final-gate.log` has SHA-256
`ca17742a057ccb1fe4552d7e44fb29815e13d1ff21cb83b07a5de0075ac41364`.
Both unchanged 1,000-original journeys passed at standard concurrency and their
original budgets: bounded pipeline 93.216 seconds; real HTTP background packages
273.814 seconds. The later Android-only consumer correction is identified
separately below; it does not change these TypeScript/runtime inputs.

The existing conditional skips are the Server macOS staged-input sandbox case
and Agent installed-Codex synthetic local Responses fixture. Neither was run or
turned into a live-model pass.

## Actual UI and native acceptance

An independent reviewer freshly installed dependencies and built Web/Server,
the emitted Electron app, its two Swift helpers/icons, and the Android app/test
APKs against original PR143 product source `ce0c7e21`. Those appearance inputs
are retained by the main candidate. Generated-token consistency and focused
Shared/Web appearance/lifecycle tests passed. A separate post-readiness-fix run
on the main integration candidate exercised the production Web matrix again.

| Lane | Actually executed scope and result |
| --- | --- |
| Production Web | All **6** Light/Dark/Auto × OS-light/dark pairs pass. The application module is held under the real production CSP while exact bootstrap scheme/background/meta values are checked; refresh, live media changes, cross-tab selection, controlled Login modal and Notes draft identity/selection/focus/hash, phone overflow and increased-contrast roles pass. The post-fix main run reports all six pairs and `noModelCalls:true`; log `/tmp/mote-merge-appearance-bootstrap-ui.log`. |
| Emitted Electron | Independent **12/12**: six cold preference/OS pairs and six separate process restarts. Real preload/IPC, native theme source, atomic-save failure acknowledgement, modal/draft retention, refresh and contrast roles pass. OS input is generated through Electron's actual nativeTheme; global macOS appearance was not changed. Log `/tmp/mote-pr143-electron-matrix.log`. |
| Android API37 | Fresh generated headless/read-only emulator, build `CE2A.260420.019`: original native appearance **4/4** (56.105s), platform Auto case **1/1** (13.581s, all four explicit-Light/Dark→Auto × manually fixed OS pairs), and **5/5** force-stop/new-process cases. Application package resources and manifest launch-theme colors are asserted before Activity creation; Activity native-bar flags and editing state are checked separately. |
| Android focused build/lint | Focused actual Kotlin **12/12** (AppearancePreference2 + NativeUiPack10); development/test APKs and lint exit0, actual lint XML **0 errors / 268 warnings**. Historical PR143 lint counts remain scoped to their old runs. |
| Hidden UI harness | Main background harness passes window recreation, keyboard/wheel/pointer and animation-frame checks, with **0 windows shown / 0 native focus calls**; log `/tmp/mote-merge-final-background-ui.log`. |

The new-process sequence covers Auto→Light/OS-light, Light→Dark/OS-dark,
Dark→Auto/OS-light, then persisted Auto under OS-dark and OS-light. This is
process-start evidence rather than an inference from Activity recreation.
This independent run made no new native system-splash recording; the existing
generated system-splash frames retain their original PR143 attribution.

The numeric Android scheme-validation finding is reproduced and addressed by
the PR143 head. The app-local Auto claim was not reproduced: independently
reviewed AOSP API31 service code maps app-local AUTO to an undefined package
override, and the available API37 runtime cases agree. Both GitHub review
threads were read back as resolved; API31–36/OEM runtime behavior remains a
separate unperformed boundary.

Independent local logs: `/tmp/mote-pr143-web-matrix.log`,
`/tmp/mote-pr143-electron-matrix.log`, `/tmp/mote-pr143-android-build.log`,
`/tmp/mote-pr143-native/`, and `/tmp/mote-pr143-native-driver.log`.
These are new executions; the historical counts in the original appearance
record are not relabelled as this run.

## Additional production-entry regressions

After the final SQL correction, Server and Web runtime artifacts were rebuilt
successfully (`/tmp/mote-merge-sql-runtime-build.log`). The following original
commands then completed as one naturally successful chain; all data and model
responses were generated:

| Command | Actual result |
| --- | --- |
| `npm run test:profiles` | Exit0. Independent real Central profiles/tokens/vaults, encrypted image roundtrip, watcher/restart, offline backup/SHA/restore, release upgrade/rollback and PID identity protection pass. |
| `npm run test:e2e` | Exit0. Synthetic Mac/Android capture → encrypted deduplicated archive → real Harness tool loop with fixture provider → evidence/image → portable archive roundtrip. |
| `npm run test:media-e2e` | Exit0. Generated locked-screen media → idempotent archive → real Harness with fixture provider → scoped accounting/cited metadata → archive roundtrip. |
| `npm run test:privacy` | Exit0. **22 fixture checks** through the privacy gateway and local synthetic model; no screenshot or real-model validation. |

Logs are `/tmp/mote-merge-sql-profiles.log`,
`/tmp/mote-merge-sql-e2e.log`, `/tmp/mote-merge-sql-media-e2e.log`, and
`/tmp/mote-merge-sql-privacy.log`. The Harness is the real product adapter; a
fixture provider is not live-model quality evidence.

## Independent review and preserved failures

Independent non-author review of exact candidate `47bacc7a` found no confirmed
P0/P1/P2 defect in the SQL lifecycle or the two appearance readiness fixes. It
compared the SQL actions with `invalidateConversationAnswers([old.id], false)`,
including conservative dependency handling, delegated-product withdrawal,
summary/query-event cleanup, preserved prose/privacy lineage and revision
expiry. It inspected raw backup/native/Docker writers, optional schema install
order, obsolete-trigger replacement, standalone/nested savepoint rollback, and
the nine focused HTTP/SQLite scenarios. This was read-only source review; the
root's execution logs remain the test evidence. The focused five-file group
passed **28 tests**, without skips or cancellations.

Earlier unsuccessful outcomes remain distinct:

- The joint historical-notice omission was a production RED. Its initial
  callback-trigger correction then failed the real backup consumer with
  `no such function: mote_context_history_invalidate` (Server1,959 pass,
  1 fail, 1 skip). Persistent SQL replaced that connection-local dependency;
  real backup/restore, independent raw writes, rollback, restart/follow-up and
  later original deletion are durable regressions.
- The inherited overlap-poll fixture pinned only `Date.now()` while observations
  used real `new Date()`. The consistent Date mock retains the original
  assertions; production connector time validation is unchanged. Earlier
  interrupted/stalled or unsuccessful full-suite attempts are not accepted
  complete runs, and the unchanged Memory budgets were not extended.
- The first post-SQL complete driver's final SDK setup failure remains exit1.
  The fresh 333-test JVM pass and the final successful complete-driver result have
  their own sources and logs; neither rewrites that failure.

Review notes are retained locally in `/tmp/mote-pr143-independent-review.md`
and `/tmp/mote-independent-main-sql-readiness-47bacc7a.md`.

## Limits and delivery readback

Only generated fixtures were used. Physical Android/OEM and API29–36 runtime,
vendor background/system grants, a physical Mac global appearance change,
actual macOS Increase Contrast/Reduce Transparency and native system prompts
remain unrun. There is no iOS or browser-extension UI in this repository.
No real account/OAuth revocation, live external write, live-model call or model
quality, real personal screenshot/vault, deployed-release or deployment claim
is made. Already erased historical answers or Memory cannot be reconstructed.

Main five-PR validation does not establish the separate multiuser integration
branch or broader semantic equivalence for other provider fields/adapters.
Further raw-capture, Material-context and recording/container-equivalence
investigations retain their documented ownership and product boundaries.

The final GitHub integration PR records its published head and authorized merge
readback. Delivery requires all five original heads, the SQL fix and the Android
consumer correction to be ancestors of the refreshed remote `main`; its tree
must match the reviewed candidate. Local validation does not itself claim a
release or deployment.

## Android historical-answer consumer follow-up

The final consumer review found that main's two actual native readers ignored
`evidenceStale`: Ask history and Activity → completed work → results. Both
unmodified readers reproduced the missing notice with otherwise readable answer
and citation controls. The correction shares existing flag presentation across
those two readers, using the existing synchronized Chinese/English copy and
preserving the current/deleted priority and navigation. It introduces no new
history, permission or deletion policy.

Production/test source `92b23ced` was cherry-picked as
`8642267f80dfe008f75828d71e6cd9cf0a0a05b7`. Together with the generated host fixture
`6c909149` and its comment-only clarification `f8ebb31f`, this combined candidate
has tree `7c19c32a87742ce25794ca1a358e8c5d2a8d7214`. Only the five Android paths
changed after the complete-driver candidate; the rest of the runtime is unchanged.

The durable host uses a generated `agent.query` adapter, not a real Harness or
live model. Owner authentication, 21 actual HTTP query turns, conversation/work
storage, older-page requests, archive revision replacement and original deletion
use the real application. Native instrumentation launches the actual MainActivity
and clicks both existing readers. Generated fixture text is read from native
Views; no personal screenshot or UI dump is collected.

Actual final native results are **6/6**: both readers in Chinese/dark and
English/light, plus two successive process phases with the same app data and
host. Journeys assert current answers/citations, retained stale answers and
notices, older-page navigation, Activity recreation, explicit original deletion
and withdrawal of the work-result link. Phase1 persisted PID8519 and its start
identity; phase2 observed PID8622 and asserts a different PID/start identity.
The runner ended the first process naturally; this is new-process evidence, not
a claimed SIGKILL. Development/test APK builds and lint passed: **0 errors /
267 warnings**. Full RED, GREEN, per-run hashes, setup failures, cleanup and
limits are in the [Android receipt](android-history-notice-2026-10-17.md) and its
[structured receipts](android-history-notice-2026-10-17.json).

After combining the fixture and Android changes, the root independently ran:

```sh
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
ANDROID_HOME=/Users/utopiafar/Library/Android/sdk \
npm run check:affected -- --base 47bacc7a861ce387d2e8f0eca446c711c4ccd9e0
```

It selected Android only and **naturally exited 0**: i18n and **52 release-tool
tests** passed; Gradle completed in 36 seconds with 25 tasks (5 executed,
20 up-to-date), and actual XML contains **71 suites / 333 tests / 0 failures /
0 errors / 0 skips**. Log `/tmp/mote-main-final-android-affected.log` SHA-256:
`87e90f1a30855ecf990cec651481dc42c00874aa3c60ffb11ce7c908f811cb31`.
The new host fixture also passed strict NodeNext TypeScript checking. An
independent non-author read-only review found no blocking issue in the actual
owner path, state transitions, native assertions or source attribution.

The root-owned fixture host ended naturally with exit0 after SIGTERM; its PID
and both ports were independently confirmed absent. Agent-owned native process,
ADB reverse and emulator cleanup is recorded in the Android receipt. Subsequent
changes to this candidate are documentation only. Final target readback compares
the published integration head's complete tree, including those documents;
it does not compare the final target to the earlier `47bacc7a` tree.
