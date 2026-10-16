# M13 Web validation — incomplete checkpoint

Baseline M08 PR13758944f00837c89bc1d302ecd7be7a568db4abe44 includes accepted
M07 PR136cd7a306cce0f6cd5fec3c9e91e6dee0761352115 and public-contract PR135.
Own branch codex/mote-multiuser-m13-web, independent task17 clone. No dirty main
workspace used, no integration/main mutation, no PR/push/merge/deploy/CI action.
Final M11 remote98d76945e091d7234217ebcf532ebeff3350937c was verified and
merged in4eb1513c. M12 handoff remains denied/pending user authorization;
final M13 remote/PR verification has not occurred.
The original Web capability matrix is [the required acceptance ledger](../design/multiuser-web.md).
OPEN rows block complete Web acceptance; no feature is silently removed.

## Regression / characterization receipts

Commands use existing Node24 `/tmp/mote-node24-runtime-20261014/node-v24.21.0-darwin-arm64/bin/node`.
Logs and `.exit` files below are local evidence, not overlapping test totals.

| Source/test/fix | Actual command / result | Evidence |
| --- | --- | --- |
| baseline589 + test00a377cd -> fix15a64aa6 | `node --import tsx --test apps/web/test/multiuser-api.test.ts`: RED0/3 EXIT1; focused existing API characterization + new tests GREEN15/15 EXIT0 | `/tmp/m13-api-red.log`, `/tmp/m13-api-green.log` |
| test79887e02 -> runtime9d2593d8 | new masked-view editing method contract RED1fail EXIT1; config-service characterization + new scenario31/31 EXIT0 | `/tmp/m13-config-red.log`, `/tmp/m13-config-green.log` |
| runtime9d2593d8 | own auth/API/draft8/8 EXIT0; session/login/notes characterization22/22 EXIT0 | `/tmp/m13-auth-unit.log`, `/tmp/m13-characterization.log` |
| runtime9d2593d8 | `node --import tsx --test apps/server/test/multiuser-web.test.ts`: actual buildApp/Accounts/SQLite/Ingress with Web Api, synthetic Cookie transport through Fastify inject,3/3 EXIT0 | `/tmp/m13-real-http-inprocess.log` |
| real renderer9d2593d8 -> test5298bf9f -> fix22b14deb | old A-viewed loginRequest persisted through B re-login; actual RED then actual IAB GREEN. No client grant issued | `/tmp/m13-approval-route-red.md`, `/tmp/m13-iab-checkpoint-22.md` |
| test47ee1679 -> runtimeeda455ee | `node --import tsx --test --test-name-pattern='Web feature metadata' apps/server/test/multiuser-web.test.ts`: actual503 RED0/1 EXIT1; same assertion GREEN1/1 EXIT0, actual formal-note producer/canonical revision/source facets/A-B/current-session | `/tmp/m13-library-red.log`, `/tmp/m13-library-green.log` |
| test5162526f -> runtimeb64afe07 | `node --import tsx --test --test-name-pattern='Web attachment transport' apps/server/test/multiuser-web.test.ts`: old file-sync route actual503 RED0/1 EXIT1; actual original-byte ticket read/retry/same receipt/foreign404/stale409 GREEN1/1 EXIT0 | `/tmp/m13-attachment-red.log`, `/tmp/m13-attachment-green.log` |
| attachment increment | `node --import tsx --test apps/web/test/note-attachments.test.ts apps/web/test/multiuser-api.test.ts apps/server/test/multiuser-web.test.ts`:11/11 EXIT0 (five actual server-boundary cases, old upload characterization and Api) | `/tmp/m13-web-increment-focused.log` |
| test029fba7c -> fix5438b1ce | delayed ticket/new login adoption contract RED0/1 EXIT1 (missing rejection); `node --import tsx --test apps/web/test/login-handoff.test.ts apps/web/test/multiuser-web-auth.test.ts apps/web/test/multiuser-api.test.ts`:12/12 EXIT0 | `/tmp/m13-ticket-race-red.log`, `/tmp/m13-ticket-race-green.log` |

Masked editing is a new contract (missing-method RED), not proof of an old
production bug. One initial config test attempt lacked local dependency dist;
it is an environment failure, not an isolation failure. A changed handoff fixture
initially resolved a barrier before serialized request admission; waiting for the
actual request repaired the invalid fixture timing without weakening assertions.
Attachment typecheck first found a missing explicit default `deleted:false` in
the typed manifest; fixed and typecheck EXIT0, not a business-runtime RED.

## Actual renderer/backend checkpoint

Hidden existing Codex in-app browser, two temporary tabs; generated accounts and
content only; production buildApp shared SQLite/services/single executor, actual
loopback HTTP and built Web main. No real provider/model/user data/actions.
Original host61031 runtime9d; restarted host62909 runtime/bundle22 for fix proof.
Tool-driven actual DOM/AX checks are separate from unexecuted Electron automation.

Verified at22:
- username/password login, own current account; ordinary user lacks administrator UI;
- identical A/B note UUID isolation; A draft reload and same-account re-login
  recovery; B empty composer; actual B rendered save reaches B Ingress/SQLite;
- actual A response entered the hold before switching to B; B positive first,
  then release old successful A response, B remains positive with no A/draft;
- already-open native approval detail retires with A, URL loginRequest removed;
  explicit B re-login cannot resurrect it, original request still pending;
- failed login leaves old private tree absent;
- actual credential revocation then rendered refresh clears private UI;
- actual account disable then rendered refresh clears private UI;
- actual A rendered save admitted to Ingress then held ACK; logout/switch B,
  release ACK; A record26ff4304-5398-4235-aa74-2d8d3e71ba3b remains A, B has only
  B notes/empty composer, no A content. Logout does not cancel admitted work;
- administrator Settings lists generated account metadata and shared-model entry,
  without A/B private note bodies. No password reset/real credential grant UI run.

Detailed receipts `/tmp/m13-iab-checkpoint-22.md`, `/tmp/m13-lifecycle-checkpoint.md`.
Invalid test assumptions are explicitly excluded: an earlier unconfirmed gate
held B, not A; immediate reads before lazy page settlement saw empty fields; a
running static host cannot serve hashes from a later build and was restarted.
None is called an old production bug or counted as a successful assertion.

## Build/review/environment boundaries

- Own shared build EXIT0 `/tmp/m13-shared-build.log`.
- Own Web typecheck/build at22 EXIT0 `/tmp/m13-web-types.log`, `/tmp/m13-web-build.log`.
  Existing Vite chunk-size warning retained. This does not validate later bundles.
- Web typecheck after attachment implementation EXIT0 `/tmp/m13-web-types-attachment.log`.
- i18n8359 keys EXIT0 `/tmp/m13-i18n.log`; Android English JSON synchronized.
- scope scanner actual[] ateda, diff-check0; final gates still pending.
- M11 bounded read-only independent review exact589..22: no new confirmed
  P0/P1/P2 in Api/session/drafts/secret-CAS/context scope, no independent tests
  run. `/tmp/mote-m11-review-m13-22.md`. Later increments are NOT reviewed yet.
- Reviewer suggested delayed-ticket and direct-stream follow-up, not confirmed
  findings. Delayed-ticket migration contract gained RED/GREEN above. Current
  Web sources have no direct ReadableStream/getReader/SSE consumer; do not claim
  raw body-method tests prove a future direct stream consumer.

