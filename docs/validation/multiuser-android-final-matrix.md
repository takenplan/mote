# M15 finite final acceptance matrix

This is a current checklist, not a passing gate. Historical RED/fixture errors,
exact SHAs and logs remain in [the chronological ledger](multiuser-android.md).
Workspace is task-19/mote, feature codex/mote-multiuser-m15-android. No M15 Draft
PR or final required check has yet been delivered. Parent22:08 reserves the
current full gate for QR and will allocate M15's next window explicitly; stale
resource files do not authorize another build.

| Original capability | Current evidence / contract | Remaining final action |
| --- | --- | --- |
| Screenshots, notification/device events, local audio, privacy and local OCR | Existing collectors, filters, capture pipeline, queue and shared service remain. Generated capture drain and B explicit capture have actual native evidence in the ledger. | Repeat the representative capture/permission-refusal/old callback case on the final combination. Real phone/vendor background and actual special-permission grant/revoke are separately unperformed; do not expand permissions. |
| Offline queue, WorkManager, file/calendar sources, originals and recovery | Actual A offline→B→late ACK/network recovery, source spool/head/context/snapshot recovery, token rotation, replacement deployment, process SIGKILL/restart evidence exists at exact earlier SHAs. | Fresh final core Worker/source/snapshot/restart representative run; current357 full JVM is recorded separately below; it does not substitute for final composed native recovery. |
| Drafts, local archive and native raw reader | Account-local drafts/caches/cursors, synchronous A presentation retirement, canonical central OCR/own device updates; real native RED→GREEN in the ledger. | Retain final A/B and same-owner recovery assertions; no raw-history fallback for M08 query evidence. |
| Native Ask/Insight, Memory, plugins, MCP, owned configuration and Activity | Original native controls consume M04/M05/M07/M08/M09/M11/M12 and the declared readers. Independent bounded reviews and generated native journeys exist. | Final composed representatives and new bounded delta review; exact existing local Codex gpt-6.1-sol check remains generated-prompt-only evidence, not model-quality acceptance. |
| Native Google/Gmail/Lark/recording connectors | Owned M10 instances, encrypted same-operation intents, source mappings, OAuth/status/cancel/retry/disconnect and real authenticated original WAV playback narrowly pass. | Obtain explicitly frozen M13 large UTF-8 result/fixed task-identity delta, then exercise the original large preview/status task result. Ordinary CLI installation has no scoped operation; retain it as an explicit capability/policy gap, never a shell fallback. |
| Generic Imports and upload staging | Joint c45; multipart/private preview/explicit confirmation/actual lost admission ACK passes13.234s. CentralImports exact original/archive/admission checks pass3 JVM tests. | Final same-body recovery regression plus required related server tests. Explicit confirmation must still be the publication boundary; saved M03 bytes alone are insufficient. |
| Files raw/current text, original playback, correction, confirmed names and export | Joint a10 is already consumed. Actual native generated WAV/chunks/correction/names/exact text and authenticated original playback pass. | Retain exact source/artifact/chunk/text and original hash assertions in final representative. |
| Original Files cancel/stage-retry/delete | Joint owns the shared producer. Candidate36ff was read only; it is not a frozen Android dependency. Native original retry body lacks the candidate's required stable operationId. | Consume only an explicit freeze. TDD the original stop/retry/delete controls, retained operation/body on lost ACK, unknown/physical occupancy, diarize-only preserving raw ASR, raw/processed export identity and A/B. Do not create another backend. |
| Model preset copy with credentials, connection probe and provider model directory | These three controls are present in baseline98d CentralAdmin.models. Current ownedConfiguration(models) keeps CAS/secret preservation but explicitly displays that copy/probe/directory await multiuser APIs. An Ask selection test is not equivalent. | Obtain the shared M04-compatible owned/reference contract; retain private credential ownership, opaque shared resource rules, fixed original Api/revision and existing endpoint/network safeguards. TDD actual original controls; do not infer masked secrets or recreate old global model routes. |
| QR/JSON/scan pairing and original device reauthorization | Producer6a84. Native e8b9/806 parses v2, journals PKCE before claim, checks exact self, preserves finite credential expiry and same-grant ACK recovery. Real original pairing2.041s and issuer QR0.935s pass; parser5/5. | Confirmed post-restart ACK410 P2: real ACK200→restart→self200→ACK410 leaves pending,2.109s EXIT1. Minimal c0/d3 now passes the real restart samecase2.117s; revoked credential negative2.019s, corrected five-field/self/unsaved-draft reauthorization0.408s and held-picker samecase0.993s pass. Final bounded closure review and final combined core Worker recovery remain. |
| Agent catalog and declared canonical reading | Actual M08 Material-read succeeds; native10442 fixes the wrong old evidence path. Same original catalog/episodes/expand/A/B case passes0.928s. | `/api/agent-view/startup` and `/events?afterSeq=0` are still503 for member and admin in the current genuine host. Preserve the old new-conversation preview/no-model-call semantics and only actually recorded historical traces; await shared owner freeze, no bundle or reconstructed-prompt substitute. |
| Diagnostics/support/update and instance controls | M16 metadata-only diagnostic/support/update readers are admin-only; a real probe returns member403/admin200 for diagnostics. M04 design allows resource admin HTTP only for models; other instance settings retain operator startup/restart contracts. | Native concurrency/diagnostics entries now explain the actual operator contract without those503 requests; actual original native samecase0.851s passes, with the user processing editor and admin diagnostic positive retained. Do not invent new singleton writes. |
| Portable personal export/import and lifecycle | M16 exact receipt/hash/owner/epoch and same-original-account merge contracts are consumed; native picker/download/receipt/cancel/retirement and original staged-output protections have actual evidence. | Final positive and bad receipt/header/hash/retired owner sentinel representative; no mobile whole-instance backup, cross-account import or restored authorization. |

