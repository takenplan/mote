# M11 protocol/source phase validation

This record covers the protocol/source phase, not complete M11 acceptance.
The initial baseline is PR133 `470516b7ed4ab7ee8b0fba344883c6b42bb7ce56`.
Accepted PR134 `7572b573b03437ff743652c13181b9fdcf251fda` is now composed on
this feature. Final accepted M07/M08 real query tools remain required.
No mock Memory, Ask, connector or processing service proves them.

## Paused for the shared architecture review

At the parent's request, M11 stops after its current narrow checks on a clean
feature commit. It is **not finally accepted and has no final Draft PR**. No new
full affected/Android checks or implementation expansion starts during this pause.
The exact runtime/HEAD and reusable-boundary inventory are recorded in
`/tmp/mote-m11-architecture-pause-handoff.md`.

The latest bounded change restores the old outbound MCP import status flow, a
confirmed migration omission rather than evidence of an old-flow defect or a
cross-user disclosure. Its actual SDK regression first fails because syncing
status is absent: `/tmp/m11-outbound-status-before.log/.exit`, EXIT1. The final
complete protocol/source file passes **26/26**, no failures/cancellations/skips,
EXIT0,14362.323ms:

```sh
node --import tsx --test --test-concurrency=1 --test-timeout=120000 apps/server/test/multiuser-mcp.test.ts
npm run typecheck -w @mote/server
node scripts/check-scope-contracts.mjs
```

Receipts: `/tmp/m11-outbound-status-final-protocol.log/.exit`,
`/tmp/m11-outbound-status-final-types.log/.exit`,
`/tmp/m11-outbound-status-final-scope.log/.exit`, all EXIT0. Real HTTP/SDK fixtures
cover identical A/B IDs, syncing/fixed error/success, retry, metadata rename,
configuration retirement, held restart, cancellation, domain deletion/restore and
Ask's actual source status reader. No neighboring service is replaced. This new
status delta still needs independent review and final whole-module gates.

Independent bounded M08 review of exact
`1fe83c78d62bc7a7f0c9ba92c162c226164bb2f1` passes working/restart/task-owner
barriers **3/3**, EXIT0,12677.666792ms and the original actual one-minute A/B
Insight/frozen snapshot/late-stop case **1/1**, EXIT0,70338.220083ms:
`/tmp/m11-review-m08-1fe-periodic.log/.exit`,
`/tmp/m11-review-m08-1fe-insight.log/.exit`. No confirmed actionable P0/P1/P2
was found in this bounded review; it does not certify the complete M08 module and
this newer freeze is not yet composed into M11.

M07 ca69 required affected failed separately:2315 server tests,2312 passed,
2 failed,1 optional skipped,EXIT1; Android was not reached. One zero-Material
assertion predates the restored real producer; the other is a fixed5s plugin
late-ACK observation pending independent diagnosis. More significantly, M07's
isolated settled-producer probe confirms a **new migration integration defect**:
generic M06 `source.original` publishes raw Coding tool-result text as searchable
Material. This violates the Coding projection/disclosure boundary; it is not
yet evidence of cross-user reading, and there is no old-version reproduction
proving that the original flow already had it. M07 is fixing the structural
projection while retaining real originals, producer and valid dialogue positives.
Its precise fix and an actual M11 SDK regression remain pending. The failure
receipts `/tmp/m07-ca69-affected.log/.exit` and
`/tmp/m07-ingress-ca69-probe-raw.log/.exit` remain failures, not passes.

## Current bounded composition receipts

Exact runtime composition `96f955a687279b110c17cca20251a00ae996f3b7` contains
M07 closure443c201a9159d77120d990a1b2d888cb2015d139 and M08
73244e11f4625f3c1e0674b1f8629d8295c05b76. Both precise freezes are composed,
not declared final accepted modules. Types0 and scope0:
`/tmp/m11-96f-types.log/.exit`, `/tmp/m11-732-composition-scope.log/.exit`.
Ingress merge retains M10 exact original formats, the same transactional
onAccepted/savepoint/onAdmitted seams and adds M07 fresh-only import binding.
App merge keeps MCP bindMemory/bindAsk and shutdown fences plus ownerQuestions.

