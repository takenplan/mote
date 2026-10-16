# Final multi-user joint acceptance: fixed scope and preparation ledger

Status: **PREPARATION; NOT final acceptance**, updated 2026-10-16 UTC. All final-gate
rows below are pending unless an actual execution receipt explicitly says otherwise.
The 15 delivered modules (including resumed M14) and architecture review are
dependencies, not proof that all17 modules work together. M13/M15 remain
checkpoints with known capability gaps. No whole-project completion, final
candidate or final joint PR is claimed.

## Authority, composition and evidence rules

The governing sources are [AGENTS](../../AGENTS.md), the
[original multi-user ADR](../adr-multiuser-scope.md),
[module and joint contract](../design/multiuser-modules.md), PR135's
[public contracts](../design/multiuser-public-contracts.md) and
[representative-chain specifications](multiuser-public-contracts.md).
Their single shared SQLite, shared services and one executor remain the design.
The original domain ADRs retain their business semantics; this preparation does
not introduce a framework, owner selector, additional runtime or new product limit.

Own clone: `/Users/utopiafar/Documents/Codex/2026-10-17/task/mote`.
Own branch: `codex/mote-multiuser-joint-validation`.
Actual host: `guangmodeMac-Studio`; the handoff's Bogon label is not machine proof.
The user's main working directory is not used for writes. Main and integration
were independently read from GitHub at `6272a9b51ec92cc4c32e2ff1a1eeb4fa38b142ed`.
Only this feature may compose dependencies. No merge/push to main or integration,
deployment, CI enablement, real data migration/deletion, real calendar/mail operations or system permission changes are authorized by these tests.
The later user instruction permits a separately reported real-model regression
through the locally signed-in Codex GPT-6.1 sol entry only; see J14.

Use generated A/B accounts with equal source/device/external/revision/batch IDs,
operation keys and original bytes. Keep actual Accounts, production app/listener,
SQLite, domain services, shared executor, worker and client adapters. Substitute
only external transport/model/provider I/O. Observe real entry/checkpoint/ACK
barriers with bounded state waits. Read-only DB observation is evidence; explicitly
label fault injection. A refusal needs a legitimate subsequent positive and B's
unchanged private state. Do not prove isolation by closing a whole capability.

An execution receipt records exact code/test SHA, command, runtime/ABI, selected
test names, pass/fail/cancel/skip, exit, duration and log SHA-256. Historical logs,
static review, copied build artifacts and new source runs are distinct categories.
An interrupted process without an exit receipt is not a pass or a code failure.
The 16:02 interruption at107 is retained as interruption; the resumed required
command actually completed EXIT0. Documentation-only deltas require link/format
review, not mechanical application reruns. Runtime changes trigger the affected
consumer checks and relevant matrix rows.

## Frozen delivered dependencies

GitHub metadata was independently read during preparation: these 15 PRs are OPEN
Drafts with base `codex/mote-multiuser-integration`; PR135 is architecture review,
not an eighteenth module. The snapshot is `/tmp/mote-joint-pr-snapshot.json`.
Main/integration readback: `/tmp/mote-joint-baseline-remote.txt`.

| Module / PR | Exact delivered head |
| --- | --- |
| M00 /126 | `5031b754915d3fbba0dbe0c050b6d103a02966ef` |
| M01 /127 | `443726d2a95ef55db9466d06aa44ea1061ca56e4` |
| M02 /128 | `8ecccb8ecf0093cc655fadd8bbc5e1637220f9fd` |
| M03 /131 | `b1f6700a7e68b60318b7b05f631a47d12fd93c24` |
| M04 /129 | `bc5323e1b5ee337c20dee58d4a8e9c25bc2adbbf` |
| M05 /130 | `7f72e9040872dbbb351f3c9a22afa6f069aa59c8` |
| M06 /133 | `470516b7ed4ab7ee8b0fba344883c6b42bb7ce56` |
| M07 /136 | `cd7a306cce0f6cd5fec3c9e91e6dee0761352115` |
| M08 /137 | `58944f00837c89bc1d302ecd7be7a568db4abe44` |
| M09 /132 | `cdc5c34c36fc5743049007ee2c76d705fde3dd7f` |
| M10 /134 | `7572b573b03437ff743652c13181b9fdcf251fda` |
| M11 /138 | `98d76945e091d7234217ebcf532ebeff3350937c` |
| Architecture /135 | `094b69d0c4d623a3b478ae4c05ee249b024ba73b` |
| M12 /140 | `a50d1c88647780ebd27d7a247ec4ffbc170ab87f` |
| M16 /141 | `eec967c66304fef78f683e3445900287e75bac21` |

Initial own combination `5656b5999c8f5c27fca11271a89cda3587a28325` merges
M12's final documentation into M16's delivered head. Relative to tested
`10748005a5d007695ecc9401d0d57dc9dea94919`, only
`docs/design/multiuser-actions.md`, `multiuser-actions.md` in this directory and
`multiuser-m16-lifecycle.md` differ. No runtime/test delta exists at this point.

An ancestry check found M02/M03/M04 delivered heads are **not** literal ancestors:
earlier composition copied their commits with new IDs. This must not be described
as all final heads being ancestors. Known mapped implementations are M02
`1323c7e1→12c1b44f`, shutdown `d8aaef97→e77faca9`; M04
`a5e91664→c4e4e8bc`, snapshot `e76f1fe6→463d5299`; M03
`fffe1d12→c21062a1`, staging fix `14858e86→d44963f5`.
The original M05 and M03 ledgers explain the composition. Verify remaining
patch/merge differences and retain later legitimate domain fixes; blindly merging
old branches must not restore superseded code. Other listed delivered heads,
including PR135, are literal ancestors of5656.

## Client readiness and remaining original capabilities