Default sandbox host listen returned EPERM before binding. Parent supplied new
explicit authorization for the original synthetic loopback host standard
escalation; automatic review allowed that exact host action. Hidden Electron
startup separately aborted at macOS ___RegisterApplication. A later standard
request to run hidden Electron `apps/web/test/multiuser-browser.cjs` was explicitly
DENIED before execution: that escalated renderer approach was not specifically
authorized and the existing IAB path was available. No retry, renamed command,
proxy runner or OS/network/security change followed. Existing hidden IAB + the
separately approved synthetic loopback host is the safe validation path.
`multiuser-browser.cjs` is durable scenario source, UNEXECUTED/unaccepted; its
presence is not a green automation receipt.

## Remaining gates / blockers

1. Complete the original capability matrix. Actual missing589 scoped projections
   include capture browser sessions/albums/image/OCR, import confirmation/read
   view, typed file review/speaker/export, private storage/encryption/backup and
   instance diagnostics/update. Memory/connector/plugin old response shapes need
   domain contract mapping; do not assume aliases prove equivalence. See exact
   pages/API/dependency/minimum approach in the ledger. M13 thin metadata/library
   and attachment increments still require fresh renderer proof.
2. Final accepted M11/M12 remote heads and composition on own feature only. M12
   open-action-dialog/current-review/version/target/epoch/revoke interleavings
   and actual final approval UI chain remain pending. Current checkpoint is not
   final acceptance of either dependency.
3. Newer-auth adoption overlap real IAB proof; same account/deployment rotation,
   missed-tab signal/backend session guard, expiry and final subscription/dialog
   matrix. Existing real HTTP stale-tab mutation negative complements actual IAB
   storage-event retirement, but is not a lost-event renderer rerun.
4. Independent incremental code review after22, fresh own builds, complete Web
   suite, required `npm run check:affected -- --base origin/codex/mote-multiuser-integration`
   including actual Android, final scope/diff/i18n. Serial heavy slot is held by
   no other module is persistently assigned here; M13 final full gate has not started or been counted passed.
5. Push own branch and create/attach Draft PR to integration only after acceptance;
   final remote head/base SHA checks. No PR URL exists at this checkpoint.

Last independent narrow checkpoint at runtime5438b1ce:
`node --import tsx --test apps/web/test/multiuser-api.test.ts apps/web/test/multiuser-web-auth.test.ts apps/web/test/login-handoff.test.ts apps/web/test/note-attachments.test.ts apps/server/test/multiuser-web.test.ts`
20/20,0skip/fail/cancel,EXIT0,6810.550625ms,
`/tmp/m13-final-narrow-checkpoint.log/.exit`. This is not the complete Web suite.
Parent subsequently paused M12 at a clean non-final checkpoint; its contract
handoff was denied pending explicit user authorization. No proxy transfer or
wake-up of M12 is performed. Current three slots are M13/M14/M15; M11 is complete and is not awakened.
M13 has released its latest short build/suite window.

## Increment9659 (still incomplete)

Own head9659d6df1e0f4348df6f70156c074e5762098803. M15 public Wire2
107004df cherry-picked asda2b030e (two new-file conflicts retained exact
source test/ledger); M14 public source-CASfdc cherry-picked as6ff66860. No
M12 content was consumed. Public Web projection-only freezec6b092ed has parent
fdc50cdc and no Web/native/M12 runtime; M14/M15 composition is separate.

| Test/fix or checkpoint | Receipt | Evidence |
| --- | --- | --- |
| M11 final composition4eb1513c | Actual Web backend6/6 and Web tsc/Vite EXIT0 | `/tmp/m13-m11-composed-web{,-build}.log/.exit` |
| Missing model inventory selection6d04dbe6→bf6a4a22 | Actual M01/M04 empty/selected account contract1/1 EXIT0; unconfigured is a normal state | `/tmp/m13-ask-selection-contract-red.log`, `/tmp/m13-ask-selection-green.log` |
| Original unopened connector panela1917→ada084 | RED actual eager old/status request; component GREEN16/16 | `/tmp/m13-source-panel-red-valid.log`, `/tmp/m13-source-panel-green.log` |
| Original Memory lifecycle fields91f16117 | Original controls characterization12/12, typecheck0; IAB field save revision0→1 | `/tmp/m13-memory-fields-{characterization,types}.log` |
| Missing owned MCP preparationce855→fc28/697 | Actual Ingress/configuration/CAS1/1; same-ID component draft retirement RED→GREEN17/17; narrow combined22/22 | `/tmp/m13-mcp-preparation-{red,green}.log`, `/tmp/m13-mcp-draft-{red,green}.log`, `/tmp/m13-697-narrow.log` |
| Skills9f708→78a60 | Actual503 RED→1/1 GREEN; initial registration before topology hook separately RED→moved registration GREEN | `/tmp/m13-skills-{red,green,topology-red,topology-green}.log` |
| Insight default selectiond8e5→4d2d | Original per-request global selector incompatible, SSR contract RED→GREEN2/2; per-request capability still OPEN pending M15 seam | `/tmp/m13-insight-model-{red,green}.log` |
| Query citation796431→d658 | Actual IAB old capture-browser path503; route reader preservation RED→GREEN8/8, real component context reader7/7; actual IAB5e citation and reload GREEN | `/tmp/m13-query-evidence-{route-red,green,component}.log`, `/tmp/m13-iab-query-5e.md` |
| Raw capture45b99→5e26 | Original text reader old route RED→M02 GET GREEN8/8 | `/tmp/m13-raw-capture-reader-{red,green}.log` |
| ACK identity2d09/51101→c1b6 | Actual M03 response corrupted only at external transport,9 negative scenarios RED (10total incl parent), same tests + original positive/retry/A-B12/12 GREEN | `/tmp/m13-receipt-identity-red{,-expanded}.log`, `/tmp/m13-receipt-identity-green.log` |
| Run scope/turn metadata06564→3529 | Actual IAB InsightProgress scope.after crash + backend RED2/2; own persisted metadata GREEN2/2; actual IAB report/text/citation/history refresh GREEN | `/tmp/m13-query-metadata-{red,green}.log`, `/tmp/m13-iab-insight-3529.md` |
| Public reader probe9659 | Real backend with no Web helper imports2/2 EXIT0 | `/tmp/m13-public-web-projection.log/.exit` |
| Full Web tests9659 | `node --import tsx --test test/*.test.ts`, cwd apps/web,485/485 EXIT0 | `/tmp/m13-9659-web-suite.log/.exit` |
| Fresh builds9659 | shared0, Web tsc/Vite0, server after dependency repair0 | `/tmp/m13-9659-{shared-build,web-build,server-build-repaired2}.log/.exit` |

Node24 remains the runtime. The initial complete `npm run test -w @mote/web`
failed before tests because tsx CLI IPC pipe creation was EPERM; same CWD and
files through Node's loader passed482/482, then485/485 after the reader increments.
That environment failure is not a product/isolation RED. Server first build and
first repair attempt EXIT2 missing nested mem0ai/oss. The independent dependency
copy guard rejected `.bin` before copying; it was corrected to exclude generated
executables and verify all12 nested registry package versions against lock and
reject symlinks. Independent APFS copies then fresh server build EXIT0; no peer
workspace/dependency tree was modified. Original failed logs remain.