Prior exactbd23220d0543233dd86ff60d6801c36820fc3f69 complete MCP matrix passes
**60/60**,0fail/cancel/skip,exit0,135184.817542ms:
`node --import tsx --test --test-concurrency=1 --test-timeout=120000 apps/server/test/multiuser-mcp*.test.ts`,
`/tmp/m11-bd23220d-focused.log/.exit`. Later runtime fixes below require fresh
whole-suite/combined/build/emitted/affected checks; this60 is not relabeled as
an exact96f full receipt.

Two later genuine projection corrections preserve original strict assertions:

- Current formal history was wrongly marked `current:false` because canonical
  block IDs differ from the raw logical head. Actual SDK0/1exit1 before, then
  legacy inventory/paging/current-history3/3exit0,7938.169333ms after7c85300e:
  `/tmp/m11-history-current-{before,fixed}.log/.exit`.
- Independent M08 review found `mote_file_chunks(limit=1)` returned3 actual
  canonical blocks. Original probe0/1exit1,2274.468708ms,
  `/tmp/m08-review-m11-file-limit.log/.exit`. M08 host732 honors its real limit
  and exact canonical revision; own adapter31e931ca advances by requested page
  size. The original peer probe is byte-identical (SHA256
  `bcd9247001c8bc100ea6db762c3eeda874164cb66d6855ae3d1d19db028dbddb`) in a literal96f
  archive and passes1/1exit0,1484.642334ms:
  `/tmp/m11-peer-original-file-limit-fixed.log/.exit`. Durable SDK source/native
  block/file-limit/owner/query/projection/restart cases3/3exit0,4249.456625ms:
  `/tmp/m11-732-file-limit-fixed.log/.exit`. M08 independently reran the same original probe on exact96f:1/1exit0,
  2286.53525ms, `/tmp/m08-review-m11-96f-limit.log/.exit`, closing its P2.
  This includes all blocks exactly
  once with limit1 and owner-only audit API refusal for MCP credentials.
  Additional exact retired-file-ID scenario passes1/1exit0,1217.643542ms,
  `/tmp/m11-732-retired-file-id.log/.exit`; its old canonical ID cannot return
  newly revised body text.

Own ingress composition at117eaa37a9d0c93d38f7eb5c15856fac413162e4 passes actual
M10 connector two-process, MCP credential isolation, exact fresh import through
M06+Memory, automatic M03/M06 pipeline and caught bad-child rollback **5/5**,
exit0,13357.687334ms, `/tmp/m11-443-production-seams.log/.exit`.

M07 closure443 owner audit/event subset independently passes5/5 plus three added
real provider-await capture DELETE/plugin-stop/MCP-private-authority barriers3/3,
all exit0; `/tmp/m11-review-m07-443-owner-audit.log/.exit`,
`/tmp/m11-review-m07-443-audit-races-final.log/.exit`. Initial2/3 failure was a
probe omitting the safe provider-revocation401 status; no body leaked, and only
that expected blocked-status set was corrected before the complete3 rerun.
M07 feedback1d actual two-process SIGKILL independently1/1exit0,36077.261291ms,
`/tmp/m11-review-m07-1d-feedback-process.log/.exit`. M08 exact80cf bounded
pagination/worker/full-longturn/span pause-restart independent4/4exit0,
`/tmp/m11-review-m08-80cf-{narrow,working}.log/.exit`.

The actual SDK `mote://memories` resource now has its own held-provider
credential-revocation regression, in addition to the read-tool matrix. A revoked
A resource read returns a fixed error without body or credentials while the same
URI on B returns identical private bytes. With the existing actual provider
failure/no-SQL-fallback scenario, **2/2**,exit0,10938.556917ms:
`/tmp/m11-resource-real-provider-revoke.log/.exit`. This is a real resource
callback over M07/M09; no neighboring service substitute is used.

Two additional real outbound instance-lifecycle cases retain the existing
restart-required policy contract: a saved local-access candidate leaves the
current effective value unchanged, real host restart closes a held old SDK
invocation, the new disabled boundary rejects before external I/O, and a later
fresh restart can authorize B again. An unrelated instance-domain update leaves
the held invocation usable. With three neighboring connection/policy checks,
**5/5**,exit0,5877.503666ms, `/tmp/m11-instance-policy-real-restart.log/.exit`.
Initial diagnostic logs `/tmp/m11-instance-policy-{before,fixed}.log/.exit` fail
because the probe wrongly treated a saved restart candidate as an immediate
withdrawal. That production P2 hypothesis was withdrawn, its uncommitted runtime
experiment removed, and original `scope/mcp.ts` was restored byte-identically to96f before the later
outbound status delta. The
correct regression uses the real configuration and app restart; no setting
activation semantics were changed.