M13/M15 entries are **CHECKPOINT**, not final candidates; M14's module delivery
is final within its declared boundary. Finalization requires each remaining
owner's explicit final tested SHA, final affected/native/UI receipts, bounded
review and exact remote Draft PR head. Later WIP is never imported as a freeze.

| Owner | Explicitly reported composable checkpoint | Remaining gate / original capability |
| --- | --- | --- |
| M13 Web | **RESTORED by parent, active CHECKPOINT**, tested short build/types `815c5fe6`; later `84e3f9b85e2a3dc2cdc5edceb878133a643b7077` remains narrow-only | Consumed declared Joint43db Imports PREP; actual renderer upload/private-preview/confirm/A-B and lost commit/admission ACK/file-slice retirement have owner narrow receipts. Lark UTF8/task-identity/large calendar inventory have actual RED/GREEN and bounded read reviews; latest types/build/full affected/IAB/push/PR remain due. Earlier fullWeb515/515 belongs to its earlier candidate. New M06 unknown candidate is not consumed. |
| M14 Desktop | **FINAL module delivery** remote `cd46f25a030bdbe593bc138adc375577b4d032ae`; tested `45467379c5645dec62cc4b03e891b404b675193b`, later only two docs | Own independent GitHub readback confirms PR139 OPEN/Draft/base integration/exact final head (`/tmp/mote-joint-pr139-final-readback.json`). Owner required actual EXIT0: Desktop501/501, Server2626 pass/0 fail/1 existing OS opt-in skip, Web515/515, Android352/352/no failure/error/skip, types/root/shared/CLI0, Agent317+1 opt-in skip. Real generated Desktop native-calendar→M12 fixed review→M05 plus Ask/offline A/B/SIGKILL/restart passed; M13 bounded review no new confirmed finding. Handoff `/tmp/mote-m14-final-delivery-resumed.md`. No joint Files writes were in454; this is not whole joint proof. M14 ended, do not awaken. |
| M15 Android | Tested main `48a797854e96eedf57c4edbd451fa2e5c5132a73`; later limited Lark checkpoint `49347f929c3919a6e8471efbe458e6c0806a79fa` | Owner full Android353/353 and production APK41s EXIT0 apply to48a; real native Files speaker/correction/original/literal prefix, processing/devices/statistics/MCP, Google Calendar and Gmail lost-ACK/recreate/switch pass in its recorded scope. Generated local Codex Native Ask1/1 is separately reported in J14. Lark original entry RED→owned scope/preview/archive/source-context/A-B GREEN is a limited later checkpoint. New central browser-login purpose and recording reader changes remain untyped WIP; no full-module freeze is inferred. Final affected/review/push/PR, shared Imports/remaining Files/recording/QR outcomes remain OPEN. |

Shared-page ownership remains in the owners' existing ledger
`/tmp/mote-m13-shared-page-contract-map.md`,
[Web design](../design/multiuser-web.md),
[Memory parity](../design/multiuser-memory-parity.md),
[Desktop](multiuser-desktop.md) and [Android](multiuser-android.md).
Missing original capabilities are blockers; a new route or generic Material list
does not substitute for their intended user outcomes. Route changes allowed by
the MVP do not authorize capability removal.

Own composition `abbb3a786ab1cc5daa44a1fed20a2f5dde15cf4c` includes M14finalcd46,
M13CSS10f11 and M15stable220c. Android native main differs from220c only in the
shared translation catalog, retaining equal messages; no peer Android runtime
was edited. Four append/history conflicts took the delivered final/native test
versions after checking the concrete conflict. Two prior duplicate-key cleanup
commits deleted opposite occurrences, causing14 keys to disappear on merge;
own check:i18n actual RED then `d7990a85` restores exactly those14 shared/Android
keys once. Same checker GREEN8439 synchronized messages/call sites. This is a
joint merge repair, not a failure in M14's tested tree.

Later bounded client deltas are not yet imported here: M13Google0384,
original-byte reader17fd and raw Library entrybe6e; M15new7eca/107f work.
The exact17fd original-byte delta was independently source
reviewed here with no new confirmed P0/P1/P2; report
`/tmp/mote-joint-review-m13-file-original-17fd.md`, no test/build rerun. Its3/3
runtime result belongs to M13. Original invitation/QR pairing remains a shared
UNKNOWN: M01 PKCE approve/poll/ACK is implemented; no frozen canonical equivalent
for old invitation redemption/scan was delivered. Username login and MCP QR do
not close that retained outcome.

## Independent preparation probes: narrow scope only

Own read adapter `e27444881c63b0841be6098f6e55023f12ba18ae` restores actual
owner-filtered Files list/detail/chunks, authenticated M03 original playback and
existing tar formatting from M06 publications. Node24.21.0, source entry;
`multiuser-file-views.test.ts` plus the existing tar algorithm case3/3, no skip,
EXIT0. `/tmp/mote-joint-files-read-freeze.log`, SHA256
`0976d5c33199eca9e9bf0a67eb9f45f38ec161396987340dd758343d975fa322`.
Fresh shared build, server types and scope boundary passed separately. This is
partial Files, not whole recording/Imports parity or final compiled proof.

M13's exact-e274 independent review found export source errors were not forwarded
through `.pipe(gzip)`. Own durable actual-helper child process atbf00 reproduced
uncaught source error/EXIT1. Minimal07c0adf switches to `pipeline`; same source
failure plus existing tar positive2/2/no skip/EXIT0, source Node24.21.0.
`/tmp/mote-joint-export-stream-green.log`, SHA256
`5b647d9a8a8c0cc5df3e517a5d17171b2eb7845bfd7a9b4a05a1f9c93cf90b09`.
M13 reviewed exact07c and closed the code path with no new confirmed finding in
`/tmp/mote-m13-review-joint-files-e274.md`. This is not a full HTTP timing proof.