Invalid fixture attempts remain excluded: async React model-selection fixture
did not settle correctly and was removed, not counted as a runtime fix; the first
source-panel test used wrong JSX CWD; first raw reader GREEN fixture intercepted
DELETE as GET, then method predicate repaired with original assertions retained
(the log was overwritten, transcript retains that invalid failure). Insight
fixture originally dated captures later than asOf; changed only generated date
for a meaningful positive bounded report. A post-clean-host-close browser reload
returned connection refused; new tab in the same existing browser recovered.

M14 bounded independent read-only review exact22..5e plusc1b6/3529 found no
new confirmed P0/P1/P2; ACK P2 is closed. `/tmp/mote-m14-review-m13-5e26b473.md`.
M14's tests were not run by this reviewer; its report does not replace final
renderer/whole-module gates. M13 independently re-reviewed M14's account/window
fix at29d without running Electron/tests: `/tmp/mote-m13-review-m14-29d.md`.

Finite remaining original capabilities: per-request models (M15 minimal M04
seam in progress), M10 vendor cards, M07 normal/audit/jobs/recipes/binding and
selection/progress mapping, M09 instances/admin packages, raw albums/session/
image/OCR filters, import confirmation/recovery/typed file review/export/aggregate
activity, Agent startup/trace, per-user storage/backup/index and explicit instance
management facades, and M12 Todos/Actions approval. These are required old
abilities, not optional new work. Missing domain projections are not replaced
with empty lists, invented counts or unrelated operations. M12 handoff is the
explicit user-authorization dependency; parent domain ownership/contract decisions
for genuinely absent management/import facades remain to be resolved.

Final freeze still requires incremental independent review, final actual
renderer/backend matrix (incl attachments/MCP and delayed auth overlap), fresh
related builds, full required affected including actual Android, scope/i18n/diff,
then own push/Draft PR/attachment/remote head-base verification. No final gate or
whole-module completion is claimed. Finite coordination details are preserved
in `/tmp/mote-m13-finite-closeout.md`; primary capability ledger above remains
authoritative for OPEN rows.

## Request-model and plugin/control increment (not final gates)

- M15 db88 composed as7f2fe173. Original control SSR RED41337d12 →cde70676
  GREEN3/3; same-ID model ownership REDa39db8c0 →705d0207 combined5/5 EXIT0,
  `/tmp/m13-model-owner-{red,green}.log/.exit`. M14 bounded readonly review
  `/tmp/mote-m14-review-m13-705d.md` has no confirmed P0/P1/P2; no rerun claimed.
- Actual hidden IAB alternate-model query at705d completed and archived. The
  later read-only provider/default queries lost their transport. After parent
  steering, readonly git/artifact/browser checks succeeded, original archived
  query remained visible and the old fixture HTTP listener was gone. No replay.
  Provider model/default post-state remains unverified; this is environment
  evidence, not a model-isolation failure or a passed provider assertion.
- Public c6 standalone omitted the full branch's exact pure `web-assets.ts`
  scanner allowance. Independent16cdf1619c89340b75c5c91de2e5c722773a1e09 adds
  only that single file; exact tracked tree scanner[] EXIT0 in
  `/tmp/m13-public-scope-16-complete.log/.exit`. First archive lacked
  fixtures/legacy-app.ts and exited1, retained separately; no broad allowance.
- Actual M09 metadata/masked-reference edit contract RED8cc78a64 0/2 EXIT1
  `/tmp/m13-plugin-metadata-valid-red.log/.exit` →ff91b6f8 GREEN2/2 EXIT0
  `/tmp/m13-plugin-metadata-green.log/.exit`. Same-ID A/B plus stale CAS,
  no hidden references in HTTP view, checked versus unsupported capabilities.
- Original PluginCenter + production Fastify/Accounts/M09/SQLite RED54238eb9
  crashed on the old view shape;71a2230c GREEN1/1 in
  `/tmp/m13-plugin-page-green.log/.exit`. This is a scoped-host migration gap,
  not an old single-owner production defect.
- Missing original M07 control REDf4ed4df1 and missing durable owner preparation
  REDd1e16e92 retained in `/tmp/m13-memory-control-red.log/.exit` and
  `/tmp/m13-memory-reload-red.log/.exit`. Actual backend + original renderer
  control GREEN4/4 `/tmp/m13-plugin-memory-green.log/.exit`; expanded actual
  reload→verification→activation and open-stop A/B switch GREEN1/1
  `/tmp/m13-plugin-memory-lifecycle.log/.exit`. Generated empty binding tests
  do not prove nonempty external-provider body migration.
- Reused the original modal and retained legacy PluginCenter characterization:
  `/tmp/m13-plugin-memory-modal.log/.exit`11/11 EXIT0. First new i18n check
  failed on a missing key; exact English/Android catalog sync then
  `/tmp/m13-plugin-i18n-green.log/.exit` EXIT0 (8365 messages).

Final affected, all builds at the final composition, real browser plugin/admin
journeys and all OPEN original-capability rows remain outstanding. No PR or
remote final head has been created. M12 handoff is still denied pending explicit
user authorization; M16 lifecycle is an explicit owned dependency.

### Memory reader characterization (after 9f305c81)

The canonical-Material-ref expectation in the first added test was invalid. Both `/tmp/m13-memory-anchor-red.log` and `/tmp/m13-memory-anchor-valid-red.log` failed only that expectation; following the actual returned `capture:<M07 evidence UUID>` through `/context/read` already succeeded with A's text. The uncommitted exploration that changed backend output was withdrawn; no `memory.ts`/`ask.ts` production change was shipped. `/tmp/m13-memory-anchor-green.log` therefore is not a delivered-fix result.

Corrected characterization runs the real M07 publication chain, follows the declared context reader, verifies raw `/captures/<same evidence UUID>` is 404 and B cannot read A's Memory/Material. Exact command `node --import tsx --test --test-name-pattern='Memory evidence navigation retains' apps/server/test/multiuser-memory.test.ts`, Node24 with synthetic local HTTP model fixture, standard approval: 1/1 EXIT0, `/tmp/m13-memory-reader-characterization.log` and `.exit`. This proves the reader boundary, not original Memories page closure.

### Original Memories consumer increment

Existing M07 real fixture was extracted unchanged into `test/fixtures/scoped-memory-host.ts` for reuse by the original React page test; normalized pre-extraction function SHA256 `dc71c512f6c2c92065d299e6162c6bb132f05bdf26a0a8e6d2fca7b782dfa063`, no fixture body/semantic assertion change. Generated A/B use equal Material IDs, real Ingress publication, local model HTTP, independent review and Memory commit.