Current whole combination, fresh compiled smoke, required affected, final accepted
M07/M08 and M11 Draft PR are pending. Historical gates below remain as labeled;
Checks/Component checks are disabled/unrun, and no integration/main edit or PR
merge is authorized or performed.

## Historical4cb real composition

Exact runtime/test composition `4cb0e9e8502c2b854dde9f6f72fc39415290bfd0` adds
M07 partial parity `6d3661de8a7f2fa4a9633d194632f21ca77c0685` and M08 fix
`9cbc863bdb7c2bc337ce820f4c566d8f10ce9923`. Types and scope guard exit0:
`/tmp/m11-6d-9cbc-types.log/.exit`, `/tmp/m11-4cb-scope.log/.exit`. Actual
all-scope/multiuser combination finished **447/454**,7fail,0cancel/skip,exit1,
432930.188ms (`/tmp/m11-4cb-combined.log/.exit`). Six failures were fixture
assumptions superseded by the real new `memory.materials` producer: actual
canonical Material navigation, selecting a known Material, observing all produced
context refs, a document-only candidate matrix and strict four-task rollback
inventory. Test-only commit `d412212c2e844209238fa58c8ec616df6e1f8bfe` preserves
the producer and passes those six targeted cases **6/6**,exit0,12829.3055ms
(`/tmp/m11-6d-composition-repairs-waited.log/.exit`). The seventh failure is a
production native-original pagination P2: `mote_items(limit=1)` returned two
blocks. Its original strict limit assertion remains unchanged; upstream80cf fix
is awaiting independent retest. The failed454 run is not relabeled as passed.

At exactd412, fresh server build exits0 and actual emitted production index plus
connector two-process smoke passes **2/2**,exit0,9535.425833ms:
`/tmp/m11-4cb-server-build.log/.exit`, `/tmp/m11-4cb-emitted-smoke.log/.exit`.
This retains the genuine MCP→M03→M06→reviewed Memory→Ask chain, SIGKILL, reconnect,
A/B owner separation and subjectless Gmail Material. It does not replace final
combined/affected gates.

Previous exact composition `3beece41e537b5b074f081bca90d7c7f7be71d93` passes
**59/59**,0fail/cancel/skip,exit0,137963.888583ms:
`node --import tsx --test --test-concurrency=1 --test-timeout=120000 apps/server/test/multiuser-mcp*.test.ts`,
`/tmp/m11-9cbc-focused.log/.exit`. This includes the upgraded actual production
index process: MCP→M03→M06→independently extracted/reviewed Memory→M08 query,
A/B isolation, SIGKILL/reconnect, credential revocation and no successful-model
replay. At prior exact604dc571ea6f7972056396472262e6d9b19acf90 fresh libs/server
builds exit0 and emitted real M11/M10 processes **2/2**,exit0,8162.862125ms:
`/tmp/m11-core-{libs-build,server-build,emitted-smoke}.log/.exit`. These earlier
compiled receipts do not prove the newer4cb runtime.

Artifact findings below are now CLOSED at9cbc: original two SDK probes and
external fixture unchanged in a complete literal composition archive pass2/2,
exit0,10515.088042ms, `/tmp/m11-review-m08-9cbc-artifact-sdk.log/.exit`.
Persistent actual SDK regressions pass2/2,exit0,10297.252375ms,
`/tmp/m11-artifact-persistent-sdk.log/.exit`, and are included in59 above.
Legitimate own artifact still reads; other-source and B deny. Conversation
DELETE200/artifact GET404 during provider await prevent old body publication.
First complete artifact/run/conversation pins and all dependency query filters
are rechecked in the actual reader's final request fence.

M07 exact6d question/feedback subset independently passes7/7 plus two additional
actual interpreter-await cancel/source-delete barriers2/2,exit0:
`/tmp/m11-review-m07-6d-parity.log/.exit` and
`/tmp/m11-review-m07-6d-late-owner.log/.exit`. M08 exact9cbc child retry/any-cancel/
conversation-CAS/source-declaration/empty-account subset independently passes5/5,
exit0, `/tmp/m11-review-m08-9cbc-children.log/.exit`. Reviews are bounded to those
real scenarios, with no new confirmed actionable P0/P1/P2. M08 also independently
reviewed the4cb app/scanner/inventory composition delta; recorded receipt
`/tmp/mote-m11-composition-peer-review.md`. It retains accepted M10/M06 startup,
M11 capability guards and new ownerQuestions host wiring.

