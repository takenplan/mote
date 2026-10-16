# M08 multiuser Ask validation

Status: implementation/review in progress. No final M08 acceptance or PR yet.
Production is the scoped app; no legacy Store or fake Memory service is mounted.
All fixtures are generated and isolated. Models/worker/network I/O use loopback
scripted substitutes with actual Harness, transport, M04 leases, M05 executor,
M03 originals, M06 processing and real M07 provider/Memory read paths.

## Scenario-to-test map

| Journey and transition | Durable test |
| --- | --- |
| A/B equal chat, turn, source, original, run and operation IDs; actual model request disclosure; traces | multiuser-ask: actual Harness isolates equal chat/turn/source/run IDs |
| Foreign direct IDs, signed run/conversation/turn cursors, forged HTTP owner, invented/undisclosed citation | multiuser-ask: direct foreign IDs…; conversation and turn cursors… |
| Actual malicious model input.userId/scope.userId/scope.sourceIds; no child admitted | multiuser-ask: actual model delegation parameters… |
| Full transitive Material source allowlist before SQL candidates/order/LIMIT; immutable scope copy | multiuser-ask: host reader filters full Material dependency sources… |
| Actual Memory extraction/review → Ask and Insight opening; lead alone cannot cite; fresh proof required | multiuser-ask: real M07 Memory openings… |
| Real external Memory await plus earlier original deletion/recreation, including same body/UUID with new app identity | multiuser-ask-read-races: first observed original…; identical original text… |
| Earlier Memory/Material/source declaration change during later provider read; first pin remains immutable | multiuser-ask-read-races; M11 unchanged independent SDK probes |
| Partial Material ready-only catalog/segments/read/query/history/file/context projection; pending text cannot select candidates | multiuser-ask: real query-visible history…; M11 nine-outlet partial SDK probe |
| Real MCP/M03/M06 processed:<captureId> logical history and file catalog URI directories; raw replacements withheld | multiuser-ask: logical history follows actual M03 upload…; file directories…; M11 actual pipeline SDK |
| UTF-16 safe windows, spans and correct continuation; typed session/collection navigation with current anchor | multiuser-ask: material and original windows…; raw note navigation… |
| Minimum 1000-char context, includeMemories=false means no provider I/O, two channels/durable cursor and multi-block card expansion | multiuser-ask/context cards…; read-races/minimum context…; M11 original SDK budget probe |
| Native timeline/items limit inside multi-block Material, later-block lexical hit, distinct entity/original cursors and revision/user/scope invalidation | multiuser-ask: native original pagination…; M11 original limit1 assertion retained |
| Existing read_file_evidence capability uses retained canonical original and requested source range, no invented excerpt citation | multiuser-ask: real Harness read_file_evidence… |
| Measured activity/media intervals; raw screenshot/Coding UUID does not authorize source or image | multiuser-ask: real measured Activity… |
| Existing InsightSnapshot metadata, version chain, observed interval union, boundary clipping, A/B source-state separation and actual host prompt | multiuser-ask: scoped Insight preserves the existing measured snapshot… |
| Genuine M03 explicit image uploads → Harness pixels; same-ID A/B, conversation continuation and deletion | multiuser-ask: explicit M03 image uploads… |
| Real model/settings/price admission snapshot survives current configuration edits; provider errors/credentials absent from user trace | multiuser-ask: model settings change…; model transport failures… |
| Cancel, pause, logout, source/Material/conversation delete, account disable while model/SSE held; B control operates | multiuser-ask: held actual Harness… five actions; foreground progress…; actual HTTP disconnect… |
| Duplicate admission/changed operation hash, concurrent same-owner conversation CAS | multiuser-ask: concurrent duplicate submission…; concurrent same-owner… |
| Ordered deduplicated actual worker units, fresh child receipts, prior-fragment/handle citation rejected | multiuser-ask: real ordered Agent subtasks…; parent cannot cite… |
| Failed worker retries only its branch; any/all waits and cancel held sibling; late artifact withheld | multiuser-ask: failed real child retries…; any-child wait… |
| Worker owner/source inheritance, narrower actual time/device selection, no parent dialogue or query workspace | multiuser-ask: real delegated workers… |
| Narrow Insight research child omits the parent report's full-range coverage metadata while parent retains its snapshot | multiuser-ask: Insight research children… |
| Explicit and online compaction retain owner, complete prior summary and every huge-turn span; budget and source validity | multiuser-ask: real compaction…; automatic working-memory compaction… |
| Successful compaction span pause/restart/config change has no replay; current settings cannot enlarge admitted snapshot | multiuser-ask: successful compaction spans… |
| Source/compiled two HTTP processes, SIGKILL, successful child not replayed, fixed model/price and own artifact/turn | multiuser-ask-process |
| Portable export/restore exact parents, no active task/model authority or cross-user adoption; deleted parents reject | multiuser-ask: owned Ask portable data… |
| Empty owner or zero-source host grant still supports actual dialogue without acquiring archive access | multiuser-ask: a configured empty account… |
| Genuine Gmail ledger status → Ask + MCP tool/resource, no adapter/network metadata read | multiuser-connectors/actual source status; M11 persistent SDK status case |