The owner correction/speaker candidate has actual2/2 missing-route RED at7faf;
`/tmp/mote-joint-files-corrections-red.log` SHA256
`15ec6b293b6186ab9cbda3c036194a73b83dcd551229e4f7a8eb4c883090aaae`.
Its later older-portable merge probe validly failed `archive_conflict` at Memory's
current-only evidence reader after a legitimate Material revision; diagnostic
instrumentation was test-only and removed. `/tmp/mote-joint-files-corrections-merge.log`
SHA256 `e8ddbe34e8286244d6f754bdca047867f0e95644d0d571c8b21f399b9ed00c53`.
After minimal retained-recovery adaptation, source candidate3/3/no skip/EXIT0,
4.39s: exact A/B correction, preserved raw/corrected tar, confirmed names,
older-name merge/current-name preservation, replay/corrupt-link rollback, physical
A deletion with B unchanged, offline backup/restore and old token401.
`/tmp/mote-joint-files-corrections-merge-green.log` SHA256
`0db603788a0fea4d7ee2b2016ac3be7e21bf9b0d3eafc551b86797ac2889f8c1`.

One additional actual production Memory/portable test using generated loopback
model I/O passes1/1/no skip/EXIT0,11.82s: retain old evidence/history, preserve
grants/call count on import, reject old pinned execution409, and execute a new
current owner request positively. Sandbox listener EPERM was environmental;
the same command passed under normal authorized review, no real model contacted.
`/tmp/mote-joint-memory-retained-import.log` SHA256
`76eb490621a4a704e850cc83f1c30dd4524f18c37c57d646252eb7f99be2c153`.
These write/recovery changes remain a candidate until types, adjacent checks and
bounded review complete; no final affected or module claim is inferred.

**Current shared thin freeze: `a10effd109e64651e5cafe801b686238271964bf`.**
Its write core is643812, with M14final composition and the catalog repair above.
M13 independently reviewed exact643812 and the exacta10 two-line format filter,
no new confirmed P0/P1/P2, `/tmp/mote-m13-review-joint-files-6438.md`; no reviewer
test rerun. At9b96 an actual retained source-item JSON envelope incorrectly
appeared as an external file: valid RED `/tmp/mote-joint-files-envelope-red.log`.
a10 limits the common owned-read base to M06's trusted `file`/`processor:*`
format. Reference captures remain readable through their own source entry; no
playback/download authority is fabricated from their retained JSON wrapper.

Earlier speaker/backup cases used structured source-item metadata. They are
superseded for external-recording proof by actual generated WAV M03 upload→M04
lease→M05→M06, substituting only the external loopback ASR response. Current
seven source tests (three file views, three correction/speaker/recovery, one
stream-failure regression) pass7/7/no skip/EXIT0,8.65s:
`/tmp/mote-joint-files-real-recording-green.log/.exit`. The old export algorithm
positive separately passes1/1. Server types at643812 passed; the current exacta10
types and adjacent complete portable suite receive their own receipt below.
The freeze was offered to active M13/M15 consumers, not ended M14. It closes only
these listed seams; review proposals/acoustic assets/controls and Imports remain
OPEN. Whole final candidate/required/compiled/native/client acceptance is pending.

Exacta10 server noEmit exits0 (`/tmp/mote-joint-a10-types.log/.exit`, SHA256
`d92fa527b2cf6e7a734a389df70ded049e13fde5d094ded997bb6d7bd18c61e9`).
The complete affected personal-portable suite passes15/15/no skip/EXIT0,33.57s,
`/tmp/mote-joint-a10-portable.log/.exit`, SHA256
`0caa291aa0843e97741243d610a6306ce4cb6b595ea559fa5a7eb56da7cf9efd`.
The current seven Files cases' log SHA256 is
`95901430f445b32fb99c4e29e1f68fd3e7f06c4ac7070506ee49082ec1c47978`.
These are independent source-entry receipts, no compiled/server-wide gate claim.
All Joint processes completed and the heavy slot is explicitly RELEASED.

The parent assigned a released slot to container validation
`01a145c1-31b7-75e9-b834-56885c972010`, based on M16eec. Its new runtime/scripts
remain separate until the final freeze. The original daemon failures are
historical: Docker became accessible, the standard repository image actually
built EXIT0 (immutable2e0a192e...), and owner13515436 actual production restore
ran two clean start/stop cycles and rebackup with equal capture IDs, distinct
A/B text, original bytes, old-token401, no active old task grants and preserved
unknown issuance. Direct offline Hindsight recovery06fd also passed with two
canonical bodies and old-token401/workerfalse. The later production Managed
Runtime/Engine.read seam first failed generated fixture digest normalization;
258f787d corrects only fixture schema normalization and same-case actual EXIT0
then proves two canonical reads, wrong-model pre-refusal, fresh credential, old
API401, workerfalse, zero inference, stop/rebackup. Later final271 gate EXIT2
(script fixture types) and final2b722 EXIT1 (MCP raw-note timing fixture) are
preserved. Deterministic fixture RED1f1897→GREEN0efc separates retired note raw
refs from actual unprocessed M03 Unicode windows; no production change. Current
ab7069aa2a1c59eda1a0775ae8d52c0632a70c89 required3 ended EXIT0; final723cc0b7 is doc-only thereafter, independently checked here. No
new whole-container gate or combined Joint backup-schema acceptance is inferred. Source reviews are in
`/tmp/mote-joint-review-container-actual-fixtures.md`; owner logs are separate.

## Finite final acceptance matrix

The following 14 rows are the final scope. Reuse the named tests/fixtures and add
only a missing concrete regression when evidence requires it. Paths below are
relative to the repository; most server suites are in `apps/server/test/`.
Every row is **FINAL PENDING**. Owning-module history is supporting evidence only.

