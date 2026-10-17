# Android retained-history notices — 2026-10-17

Both original Android conversation readers now show the existing historical
version notice while retaining the saved answer and citations. Deleted turns
instead show the existing cleared-history notice, without rendering an answer,
citations or a stale notice. The actual native regression passes **6/6**,
including both readers, pagination, recreation, English/Chinese and a new
process. No screenshot, UI dump, personal capture or live model was used.

## Scope and source

This is a main consumer correction on base
`47bacc7a861ce387d2e8f0eca446c711c4ccd9e0`, Android code/test commit
`92b23cedeb55ce420e63cc51f6ca70657906a7ea`. Its generated host was separately
committed as `6c909149d2dae9395b3dbe8f0fade65e3a4b4aeb`
(`apps/android/test-fixtures/main-history-backend.ts`). A later comment-only
clarification calls its generated `agent.query` implementation an adapter; it
does not change the executed host behavior. This fixture does not exercise a
real Harness/tool loop or live model.

The [machine receipt](android-history-notice-2026-10-17.json) records source,
APK and log hashes, every accepted method, unsuccessful attempts and cleanup.
The main TypeScript/component gate belongs to its separate exact-`47bacc7a`
receipt. It was not rerun or claimed on this later Android-only SHA.

These are supported main consumers, not dormant M15 paths. Main and this
Android client both declare wire range **1–1**. The actual native owner login
validates configuration and creates a client session; its owner credential can
read `/api/conversations`. The main `MainActivity` ASK tab creates
`CentralContent` and selects saved history. Its ACTIVITY tab opens the actual
work list, result section and conversation link through the same production
transport. Both receive the server's `evidenceStale`/`evidenceDeleted` turn
metadata. PR159's wire-2 backend, `m15fixture` package and separate history
policies are outside this correction.

The small shared
[presentation helper](../../apps/android/app/src/main/java/dev/mote/collector/CentralConversationPresentation.kt)
is used by `CentralScreens.loadConversation` and
`CentralWorkActivity.conversation`. Current results retain their original JSON
identity; missing-result/error handling is unchanged. Deleted status takes
priority over stale status. Both existing messages and their Android English
translations are reused. No navigation, login, collection, permission or
retention policy changes.

## Actual RED and GREEN

The original production APK was built from `47bacc7a`, with the new
[native journey](../../apps/android/app/src/androidTest/java/dev/mote/collector/HistoricalConversationInstrumentedTest.kt)
compiled separately. Both original entry points successfully logged in and
displayed current answer/citation text, then failed the exact assertion
`Historical version notice must accompany retained native answer` after actual
ordinary evidence invalidation: ASK **2.833s**, work result **2.533s**, each
one JUnit failure. ADB itself exited0; that is not a passing instrumentation
result. Both original failure logs and APK hashes remain in the receipt.

The dedicated loopback host uses real `buildApp`, HTTP `/api/query`, owner
sessions, Conversations, query operations, Activity projection and SQLite. Only
its entire agent adapter is generated. Each reset produces a new original,
context artifact and **21-turn** conversation through the real query route.
Its controls replace an artifact through `EvidenceArchive.save` and explicitly
delete the original through `store.delete`; no test sets history flags or seeds
them with SQL. The server independently asserts retained stale turns or erased
deleted turns. Native assertions read actual Views and invoke existing controls.

| Final test APK execution | Language / appearance | Result |
| --- | --- | --- |
| Original ASK history | Chinese / Dark | 1/1 pass, 2.374s |
| Original ACTIVITY → results → conversation | Chinese / Dark | 1/1 pass, 2.190s |
| Original ASK history | English / Light | 1/1 pass, 2.023s |
| Original ACTIVITY → results → conversation | English / Light | 1/1 pass, 2.181s |
| New-process phase one | Chinese / Light | 1/1 pass, 1.734s |
| New-process phase two | Chinese / Light | 1/1 pass, 1.414s |

Each reader verifies current text/citations without a notice, stale notice with
unchanged text/citations, the older turn page and Activity recreation. Deletion
then removes old text/citations and displays only the cleared-history notice.
For Activity, the already-open reader uses its existing older-page control;
returning to the actual work result verifies that deletion has withdrawn its
conversation link. The fixture does not fabricate a deleted result link or add
a new refresh policy. ASK additionally refreshes the original history page.