M11 original host and actual HTTP+SDK probes independently closed the pin-overwrite
P1 (c66), ready projection/UTF-16 and minimum budget/raw binding/original-incarnation
P2s (060/492), and conversation-deleted artifact P1 plus explicit artifact source
filter P2 (9cbc). Reports: /tmp/mote-m11-review-m08.md. These approvals are bounded
subsets and do not substitute final whole-module review.

## Pending gates and practical limits

Real M07 through443c201a is composed, including its ordinary owner audit/import
closure. Query-visible Memory stays published-only; audit/stale/proposed bodies
do not become model evidence. Final M07 acceptance and subsequent integration
fixes remain dependency gates. No SQL body substitute or fake service claims parity. Final focused, all-scope/multiuser actual
composition, fresh libraries/server build, emitted two-process HTTP and required
npm run check:affected -- --base origin/codex/mote-multiuser-integration must run
on the final code. Remote feature head/base and Draft PR must then be verified.
CI workflows are disabled and unrun, not passed. No deployment, real credentials,
user data, live external model/provider or physical device check is authorized.
Synthetic scripted responses establish execution/disclosure contracts, not live
semantic recall or model quality. M13+ retain client account/UI integration gates;
M16 retains complete instance backup/restore orchestration.

## Periodic migration closure candidate (not final acceptance)

The implementation retains the existing working OR-threshold/maximum-wait and
Insight AND-interval/threshold rules. Owner grant admission replaces the old
single global owner, using the same Harness, summary planner, M04/M05 and report
renderer. No second scheduler or new semantic procedure is introduced.

| Journey/state transition | Durable test |
| --- | --- |
| Explicit working policy, keep recent2, complete old prefix, restart no replay | multiuser-ask: explicit owner policy drives… |
| Pause held summary, real host restart, same grant resume, finite failure and owner retry, stopped definition requires fresh admission | multiuser-ask: periodic working pause… |
| Actual one-minute interval AND increment gate; A/B same policy ID; success static report; stop held output; arrivals excluded; admitted model retained; restart no replay | multiuser-ask: automatic Insight waits… |
| Generic task JSON and an actual domain TaskRun cannot mint owner policy authority; duplicate admission is idempotent | multiuser-ask: a durable domain task… |
| Definition-only export, A/B equal IDs, authorized delete, idempotent restore without tasks, explicit re-admission | multiuser-memory: Ask owner policy canonical lifecycle… |
| Frozen Memory catalogs before builtin/provider candidates/keys/LIMIT; caller mutation, zero manifest, exact/history, normal/ranked cursor separation | multiuser-memory: Memory query filters… and exact historical Memory… |

Frozen Memory increment22ab04fb2eda42c3ba2b1ef498bcea323c46a142 literal archive:
4/4,0skip/fail/cancel,EXIT0,16586ms; server typecheck0. Periodic narrow source
working/isolation/authority5/5 EXIT0,20424ms; actual one-minute A/B Insight1/1
EXIT0,69117ms; policy canonical lifecycle1/1 EXIT0,1037ms. These receipts precede
final peer review and the final combined/build/emitted/affected gates.

## Diagnostic classification

