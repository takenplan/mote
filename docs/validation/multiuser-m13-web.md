# M13 Web validation — incomplete checkpoint

Baseline M08 PR13758944f00837c89bc1d302ecd7be7a568db4abe44 includes accepted
M07 PR136cd7a306cce0f6cd5fec3c9e91e6dee0761352115 and public-contract PR135.
Own branch codex/mote-multiuser-m13-web, independent task17 clone. No dirty main
workspace used, no integration/main mutation, no PR/push/merge/deploy/CI action.
M11/M12 final heads not composed; final remote SHA verification not performed.
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
   M11 final affected; no M13 full gate has started or been counted passed.
5. Push own branch and create/attach Draft PR to integration only after acceptance;
   final remote head/base SHA checks. No PR URL exists at this checkpoint.

Last independent narrow checkpoint at runtime5438b1ce:
`node --import tsx --test apps/web/test/multiuser-api.test.ts apps/web/test/multiuser-web-auth.test.ts apps/web/test/login-handoff.test.ts apps/web/test/note-attachments.test.ts apps/server/test/multiuser-web.test.ts`
20/20,0skip/fail/cancel,EXIT0,6810.550625ms,
`/tmp/m13-final-narrow-checkpoint.log/.exit`. This is not the complete Web suite.
Parent subsequently paused M12 at a clean non-final checkpoint; its contract
handoff was denied pending explicit user authorization. No proxy transfer or
wake-up of M12 is performed. Current three slots are M11/M13/M14; M11 holds heavy.
