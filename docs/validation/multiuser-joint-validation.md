# Final multi-user joint acceptance: fixed scope and preparation ledger

Status: **PREPARATION; NOT final acceptance**, updated 2026-10-16 17:22 UTC. All final-gate
rows below are pending unless an actual execution receipt explicitly says otherwise.
The 14 delivered modules and architecture review are dependencies, not proof that
all 17 modules work together. M13/M14/M15 remain checkpoints with known capability
gaps. No whole-project completion, final candidate or final PR is claimed.

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
deployment, CI enablement, real data migration/deletion, real model/calendar/mail
operation or system permission change is authorized by these tests.

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

All entries are **CHECKPOINT**, not final candidates. Finalization requires each
owner's explicit final tested SHA, final affected/native/UI receipts, bounded
review and exact remote Draft PR head. Later WIP is never imported as a freeze.

| Owner | Explicitly reported composable checkpoint | Remaining gate / original capability |
| --- | --- | --- |
| M13 Web | `c21184829f03669229770de3d62bddfb63e29d33`; tested code/test `aed42550`, later docs only | FullWeb515/515 and fresh Central passed in owner environment. No push/PR/final affected. Still open: Calendar/Lark/recordings UI; generic Imports preview/ambiguity/confirm/resume; Files/audio/review/speaker/export; raw pending/failed controls; Memory raw/range/integration/full settings/audit; Agent startup trace/advanced models; storage/encryption/index/runtime config; native Actions bridge. |
| M14 Desktop | New runtime `c56e4399da9b1fc3b1e20185affbc950f9664379`, narrow checkpoint `eb9d3d1bcfe6f66aa25993cd7d73d85fa8d2819b`; final-required candidate `45467379c5645dec62cc4b03e891b404b675193b` | Owner reports real main/preload/renderer native-calendar→M12 fixed review→M05 receipt plus Ask/offline A/B/SIGKILL/restart GREEN, bounded M13 review no new confirmed finding. At latest report required still running: all types0, Desktop501/501, server2626 pass/0 fail/1 existing default OS opt-in skip. Root/Web/Android final exit and PR139 update pending; do not infer whole-gate exit. The previously observed remote PR139 checkpoint was7e080. No Files write WIP is in454. |
| M15 Android | New tested runtime `220c175ea9900c39477df0cf2da4aaecba9ca26a` includes107/9e/881 | Owner reports four actual native RED→same GREEN and synthetic Calendar journal positive; Android352/352/no fail/error/skip plus production assembleDebug EXIT0. Full affected/final review/push/PR pending. M13 bounded review found recent-five-work preview dropped at220c: actual RED then df917 fix, GREEN pending the heavy slot. MCP consumer also actual RED/WIP. Generic Imports/remaining Files lack frozen shared equivalents.220c is not whole-module final. |

Shared-page ownership remains in the owners' existing ledger
`/tmp/mote-m13-shared-page-contract-map.md`,
[Web design](../design/multiuser-web.md),
[Memory parity](../design/multiuser-memory-parity.md),
[Desktop](multiuser-desktop.md) and [Android](multiuser-android.md).
Missing original capabilities are blockers; a new route or generic Material list
does not substitute for their intended user outcomes. Route changes allowed by
the MVP do not authorize capability removal.

Later bounded client deltas are not yet imported into this workspace: M13
CSS10f11, Google0384 and original-byte reader17fd; M14c56; M15 220c and its newer
preview/MCP work. The exact17fd original-byte delta was independently source
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

## Finite final acceptance matrix

The following 13 rows are the final scope. Reuse the named tests/fixtures and add
only a missing concrete regression when evidence requires it. Paths below are
relative to the repository; most server suites are in `apps/server/test/`.
Every row is **FINAL PENDING**. Owning-module history is supporting evidence only.

| ID / real entry | Required finite journey and observations | Reused evidence / blocking condition |
| --- | --- | --- |
| J01 Accounts/private HTTP/MCP | A/B equal business IDs and bytes; valid login→read/write; exchange ID/cursor/download/token; admin cannot browse B; logout leaves previously admitted work; disable/reset rejects late publication. Verify counts and errors do not disclose B. | `multiuser-auth*.test.ts`, `private-data.test.ts`, `multiuser-ingress*.test.ts`, `multiuser-mcp*.test.ts`; real production route registration, no default owner. |
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
| J13 Docker retained recovery | Disposable epoch5 Docker profile publication and stopped target recovery through production CLI; actual owned Hindsight Docker volume snapshot/restore and canonical/history re-open, without old execution authority. No deployment or existing-volume access. | **OPEN implementation + environment**: `restoreProfile` explicitly rejects epoch5 non-native targets before staging. Existing Docker scripts still use old single-owner API assumptions. Docker daemon unavailable on fresh read-only query. Packaged-file projection/native Mem0 tests do not close either Docker requirement. |

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
   three active owners. No fifth execution thread and no awakening M12/M16.
   Build shared libraries/Central/Desktop/current APK as relevant; run J01–J13's
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