The core gates below remain historical as labeled. Final accepted M07/M08 heads,
remaining parity/recovery work, final affected command and M11 Draft PR are still
pending; neither disabled CI nor prior affected success is presented as current.

## Genuine query reader core composition (not final acceptance)

Historical runtime/test freeze `d884b4c7250136dbc2687fcdd02f0753c0ab80dd` composes
accepted PR134 plus M08 partial8819cdde6cc426b81990c0b49a0854dd0b4432f7 and
M07 exact pin/default-content fixes through dbc5ae46b69e010d1610c0b8414fd755e348be0e.
All20 existing read tools use real scoped readers, with no direct M02 read fallback.
The separate write credential retains only real M03 intake.

| Current core check | Actual result |
| --- | --- |
| `node --import tsx --test --test-concurrency=1 --test-timeout=120000 apps/server/test/multiuser-mcp.test.ts apps/server/test/multiuser-mcp-process.test.ts apps/server/test/multiuser-mcp-memory.test.ts apps/server/test/multiuser-mcp-query.test.ts` | **57/57**,0fail/cancel/skip,exit0,122773.377209ms; `/tmp/m11-881-dbc-focused.log/.exit`. |
| `npm run typecheck -w @mote/server` | exit0; `/tmp/m11-881-pin-types.log/.exit`. |
| `node scripts/check-scope-contracts.mjs` | exit0; `/tmp/m11-881-dbc-scope.log/.exit`. |
| Actual Gmail ledger→Ask+MCP SDK tool/resource status and restart | **1/1**,exit0,1390.457ms; `/tmp/m11-727-real-status-sdk.log/.exit`. No additional adapter/network calls, credentials or provider error prose. |
| New SDK page/exact/history filter and selected-provider-key regressions | **2/2**,exit0,8212.660875ms; `/tmp/m11-memory-exact-filters-sdk-fixed.log/.exit`. Also included in57 above. |
| Real M03 upload→M06→SDK directory/file pages, mixed-source filtering before GROUP/LIMIT, owner/scope/parent cursors and restart | **1/1**,exit0,2773.064083ms; `/tmp/m11-query-881-catalog-sdk.log/.exit`. Included in57. |
| Complete multi-block Material locators, pending-only text excluded before query candidates, minimum-budget cursor restart | **1/1**,exit0,2268.408041ms; `/tmp/m11-query-881-multiblock-sdk.log/.exit`. Included in57. |
| Independent literal M08 exact881 core/children/restart/conversation/image checks | **4/4**,exit0,40757.024083ms; `/tmp/m11-review-m08-881-core.log/.exit`. Applies to reviewed scope, not full module acceptance. |
| Independent literal M07 exact067 builtin/external page/exact/history/pin checks | **4/4**,exit0,12628.766083ms; `/tmp/m11-review-m07-067-exact.log/.exit`. Positive default-content issue was found separately and fixed atdbc5. |

The57 scenarios exercise actual shared SQLite/app/M01/M03/M04/M05/M06/M07/M08,
HTTP listener and MCP SDK. Only external model/provider/remote I/O is synthetic.
They cover automatic intake→independent Memory extraction/review, all20 read tool
names, A/B equal IDs, write-only and ordinary-API denial, source narrowing before
LIMIT/provider keys, malicious selectors, cursors/restart, config refresh, outbound
handle retirement, cancellation/revocation/deletion/recreation across real awaits,
original identity receipts, measured activity/media, ready-only partial text,
UTF16 coordinates, navigation and context budget/inclusion/durable channels.

Original failed probes are retained with explicit later closures:

- First observed original overwritten after later provider await: literal e7
  host0/1,exit1, `/tmp/m11-review-m08-e7-pins.log/.exit`; unchanged literal c66
  host1/1,exit0 and SDK1/1,exit0, `/tmp/m11-review-m08-c66-pins.log/.exit` and
  `/tmp/m11-query-sdk-c66-pins.log/.exit`. P1 closed independently.