## Baseline scope clarification

Read-only comparison uses exact98d76945 CentralLibrary.file and CentralAdmin.models.
The original Android file page has original playback/save/export, correction,
continuation, cancel, transcribe/diarize/summary retry and delete. It does not have
Web's separate acoustic sample widget or proposed terminology/session review
controls. Those shared producer abilities remain important to the common contract
and export completeness, but are not silently counted as missing old Android UI
or automatically expanded into new M15 widgets. Likewise, old native Memory has no
Web audit filter form, so a Web-only audit-filter gap is not an Android regression.
The original native model copy/probe/directory buttons do exist and remain in scope.

## Actual current route audit

A fresh generated M01/M04/M06 production app was probed with app.inject only;
no listener, external model or real account was used. The probe exited0 in0.802s.
Safe status metadata is `/tmp/m15-final-capability-route-audit.json`.

| Route | Member | Administrator | Interpretation |
| --- | --- | --- | --- |
| `GET /api/execution-settings` | 503 scope_unavailable | 503 scope_unavailable | Retired global write/read facade; M04 operator policy applies. |
| `GET /api/diagnostics-settings` | 503 scope_unavailable | 503 scope_unavailable | Same; do not equate M16 read-only diagnostics with settings writes. |
| `GET /api/agent-view/events?afterSeq=0` | 503 scope_unavailable | 503 scope_unavailable | A genuine missing original read entry, not an empty trace history. |
| `POST /api/agent-view/startup` | 503 scope_unavailable | 503 scope_unavailable | A genuine missing original preview entry; no provider call occurred. |
| `GET /api/diagnostics` | 403 invalid_identity | 200 | Existing M16 administrator boundary is real. |

## Required final gates and evidence discipline

1. Parent-allocated narrow test APK RED/GREEN for the new QR recovery/held-picker
   cases, preserving `/tmp/m15-pre-expired-qr-app.apk` as the actual old binary.
2. Full current Kotlin/JVM plus debug and isolated fixture APKs, with fresh XML
   totals. Repeat relevant actual Worker/queue/source/SIGKILL/native journeys on
   the final public contract combination.
3. Close the original capability rows above through frozen shared producers and
   thin native consumers; record independent review scope without calling static
   review an executed test.
4. Run `npm run check:affected -- --base origin/codex/mote-multiuser-integration`
   and the relevant builds. Preserve failed/interrupted/unrun stages distinctly;
   no broad skip, arbitrary fixture weakening or changed runtime deadline.
5. Audit authored/staged content for real private data, push only the own feature,
   create/attach a Draft PR to codex/mote-multiuser-integration, and independently
   verify remote head/base/isDraft. No merge/deploy/CI activation or operator data
   mutation is authorized by these gates.

## Fresh allocated Android phase — actual pass, not final M15 acceptance

Parent22:33 allocated the next M15 phase after QR's fresh22:34:59 RELEASE. The
known QR gate PGID8858 was independently read-only verified empty before M15
CLAIM. M15 released immediately after this phase; no long affected began.

Fixed0c59dcd99bb73281ad34c0f5292d5a68d081c609 (runtime
 a73ae69f2d7a511692429c11313c07dcbdee6588) executes the complete offline Gradle
command `:app:testDebugUnitTest :app:assembleDebug :app:assembleMultiuserFixture
:app:assembleMultiuserFixtureAndroidTest`, EXIT0,35s110tasks10executed,
`/tmp/m15-qr-final-full-android2.log/.exit/.sha`. Fresh XML75suites357tests,
0failures/errors/skips is saved in the associated `-counts.json`.

First full command at a73 was EXIT1,40s357total1failure: the old native Imports
characterization fixture still supplied empty part ACK, ID-only original and a
random job ID different from its admitted request. Raw first failure/XML remains.
Test-only0c59 migrates those responses to the actual protocol while preserving
same-body/request/archive IDs, original lost admission and one-part assertion.
No production validation was relaxed, no test skipped.

Actual same-original-native QR restart case: RED2.109s1→GREEN2.117s0, with
ACK410/fresh exact credential verification, `pairingAcknowledged:false`, A queue
upload and B404. Real post-restart DELETE of that device credential remains
pending/no-upload instead (single2.019s0). Normal no-restart lost replies still
require real duplicate ACK and report acknowledgement (single2.166s0).
The corrected anonymous/plain draft→explicit same-device reauthorization test
passes0.408s, including five corrupted self fields, current finite expiry,
same owner/directory/queue, preserved unsaved A draft and old token401. Original
held JSON picker A→B is validRED0.874s1→sameGREEN0.993s0; only a post-read settings
and publication owner check was added. New explicit B selection remains valid.
Original M04 instance-setting entry is RED0.530s1→sameGREEN0.851s0 with no retired
API request, account processing editor present and admin diagnostics200. Original
issuer QR remains1.376s0. All tests use generated data and no system permission.
Per-case exact `/tmp/m15-native-qr-*` and `m15-native-instance-policy-*` logs and
cleanup exits are retained; no static review is counted as these executions.