- c191368c renderer RED: actual published memory absent because ordinary read sent `includeStale=true` (400), old job/recipe/queue endpoints also observed. `/tmp/m13-memory-page-red.log` EXIT1. bdba5655 published query + direct evidence/context reader GREEN1/1 `/tmp/m13-memory-page-reader-green.log` EXIT0.
- Expanded Memory nested evidence valid RED e22c55f8: actual callback emitted raw `capture:<M07 evidence UUID>` instead of keeping context reader; `/tmp/m13-memory-nested-reader-valid-red.log` EXIT1. First `/tmp/m13-memory-nested-reader-red.log` only observed pending renderer initialization, not a product RED. c6ee7453 nested reader GREEN1/1 `/tmp/m13-memory-nested-reader-green.log` EXIT0.
- fc82f5d0 job-history RED: original page requested legacy `/memory-jobs`; `/tmp/m13-memory-job-consumer-red.log` EXIT1. Scoped job history now reads actual M07 signed pages, and progress shows persisted batches/tasks/publication IDs without inventing legacy input-plan counts. Actual renderer opens completed receipt, direct/nested evidence, then B with A detail retired: `/tmp/m13-memory-jobs-renderer-green.log` 1/1 EXIT0. This is a bounded read/history increment; stale audit, manual selection, correction/integration and queue settings remain separate open mappings.
- i18n including synchronized Android catalog: `/tmp/m13-memory-i18n.log` EXIT0, 8368 messages. No full affected/build claim for this increment yet.

### 0cc composed build and actual IAB increment

Shared build, Web tsc/Vite, server tsc and scope all EXIT0 at runtime `0cc7311af17463f17ba3b8664741bb9ac8f6b1ef`: `/tmp/m13-plugins-shared-build.log`, `/tmp/m13-plugins-web-build.log`, `/tmp/m13-plugins-server-typecheck.log`, `/tmp/m13-plugin-composed-scope.log` with corresponding `.exit`. M09/plugin-ingress/Web-plugin/Android transport four-file run: 35 total, 34 pass, one `listen EPERM` before assertions, EXIT1 `/tmp/m13-plugin-ingress-regressions.log`. Exact failed real-HTTP shutdown characterization under standard approval: 1/1 EXIT0 `/tmp/m13-plugin-loopback-characterization.log`. The first command remains failed, not relabeled.

Fresh distinct IAB run used existing available in-app browser3, generated accounts/temp SQLite/local SSE and generated package transport; Web bundle 0cc, runtime e295e02b fixture-only addition. Receipt `/tmp/m13-iab-plugins-model-0cc.md` and `/tmp/m13-iab-plugins-model-receipt.json`: original Ask personal temporary model ID reaches all three A-only provider requests, Memory/chat default unchanged; administrator package preview/install/uninstall/reinstall; A nonempty masked reference edit/check/enable/disable; old open A editor retires on B switch in another tab, reload discovers B empty; B Memory pause persists; generated B MCP read credential issue/hide/revoke. Trace binds all mutations to original account credentials, not B-adopted A operations. Runner close acknowledged and exited0, generated resources removed. This is separate from the interrupted prior IAB query receipt and does not fill its missing provider observation retroactively. No Web Electron action was executed.

M14 bounded static independent review exact705d..72c3 `/tmp/mote-m14-review-m13-72c3.md`: no confirmed P0/P1/P2; not a substitute for final renderer/integration gates. Public plugin/control freeze65a contract and scope check recorded in `/tmp/mote-m13-public-plugin-contract.md` and `/tmp/m13-public-plugin-scope.log` EXIT0.

Memory increment original characterization `manual-memory.test.ts` + `memory-recipes.test.ts`: 5/5 EXIT0 `/tmp/m13-memory-original-characterization.log`. First Web typecheck found a JSX `unknown` condition (implementation type defect, no runtime test failure); fixed with explicit error presence check. Rerun `/tmp/m13-memory-web-typecheck-green.log` EXIT0. Neither is final affected acceptance.

Delayed login-ticket versus a second tab's B login was characterized through actual M01/browser Web Locks and onSend gates: `/tmp/m13-iab-ticket-cross-tab.md`. At observed gates old A remained signed-out and absent after release; B positive reached ready with only its private note. The static suspicion did not reproduce, so authentication runtime was not changed. Initial non-PTY host stdin issue, exact fixture PID stop and cleanup are recorded separately. Final fixture close acknowledged/EXIT0; temporary second tab closed.

### Original Memory correction follows durable publication

cb3fbf24 valid RED: original React form received nonempty owner input, POST `/memories/:id/correct` actually returned400 with legacy flat body. `/tmp/m13-memory-correction-valid-red.log` EXIT1. `/tmp/m13-memory-correction-first.log` only failed fixture React input initialization, excluded as product evidence; dynamically initializing React DOM after jsdom made the input event real.

Consumer sends M07 `{operationId,correction}` and retains that operation ID for an uncertain retry of the same account/card/body; no default-model write or backend change. It follows actual `/memory/jobs/:id` to the publication result and reads the new Memory. Diagnostic `/tmp/m13-memory-correction-receipt-diagnostic.log` shows a successful correction is `state=committed`, task `succeeded`, `current=false` because it superseded its original input. Progress now retains historical completion while reporting changed input versions separately; current Memory reads still enforce backend proof/grants. This corrects the initial M13 adapter's completion interpretation, not a claimed backend defect.

Complete generated original renderer -> actual M07 correct task -> new published body, A unchanged: `/tmp/m13-memory-correction-publication-final-green.log` 1/1 EXIT0. Initial admission-only `/tmp/m13-memory-correction-green.log`1/1 did not prove publication and is superseded by this expanded journey. `/tmp/m13-memory-correction-publication-green.log` EXIT1 retained the adapter completion failure. i18n synchronized8369 EXIT0 `/tmp/m13-memory-correction-i18n.log`. Final type/build/affected still pending at this new increment; M14 holds the agreed sole-heavy required window at its earlier exact composition.

### Manual Memory model contract consumes existing M04 lease

508aa1b4 valid backend RED: strict M07 job request rejects explicit owned modelReference/modelOverride with400 before admission; `/tmp/m13-memory-request-model-actual-red.log` EXIT1. The earlier `-red` and `-valid-red` files failed configuration setup when a masked read projection was copied as writable data (including masked headers/extraBody); those are invalid fixtures, not production RED. Final fixture uses only explicitly generated model configuration.

M07 now calls the existing M04 leaseReference and retains explicit request metadata in its existing durable task schema. No M04/Ask implementation or global default is changed. `/tmp/m13-memory-request-model-green.log`: actual local provider receives alternate model under A key through extraction and independent review/publication; default selection metadata unchanged, identical operation retry succeeds, changed requested model with the same operation409, B cannot select A-only profile and sends no provider request. 1/1 EXIT0; old no-reference automatic task inputs unchanged. Whole M07/M04/consumer regressions/typecheck still required after the sole-heavy window.

Explicit Material boundary RED3df79eb6: revision-pinned job input rejected400 and original selection preview absent503, two real backend cases0/2 `/tmp/m13-memory-material-boundary-red.log`. Existing M07 canonical materialEvidence is now exposed as a bounded preflight projection (no job/admission), with exact revision and declared recipe requirements. Optional materialRevisions pins all selected IDs at admission. Same two actual producer/API/publication cases2/2 EXIT0 `/tmp/m13-memory-material-boundary-green.log`: selected old revision conflicts after update without model calls; B cannot use A revision; partial pin map400; preview creates no mm_job; equal A/B Material IDs yield owner-specific evidence; actual subsequent publication uses preview's evidence IDs. UI consumption and final regressions still pending.


### Original Material to manual Memory renderer

af685d21 actual renderer RED: original Material detail reads the real canonical body, but has no manual-Memory link because scoped M02 does not return legacy memorySource. `/tmp/m13-memory-material-renderer-red.log` EXIT1. After consuming M07 preflight for the detail link, the unchanged original form still disables canonical selection; `/tmp/m13-memory-material-form-red.log` EXIT1. These are migration consumer failures, not claims about the old single-owner implementation.

