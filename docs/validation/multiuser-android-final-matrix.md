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
| Offline queue, WorkManager, file/calendar sources, originals and recovery | Actual A offline→B→late ACK/network recovery, source spool/head/context/snapshot recovery, token rotation, replacement deployment, process SIGKILL/restart evidence exists at exact earlier SHAs. | Fresh final core Worker/source/snapshot/restart representative run; old353 full JVM does not cover later runtime changes. |
| Drafts, local archive and native raw reader | Account-local drafts/caches/cursors, synchronous A presentation retirement, canonical central OCR/own device updates; real native RED→GREEN in the ledger. | Retain final A/B and same-owner recovery assertions; no raw-history fallback for M08 query evidence. |
| Native Ask/Insight, Memory, plugins, MCP, owned models/configuration and Activity | Original native controls consume M04/M05/M07/M08/M09/M11/M12 and the declared readers. Independent bounded reviews and generated native journeys exist. | Final composed representatives and new bounded delta review; exact existing local Codex gpt-6.1-sol check remains generated-prompt-only evidence, not model-quality acceptance. |
| Native Google/Gmail/Lark/recording connectors | Owned M10 instances, encrypted same-operation intents, source mappings, OAuth/status/cancel/retry/disconnect and real authenticated original WAV playback narrowly pass. | Obtain explicitly frozen M13 large UTF-8 result/fixed task-identity delta, then exercise the original large preview/status task result. Ordinary CLI installation has no scoped operation; retain it as an explicit capability/policy gap, never a shell fallback. |
| Generic Imports and upload staging | Joint c45; multipart/private preview/explicit confirmation/actual lost admission ACK passes13.234s. CentralImports exact original/archive/admission checks pass3 JVM tests. | Final same-body recovery regression plus required related server tests. Explicit confirmation must still be the publication boundary; saved M03 bytes alone are insufficient. |
| Files raw/current text, original playback, correction, confirmed names and export | Joint a10 is already consumed. Actual native generated WAV/chunks/correction/names/exact text and authenticated original playback pass. | Retain exact source/artifact/chunk/text and original hash assertions in final representative. |
| Files cancel/retry, per-file acoustic controls/sample playback, proposed review/confirmation | Joint owns the shared producer. Candidate36ff was read only; it is not a frozen Android dependency. Native original retry body lacks the candidate's required stable operationId. | Consume only an explicit freeze. TDD original controls, retained operation/body on lost ACK, cancel unknown/physical occupancy, diarize-only preserving raw ASR, sample/export identity, explicit proposed-text confirmation, A/B and artifact replacement. Do not create another backend. |
| QR/JSON/scan pairing and original device reauthorization | Producer6a84. Native e8b9/806 parses v2, journals PKCE before claim, checks exact self, preserves finite credential expiry and same-grant ACK recovery. Real original pairing2.041s and issuer QR0.935s pass; parser5/5. | Confirmed post-restart ACK410 P2: real ACK200→restart→self200→ACK410 leaves pending,2.109s EXIT1. Minimal c0/d3 is uncompiled. Run same GREEN, real revocation negative, corrected anonymous/unsaved-draft reauthorization test, and held JSON picker-owner candidate. |
| Agent catalog and declared canonical reading | Actual M08 Material-read succeeds; native10442 fixes the wrong old evidence path. Same original catalog/episodes/expand/A/B case passes0.928s. | `/api/agent-view/startup` and `/events?afterSeq=0` are still503 for member and admin in the current genuine host. Preserve the old new-conversation preview/no-model-call semantics and only actually recorded historical traces; await shared owner freeze, no bundle or reconstructed-prompt substitute. |
| Diagnostics/support/update and instance controls | M16 metadata-only diagnostic/support/update readers are admin-only; a real probe returns member403/admin200 for diagnostics. M04 design allows resource admin HTTP only for models; other instance settings retain operator startup/restart contracts. | Native concurrency/diagnostics-setting buttons still call retired global APIs503. Replace the misleading request with a truthful existing-policy explanation/disabled control and test no such HTTP write, while current user model/processing settings still save. Do not invent new singleton writes. |
| Portable personal export/import and lifecycle | M16 exact receipt/hash/owner/epoch and same-original-account merge contracts are consumed; native picker/download/receipt/cancel/retirement and original staged-output protections have actual evidence. | Final positive and bad receipt/header/hash/retired owner sentinel representative; no mobile whole-instance backup, cross-account import or restored authorization. |

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