| ID / real entry | Required finite journey and observations | Reused evidence / blocking condition |
| --- | --- | --- |
| J01 Accounts/private HTTP/MCP | A/B equal business IDs and bytes; valid login→read/write; exchange ID/cursor/download/token; admin cannot browse B; logout leaves previously admitted work; disable/reset rejects late publication. Verify counts and errors do not disclose B; retain original device pairing/QR outcome against canonical M01 contract. | `multiuser-auth*.test.ts`, `private-data.test.ts`, `multiuser-ingress*.test.ts`, `multiuser-mcp*.test.ts`; real production route registration, no default owner. Canonical QR equivalence is explicitly UNKNOWN, not passed by login or MCP authorization; parent plans its next available implementation slot, so this is not waiting on a user decision. |
| J02 Web renderer | A→B, old tab/API/modal/draft, slow read and held write; old A request cannot use B's cookie; B positive request succeeds. Include actual Actions/OQ revision and portable import/export UI. | M13 current IAB journey and actual host; owner-reported old hidden Electron action was denied and unexecuted, so do not retry it or count it as a pass. Final IAB receipt pending. |
| J03 Desktop main/preload/collector | A offline queue/draft/source→B explicit start→process death/restart→late A ACK→A resumes; exact original bytes; same-account token rotation preserves owner; same URL/new deployment stops bytes; old local format refuses before mutation. | `apps/desktop/test/multiuser-desktop.test.ts`, existing headless native runner and final M14 Actions path. Settings/current status, source edits, original file scan and raw/context readers remain positive cases. |
| J04 Android Activity/WorkManager | Same queue/switch/death/late ACK/rotation/deployment matrix; native notes/capture/source/snapshot recovery and original bytes; stale detached modal/page/CalendarWorker does not adopt B; new B note/capture positive. | Existing `MultiuserWorkerInstrumentedTest.kt`, JVM tests and isolated headless fixture APK. Actual system grant/revoke and physical-device behavior remain separately unrun; do not change system permissions. |
| J05 A: original→M06→Material→Memory | Equal A/B IDs/bytes; original receipt is saved, not processed/indexed; real decoding/OCR/ASR and exact source/revision; automatic extraction+independent review; restart and success checkpoint reuse. Coding tool/envelope excluded, legitimate multipart/text/mail/image and long tail preserved; retained pre-fix projections stay retired. | `multiuser-processing*.test.ts`, `multiuser-memory*.test.ts`, retained Coding cases and original M07 parity ledger. Both current and retained/history/restore reads matter. |
| J06 B: Memory→Ask/Insight→MCP | Actual provider/Harness/SDK, equal IDs; before-LIMIT full transitive filtering; original disclosure before citation; full context/history/paging and InsightSnapshot; revoke/delete/recreate across provider await preserves first proof; B normal result unchanged. | `multiuser-mcp-representative.test.ts`, `multiuser-ask-read-races.test.ts`, `multiuser-mcp-{memory,query}.test.ts`; captured actual model requests contain only owner evidence. |
| J07 C: single executor→revoke→SIGKILL | A backlog/B ready fairness and shared capacity; real in-flight external call entered→revoke→SIGKILL→natural recovery; unknown is not reissued; worker physically retires; successful model/ASR children not replayed; B continues. | `multiuser-execution-core.test.ts`, `multiuser-memory-outcome-process.test.ts`, `multiuser-processing-process.test.ts`; seeded journal/graceful restart alone does not prove death. |
| J08 Actions/Todos/native adapter | Fixed reviewed revision/source/content/target/account/device; OQ CAS, create/update/cancel/complete, sameAs/timezone/full Unicode/paging positive; stale approval rejected; issued successful native write+host/native SIGKILL reconciles exactly once without model/native replay. | `multiuser-actions-*.test.ts`, fresh compiled host `multiuser-actions-process.test.ts`, real client consumer cases; fake external calendar only. |
| J09 personal portable import | Same deployment/account later export→earlier stopped instance→missing originals/Memory/conversation/Todos merge; existing new records win and repeated import deduplicates. Wrong user/deployment/format/coverage/corrupt original rejects atomically; no old auto grant/plugin/action authority revives after restart. | `multiuser-portable-import.test.ts`, `multiuser-actions-portable.test.ts`, real client modal/content entry. Personal merge is not historical per-user restore. |
| J10 account deletion | A has issued unknown external fact/held late result and shared bytes; revoke admission/publication first→durable result_unknown→exact late ACK settles only old fact→retry physically erases private metadata. A stays unreadable; B hashes/rows/credentials unchanged; missing/late hook blocks false success. | `multiuser-lifecycle.test.ts`, `multiuser-actions-lifecycle.test.ts` (actual M16 waits for calendar fact), provider deletion cases. Unknown cannot be marked physically complete or resubmitted. |
| J11 native instance/production package | Stopped backup CLI→empty isolated target→fresh emitted server twice; preserve deployment/account IDs, originals/hash, canonical Memory/history, conversations/config/plugins/Todos and succeeded/unknown facts; all authority retired. Old epoch/corrupt/missing domain/schema/native content rejects before target writes. | `multiuser-instance-backup.test.ts`, `multiuser-backup-{capture-updates,actions}.test.ts`; use `MOTE_M16_COMPILED_HOST=1 MOTE_M16_PACKAGED_BACKUP=1` after own fresh build. Copy-only dist is not fresh-build proof. |
| J12 shared config/plugins/connectors/old UI | Shared model key/reference and weight/code reuse with independent personal config/usage; M04 CAS/pinned snapshot/restart/explicit failures. Generated package formal install and actual worker; A stop leaves B active. Gmail/Calendar/Lark/document/recordings native formats and long text; OAuth reversed/replayed callback and account switch; no credential/cursor sharing. | Existing config/plugin/connector process tests, original algorithms and final owned client UI. Preserve Memory binding prepare/drain/migrate/activate/cancel and source import/Files/review/export/advanced settings capabilities in the owner ledger. Missing projections/UI block this row. |
| J13 Docker retained recovery | Disposable epoch5 Docker profile publication and stopped target recovery through production CLI; actual owned Hindsight Docker volume snapshot/restore and canonical/history re-open, without old execution authority. No deployment or existing-volume access. | **OPEN final container freeze/gate and Joint schema combination**. Owner13515436 actual generated production image restore/start/stop/restart/rebackup passes; direct offline Hindsight06fd canonical/API recovery passes. Managed Runtime/Engine.read258f787d actual same-case EXIT0 follows the preserved fixture-normalization failure; final required3ab706 ended EXIT0 after two separately preserved gate failures; local composition1a42 retains both originals and provider checks, with new narrow proofs below. Immutable image built EXIT0; old daemon/build-pending states are historical. Do not move the earlier d181 required gate to newer runtime or Joint Imports tables. |
| J14 real-model regression and private-data boundary | User amendment `Sentinel_90402956f4b881918763a8a61d350969`: retain deterministic mocks for isolation/retry assertions. When a real-model regression is needed, first verify the exact locally available Codex model/interface for the user’s “GPE 6.1 sol” (parent interpretation: GPT-6.1 sol), then use that signed-in local entry. Do not silently substitute another model/provider or create credentials. Prefer generated data. Optional local Central reads must be copied read-only to an isolated directory outside the repository before testing. | **PARTIAL: owner M15 actual generated Native Ask1/1,11.281s EXIT0** on retained48a baseline, using the existing M01/M04/M08 plus locally signed-in Codex `gpt-6.1-sol`. CLI0.162.1 catalog and ephemeral no-turn handshake selected the exact same model; no fallback/new provider credential. This is owner execution, not Joint rerun or an Imports semantic-model claim. Final composed model entry and privacy audit remain pending. Record only identifier/interface/SHA/result, no private content. Central originals and every derivative—prompts/responses, summaries, embeddings, screenshots, exports, logs, fixtures—must stay outside Git, including add/commit/stash/branches/remotes, PR text/comments and shared attachments/logs. Audit staged diff and new files individually; gitignore alone is insufficient. If private material has entered Git, stop push and report to parent; do not rewrite history or permanently delete it. Joint has used generated data only so far. |