- Pending partial block exposure, UTF16 split, ignored includeMemories=false and
  missing actual M06 processed-history mapping failed original probes atc66.
  Exact060 closes partial/Unicode2/2 and real history/default-budget flags2/2;
  failure logs remain `/tmp/m11-query-partial-before.log/.exit`,
  `/tmp/m11-query-legacy-options-before.log/.exit`,
  `/tmp/m11-query-processed-history-before.log/.exit`. Retests are
  `/tmp/m11-query-060-parity-retest.log/.exit` (2/4 whole command; separate new
  budget defect and adapter return-shape typo) and
  `/tmp/m11-query-060-history-flags.log/.exit` (2/2,exit0).
- Exact060 minimum-budget/raw source navigation/same-body recreation defects:
  unchanged SDK four-scenario set passes4/4,exit0,9606.266708ms at492;
  `/tmp/m11-query-492-original-probes.log/.exit`. These findings are closed.
- Default implicit content collection was rejected at067: original SDK set1/2,
  exit1, `/tmp/m11-memory-exact-filters-sdk.log/.exit`. Same set unchanged2/2,
  exit0 afterdbc5, as above; P2 closed independently.

Prior development44/44,exit0,94237.2045ms remains in
`/tmp/m11-query-composed-focused.log/.exit`; it is not a final-code receipt.
Earlier account-wide source-set barrier2/2 and callback architecture4/4 passed,
`/tmp/m11-query-all-source-fence.log/.exit` and
`/tmp/m11-query-scope-architecture.log/.exit`. Core d884 bounded independent M11 adapter review passed2/2,exit0,8524.511208ms,
`/tmp/m07-review-m11-d884-sdk.log/.exit`, report
`/tmp/mote-m07-review-m11-query-core.md`, with no confirmed actionable P0/P1/P2
in that reviewed scope. Additional actual SDK artifact probes independently
reproduce a deleted-conversation late-publication P1 and ignored source-filter P2:
0/2,exit1,9761.928375ms,
`/tmp/m11-review-m08-881-artifact-sdk-valid.log/.exit`. Both findings are closed by the original SDK probes unchanged at9cbc, as
recorded in the superseding section above. Final accepted M07/M08
capability heads, all-scope/composed build/emitted/affected on final code and the
M11 Draft PR are still required. Historical417 full gates below do not satisfy
those new final-code requirements. CI remains disabled and unrun.

## Actual M07 Memory read increment

The reviewed M07 read-contract freeze
`a6bc94c43e34ce91439cfeff6ad669264610d1d1` is composed on this feature by
merge `0b0bdfcc98aec66fcebc80cafffe8590252e3bbc`. M10 atomic callback/savepoint
admission and M07 genuine M04 model forks are both retained. Types and scope
checks pass. Three real admission/model-fork seam regressions pass3/3,exit0:
`/tmp/m11-m07-a6-admission-merge.log/.exit`.

The genuine Memory MCP SDK matrix passes **11/11**, no failures/skips,exit0,
46510ms (`/tmp/m11-memory-sdk-first.log/.exit`). It exercises actual automatic
MCP write→M03→M06→M07 independent extraction/review→Memory tool/resource for A/B;
full transitive source restriction before LIMIT; same-user scope and cross-user
cursor rejection; []/all conversion; restart; actual M09 provider read/search
failure without cached SQL bodies; held provider revoke/disable/source recreation/
toggle/Memory deletion/SDK cancellation with B still reading; earlier-page-entry
deletion; and exact provider-backed historical reads after an owner correction.
Only external model/provider I/O is synthetic. Memory/Ask/processing services are
not replaced. Exact Memory increment `af361cce371e81cd3bc3240a34783e8392500f4e`
source+Memory focused matrix34/34,0fail/cancel/skip,exit0,61254ms:
`/tmp/m11-memory-frozen-focused.log/.exit`.

M08's stable reader core now permits the next actual query composition. Full
M07/M08 legacy capabilities, final whole-module review, combined/build/emitted/
required affected gates and the module Draft PR remain outstanding. The following
full affected receipts belong to the previous protocol/source runtime only;
they are not claimed for this new Memory increment.

## Current accepted-M10 protocol/source freeze

Authoritative runtime/test commit:
`4175d4e9b9231d0741b14af4b4b8ebc6f099ded5`.
It contains the accepted M10/M06 stack and the per-connection handle retirement
repair. Subsequent documentation-only commits do not change tested inputs.