Original detail and Memories now consume exact-revision M07 preflight, keyed by the actual selected recipes. Manual admission sends canonical materialIds plus complete materialRevisions and owned request modelReference through the existing durable job. Identical uncertain retries retain their operation UUID; backend admission still repeats revision/dependency/authority checks. Raw/range selection and stale audit remain OPEN, not silently mapped to all Materials.

`/tmp/m13-memory-material-renderer-green.log` 1/1 EXIT0 first complete journey. Expanded `/tmp/m13-memory-material-renderer-retry-green.log` 2/2 EXIT0 includes the original published-memory/correction journey and Material detail → selection → nondefault personal model → a lost real admission ACK → identical retry → actual extraction/review/publication. All provider requests use A's generated key and selected model, feature default metadata stays unchanged, B same-ID Material produces no B Memory. Synthetic localhost HTTP fixture only; no actual third-party action. Final type/build/affected and independent review of this delta remain required.


### M16 owned export consumer increment

Own feature merged M14 stable a439 and explicitly composed M16 e30/f24 + credential cleanup2a48/23e + reset tombstone d8/487 + account deletion locator75fef1f8. No integration/main or peer worktree change. M14's current required run remains on a439 and excludes these later M13/M16 changes.

ea36c689 original storage route RED: null global status hides the entire page despite an authenticated M01 session; `/tmp/m13-portable-renderer-valid-red.log` EXIT1. First `/tmp/m13-portable-renderer-red.log` only had a fixture feature-registry import cycle and is excluded. Original storage route now remains available, with owner portable export controls in its original Vault location. Completed receipt verifies account/deployment/operation, coverage exclusions, content type, ETag, exact byte count and SHA256 before browser download. Semantic phases/domains are displayed without fabricated record totals.

`/tmp/m13-portable-renderer-first-green.log` actual M01 Web Cookie/session/CSRF → original storage renderer → M16 receipt → verified content download 1/1 EXIT0; held A download released after B switch produces no file; fresh B export/download succeeds. The test uses createApi and app.inject at the external fetch transport, no fake lifecycle implementation, generated accounts/temp SQLite only. Personal import, separate old metadata/data export modes, private storage/index statistics and encryption remain explicit OPEN UI/domain mappings; disabled controls and notices preserve those capability gaps instead of fabricating success. Final IAB/type/build/affected and bounded independent review still required.


### Administrator deletion consumer

5f0d712b original account-list RED: no durable deletion entry, `/tmp/m13-account-deletion-renderer-red.log` EXIT1. Original account management now opens the established modal, captures original Api/target/operation UUID, retires the confirmation on identity change, and reads only M16 metadata receipts. Tombstones expose their original deletionId for refresh/retry, with no reset/reenable controls. Self-deletion uses the existing serialized authentication-change path and closes its initiating Api after actual admission. No alternate-account credential is adopted.

`/tmp/m13-account-deletion-renderer-green.log` and `-diagnostic.log` failed because the test selector matched generated-admin when looking for generated-a; actual last_administrator rejection was correct, not a product failure. Correct exact username selector: expanded export/A-held-download/B-positive/admin-held-confirmation/delete/refresh journey `/tmp/m13-account-deletion-renderer-final-green.log` 1/1 EXIT0. Separate self-deletion extension is recorded below after its result. First i18n check found missing new catalog keys; synchronized shared/Android catalogs then `/tmp/m13-portable-i18n-green.log` EXIT0,8394 messages. No final type/build/affected claim yet.

Self-deletion extension `/tmp/m13-account-deletion-self-green.log` 1/1 EXIT0: a generated replacement administrator permits current administrator deletion; the real admission triggers one browser authentication-change event, closes the initiating Api, old account login401 and replacement administrator login200. No user data or real external side effect. This is a synthetic renderer/backend boundary, not a final IAB claim.

At cd7 composition, fresh shared build0, server typecheck0 and scope0: `/tmp/m13-cd7-{shared-build,server-typecheck,scope}.log/.exit`. Web typecheck and first build failed on new lifecycle components accessing the legacy/Web Connection union without narrowing; logs `/tmp/m13-cd7-web-typecheck.log`, `-green.log` and `/tmp/m13-lifecycle-web-build.log` retain EXIT2. Explicit Web identity guards and captured stable user ID then full Web tsc+Vite EXIT0 `/tmp/m13-lifecycle-web-build-green.log/.exit`; generated lifecycle renderer including self-delete rerun1/1 EXIT0 `/tmp/m13-lifecycle-typeguard-renderer.log/.exit`. This is an implementation type defect repaired, not an environment error or backend isolation failure.

M16 bounded independent read exact b6c1c0d5+cd7d4b40 `/tmp/mote-m16-review-m13-cd7.md`: no confirmed P0/P1/P2 in receipt owner/deployment/operation/hash/coverage, each-await download retirement, immutable deletion intent, durable deletionId, self-auth change/close and honest unknown/retry states. It did not run tests/build/IAB; later type-only guards were not independently rerun there. Final affected at the final M13 composition remains outstanding.

### Actual browser portable export and terminal-state correction

`/tmp/m13-iab-portable-8109.md`: actual existing in-app browser3, own background tab4 and synthetic localhost host, Web/runtime8109092e. Original route/M01 sign-in/export receipt/download produced 15,585 exact bytes, SHA256 `8b64cd555b4de2c72cfa3b0ef23eee48815163adeb135082751e4ce7baf1a8c1`, portable3 A identity/body, B body and credential hashes absent. Browser download tool returned only after4116.8477s; it was not repeated or bypassed. Confirmed file copy `/tmp/m13-iab-portable-a.json`; original exact generated download remains outside writable roots, cleanup not attempted without approval. This is a distinct IAB acceptance increment, not B/deletion/M12 browser proof.

The same browser exposed a new M13 UI defect: detail completed while history remained working, with unnecessary terminal polling. ef06415d durable actual renderer RED `/tmp/m13-portable-terminal-red.log` EXIT1. Minimal fix polls only working receipts and invalidates owner list pages on terminal transitions; `/tmp/m13-portable-terminal-green.log` 1/1 EXIT0 verifies completed list state and no subsequent receipt poll, plus earlier owner/download/admin lifecycle assertions. Fresh build/IAB of this later fix still pending the M16 sole-heavy release. Existing browser screenshot was emitted; no fabricated local screenshot path. Browser tab left blank, host close acknowledged/EXIT0 and temporary resources removed.


### Existing owner audit consumed by the original stale filter

623079c7 actual renderer RED: after M03 publishes a real new Material revision, original Memories needs-revalidation filter sends ordinary status=stale, which M07 correctly rejects400. `/tmp/m13-memory-audit-renderer-red.log` EXIT1. This is a consumer migration defect, not a claim that ordinary Memory proof should admit stale bodies.

The original filter now uses the existing owner-only M07 /memory/audit?kind=stale signed pages and /audit/:id?version exact human-review body/evidence. No backend change. Retained statements are clearly not usable in answers; citation navigation stays within displayed retained evidence, without opening ordinary context/read, model/plugin surfaces, correction or integration controls. Selected revision and Api identity fence the review state. Existing time/search/category controls are explicitly unavailable for this audit-only contract; complete old audit filter parity remains OPEN, not silently claimed.