## Historical receipts, deliberately not independent reruns

At107 the common M12/M16 executor was **M16**, with M12 checking its receipts.
`check:affected` EXIT0 included Desktop492, Server2626pass/1existing opt-in skip,
Web505, Agent317pass/1existing opt-in skip, Shared192, Diagnostics5, root81,
client5 and actual Android352/352 (74 XMLs, no fail/error/skip). Catalog4 and fresh
compiled Actions SIGKILL1/1 passed at107. Compiled/package backup40/40 and fresh
Desktop passed at `6f5bdeb6`; only Actions catalog runtime later changed.
See [M12 exact receipts](multiuser-actions.md) and
[M16 exact receipts](multiuser-m16-lifecycle.md). These results are neither this
thread's independent execution nor final proof for later client code.

Docker read-only environment probe in this workspace: sandbox attempt EXIT1
`permission denied` on socket; approved read-only `docker version --format
'{{.Server.Version}}'` EXIT1 `Cannot connect to the Docker daemon`. No daemon,
image, container, volume, permission or system setting was changed. The independent
source inspection also confirms `restoreProfile`'s explicit epoch5 Docker refusal.

## Execution order and release gate

1. Finish dependency mapping and documentation checks; compose only agreed
   freezes in this branch, preserve both sides of shared seams and inspect diff.
   Report preparation probes separately; do not repeatedly run whole suites while
   clients are changing. Dependencies are private copies with local workspace links.
2. Wait for all three final deliveries: exact tested SHA, final gap list, affected
   and relevant UI/native receipts, review and remote Draft PR verification. Any
   still-missing KEEP capability blocks the relevant row and whole-project claim.
3. Agree one final runtime/test combination and exclusive heavy window with the
   active owners. The parent's four current slots are M13/M15/Joint/container
   recovery; M14 has ended. No fifth thread and no awakening M12/M14/M16.
   Build shared libraries/Central/Desktop/current APK as relevant; run J01–J14's
   existing representative cases and actual client entry journeys on that tree.
4. Execute the repository-required
   `npm run check:affected -- --base origin/codex/mote-multiuser-integration`
   once against the frozen candidate with JDK21 and the existing Android SDK.
   Capture actual exit and Android XML counts. Run compiled/package restart checks
   from fresh own output, not another workspace's dist. Serial heavy phases only.
5. Record failures by responsibility and retain RED→minimal fix→same GREEN where
   a real new production defect is confirmed; rerun affected consumers/rows. Do not
   create a generic test infrastructure or rewrite old tests just to obtain green.
6. Only after this thread's applicable acceptance passes, publish its own Draft PR
   to integration, never merge. Verify exact remote head/base/Draft and CI status;
   Checks/Component checks stay disabled. Unrun Docker/physical/live-model/provider
   checks stay explicit, and prevent claiming acceptance across their scope.

Waiting conditions are substantive: three final client deliveries, closure of
missing original capabilities, an exclusive heavy window, and a decision/closure
for epoch5 Docker publication plus available Docker/Hindsight validation. Waiting
does not remove these rows. Current preparation has no final gate/PR receipt.


## Current shared Imports candidate — source-only checkpoint, not final parity

The original generic wire contract now uses M03 private staging and the existing
M06 host / M05 executor. It preserves raw four-MiB parts, stable upload/request
IDs, inline originals, one-day staging cleanup, host restart, deterministic text,
pinned bounded ZIP expansion, configured hash-pinned Python Source Packs, private
model-assisted previews, explicit review/confirmation, exact deduplication,
original archive links, cancel/retry and actual same-account portable merge.
No legacy Store, per-account runtime/executor or uploaded script capability is
constructed. Model mapping uses the existing read-only context reader; a separate
bounded host-control preview fragment may preserve original indexes or append
validated records only to the private preview. It grants no path, capture,
Material, Memory, provider or task authority. The original10000-record/32MiB
manifest bound and existing format-worker limits are retained; long text is not
truncated to fit one model answer.

