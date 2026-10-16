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