`/tmp/m13-memory-audit-renderer-green.log` first1/1 EXIT0. Expanded exact renderer suite `/tmp/m13-memory-audit-final-green.log`2/2 EXIT0 preserves previous publication/correction/Material/model/lost-ACK tests, adds real revision invalidation→owner audit retained body/evidence→A switch retires B review. New i18n first check lacked one reused empty-state key; corrected to existing message, final check below. No final IAB/build/affected claim for this later UI increment yet.

Owner audit i18n final `/tmp/m13-memory-audit-i18n-green.log` EXIT0,8395 messages; earlier missing empty-state key is retained in the failed first log. Final same-SHA build/IAB/affected still pending.

New audit consumer plus terminal export poll fix Web typecheck `/tmp/m13-memory-audit-typecheck.log/.exit` EXIT0 in the explicitly borrowed short slot; no server/full affected/Android run in that slot.


### M16 management original-page consumer

Own feature composed e91d381e926ecc0c7ca1077053a4ab958d12c015,1976bcf9763f03dc89d23248f4e223f44619796e,d7879a9e98a0e24cb85228e790a1dd0036ed0883. Only the management test hunk of mixed a21cc0148c96137434c74547eaede13695f89ec6 was applied as own1954b827; its unrelated backup RED was not imported. Documentation conflicts retain only the corresponding changed domain sections, without claiming unfinished CLI/backup code was composed here. Backend tests/type/affected for the resulting own combination remain pending.

56ba6620 actual renderer RED `/tmp/m13-management-route-red.log`: original diagnostics route is empty for an authenticated Web session when global status is absent. First post-route attempt `/tmp/m13-management-snapshot-red.log` only hit a fixture omission: the login grant was used without actual auth/self administrator metadata. This is excluded as a product RED. Corrected fixture performs actual M01 self discovery; with only original Diagnostics temporarily restored from committed source, `/tmp/m13-management-snapshot-valid-red.log` EXIT1 reproduces TypeError reading missing snapshot.queue.reportedPending. The pending fixed file was then restored unchanged; no peer worktree change.

`/tmp/m13-management-renderer-green.log`1/1 EXIT0: original route -> real M01 self/administrator -> M16 safe snapshot/log page -> original diagnostics metrics without private queue/index/services zeroes -> actual signed manifest checker with only external fetch substituted -> verified0.5.0, exact administrator check POST; switching ordinary B retires the administrator tree and sends no admin/old-global configuration fallback requests. Scope/coverage and unavailable instance YAML editing are explicit. No updater, deployment, real network/service or M12 action. Later copy-clipboard retirement and retained version-mismatch warning are small follow-ups awaiting the same test/type checks.

M15 independent bounded review05c+58+e57 `/tmp/mote-m15-review-m13-memory-e57.md` found no confirmed P0/P1/P2 in complete pins/current owner/recipes/retained M04 lease and original Api+body operation retry. Its own backend3/3 is separate actual evidence; it did not run Web UI or review94c audit. M13 bounded review of M16 e91/1976 and d787 is recorded in `/tmp/mote-m13-review-m16-e91-1976.md` and `/tmp/mote-m13-review-m16-d787.md`; known async reply P2 is statically closed at d787, not retroactively accepted at1976.


Management final narrow renderer `/tmp/m13-management-renderer-final-green.log`1/1 EXIT0, including the small clipboard lifecycle guard and retained version-mismatch warning. i18n `/tmp/m13-management-i18n.log/.exit` EXIT0,8401 messages. Fresh final Web/server build/type/affected and actual IAB for this management increment remain pending M16's sole-heavy gate.


### Original Activity consumer after M14 composition

ce3f2144 actual renderer RED `/tmp/m13-activity-route-red.log` EXIT1: a real M07 publication is already returned by the composed M14 work-activity API, while the original Web Activity entry renders Processing instead of goal cards. Restoring the existing Activity entry reaches a second business RED `/tmp/m13-activity-evidence-loopback-red.log` EXIT1: Memory evidence is opened as a raw capture rather than the declared M08 context reader. The first restricted attempt `/tmp/m13-activity-evidence-red.log` only failed listen EPERM before business assertions and is an environment failure, not another RED.

The original Activity component is reused with full Api identity retirement. Only Web Memory/Ask/Insight producers mark capture references as context reads; ingestion File/Image cards retain their raw-capture boundary. No backend aggregate or runtime is duplicated. `/tmp/m13-activity-memory-green.log/.exit` 5/5 EXIT0 covers the actual Material→chosen model→lost admission ACK→same operation→publication→Activity card/detail→evidence/context read chain, earlier actual Memory correction/audit/account boundaries, and three legacy Activity characterization cases. This is narrow renderer evidence; fresh type/build/IAB/full affected of the resulting candidate remain pending.


### Activity export receipt links

58fc4ea5 actual renderer RED `/tmp/m13-portable-activity-link-red.log` EXIT1: an existing completed M16 receipt cannot be selected by the exact Activity artifact URL `#/system/storage?export=<UUID>`. ScopedVault now restores only a UUID from that query and follows same-page hash navigation using its existing owner-validated receipt reader. Selecting/creating a receipt retains that query for reload. `/tmp/m13-portable-activity-link-green.log/.exit`1/1 EXIT0 includes refresh/same-page selection, completed polling stop, held A download retired on B, original admin/self deletion and B positive assertions. No new backend/download protocol. Server/Web combined typecheck `/tmp/m13-raw-browser-typecheck-green.log/.exit`0 also covers this consumer; first attempt had a new raw-album row inference error and remains failed in its separate log.


### Raw capture browser first scoped increment

90ad309e durable list/group tests and b7c1b773 image test. `/tmp/m13-raw-browser-red.log` and `valid-red.log` include invalid new fixtures (pending OCR without an image, then activity window-title content); these are excluded as list business REDs. Corrected fixtures first reach actual old endpoint503 for both list/group in `/tmp/m13-raw-browser-valid-red2.log/.exit`2/2 failed. List/group minimal GREEN `/tmp/m13-raw-browser-green2.log`2/2; initial implementation had an incorrect original-size SQL column, fixed by joining the existing owner-bound object table. `/tmp/m13-raw-image-red.log` is a valid real-M03 intake→missing original detail503 RED. First image GREEN attempt reached an invalid new disable body `enabled` rather than M01 `disabled`; fixed fixture only, not a product failure.

`/tmp/m13-raw-browser-image-green2.log/.exit`3/3 EXIT0 uses real shared SQLite, M01 accounts and M03 intake: 70 later distractors before-filter paging, complete owner/query-signed cursor rejection, original album/Session counts and app-return/gap behavior, equal UUID A/B different bytes, actual sharp thumbnail, and original A account disable behind sharp's actual async output barrier→401 JSON before image headers. Every SQL producer uses PrivateSql; images use M03 original descriptors and all immutable parts, with no global thumbnail cache. Server/Web typecheck first failed an album row inference; explicit typed row fixed it, `/tmp/m13-raw-browser-typecheck-green.log/.exit`0. This first increment does not yet close central OCR artifacts/completion, historical-source navigation or full raw-view renderer acceptance. No per-user runtime or legacy Store was restored.