| Exact final-code gate | Actual result |
| --- | --- |
| `node --import tsx --test --test-concurrency=2 --test-timeout=120000 apps/server/test/scope*.test.ts apps/server/test/multiuser*.test.ts` | **305/305**,0fail/cancel/skip,exit 0,138659ms; `/tmp/m11-4175-combined.log/.exit`. Includes all 23 current M11 tests (22 domain cases and one actual production index process). |
| `npm run build -w @mote/server` | exit 0; `/tmp/m11-4175-server-build.log/.exit`. |
| `npm run build -w @mote/web` | exit 0; `/tmp/m11-4175-web-build.log/.exit`, existing bundle-size warning. |
| `MOTE_MCP_PROCESS_ENTRY="$PWD/apps/server/dist/index.js" MOTE_CONNECTORS_PROCESS_ENTRY="$PWD/apps/server/dist/app.js" node --import tsx --test --test-concurrency=1 apps/server/test/multiuser-mcp-process.test.ts apps/server/test/multiuser-connectors-process.test.ts` | Fresh emitted actual M11 index/SDK/SIGKILL and M10 HTTP two-process smokes **2/2**,exit 0; `/tmp/m11-4175-compiled-smoke.log/.exit`. |
| `node scripts/check-scope-contracts.mjs` and `git diff --check` | both exit 0; `/tmp/m11-4175-scope.log/.exit`, `/tmp/m11-4175-diff.log/.exit`. |
| Independent M07 review of exact 417 | **4/4**,0fail/cancel/skip,exit 0; `/tmp/mote-m07-review-m11-protocol.md`, `/tmp/m07-independent-m11-4175.log/.exit`. No actionable P1/P2 in the reviewed protocol/source scope. |
| `npm run check:affected -- --base origin/codex/mote-multiuser-integration` | **exit 0** on the actual full retry; `/tmp/m11-4175-affected-retry.log/.exit`. Desktop 456/456; Server 2261 passed and one existing opt-in skip; Web 469/469; Agent 317 passed and one existing opt-in skip; Diagnostics 5/5; Shared 190/190; root 81/81; client 4/4; central runner passed. Android **329/329**, 70 suites, no failures/errors/skips, 25 tasks actually executed, 38s; `/tmp/m11-4175-android-junit.json`. |

The first actual full affected run exited 1: the checkout had used offline
`npm ci --ignore-scripts`, leaving Electron's binary absent. Its desktop hidden
window fixture could not start (455 passed, one failed). Server 2261 passed with one existing opt-in
skip, Web 469 passed, Agent 317 passed with one existing opt-in skip, Shared 190 passed with no
failures, but the complete command failed and Android was not reached. Logs
`/tmp/m11-4175-affected.log/.exit` preserve that failure. No production source or
check was changed/skipped. The existing local cached Electron 41.10.7 zip was
verified against the installed package's checksum
`7497a1f398c7bcac208fce96c73d297b1d63924624361a1a21930cd666cc4bbc` and extracted
only into this checkout's ignored node_modules. The actual hidden Electron
fixture then passed **2/2**,exit 0 (`/tmp/m11-electron-cache-repair.log/.exit`),
reporting zero shown windows/focuses. The exact required command was rerun on
unchanged clean 417, using existing JDK21/Android SDK, in its sole heavy slot.

M07's exact `a6bc94c43e34ce91439cfeff6ad669264610d1d1` bindRead contract has
also been independently reviewed, without composing an unaccepted module into
this runtime. Original transitive-source migration probe passed 1/1,exit 0.
A new genuine provider-backed page/delete probe initially exposed a P1 at
c0aedbbf: an earlier deleted Memory was returned after a later provider await.
At exact a6, the same semantic probe passes 1/1,exit 0,leaked=false/outcome=blocked;
only its temporary cleanup guard changed. Three further default-policy/history
export/concurrent-export regressions pass 3/3,exit 0. Full review and evidence:
`/tmp/mote-m11-review-m07.md`, `/tmp/m11-review-m07-migration.log/.exit`,
`/tmp/m11-review-m07-page-delete.log/.exit` (preserved failure),
`/tmp/m11-review-m07-page-delete-fixed.log/.exit`,
`/tmp/m11-review-m07-a6-delta.log/.exit`.
These are scoped interface/delta reviews, not final M07 or M11 module acceptance.