The current15 cases in multiuser-import-jobs.test.ts and
multiuser-import-uploads.test.ts actually pass15/15, no skip,28.23s, EXIT0:
`/tmp/mote-joint-import-entry-composed.log/.exit`, Node24.21.0 with the existing
macOS Python OS-sandbox opt-in. This includes M03 real worker, M04 frozen import
lease, M05 task fence, immutable preview, a forged known-digest task refusal,
A/B equal business IDs, exact old inline wire, real ZIP worker, real Python
sandbox, long original + repeated fragment ACK, held model response through A
retirement/re-enable, completed import export/erase/B unchanged, and restored
unconfirmed preview requiring new preparation/confirmation. Model/ASR transport
uses generated loopback substitutes; Python/container decoding remains real.
First sandbox loopback EPERM was environmental and is retained separately; the
same authorized localhost command passed. The first inline/ZIP probe expected
raw archive text in public capture metadata; it correctly found empty text under
M03's contract. Corrected assertions read exact bytes through current M03 tickets
and explicitly require public capture text to stay empty; no production guard
was weakened.

Import media/read-only progress separately passes the same actual WAV chain1/1,
including explicit confirmation, exactly one ASR call per owner, exact ticket
bytes, live processing task/searchability, Memory disabled rather than falsely
completed, source-retired A unavailable and equal-ID B still current. Progress
projects existing M06/M08 receipt/material/task data only; it admits no work.
Non-disabled Memory recipe/batch progress is still awaiting its full user-journey
characterization. Server types passed after the sole new parts-array annotation
repair (`/tmp/mote-joint-import-expanded-types2.log/.exit`); subsequent projection
classification-only deltas need their final affected gate.

The M15 post-handler/onSend export observation was independently reproduced here
in multiuser-files-stream.test.ts (EXIT1). The producer now starts lazily on the
consumer read and checks exact current file/source/artifact proof before each
returned compressed chunk. Same held-source retirement + equal-ID B positive
and original source-error child process pass2/2/no skip/EXIT0:
`/tmp/mote-joint-files-stream-composed.log/.exit`. This closes that concrete
pre-consumer boundary; it is not a cross-account leak claim or all socket timing.

Still OPEN before whole Imports/Files acceptance: image profile/attachment image
pipeline equivalence (explicit image profile currently blocks rather than being
silently ignored); partial-commit recovery/ambiguity/fault branches; full Memory per-recipe/batch progress; Files review
proposals/acoustic samples/per-file overrides/reprocess/cancel/retry/forget and
complete recording export. Current source checkpoint is not a compiled/final
candidate, client consumer acceptance, required affected gate, or joint PR.


Deletion and stopped-instance import seams (post-ead narrow checkpoint): the
last-import delete previously left its private original downloadable (actual
RED against ead; /tmp/mote-joint-import-delete-red.log/.exit). M03 now removes
unreferenced archived file metadata and staging receipts, retaining other jobs
and capture links, and uses existing object GC when no M03 activity is active.
The same last-delete case passes, including actual absent A object path and
same-upload-ID B bytes. Personal unconfirmed export -> delete -> restore -> new
preview/confirmation also passes: two selected cases, 2/2, no skip, EXIT0 in
/tmp/mote-joint-import-delete-restore-approved.log/.exit. The initial sandbox
run's localhost listen EPERM is retained as environment failure, not code RED.

A new real stopped backup/restore case preserves A private preview and equal-ID
B completed history, rejects the pre-restore token and old confirm, then uses a
fresh model lease/preview/explicit confirmation before importing A. B capture
IDs stay unchanged. 1/1, no skip, EXIT0 in
/tmp/mote-joint-import-instance-restore.log/.exit. This is generated SQLite/FS/
production HTTP/backup script evidence with synthetic localhost model transport;
it does not substitute for physical clients, provider accuracy, partial-commit
recovery, pin-held deferred GC characterization, or the final affected gate.
Scope inventory passes; no new types/build/fullsuite was run during theme's
soleheavy window.


The 1a9d deletion checkpoint received a bounded source review from the container
owner (/tmp/mote-container-review-joint-import-gc-1a9d.md). Its late-GC concern
was reproduced with two generated originals and a fault after actual object GC:
HTTP503 rolled job/archive SQL back while its original bytes stayed absent
(/tmp/mote-joint-import-delete-gc-red2.log/.exit). Physical GC now runs after the
outer deletion metadata commit; failure leaves deleted metadata committed and
garbagePending=true for the existing GC retry. A surrounding host transaction
also defers physical GC. Actual real M03 pin retention initially returned a false
settled flag (pin RED); removed-hash pins now explicitly defer reclamation.

Four selected cases pass4/4/no skip/EXIT0, 7.04s in
/tmp/mote-joint-import-fault-pin-resume-green.log/.exit: successful last-delete
with sibling/B preservation; first record durable + injected second publication
failure -> host restart -> exact checkpoint resume (no first-record replay); late
GC failure -> committed deletion/pending GC -> retry; actual Originals.pin ->
metadata deletion/physical retention -> release -> physical GC. This closes these
concrete branches, not partial instance-restore or every ambiguity/external-I/O
path. No final types/affected/compiled/client acceptance is inferred.