The two process phases retain the same backend and app data, without clearing
or reinstalling between phases. Phase one persists PID **8519** and process
start time; the instrumentation runner subsequently ends that process
naturally. Phase two runs as PID **8622**, asserts a different PID or process
start, restores the original owner/history, reads the older stale page and
verifies later erasure. Both `/proc` entries are absent afterward. This is a
real new-process check; no SIGKILL is claimed. Five earlier successful native
invocations are retained as supplementary results, separately from this final
six-case matrix.

## Checks and preserved setup failures

JDK21 and the existing Android SDK were explicitly selected. Development app
and test APKs plus `lintDevelopment` pass: **65s**, followed by the final
instrumentation/PID/theme delta and lint in **16s**. Actual lint XML reports
**0 errors / 267 warnings**. The final product APK SHA-256 is
`1ade1cbba1f2e62d86cafb1b5ccf0910688ae443c87fc59962c2c5946b48c7ae`;
the final instrumentation APK is
`eea3e3ecfc1c62801a1b8c90bc1ec40e8dac2ca8c26ec8a2081c1c22521dade8`.

```sh
npm run check:affected -- --base 47bacc7a861ce387d2e8f0eca446c711c4ccd9e0
```

The actual plan selects **Android only** and naturally exits **0**: translation
checks, **52/52** release-tool regressions and **333/333** debug JVM tests.
There are **71 XML suites, 0 failures/errors/skips**; Gradle takes **41s** with
**24 tasks executed / 1 up-to-date**. This is a fresh JVM execution. Matching
dependencies are linked read-only within a gitignored directory; the lockfile
is unchanged.

Three local setup attempts remain explicit. The first private-fixture copy had
an ADB shell-quoting error before any method ran. The first affected attempt
exited1 because this new worktree lacked TypeScript. An initial top-level
dependency symlink was then detected as an untracked runtime path and
over-selected components; that attempt exited2 at TypeScript checking for a
missing workspace-private `mem0ai` type dependency, before any test suite ran.
Replacing it with a gitignored dependency directory restored the intended
Android-only plan. No assertion, concurrency limit or timeout was weakened,
and none of these setup failures is labelled a production RED or green gate.

The integration owner also reran the same affected entry point on combined
candidate `8642267f80dfe008f75828d71e6cd9cf0a0a05b7`, tree
`7c19c32a87742ce25794ca1a358e8c5d2a8d7214`, including the separate durable
host and its comment clarification. It naturally exits0: i18n, release52 and
JVM333 pass, with 71 XML suites and zero failures/errors/skips. Gradle takes
36s, **5 tasks executed / 20 up-to-date**; the earlier fresh333 run above is
not relabelled as this run. The final combined log is
`/tmp/mote-main-final-android-affected.log`, SHA-256
`87e90f1a30855ecf990cec651481dc42c00874aa3c60ffb11ce7c908f811cb31`.
Independent strict NodeNext checking of the durable host also exits0. These
Android/fixture checks do not claim another full TypeScript suite on that SHA.

An independent reviewer checked the shared helper, both integrations and
native journey with no blocking finding. A second independent review confirmed
the deleted-status priority and real Activity older-page path. These reviews
do not replace execution evidence.

## Repeat and boundaries

Build development app/test APKs using `-Pmote.testBuildType=development`. Start
the generated main-history host, forward only its two owned ports to a fresh
headless emulator and copy its private fixture JSON into the fixture package's
private files directory. Run the recorded methods with `historyFixture=true`,
the private `fixture` path, `language` and `appearance` instrumentation arguments;
require `OK (1 test)`. Invoke the process phases separately without clearing app
data, restarting the host or reinstalling between them. The host's `/state`
control is read-only. Generated credentials stay in private local files.

The dedicated API37/build `CE2A.260420.019` emulator (`emulator-5586`) was newly
created with no window, audio, snapshot or writable shared AVD. Its two ADB
reverse mappings were removed and verified empty; it exited0 and its PID/serial
are absent. Its temporary AVD was removed. The host owner verified PID36703's
identity, sent SIGTERM, observed graceful exit0 and confirmed no PID or listeners
on ports62012/62013. Only owned resources were touched; the shared ADB server
remains. Logs, APKs and local driver remain under
`/tmp/mote-main-history-native/evidence/` and `/tmp/run-main-history-native.py`.

Physical/OEM devices, API29–36 runtime, real system permissions/background
behavior, personal data, live-model quality, deployment and a PR159 port remain
unperformed. Generated native View assertions are not screenshot or physical
device evidence. Delivery to main must be established by the integration
owner's final target-branch readback.
