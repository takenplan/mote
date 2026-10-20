# Desktop queue and browse parity

Scope: DESKTOP-D1–D4 plus the related DESKTOP-S1 authorization consumer. Fixed
starting point: `2c78ca8d52a7d17fae20962cf68d09a717ffc73a`; historical comparison:
`2c2627621e2598332ae8169845bc7343be7ed63e`. Branch:
`codex/parity-desktop-20261018`. This is module author evidence, not independent
acceptance, integration, a release or a deployment claim.

## Behavior and regression journeys

| Finding | Implementation and generated production-entry coverage |
| --- | --- |
| D1 | Account SourceSync reports individual ACK/rejection results. A real reference ACK before a simulated network disconnect settles durably; restart preserves the remaining exact revisions, a competing head produces a real 409, only that version is quarantined, and the next batch completes. A genuine owner forget produces 410 without blocking sibling versions or same-ID B. 429/503/507 defer only their version. A mid-request source pause retains the pending versions. |
| D1 lifecycle | Real transport slices settle accepted reference progress before yielding. SyncHistory preserves interrupted status for yield/abort and 401/403 diagnostics for the remaining attempted version. Earlier received history remains received. |
| D2 | LocalSourceManager scans a generated file larger than one part, persists its original spool, loses a part request or a successful commit response, then resumes after a generated >24h session expiry and real local source/backend restart. The request key/revision remains identical; unfinished transport gets a fresh attempt, committed intake returns its durable ACK, and capture count remains one. |
| D2 in flight | Reference and archive sessions expire after begin but before part/commit. HTTP409 `upload_expired` retains the immutable version for normal retry; it is not quarantined as a permanent conflict. No user-created revision or manual GC is needed. |
| D2 server boundary | Real scoped HTTP verifies equal owner/source/request IDs in two accounts, manifest/predecessor conflicts, old-attempt late commit rejection, disabled source, revoked credential, authorization epoch, deleted inputs, snapshot deadlines and nonrenewable recovery grants. |
| D3 | 65 generated captures require one limit-30 request per content/record page. The signed server cursor is forwarded unchanged and remains stable after a leading insert. Same-ID B and changed query reject A's cursor. 31 Sessions and a 35-member Session use the server Sessions/member cursors without reconstructing all daily captures. |
| D4 | A generated JPEG with no OCR/preview text shows exactly the server original byte size. Same-ID B with different bytes/text retains its own size and content. |
| S1 / isolation | Real account confirmation401 and device-bound archive403 return authorizationDenied. The content UI closes central detail, clears private DOM and rejects held late content on this contract. Actual emitted main/preload rejects held A page/detail after B login; B sees only B's same-ID body, retired A document rejects, and a revoked B feed returns authorizationDenied. Existing startup/late-ACK fixtures also cover account switch, SIGKILL/restart, stable deployment and old source bytes. |

All accounts, files, image pixels and transport failures are generated. Tests use
the real scoped application, SQLite, queue, source scanner/manager, transport,
main/preload and content UI where named. HTTP is loopback or injected directly
into the production Fastify host. Expiry fixtures alter only the generated owner's
`ig_uploads.expires`; they do not advance credential/task clocks or wait 24 hours.
The reference-forget setup calls the actual owner-bound ingress forgetting
service because the missing reference Files entry is owned by the Files module.
It does not mock the upload rejection or bypass its real admission checks.
The emitted-main fixture replaces native I/O and windows; it is not a physical
or Electron-native validation claim.

## Executed checks

Runtime: Node `v26.11.1`, ABI `147`, macOS arm64. Dependencies are installed in the
independent worktree using the unchanged lockfile. `npm ci --ignore-scripts`
completed (exit0), then the allocated P007 preparation ran
`npm rebuild better-sqlite3` and `npm rebuild electron` (both exit0). The Server and
Mem0/oss resolvers each created and queried their actual better-sqlite3 memory
database; the environment checker confirms the Electron executable is present.
No node_modules/dist sharing or lockfile change was used.