Remaining: accepted actual M07/M08 composition, all 21 legacy MCP tools' real
query/disclosure/activity behavior, final expanded SDK matrix, final independent
whole-module review and final-code full gates. See the
[detailed query composition plan](../design/multiuser-mcp-query.md). No own
feature push/Draft PR is claimed before the requested module gates.
Remote integration remains `6272a9b51ec92cc4c32e2ff1a1eeb4fa38b142ed`,
PR133 `470516b7ed4ab7ee8b0fba344883c6b42bb7ce56`, PR134
`7572b573b03437ff743652c13181b9fdcf251fda`; own remote branch remains absent.
Checks and Component checks remain `disabled_manually`; CI is unrun. Existing
release workflows were only read and left unchanged. No protected branch,
sibling source/existing DB, live credentials/data/provider/model or deployment
was changed.

## Executable journey matrix

| Risk | Real exercised boundary |
| --- | --- |
| A/B same IDs | Same source, external item/revision, connection, resource and tool IDs through actual HTTP and SDK; SQLite/content/results only owned. |
| Restricted credential escalation | MCP rejected from ordinary source/configuration/auth/admin routes; write sessions have no read resources/tools; source creation and out-of-scope writes refused. |
| Host-field spoofing | Forged tool userId refused; outbound remote tool arguments cannot change the actual host identity or local destination owner. |
| Browser/account switch | B Web cookie alongside A MCP bearer stays A; Web logout leaves independent MCP owner unchanged; explicit MCP revocation and account disable/re-enable reject old sessions. |
| Paging/restart | A cursor cannot be used by B or another source; own cursor resumes after restart; remote pagination traverses pages and rejects repeated cursor. |
| Crash/reconnect | Actual production index listener and SDK; SIGKILL, persistent credentials/data, old session404, new initialization fixed owner, persisted revocation, orderly final exit. |
| Late I/O | Barriers for revoke/disable/source delete/same-ID recreate/toggle/config refresh/cancel/domain delete; zero A intake/manifests; B still imports. |
| Privacy deletion | Held remote re-read cannot resurrect an explicitly deleted capture; exact pre-I/O selected heads are checked before transaction. |
| Resource snapshot | Same-account retry/restart deduplicates; shorter resource retracts its own tail; B keeps both parts. |
| Provider failure/retry | Real SDK failure/unsafe tool/repeated cursor yields fixed codes; no provider/key text; no partial intake; explicit next successful retry works. |
| Configuration/handles | Actual M04 CAS and sensitivity/export; A/B same connection IDs use distinct credentials and SDK sessions; local-network boundary remains administrator-owned. |
| Domain lifecycle | Actual session close and credential revocation at delete; metadata-only restore cannot revive old token; B session remains usable. |
| Real adjacent production | M03 archive intake via MCP tool automatically enters actual M05/M06 processing; SDK reads each owner's actual published Material. |
| Material dependency pagination | Mixed-source Materials are removed in SQL before ordering/limit/cursor publication; narrower same-user source scopes reject a broader Material cursor. |
| HTTP disconnect | Actual outbound import HTTP client abort reaches SDK cancellation; held result leaves no capture. |

## Historical development receipts

Initial 634 protocol/source freeze passed 64/64 adjacent auth/ingress/MCP/scope
and actual index tests,exit 0 (`/tmp/m11-frozen-adjacent.log/.exit`), plus fresh
Server/Web builds and emitted process 1/1,all 0. Accepted-M10 merge56 passed 304/304
and emitted 2/2,all 0. These precede the per-connection repair and are historical;
current 417 combination of 305/305 and full affected above supersede them.

Initial test clients omitted Ingress3 and requested Fastify listeningOrigin before
binding; they failed and were corrected without relaxing production checks.
One adjacent run had 63 passes and one scope-inventory failure after adding reply to
registerUserRoute; the exact mixed-ownership declaration was corrected, not
skipped. The first affected dry run lacked the freshly cloned base ref; fetching
its exact remote-tracking ref corrected that. Dry runs were never counted as
actual checks. Per-connection configuration self-audit then replaced whole-user
handle invalidation, with a durable two-held-connection regression before 417.

## Independent peer review performed by M11

M10 exact 41d2775307db5afecbb5b40b81b5fd8c8a0b9b9b real M06 composition:
7/7 actual joint/upgrade/reference tests, 6/6 secrets/admission regressions,exit 0.
Final delta 2ae03155ef766655f4996977e4eedcc0a2177e9d subjectless Gmail:
real HTTP two-process smoke 1/1,exit 0. No confirmed remaining P0/P1/P2 in reviewed
scope. Full report `/tmp/mote-m11-review-m10.md`; no sibling source/existing DB
writes. This is M10 review evidence, not an independent review of M11 itself.