Non-disabled Memory progress now has two concrete real entry cases, not merely
SQL seed coverage. /tmp/mote-joint-import-memory-composed-green.log/.exit is
2/2/no skip/EXIT0, 13.53s: same import ID A/B, two original records and two
selected recipes per owner, actual M03/M06/M08 workers with two-record batches,
then A cancellation of one selected recipe while its sibling commits. Both
selected recipes must complete before an original is completed; cancelled A
originals do not inherit B completion. The external model transport supplies
generated empty candidates with exact target coverage, not real model accuracy.

The missing-A-model case exposed an actual GET Import404 while the saved import
and original existed: mm_intakes had a proposed job_id but admission's actual
M05 task was stale/grant_revoked before mm_jobs existed. That failure is retained
in /tmp/mote-joint-import-memory-model-wait-red2.log/.exit. Projection now catches
only that missing Memory job, reads its actual intake task, and exposes failed
progress without a nonexistent job link; B completes through B model only. The
actual stale receipt is not relabelled waitingForModel. Media job links also join
actual owner mm_jobs. New known-model-wait/paused/backoff/restore branches remain
unverified, as does semantic extraction accuracy; current code still needs final
types/affected/compiled/client acceptance.


Partial instance recovery now has its separate actual case: before second M03
record publication a generated fault leaves exactly one committed record and
one durable checkpoint. Stop -> real epoch5 backup -> fresh target restore ->
old confirmation409 -> fresh model preview with zero new publications -> explicit
owner confirmation imports only the second record and deduplicates the first;
the original first capture ID survives. 1/1/no skip/EXIT0, 7.43s in
/tmp/mote-joint-import-partial-instance-restore.log/.exit. It uses actual M01/M03/
M04/M05/M06/SQL/FS/backup entry points with a synthetic model transport. No
production change was needed for this scenario. Unknown external results, image
profile parity, remaining Memory states and the previously listed Files gaps
remain OPEN; this case does not replace a final candidate gate.


Generic upload erasure seam: a real M03 original worker is held before its actual
prepareArchive transport while account A is deleted. M16 returns result_unknown
and retains A physical root until settlement. Equal upload-ID B commits and its
bytes remain readable. Release makes retired A commit401; explicit existing
admin erasure retry completes and A physical root is absent, B bytes unchanged.
1/1/no skip/EXIT0, 1.03s in /tmp/mote-joint-import-upload-erasure.log/.exit.
This proves the local live-activity erasure barrier for the new generic-upload
path; it is not an external provider unknown-result settlement assertion. No
production change was needed, and final affected checks remain pending.

M06 unknown-result repair candidate: original bare-503 fixture actually issued
four calls rather than one (RED /tmp/mote-joint-file-unknown-red.log/.exit).
The existing M05 issuance ledger now guards each real M06 I/O stage. Two new
production HTTP cases pass 2/2 in
/tmp/mote-joint-file-unknown-late-green2.log/.exit: bare503 retains unknown with
one A call and B success; a held valid ASR ACK after account deletion settles
only the exact old external fact, publishes no A artifact, and permits the
existing erasure retry to remove A physical originals while B stays indexed.
The earlier misleadingly named late-green log ran only the first case after a
fixture rewrite failed; it is not evidence for the second case.

Adjacent actual cases: ASR+diarization checkpoint restart and explicit unknown
retry 2/2 in /tmp/mote-joint-file-unknown-explicit-adjacent2.log/.exit; media
cancel, original M16 processing deletion, scoped summary and cancelled summary
4/4 in /tmp/mote-joint-file-unknown-fences-adjacent.log/.exit. Explicit retries
start a fresh attempt budget; two confirmations and four actual calls leave two
old unknown external facts unresolved. Initial candidate nested-admission and
fixture budget assertions failed and remain in their own logs; these are not
baseline behavior failures. No full affected/type/compiled acceptance is inferred
from these narrow generated transport cases, and no real provider was called.

M05 adjacent issuance capability: a completed first stage permits the second
issuance, replaying the first ACK leaves the second issued, and settling A's
second fact never readmits its blocked task or changes B. This new case plus
the existing unknown-effect restart/owner-confirmation case pass 2/2 in
/tmp/mote-joint-file-unknown-m05-adjacent2.log/.exit. These are task-authority
checks, not new client or arbitrary socket-timing coverage.

Additional cross-operation characterization: a fresh operation ID was accepted
and actually issued a second ASR request while its original remained unknown
(1/1 RED, /tmp/mote-joint-file-unknown-new-operation-red2.log/.exit). Admission
and issuance now check the existing owner's unacknowledged M05 calls for that
original. Same-operation ACK retry remains idempotent. The extended bare503,
late account-delete ACK and two synchronously queued no-model parents with real
asynchronous M04 children pass 3/3/no skip in
/tmp/mote-joint-file-unknown-operation-queue-green2.log/.exit. Initial queued
fixture wrongly attempted synchronous model admission and was rejected409; it
was corrected to genuine no-model parents, without changing production rules.
Existing cached duplicate operation, ASR checkpoint and explicit confirmation
recovery pass 3/3 in
/tmp/mote-joint-file-unknown-cross-operation-adjacent.log/.exit. The new admission
query does not turn a replay confirmation into outcome settlement. Types,
independent review of this additional delta and final composed gate remain due.

Two additional Imports→Memory projection journeys need no production change.
A real held extraction is paused by its owner, its successful checkpoint settles,
then host restart retains paused1/completed0; resume runs the still-pending
independent review and completes, while equal import-ID B remains complete and
cannot control A's job. 1/1/no skip/EXIT0,4.995s,
/tmp/mote-joint-import-memory-paused-restart.log/.exit. A separate real429
Retry-After60 capacity response leaves the saved Import completed but Memory
pending1/completed0/failed0 and no spent execution attempt. Host restart/tick
preserves that future wait without another model request; B cannot retry A;
explicit owner job retry performs the missing work and completes.1/1/no skip/
EXIT0,5.570s,/tmp/mote-joint-import-memory-capacity-restart.log/.exit. Only model
transport responses are generated; actual M01/M03/M04/M05/M06/M08 receipts and
host restart order are exercised. Missing-model intake failure remains the
previous distinct actual stale receipt, not a fabricated waitingForModel pass.
Unavailable snapshot recovery and additional Files/image-profile parity stay OPEN.