| Command / input | Actual result and evidence |
| --- | --- |
| `npm run build:libs` | exit0; `/tmp/mote-parity-desktop-libs.log` |
| `node scripts/release/check-environment.mjs --workspace @mote/server --workspace @mote/desktop` | exit0; `/tmp/mote-parity-desktop-native-preflight-green.log`; resolver details `/tmp/mote-parity-desktop-native-resolvers.log` |
| `node --import tsx --test --test-concurrency=1 --test-timeout=120000 apps/server/test/multiuser-ingress.test.ts apps/server/test/multiuser-snapshot-recovery.test.ts` | 29/29, exit0, no skips; `/tmp/mote-parity-desktop-ingress-complete.log` |
| `node --import tsx --test --test-name-pattern='ordinary retry after more than a day' apps/server/test/multiuser-ingress.test.ts` | 1/1, exit0; explicit upload_expired response contract, `/tmp/mote-parity-desktop-expiry-contract.log` |
| `npm run test -w @mote/desktop -- source-sync-batch source-account-retry central-browse-parity content-library-ui multiuser-desktop` | 83/83, five files, exit0, no skips; `/tmp/mote-parity-desktop-journeys-final.log` |
| `npm run typecheck -w @mote/desktop` | exit0; `/tmp/mote-parity-desktop-type-final2.log` |
| `npm run typecheck -w @mote/server` | exit0; `/tmp/mote-parity-desktop-server-type-green.log` |
| `npm run test -w @mote/desktop -- source-account-retry` | 14/14, exit0; `/tmp/mote-parity-desktop-source-retry-complete.log` |
| `npm run test -w @mote/desktop -- central-browse-parity` | 4/4, exit0; `/tmp/mote-parity-desktop-central-browse.log` |
| `npm run test -w @mote/desktop -- content-library-ui` | 11/11, exit0; `/tmp/mote-parity-desktop-content-ui-review.log` |
| `npm run test -w @mote/desktop -- multiuser-desktop -t 'keeps scoped content/record'` | 1/1 selected case, exit0; 36 cases deliberately excluded by the pattern, not claimed run; `/tmp/mote-parity-desktop-main-browse-green.log` |

The in-flight-expiry regression first failed both reference/archive cases because
the old generic409 was quarantined and flush resolved successfully:
`/tmp/mote-parity-desktop-mid-expiry-red.log`. Both pass in the 14-case run after
the producer error and consumer classification correction. Initial new fixture
failures involved a twice-consumed request stream, invalid test contentVersion,
source UI timestamp equality and an incorrect held-detail route/error-message
expectation. They are retained in `/tmp/mote-parity-desktop-source-retry*.log`,
`/tmp/mote-parity-desktop-journeys.log` and
`/tmp/mote-parity-desktop-main-browse.log`; they are not counted as product REDs
or successful runs. The first server typecheck after adding upload_expired found
its missing declared error union; that type is included in the final candidate.

Combined Desktop journeys and final typechecks pass as recorded above; the
frozen candidate and affected-component gate status are recorded in the module handoff. The affected
plan selects Desktop, Server and Web. A dry-run is a plan, not a passing gate.
Android's real Worker consumption of the D2 producer belongs to the coordinated
Android candidate and independent acceptance; this document does not claim it.

## Remaining validation boundary

The required final `npm run check:affected -- --base
2c78ca8d52a7d17fae20962cf68d09a717ffc73a` remains queued through the integration
driver until an execution slot is assigned. A Draft PR is not opened before that
command passes. Final cross-module checks and independent acceptance are owned
by the integration/acceptance chats.

Physical devices, real personal screenshots, macOS privacy prompts, real sleep or
lock transitions, live providers/models, production data reprocessing, migration,
release and deployment were not run. No personal screenshots were collected or
transmitted. Snapshot byte authorization and external unknown-outcome boundaries
remain unchanged. See the [current capability ledger](../design/multiuser-desktop.md)
and [Ingress contract](../design/multiuser-ingress.md) for the supersession table.