Raw image follow-up confirmed a new migration race at5abd56ac: with actual sharp output held, deleting A's capture then recreating the same UUID with different M03 original bytes allowed the old thumbnail200. 3f7bb229 retains the actual RED `/tmp/m13-thumbnail-recreate-red.log/.exit` (200 !=409). The response now compares the captured original ref/hash and current raw record binding after the await and before headers; unchanged full suite `/tmp/m13-thumbnail-recreate-green.log/.exit`4/4 EXIT0 includes new A replacement and unchanged B positives. This claim concerns the new scoped adapter only; no old-system bug is asserted.


A second new adapter race is retained at ad43f472: releasing the actual M03 snapshot behind sharp's output barrier still returned thumbnail200 because a length0 original read checks metadata, not the bytes grant. `/tmp/m13-thumbnail-release-red.log/.exit` is valid200!=410. The final fence now reads one byte through the existing M03 availability/pin check before headers. `/tmp/m13-thumbnail-release-green.log/.exit`5/5 EXIT0 preserves earlier image/account/replacement positives and returns410 JSON after snapshot release. No change to M03 expiration or pin policy.


### Actual central OCR read projection

9cb3899a is the real-M01/M03/M04/M06 RED: generated PNG/worker and a successful actual processing task still leave original browser completed-filter count0 (`/tmp/m13-central-ocr-red.log/.exit`, expected1). No input record is rewritten. The new reader joins only the current visible M06 publication, exact original membership and matching ready extraction artifact; summary/image-understanding cannot substitute the OCR body. `/tmp/m13-central-ocr-green.log/.exit`6/6 EXIT0 and expanded `/tmp/m13-central-ocr-device-restart-green.log/.exit`6/6 EXIT0 include actual M06 binary transport, owner status filter/detail, unchanged raw intake, device-only ingress updates versus denied private route, different-device403, credential revoke401 and actual host restart preserving its numeric device cursor. New per-owner/device journal is a derived notification only, cleared on M03 deletion and excluded by existing portable receipt-history coverage; it never admits work. Rebuild/paging/renderer/final schema acceptance remain pending the next increment.

### Stable derived device cursor and raw renderer increment

608e03d8 retains valid future-cursor RED `/tmp/m13-ocr-cursor-rebuild-red.log/.exit`: a future numeric cursor returned200 instead of409 and could suppress later records. The fix preserves persistent per-owner/device counters, deduplicates exact capture/artifact notifications and reconciles only a bounded page of current canonical extraction. `/tmp/m13-ocr-cursor-rebuild-green.log/.exit`6/6 EXIT0; expanded `/tmp/m13-ocr-pages-green.log/.exit`6/6 EXIT0 adds three actual M06 publications through numeric one-item pages and deletion of the highest event without counter rollback. No model/task is admitted during reconciliation.

New actual React timeline/Session→M01 Web cookie→M03 original backend renderer test `/tmp/m13-raw-archive-renderer3.log/.exit`1/1 EXIT0 preserves original filter, real thumbnail Blob, captured raw references, held A response retired on B, B reload and A Session restoration. The first fixture lacked JSDOM IntersectionObserver; the second incorrectly expected OCR text in an existing image card that displays its image/title. Both are fixture assumptions, not production REDs. Only the viewport I/O is substituted; backend bodies and account authority are real. This is not full ImageProgress or IAB acceptance.

First final narrow type attempt `/tmp/m13-raw-freeze-types.log/.exit` EXIT2: new projected `ocr.status` widened to string. An explicit existing CaptureRecord return type corrects the declaration without changing behavior. Final types/scope results are retained separately. The public interface/schema and remaining limitations are in `docs/design/multiuser-capture-browser.md`.

Final narrow Server/Web types `/tmp/m13-raw-freeze-types-green.log/.exit` EXIT0; exact scope inventory/import boundary `/tmp/m13-raw-freeze-scopes.log/.exit` EXIT0. Only the explicit return-type annotation changed after the six-case run; no runtime behavior change. Full affected, builds and IAB are pending the composed candidate.

### Identical-image recreation fence

M15 independent review of0172 confirmed a distinct P2 using identical original bytes. Its durable36a9dbc3 was applied as own47405f0d. Own unchanged case `/tmp/m13-raw-identical-incarnation-red.log/.exit` EXIT1 reproduces oldthumbnail200!=409 on the actual composed backend after delete/recreate with identical UUID, ref, hash and bytes. M13 now captures the existing M08 originalReadReceipt and rechecks it before image headers; its persistent original incarnation distinguishes the recreated record. There is no new identity table/runtime, no raw/context fallback and no intake rewrite. Complete narrow actual backend `/tmp/m13-raw-incarnation-green.log/.exit`7/7 EXIT0 also preserves prior owner/image/retention/OCR/cursor cases. Types and final combined gates are tracked separately.

Identical-image fix with current M14/M16 composition Server/Web typecheck `/tmp/m13-incarnation-composed-types.log/.exit` EXIT0. The eight-second types slot is released. The M16 backup63 bounded helper review `/tmp/mote-m13-review-m16-backup-63.md` has no new confirmed finding; it does not substitute for M16's actual corruption cases.

### Same-account portable3 original Web import

Current feature composed stable M14 exact76745cc3 (including M16 import89dd/1fd and prior lifecycle/backup runtime) as c04317e4. Conflicts retain full M16 ingress synchronous merge/rollback and union the two M13 deletion tables, scope surfaces and append-only validation evidence. M16 two-table backup REDb24/fix63 are also composed as aef86400/9a74d1e6. No integration/main, M12, deployment or CI changes.

23b347c9 retains actual renderer RED `/tmp/m13-portable-import-red.log/.exit`: generated M01/M03 archive exported successfully and its original account record was deleted, while the original Vault file picker remains disabled. The thin consumer reuses the original select-file→import flow and M16's canonical import engine. It checks original deployment/account before POST, retains exact operation id/body for uncertain retries, reads owner-bound durable history/deep links on reload and reports semantic coverage; it stores no full archive in local storage and produces no fake download artifact.

First actual `/tmp/m13-portable-import-green.log/.exit`1/1 EXIT0; expanded export/import/raw renderer `/tmp/m13-portable-raw-renderer-composed.log/.exit`3/3 EXIT0 preserves existing export/hash/download/admin/self-deletion and raw filter/image/Session journeys. Import includes actual M03 deleted-record restoration, B same-ID unchanged, real admitted response ACK loss→same id/body retry, durable refresh, terminal polling stop, A file.text held across B switch, foreign-account archive rejected before POST and a genuine held domain read→user cancel→cancelled receipt. Latest same test with a synchronous in-flight event guard `/tmp/m13-portable-import-final-green.log/.exit`1/1 EXIT0.

First new i18n check lacked `取消导入`; after adding the authored English message and synchronized Android catalog, `/tmp/m13-portable-import-i18n-green.log/.exit` EXIT0 (8411 messages). Final type/build/IAB/affected and bounded review of this consumer remain separate pending checks.

Import first narrow Web typecheck `/tmp/m13-portable-import-types.log/.exit` EXIT2: the new component did not explicitly narrow the Api connection union to Web before reading its account/deployment. The same existing ScopedVault Web guard and captured immutable identity fix the declaration; `/tmp/m13-portable-import-types-green.log/.exit` EXIT0. This slot is released; fresh builds/IAB/affected are still not claimed.

### Import receipt closure review follow-up