A genuinely unavailable retained M04 snapshot now has its distinct composed
case: after real429 capacity waiting, corrupt only the generated exact encrypted
snapshot tag, restart, and owner retry. The actual M05 task blocks with
model_snapshot_unavailable; GET Import remains saved/completed but reports
Memory waitingForModel1/completed0/failed0, with zero additional A model calls
and B still complete. Restore only the exact retained encrypted tag, restart,
and owner retry completes through the original snapshot.1/1/no skip/EXIT0,
5.304s,/tmp/mote-joint-import-memory-snapshot-recovery.log/.exit. Ciphertext and
keys stay in the generated temporary fixture/in-process memory, never in Git or
logs. This is a snapshot fault/recovery assertion, not permission to substitute
a fresh model for a withdrawn snapshot or a real-model semantic validation.

M13 bounded read-only reviews of exact1a3bf5d9 and exactce3572ce report no new
confirmed P0/P1/P2 in /tmp/mote-m13-review-joint-unknown-{1a3b,ce357}.md. The
reviewer did not execute the tests or compose the candidate. Existing generic
private-preview/confirmation plus equal-ID WAV Imports→real M03/M04/M05/M06
adjacent cases pass2/2 in
/tmp/mote-joint-unknown-import-entry-adjacent.log/.exit on the new runtime. This
supports the narrow candidate; fresh source types and final gates remain due.

The atomic cross-operation guard rejects before transport begins. Its existing
ExecutionFailure fact now explicitly records executionStarted:false, so the
queued rejected task retains zero spent attempts as well as no second issuance
or activity. The same three cases pass3/3/no skip/EXIT0 in
/tmp/mote-joint-file-unknown-no-issuance-budget.log/.exit. This flag is a host
pre-I/O fact, never inferred from a provider message or used to settle the older
unknown call. ce3572 review covers the preceding query; this final one-fact delta
is separately identifiable for the reviewer and current types remain pending.

Explicit narrow release: c45fdb4a2518fef0d5072b02aafbe8f46cb5a90b Server source
noEmit ACTUAL EXIT0, /tmp/mote-joint-unknown-current-types.log,
/tmp/mote-joint-unknown-current-types.exit and .sha. It was a few-second idle-gap
claim after Container final3 explicit release, with immediate Joint RELEASE.
M13's final c45 pre-transport fact review also has no new confirmed P0/P1/P2,
/tmp/mote-m13-review-joint-unknown-c45f.md. Together with the exact narrow actual
receipts, this permits clients to compose this thin checkpoint. It is not a new
module-final/full affected result and does not close remaining original outcomes.

Frozen container composition is now local merge
1a42f2e9fd015e29bbf26a6e43209cc8c0440990 of declared source723cc0b7. Verified
ab706→723cc changes only one validation document; all runtime inputs match the
owner's final3 EXIT0. Its Server2641/Desktop492/Web505/Android352 (fresh74XML,
zero fail/error/skip, actual unit execution/compiled inputs reused) remain owner
evidence. Container has ended and must not be awakened. Parent restored Theme
only for independent PR143 review; no theme source is merged here.

Automatic composition retains both archived-file original completeness and
strict Hindsight canonical provider/body verification, with Joint's extended
schema catalog intact. Own narrow protocol run passes15/15/no skip/EXIT0 in
/tmp/mote-joint-container-merged-protocol.log and .exit. SQL/FS/YAML staging and
native host reopening are real; Docker transport remains substituted there.
Own actual stopped-Import private-preview/equal-ID recovery plus partial
first-record dedup/fresh-owner-preview recovery pass2/2/no skip/EXIT0 in
/tmp/mote-joint-container-import-composed-restore2.log and .exit. Only model
transport is generated. The first similarly named command matched no test
names and produced a file-level success; it is explicitly not case evidence.
Combined actual Docker/Managed Hindsight production and final client/affected
proof remain pending. Content audit:
/tmp/mote-joint-container-composition-content-audit.md.

Files cancellation candidate after host recovery: baseline original endpoint
returns503 scope_unavailable (actual RED,
/tmp/mote-joint-file-cancel-entry-red.log and .exit). The pre-disconnect same-case
GREEN session57818 had an unknown outcome until recovery. On restored Bogon,
its saved log/exit proves1/1/EXIT0; scoped process inventory confirms no old test
is still running. Transport disconnect/ps sandbox denial are environment facts,
not code failures. The five original uncommitted files were preserved.

The extended actual cancel case now includes held A ASR, unaffected other A file,
equal-ID B, missing B original404, valid late completion/no A publication,
retained original, sticky cancel across ordinary restart, private portable export/
merge, corrupt original-control link rejection, and stopped-instance restoration
with old token401/no resumed cancelled work.1/1/no skip/EXIT0 in
/tmp/mote-joint-file-cancel-lifecycle.log and .exit. Latest missing-owner check plus
unknown503 cancellation pass2/2/no skip/EXIT0 in
/tmp/mote-joint-file-cancel-unknown-isolation.log and .exit: wait remains unknown,
old external fact remains unresolved and B is still indexed. A separate real
language-agent cancellation retains the completed raw Material, rejects the held
late summary and allows exact owner text correction;1/1/EXIT0,
/tmp/mote-joint-file-cancel-owner-edit.log and .exit. All transports/content are
generated; M01/M03/M04/M05/M06/M16 and restart/backup/portable entries are real.
Types, independent bounded review and current affected/compiled/client gates are
pending for this candidate. c45 remains the previously declared thin consumer
freeze until a new one is explicitly released; file retry is not implemented here.