- New implementation defects: first-pin overwrite; artifact lifecycle/source
  fence omissions; ready-block and Unicode projection; file-limit/revision and
  native block continuation; minimum context budget; raw source binding and
  exact original incarnation. Peer probes distinguish same-owner disclosure or
  availability/correctness impact from cross-user/source isolation impact.
- Migration omissions: real Memory/query/readers, complete working spans and
  periodic working/Insight admission, plus the existing InsightSnapshot coverage
  and version metadata. Recovery restores production seams rather
  than replacing them with blocked routes or neighborhood mock services.
- Obsolete test assumptions: extra genuine memory.materials tasks/Materials;
  paging raw rows before the producer replaces them; full prompt length includes
  system instructions; omitted summary is undefined; the final fresh raw-UUID
  positive was replaced by a genuine canonical Material positive after the
  producer completed, retaining the delete/recreation receipt rejection. Positive assertions retain
  actual producer completion and exact limits/owner/receipt checks.
- Environment/fixture failures: native ABI24 mismatch versus Node26; SQLite
  observer omitted busy timeout; a mocked global Date advanced authorization and
  execution clocks inconsistently. The interval test now uses real elapsed time.
- Periodic WIP diagnostics: post-publication wake used an already invalid task
  context; nested M05 grant transaction was rejected; constrained reports were
  omitted from full-owner lists; a cursor manifest was appended after decode.
  These were this implementation's defects and were fixed before the cited
  passing cases. No evidence establishes them as bugs in the old single-owner flow.

Delete/revoke/restart and scope-isolation impacts are tracked separately. No
unsupported old-flow bug claim or blanket description of all P2s as data leaks is
made. Old failing logs remain available in /tmp and are not counted as passes.

The InsightSnapshot omission has a separate failing regression commit
`c3e8932a8d71f4fd1167a6f7e27690a88d42ce7d`. Against literal runtime6855,
the valid regression failed 0/1 EXIT1 because the completed report omitted the
snapshot (`/tmp/m08-insight-coverage-before-valid.log/.exit`). The fix reuses
the old shared snapshot shape and observed interval algorithm. Its strengthened
regression checks clipping across the upper boundary and stable fingerprints
only after the genuine Material producer finishes. The actual Memory→Insight
case plus this regression passed 2/2 EXIT0,23637ms, server typecheck0
(`/tmp/m08-insight-coverage-green.log/.exit`, `-green-types.log/.exit`).
The complete legacy snapshot tests also passed 2/2 EXIT0. These narrow receipts
do not replace final frozen-candidate validation or independent review.

Exact b84240f554fe2c549eb9142cc00089eea1a84e88 passed the five-case frozen
Memory→Insight/empty-owner/periodic working/real-minute Insight/snapshot matrix,
5/5 EXIT0,97641ms (`/tmp/m08-b842-frozen-narrow.log/.exit`), and the legacy
snapshot tests 2/2 EXIT0. The old source-state metadata also includes paused
sources; this separate omission was preserved in RED commit
`b2cc49a6b7baec480c45ee6b45ff980cedd9b392`, 0/1 EXIT1 against b842
(`/tmp/m08-b842-paused-source-before.log/.exit`). The follow-up reads only
owned, source/device-filtered metadata before LIMIT, while original retrieval
still rejects disabled sources. Its expanded regression checks A/B paused-source
metadata and completed snapshot export/delete/idempotent restore/restart without
model calls, followed by version3 linked to the restored version2: 1/1 EXIT0,
11099ms (`/tmp/m08-insight-paused-restore-green.log/.exit`), typecheck0.

The new snapshot increment initially copied parent report metadata to narrowed
research children. This implementation defect is preserved by RED commit
`b915496b1403c3e9bcd21cc31c4a44e1d2eabaee`, 0/1 EXIT1,9473ms
(`/tmp/m08-insight-worker-snapshot-before.log/.exit`). The host now supplies
report metadata only to the parent review. Ordinary delegation, narrowed workers
and Insight delegation passed 3/3 EXIT0,34030ms
(`/tmp/m08-insight-worker-snapshot-fixed.log/.exit`). The confirmed impact is
same-owner task scope, not evidence of a cross-user disclosure or an old-flow bug.