M16 bounded review of ee4 found a malformed same-owner receipt could claim completion with empty/unfinished domain rows or a wrong phase. This was a static candidate, not a claimed M16 producer failure. e674a68f durable RED uses an actual successful M16 admission/receipt, mutating only its presentation fields before the production parser: `/tmp/m13-import-receipt-closure-red.log/.exit` EXIT1, ten malformed cases accepted (11 failures including the parent). The parser now requires unique imported/preserved coverage, exact union with all rows, preserved/complete states, exact phase and no export artifact fields. Required five canonical domains are a subset of the complete declared union, allowing explicit registered extensions without guessing authority.

`/tmp/m13-import-receipt-closure-green.log/.exit`13/13 EXIT0 includes all ten unchanged negatives and both original real import/export renderers; the additional fully declared-domain parser positive is format compatibility only, not a claim that an extra execution provider was installed. No backend policy/runtime changed. Final types/review of this small fix are separate.

Strict import receipt final Web typecheck `/tmp/m13-import-receipt-types.log/.exit` EXIT0 and unchanged i18n8411 `/tmp/m13-receipt-i18n.log/.exit` EXIT0. Slot released. This is a Web parser follow-up to the independently reported malformed-response boundary, not a new server import implementation or whole-module acceptance.

### First owned Gmail business chain

608d5365 retains the original-card actual M10 host RED `/tmp/m13-gmail-owned-red.log/.exit` EXIT1: there is no owned connection selector and the old global status path is incompatible. The new Web-only card reuses the original location and presentation with an explicit owned M10 connection, real OAuth admission and M05 task receipts. Only Google OAuth/network I/O is synthetic; M01/M04/M09/M10/M05/M03 and the renderer are production code.

Initial actual archive success in `/tmp/m13-gmail-owned-expanded.log/.exit`1/1 EXIT0 did not prove the result presentation. Adding the actual durable-task count assertion exposed a new implementation mistake in `/tmp/m13-gmail-owned-result.log/.exit` EXIT1: the consumer expected a UUID although M05 task IDs are64-character hashes. Correcting that contract yields `/tmp/m13-gmail-owned-result-green.log/.exit`1/1 EXIT0, covering OAuth→real Gmail parsing→M03 archive and real task counts, admitted sync ACK loss→same operation/body retry, A/B same connection IDs, retired A disconnect, actual A disconnect preserving archived mail, and a held A authorization response discarded on B. This is a new consumer defect, not a claim about the original single-owner system.

New message catalog synchronization `/tmp/m13-gmail-i18n.log/.exit` EXIT0 (8413). M16 owns the heavy slot, so fresh types/build/IAB/full affected are not claimed. Existing connection configuration CRUD/CAS and uncertain disconnect retry, plus Google Calendar/Lark/recordings consumers, remain OPEN. M12 handoff is now explicitly cleared by the parent; stable35d contract was read but is not yet composed here, and later M12 lifecycle REDs are not accepted.

The next unchanged renderer journey injects response-only ACK loss after the real M10 disconnect200. `/tmp/m13-gmail-disconnect-ack-red.log/.exit` EXIT1 reaches a second identical operation/body returning409 connector_command_conflict. The first operation really disconnected A and preserved its M03 archive; this is a migrated M10 operation retry defect, not an assertion about the old single-owner implementation. Fix and rerun follow separately.

b98dc625 retains that RED. The minimal existing-command branch delegates to the same M10 submit fingerprint/current-generation/account-epoch validation before any extra retirement. `/tmp/m13-gmail-disconnect-ack-green.log/.exit`1/1 EXIT0 returns the original task ID; expanded `/tmp/m13-gmail-disconnect-generation-green.log/.exit`1/1 EXIT0 also proves the connection generation advances once. No prior task input or snapshot is replaced. Current Server/Web typecheck `/tmp/m13-gmail-types.log/.exit` EXIT0; the short slot was explicitly released to M15. Targeted old M10 regression checks and independent review are recorded separately, as are final build/IAB/full affected.

Targeted existing M10 current-configuration/duplicate-sync/encrypted-Lark/disconnected-reference tests `/tmp/m13-gmail-disconnect-regressions.log/.exit`4/4 EXIT0 on a88da778. This checks neighboring admitted identity and secret revocation without claiming the entire connector suite passed.

### First authorized M12 composition

After the parent explicitly confirmed the original handoff succeeded, M13 read M12 instructions/design/validation. The newer stable4a0e82dbb28908e6ec34a6703e86fcd1229dfaf5 (runtime5172f099; contract unchanged from35d) is composed on this feature branch. Conflict resolution retains the Gmail test fixture's optional external-I/O ports, current raw journal wording, both translated catalogs, newer original Desktop native evidence and append-only domain validation records. Existing app composition preserves lifecycle/Activity/static assets/raw capture and adds Actions/Todos; no integration/main change.

Current scope/import inventory `/tmp/m13-m12-composed-scopes.log/.exit` EXIT0 and bilingual catalog `/tmp/m13-m12-composed-i18n.log/.exit`8423/0. No build/types/whole gate of this new combination is claimed yet. M12's unknown/deletion/portable fixes have only its reported narrow results; backend13-table backup retirement still belongs to M16's next actual combination. Original Actions/Todos renderer approval and already-open dialog account/revocation matrix are the next M13 consumer work.

### Original Actions fixed-review consumer RED

The first new renderer command `/tmp/m13-actions-review-red.log/.exit` failed listen EPERM before business assertions. The exact synthetic loopback fixture was then allowed by standard approval; `/tmp/m13-actions-review-loopback-red.log/.exit` is the valid business RED: real M03 evidence→M12 Harness→A/B proposals and owner targets exist, but the old modal directly calls compatibility confirm without first displaying the returned immutable review and its target account. No real provider/calendar action is used. This is a new multiuser-contract consumer gap; it does not claim the old single-owner approval flow was defective.

f2c7567f retains that RED. The original edit modal now prepares a fixed M12 review and shows its actual event, version, evidence and device/calendar/account before an explicit OQ reply; the original OwnerQuestions entry uses the same fixed-content renderer rather than its generic text composer. The server still owns fingerprints, source/target/account epochs and all grant admission. Web uses M03 registered device metadata and keeps opaque cursors encoded without numerical conversion; full paging acceptance remains a later test.

`/tmp/m13-actions-review-green.log/.exit`1/1 EXIT0 is the first real model/Harness/backend/renderer approval positive. Expanded `/tmp/m13-actions-review-matrix.log/.exit` and `/tmp/m13-actions-review-entries-matrix.log/.exit` each1/1 EXIT0 add original question entry, malformed same-owner target receipt rejected before a button, actual open B review→A retirement, retired tab rejected before transport, actual held B review→A discarded, revocation409 and account disable401 while the fixed modal is open. A approval leaves B proposed. These are scenario assertions in one genuine fixture, not artificially counted as separate tests. No real calendar I/O, grant or external account is touched.

New Web typecheck `/tmp/m13-actions-review-types.log/.exit` EXIT0; i18n `/tmp/m13-actions-review-i18n.log/.exit`8426/0. The later changes only stop terminal review polling and guard evidence navigation, exercised by the expanded test; final same-candidate type/build/full Web/IAB/affected and bounded independent review remain pending. Native bridge execution, Todo/full signed pagination and module capability OPEN rows are not accepted by this matrix.
