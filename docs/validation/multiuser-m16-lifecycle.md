# M16 lifecycle acceptance ledger (in progress)

Baseline: M14 clean composition `9bc65b53d5823443ad1ecffb49d2c6eecc687927`.
Independent clone: `task-20/mote`; branch `codex/mote-multiuser-m16-lifecycle`.
No original user data, deployment, integration/main or disabled CI was changed.
The execution host reports `guangmodeMac-Studio`; other module workspaces are
locally visible. The requested parent thread was unavailable to the app messaging
tool (`thread not found`); no report is claimed delivered by that attempt.

## Initial evidence

At production parent `9bc65b53`, RED commit
`e30e7b71d9606a9e3fea526cd49677ddfe661c46` records the missing personal export
and account deletion entry points. `/tmp/m16-lifecycle-red.log/.exit`: 0/2,
exit 1; actual routes returned 503. Subsequent implementation is not called
complete or independently accepted on the strength of this checkpoint.

The first implementation run passed deletion and failed export with
`archive_changed`: actual M06/M07 producers were still changing the archive.
The first fixture stabilization attempt incorrectly waited for every waiting
task, including `memory_window_pending`; that attempt failed after 65 seconds.
The corrected fixture waits for actual producers to settle while retaining the
legitimate scheduled intake task. This is a fixture correction, not a product
RED/GREEN claim. `/tmp/m16-lifecycle-green3.log/.exit`: 2/2, exit 0.
Server typecheck passed in `/tmp/m16-typecheck2.log/.exit` after fixing initial
TypeScript assertion-target annotations. The all-workspace/heavy gates remain
pending while M14 holds its coordinated required-check window.

## First public server contract

All routes require Wire 2 and the existing originating-session/CSRF checks.
Limited collection devices and MCP credentials do not obtain these capabilities.
The account API instance and operation UUID must be retained by consumers.

| Endpoint | Request / response |
| --- | --- |
| `POST /api/portable/exports` | `{operationId: UUID}`; idempotently creates own receipt. An ID owned by someone else is 404. |
| `GET /api/portable/exports/:id` | Own receipt only, including for an administrator. |
| `GET /api/portable/exports/:id/content` | Completed immutable JSON bytes. MIME `application/json; charset=utf-8`; attachment `mote-portable-<id>.json`; quoted SHA256 ETag; `Accept-Ranges: bytes`. |
| `POST /api/portable/exports/:id/retry` | `{}`; failed export only. Re-exports current data with the same identity, and may change bytes/hash. Old content is never a partial download. |
| `POST /api/portable/exports/:id/cancel` | `{}`; idempotent, also retires a completed download and its stored content. |
| `DELETE /api/admin/accounts/:id` | `{operationId: UUID}`; explicit administrator deletion approval, immediate account epoch revocation, metadata-only durable receipt. Last enabled administrator cannot be deleted. |
| `GET /api/admin/account-deletions/:id` | Administrator-only receipt, with no domain contents. |
| `POST /api/admin/account-deletions/:id/retry` | `{}`; continue the same approved operation; do not replay successful erasures or unknown external actions. |

Receipt common fields: `id`, `kind: export|delete`, `userId`, `deploymentId`,
`state`, ISO `createdAt/updatedAt`, `domains: {domain,state}[]`, optional fixed
`error` code. Export state is `working|completed|cancelled|failed`. Delete can
also be `pending|result_unknown|blocked`. Export receipts include
`format: mote-portable`, `version: 3`, and coverage with the exact domain IDs,
`credentials:false`, `activeAuthorization:false`, `instanceBackup:false`.
Completed export receipts additionally carry exact `bytes`, lowercase `sha256`,
`filename` and `contentType`. Each exported domain also declares its own payload
coverage/exclusions. Delete receipts carry `logicalAccessRevoked:true`; only
`completed` represents all recorded adapters returning physical completion.

No invented download expiry is introduced: content survives restart until cancel
or account deletion. Current authorization is checked on every read; a changed
account epoch is 409, and disabled/revoked credentials are 401. Other owners are
404. Missing/not-completed/corrupt content is unavailable, never an empty success.
Single bounded/suffix/open ranges are supported; malformed/unsatisfiable ranges
return 416 and `Content-Range: bytes */<size>`. A mismatched `If-Range` returns the
entire current immutable object, following HTTP range semantics.

Export uses the existing 64 MiB default/instance `maxExportBytes`, not a new user
quota. Failure is explicit (`archive_too_large`, `archive_changed`,
`domain_export_failed`, `domain_unavailable`, `interrupted`). A concurrent SQLite
write conservatively invalidates a mixed snapshot, including another user's
write; the caller can retry. There is no automatic unsafe retry or silent partial
coverage. A crashed working export needs a fresh owner-authorized retry; a crashed
deletion keeps its approved per-domain journal and needs administrator retry.

Personal portable import, whole-instance backup/restore, administration audit,
race/large-page/fault matrices, emitted-process checks, independent review,
required affected, M12/final native dependency composition and Draft PR are still
pending. This is an interface checkpoint, not M16 acceptance.

## Independent bounded reviews and fixes

M13 independently read the exact first public freeze `f24dbad6` and the
subsequent credential cleanup/reset deltas; M14 independently read the first
freeze and the credential-cleanup delta. These are bounded static reviews, not
independent test executions or complete M16 acceptance. Reports:
`/tmp/mote-m13-review-m16-f24.md`, `/tmp/mote-m13-review-m16-487.md` and
`/tmp/mote-m14-review-m16-f24.md`.

- M14 confirmed P1: a `completed` deletion retained `auth_credentials` hashes,
  CSRF hashes and device/parent metadata. Actual DELETE regression at RED
  `2a48cfe0` failed `1 !== 0`; fix `23e135ac` physically retires A's credential
  rows and account-attempt bucket in the final completion transaction. Same
  scenario passes and B's complete credential rows stay byte/state identical.
  `/tmp/m16-credential-delete-{red,green}.log/.exit`: 0/1 exit 1 → 1/1 exit 0.
- M13 identified the reset/tombstone seam. Actual administrator reset after
  completed deletion and during unknown-result deletion both returned 200 at
  RED `d8bbaf2e`; fix `487aba84` checks the persistent tombstone before password
  derivation and again inside the final transaction. Same two actual endpoints
  return 409. `/tmp/m16-reset-after-delete-{red,green}.log/.exit`: 0/2 exit 1 →
  2/2 exit 0. No login or password material is restored by these requests.
- The administrator account inventory additionally exposes only the optional
  `deletionId` for a tombstone, so a refreshed administrator can rediscover its
  durable receipt without saving private contents or inventing a new operation.

`/tmp/m16-23e-lifecycle-auth.log/.exit`: 17/17 exit 0 before the later reset and
inventory delta. That evidence does not automatically validate a later SHA.

## Offline backup development evidence

Backup RED commit `8cfd8914` invokes the existing real `scripts/backup.ts` with
an actual epoch-5 app's stopped generated data. It fails at the old epoch-4
admission. `/tmp/m16-backup-valid-red.log/.exit`: 0/1, exit 1. The earlier fixture
used the nonexistent `ingress.captures` method and is explicitly a fixture error,
not a production RED (`/tmp/m16-backup-red.log`).

The first epoch-5 CLI → existing `restoreProfile` → real app round trip passes
1/1, exit 0 in `/tmp/m16-backup-green2.log/.exit`. It preserves deployment/account
identity and exact original bytes, rejects mismatched manifest identity before
creating the target, and rejects an old login grant after restore. The earlier
green attempt failed on the operating system's `/var` → `/private/var` temporary
path alias; staging now uses its canonical owned directory. This is still WIP:
native/provider/canonical combinations, fault injection, interruption, emitted
processes and final required checks have not been accepted.

Additional old capability gap reported by M14: `scripts/client.ts` and
`scripts/import-files.ts` still use the legacy wire/Ingress, token-hash binding
and old source routes. Their old fake-fetch tests do not prove a scoped CLI
consumer. Track this explicitly in M16's old-capability closure.

## CLI M01/M03 consumer checkpoint

The existing `scripts/client.ts`, `import-files.ts` and synthetic `seed-demo.ts`
now reuse Desktop's actual `testConnection`, `ingressRequest`, account key,
connection binding and SourceSync. Confirmation precedes state/spool open;
origin/deployment/user partitions replace credential hashes. Existing nonempty
unmarked state is preserved and rejected, and token rotation cannot change owner.
Explicit selected YAML/credential file precedence remains authoritative. The
retired implicit owner access-token file and v2 POST fallback are removed.
SourceSync's local schema version 4 / ingressVersion 2 checkpoint is unchanged;
its `request.account` selects the actual wire-2 / Ingress-3 transport.

`/tmp/m16-cli-contract-red.log/.exit`: actual generated account/server/file scan
against the old CLI fails HTTP 426 (exit 1). Earlier loopback EPERM and missing
credential in the selected generated YAML were environment/fixture failures,
not production RED. `/tmp/m16-cli-green2.log/.exit`: actual scan A/B, same-owner
credential rotation, exact original SQL/FS publication and the second real
synthetic seed-demo consumer pass 1/1, exit 0. No real files/service were imported.
`/tmp/m16-cli-unit-final3.log/.exit`: 5/5, exit 0, including unchanged old outbox,
wrong owner, linked spool and offline dry run. Its one legacy v2 SourceSync test
is deliberately an algorithm characterization, not scoped protocol acceptance.
New binding test's first two attempts read the obsolete JSON state path; this
fixture error was corrected to SourceSync's actual SQLite path.

M14 bounded review found two CLI defects after b960636c (report
`/tmp/mote-m14-review-m16-cli-b960.md`): P1 startup-only self confirmation and
P2 synthetic seed image ACK missing expected-original checks. The first actual
same-URL replacement deployment accepts the generated old credential and private
POST before the fix (`/tmp/m16-cli-deployment-red.log/.exit`, 0/1 exit 1).
Each CLI request now calls the existing `assertAccountConnection` before private
transport and checks cancellation after that await. The URL, owner and selected
credential remain immutable. `/tmp/m16-cli-deployment-green.log/.exit`: 7/7 exit 0,
including replacement receiving only `/api/connections/self` and zero device rows.
This is admission checking; an already issued request cannot be retargeted or
retracted across an independent server replacement during its network flight.
The seed's actual M03 publication with response-only missing/wrong original
corruption also fails 0/2 before the fix (`/tmp/m16-cli-original-red.log/.exit`,
exit 1). It now validates the transmitted image hash, byte count and MIME after
the common envelope parser; SourceSync's existing full original ACK checks are
unchanged. A later combined log records the complete green result.

## Epoch-5 stopped instance checkpoint

`MOTE_M16_COMPILED_HOST=1 node --import tsx --test
apps/server/test/multiuser-instance-backup.test.ts
apps/server/test/multiuser-lifecycle.test.ts
apps/server/test/multiuser-auth.test.ts apps/server/test/multiuser-cli.test.ts
scripts/client.test.ts`: **31/31 exit 0**, `/tmp/m16-freeze-backup-cli-auth.log/.exit`.
The default durable process test starts the real TypeScript production entry;
the explicit compiled mode additionally used freshly built `dist/index.js` twice.
`npm run build:central`: exit 0, `/tmp/m16-central-build1.log/.exit` (before this
script-only backup delta; no later server runtime change in this checkpoint).
The earlier freeze command named nonexistent `scope-auth.test.ts`; Node selected
15 real tests and passed them, so its log is **15**, not authentication coverage.

Actual coverage: existing backup CLI and native profile restore; standalone
restore CLI; generated A/B identities, exact originals, real Memory extraction,
conversation metadata, user YAML, completed tasks; actual native Mem0 SDK vector,
operation and history SQLite files; fixed installed package validation; unchanged
succeeded/issued external journals; old retry grants rejected; two compiled host
starts/stops without old model work. Faults cover missing/damaged files, linked
files, traversal, rehashed wrong database deployment, mismatched expected identity,
nonempty target preservation, live Central PID and a self-consistent manifest
omitting required native vectors. Source and target are always disposable.

The valid extra RED `/tmp/m16-backup-combined-red3.log/.exit` is restored Memory
`desired=2` rather than 0; stage restoration now pauses automatic admission in
SQL and its authoritative user YAML. Its prior source-kind conflict and nonexistent
`execution_steps.result` were fixture errors. Native first attempt found the real
scoped YAML domain is `pluginInstances`; the old `plugins` rewrite left old desired
state and correctly failed `config_prepare_failed`. This was corrected, and all
temporary diagnostic instrumentation was removed. `/tmp/m16-backup-native2.log`
and the final 31-case log pass; no debug production change remains.

The existing Hindsight owned-volume snapshot/restore implementation is reused,
but actual M16 Docker/native-volume validation is **not run**: sandbox socket
access first failed; an approved read-only image check then confirmed the Docker
daemon is unavailable (exit 1). No daemon was started, image pulled, system setting
changed or existing volume inspected. Epoch-5 Docker profile restore remains an
explicit pre-write rejection; portable import, M12 and final M15 composition,
management boundaries, independent backup review and final required checks remain
OPEN. This green checkpoint closes the inherited epoch-5 backup RED, not M16.

## Registry change during physical erasure

A real registered extension adding a private domain while deletion was running
could leave A's rows and still produce `completed`. The generated actual DELETE
regression fails 0/1 in `/tmp/m16-delete-registry-red.log/.exit` (exit 1).
Completion now rechecks the registered domain set. A changed registry yields
`blocked/domain_registry_changed`; explicit administrator retry adds durable
per-domain grants under the existing approved account operation, retaining prior
completed domains and missing-domain blockers. `/tmp/m16-delete-registry-green.log/.exit`:
lifecycle + authentication **18/18 exit 0**, A late-domain rows erased once, B
unchanged, no grant or private-query delegation to the administrator. No export
receipt or content protocol changed. Backup checkpoint f33 remains separately
reviewable; this later server delta requires its own final composition checks.

## Management boundary checkpoint

The original management path first fails actual scoped admission in
`/tmp/m16-management-red.log/.exit` (0/1 exit 1, ordinary 503 rather than a real
administrator-only feature). The implementation reuses `createUpdateService` and
bounded `ServerDiagnostics`, with explicit production import/inventory declarations.
`/tmp/m16-management-lifecycle-green.log/.exit`: **25/25 exit 0**, actual M01
ordinary/admin/unauthenticated routes, real signed release parser with generated
RSA envelope and response-only network fixture, no startup network, rejected
repository selector, administrator disable during held response, unchanged B,
private trace/token/user ID exclusion from logs/pages/events/support, own M03 GC
and cross-owner rejection, linked diagnostic storage preserving sentinel bytes/mode,
plus adjacent lifecycle/auth and original update-service behavior. No updater,
deployment, real third-party request or system configuration was invoked.

Server typecheck and scope inventory/import-boundary check exit 0 in
`/tmp/m16-management-types2.log/.exit` and
`/tmp/m16-management-scope-green2.log/.exit` (prior to later test/comment-only edits).
`node --test scripts/update-tests.mjs`: 12/12 exit 0,
`/tmp/m16-update-adjacent1.log/.exit`, including ordinary unbuilt Docker profile
commands after adding the new backup helper to the generated release fixture.
Management adds no private trace or old queue/index statistics impersonation. The
Web/Android original diagnostic consumers must recognize the declared metadata
coverage; this checkpoint does not claim their complete UI or final required gate.

First required affected attempt at 1976bcf9 exits **1** during root tools TypeScript
checking, before the full test workspaces or Android stage:
`/tmp/m16-required-affected-first.log/.exit`. Missing `scoped-backup.d.mts`
(TS7016) and a test-only SourceRequest GET call with too few arguments (TS2554)
are tooling/type integration failures. The explicit public declaration and full
GET arguments fix them without runtime behavior changes. A root typecheck green
and later required retry are separate evidence; the failed attempt is retained.

## Required retry and backup completeness corrections

Second required at `8eb07ad281f919717f978e68c9d921f3d58d281a` completed
**exit 1**, `/tmp/m16-required-affected-second.log/.exit`. Desktop: 476/484,
seven old v2 fake-HTTP CLI fixtures and one absent local Electron binary; Server:
2511 pass, one backup/cold-user configuration failure, one existing opt-in OS
sandbox skip (2513 total); Web: 490/490; Agent: 317 pass/1 existing skip, Diagnostics: 5/5 and
Shared: 192/192. Root test commands after the failed workspaces and actual Android
were not reached. These failures are retained, not replaced by narrow green claims.

The cold-user failure is a production backup admission defect: `GET /api/usage`
may create `user_configuration_state` before ConfigService initializes a YAML file.
Only unchanged, never-initialized defaults without durable model/configuration
provenance may omit that file. A materialized configuration remains mandatory.

Additional actual regressions, committed in `39c203a2`, produced **0/3 exit 1** in
`/tmp/m16-backup-completeness-red.log/.exit`: an actual completed Ask turn was
backed up, then dropping `ma_turns` and regenerating the outer SQLite checksum was
incorrectly accepted; Docker's real runtime COPY projection omitted the new
helper, preventing even backup `--help`; and a cold account's usage metadata
incorrectly prevented backup. The first temporary schema attempt failed module
loading and is not product RED. The valid temporary schema RED is
`/tmp/m16-backup-schema-red2.log/.exit`.

Stopped backup admission now requires the current production epoch-5 table and
column contract in `scoped-backup-schema.mjs`, while preserving additional
extension tables/columns. Missing turns, a renamed result column and an omitted
unused domain table all fail before target publication. A real restored
conversation returns its saved answer through the authenticated conversation HTTP
entry, beyond the earlier metadata-only conversation check. Docker copies the
backup/restore helpers and schema; fixed package verification consumes the shipped
compiled release verifier when TypeScript source is absent. Docker runtime file
projection is not a Docker daemon/image/volume run.

`node --import tsx --test apps/server/test/multiuser-instance-backup.test.ts`:
**8/8 exit 0**, `/tmp/m16-backup-completeness-green2.log/.exit`. Its prior green1
was 7/8: a new test interpreted a single-file Docker COPY destination as a directory;
that test projection bug was corrected. The product missing-helper RED remains
valid. Compiled package projection and fresh compiled production restart are
separate checks, still pending at this writing. Server/tools typechecks exit 0 in
`/tmp/m16-backup-{server,tools}-types.log/.exit`; update/profile adjacent tests:
12/12 exit 0, `/tmp/m16-backup-update-adjacent.log/.exit`.

The seven original CLI scenarios now use actual generated M01/M03 hosts, SQLite,
files and child CLI processes: account-isolated profiles; lost real commit ACK
with no duplicate canonical capture; explicit deletion/restoration; dead-process
lock recovery in the stable account partition; A pending original/B new scan;
reference with zero originals; dry-run/consent; and multipart directory paging.
Only the real HTTP response is dropped after publication for the ACK fault.
`/tmp/m16-cli-desktop-real3.log/.exit`: **7/7 exit 0**. The first migrated run was
6/7: the old fake accepted a 17 MiB snapshot despite the existing shared 16 MiB
snapshot contract. The paging case now explicitly requests archive (five full/
partial original parts plus the next file), without changing runtime limits or
adding an automatic retention fallback. An intervening command used the wrong
working-directory path for this test edit, so real2 repeated that same failure;
it is not a second product defect.

The omitted npm-install Electron distribution was restored only inside this
clone's ignored dependencies from the already-installed same version 41.10.7.
Executable SHA-256 on both copies:
`0c23b9764481d57cd769318ec81b42e8337ed7d1cad241b82592d88a80ef8a64`.
The original hidden Electron tests pass 2/2 in
`/tmp/m16-cli-desktop-real2.log` (that command still failed its old paging case).
No window was shown or system permission changed. Full required retry remains
mandatory after these runtime and test corrections. Personal import, M12,
Docker native-volume evidence and independent backup/management review remain OPEN.

At clean `05e434ee6904a95b50ed0f16195e3baec483493f`, fresh
`npm run build:central` exits 0 (`/tmp/m16-central-build2.log/.exit`). Then
`MOTE_M16_COMPILED_HOST=1 MOTE_M16_PACKAGED_BACKUP=1 node --import tsx --test
apps/server/test/multiuser-instance-backup.test.ts`: **8/8 exit 0**,
`/tmp/m16-backup-compiled-packaged-green.log/.exit`. This starts/stops/restarts
actual compiled `dist/index.js` against the restored temporary instance twice.
The native Mem0 scenario additionally runs both backup and restore CLIs from a
runtime projection containing the Docker COPY files and compiled server,
without server TypeScript source; it verifies installed fixed packages, actual
SDK SQLite state, preserved Memory rows and retired plugin snapshots. This is
compiled package/entry proof, not a container image/daemon or native Hindsight
volume proof. The optional flags select these explicit integration checks; the
default full suite also executes the source-host backup cases.


## Third gate and subsequent independently discovered boundaries

The complete required command at clean `ce9b832f565f6f128cc7159ed3a068e67d233acd`
exited **0**, `/tmp/m16-required-affected-third.log/.exit`: Desktop 484/484,
Server 2515 passed, zero failed and one existing opt-in OS sandbox skip; Web
490/490; all other workspaces/root checks and the actual Android JVM task passed
(`BUILD SUCCESSFUL`, 49 seconds, 25 executed tasks). This result covers that
candidate, not the later fixes below.

M15 independently found that two diagnostic attachment handlers awaited real
file I/O and then called `reply.send` before the shared authorization wrapper's
final check. Durable generated-account/actual-file barriers revoke the original
administrator during that read and previously received 200 on both `/logs` and
`/support-bundle`. Two additional real archive faults bypassed complete-original
verification: a future manifest date hid an unexpired snapshot, and an expired
snapshot with a live M03 physical pin was ignored. A canonical configuration
owner containing `../../../outside` also selected a generated sibling YAML
outside the archive. With regenerated manifest checksums these were accepted.
The combined actual RED is **five failures/one positive**, exit 1,
`/tmp/m16-retirement-owner-snapshot-red.log/.exit`, committed as `a21cc014`.

`d7879a9e` asserts the captured administrator after the last await and before
headers, then returns an unsent payload for the existing wrapper to authorize
before serialization. `9797ca15` validates known SQL owner namespaces against
real account identities before filesystem resolution, preserving the shared
executor/operation empty-owner catalogs. Original completeness uses the earlier
of manifest time and current time, and includes active same-owner/hash physical
pins; expired unpinned metadata retains its existing unavailable/410 behavior.
It does not renew snapshot deadlines, collector grants or execution permissions.
The combined source suites passed **17/17**, exit 0,
`/tmp/m16-retirement-owner-snapshot-green.log/.exit`; additional traversal,
well-formed orphan and unsafe-account rejection passed **3/3**, exit 0,
`/tmp/m16-backup-owner-extra-green.log/.exit`. All rejected restore targets remain
absent. The expanded final suite contains those additional owner cases.

At `9797ca15`, fresh `npm run build:central` exited 0,
`/tmp/m16-central-build3.log/.exit`; explicit compiled-host/packaged-CLI backup
suite passed **14/14**, exit 0,
`/tmp/m16-backup-compiled-packaged-final.log/.exit`. It again exercises actual
compiled process recovery and both CLI entry points without server TS sources.
M13 independently reviewed the management fix (`/tmp/mote-m13-review-m16-d787.md`)
and M15 reviewed the backup delta (`/tmp/mote-m15-review-m16-9797.md`); neither
found a new confirmed P0/P1/P2. These are bounded static reviews, not independent
reruns or whole-module acceptance. A fresh full required check remains mandatory.

Personal import remains OPEN: the current adapters restore only their original
identity and either an empty target or an identical replay, while the original
personal import merged/deduplicated data. Host identity mapping and per-domain
merge contracts must be defined before those hooks can safely expose that
capability. The M12 handoff remains unauthorized. No missing domain is treated as
successful, and neither this gate nor a draft PR means M16/project acceptance.

## Personal import implementation checkpoint (not final acceptance)

This supersedes the earlier OPEN identity decision: the user approved only the
original deployment/account and canonical merge/dedup. The actual public endpoint
was first RED 3/3 at `0499fe5c`, `/tmp/m16-personal-import-first-red.log` (exit 1,
missing production import entry), before its implementation.

The current narrow actual-host suite is 12/12, exit 0:
`node --import tsx --test apps/server/test/multiuser-portable-import.test.ts`,
`/tmp/m16-personal-import-twelve.log`. It exercises original bytes and missing
sources, B unchanged, duplicate/restart receipts, actual Memory/model completion
and saved conversations, deletion then reimport, current grant/policy/model-call
preservation, real-domain-read barriers for cancel/disable/logout/restart,
wrong owner/deployment/version/coverage rejection, later-domain SQL/FS rollback,
newer source-head/retired Material preservation, valid source identity conflict,
corrupt original bytes, changed retry input, empty owner and cursor-bound pages.
A conflict fixture initially changed deviceId while leaving its captures tied to
the previous device; it was correctly invalid_data rather than a valid immutable
conflict. That assertion failure is retained in the boundaries-first log; the
corrected source-kind conflict reaches archive_conflict and passes. It is not a
production RED. Barrier cleanup is registered before host close to avoid a failed
assertion stranding the generated provider.

Server typecheck exits 0 (`/tmp/m16-personal-import-types2.log`); scope inventory
and production import boundary exit 0. The new import list/receipt/control routes
and private original rollback directory admission are explicitly inventoried.
`ig_state` restore/delete now names its existing columns for compatibility with
M13's proposed derived notification column; no unreviewed journal is assumed.

This public checkpoint still needs independent review, adjacent adapter checks,
real original UI consumers and a new combined required/build window. The ec6
required result does not cover this runtime. M12 remains unavailable by the
explicit handoff restriction; Docker publication/native-volume limitations and
final all-module joint validation remain separate OPEN items.

Existing domain adapter adjacent journeys also pass 11/11, exit 0:
`node --import tsx --test --test-concurrency=1 --test-name-pattern='restore|portable|lifecycle' apps/server/test/multiuser-ask.test.ts apps/server/test/multiuser-memory.test.ts apps/server/test/multiuser-ingress.test.ts apps/server/test/multiuser-processing.test.ts`,
`/tmp/m16-personal-import-adapter-adjacent.log`. These include real external Memory
historical-body export/stale builtin restore, held provider deletion, original
identity stitching rejection and processing publication/hash parents. They are
adjacent adapter evidence, not a full server or all-module acceptance run.

### Actual earlier-instance/later-personal-data restart correction

A new end-to-end case takes an actual stopped instance backup before a generated
Material, exports that later Material under the same account/deployment, restores
the earlier instance, logs in again (old credentials correctly rejected), imports
the later portable archive, then restarts the real host. At `dd284ad0` it reaches
its intended assertion and fails: import-time suppression leaves zero new events,
but the repeated Ask schema backfill creates an insights notification on restart.
`/tmp/m16-import-restart-notification-red.log` is exit 1, 1/1 valid RED. This proves
a new automatic-input notification, not an executed external/model action.

The correction runs the canonical automation-event backfill only when installing
that journal table for the first time, in the same SQLite savepoint as schema and
cursor initialization. Existing normal publication triggers are retained. A
positive migration case reconstructs the real pre-journal schema checkpoint,
proves first install seeds the existing Material exactly once, restart does not
reseed it, and later real publication still produces a normal notification.
The two focused cases pass 2/2 (`/tmp/m16-import-restart-notification-green.log`),
followed by the final full personal-import suite recorded separately. No new
policy, task runtime, external replay or M12 interaction is added.

After the atomic migration correction, all personal import cases pass 14/14,
exit 0 in `/tmp/m16-personal-import-fourteen.log`; no skip. Scope inventory and
production boundary check also exit 0. This remains narrow evidence awaiting the
new combined required/build and current UI consumer acceptance.

Current composed automatic-policy adjacent checks pass 12/12, exit 0:
`node --import tsx --test --test-concurrency=1 --test-name-pattern='policy|automatic|automations|owner policy' apps/server/test/multiuser-memory.test.ts apps/server/test/multiuser-ask.test.ts`,
`/tmp/m16-import-automation-adjacent.log` (112 seconds, including the original
61-second actual Insight interval). Existing normal automatic M06/Memory/Ask
publication, pause/stop, owner questions and successful-window restart behavior
remain exercised. No live model/provider was called; the generated HTTP provider
is the external service replacement.

## M13 device notification journal composition

Consumed pure server `0172bf14bef8ef6699beff8915715ea3267570ee` as
`515fc169`: keep the full M16 ingress merge/rollback adapter and add the two
M03 deletion tables; retain both scope declarations and take the full new actual
raw reader test. No M12 or peer Web WIP was consumed.

Required stopped-backup schema now includes all columns of
`ig_capture_update_sequences` and `ig_capture_updates` (160 required tables).
The offline verifier also checks the existing domain invariant: counters and
sequences are safe nonnegative/positive integers, every event has its matching
owner/device counter, and the counter is at least every surviving sequence. A
counter higher than the last surviving event is deliberately retained, never
rebuilt from MAX(sequence).

Durable RED `b24ec6b8` uses actual generated M06 OCR publications twice, deletes
the highest capture, makes a stopped instance backup, restores it and proves exact
journal/counter rows plus an authorized unchanged cursor=2 read. Then six damaged
copies have valid refreshed database checksums but lose either table, artifact
column, counter row, or rewind/negate the counter. All six unexpectedly published
before the fix: `/tmp/m16-backup-derived-red.log`, exit 1 (six subcase failures
plus the parent). After schema/invariant admission they all reject before target
creation and the valid round trip remains exact: 7/7, exit 0,
`/tmp/m16-backup-derived-green.log`. No business or storage I/O was mocked; the
only replacement was the external generated HTTP OCR service. Scope check exits 0.

The current combined source-host backup/import check passes 37/37, exit 0:
`node --import tsx --test --test-concurrency=1 apps/server/test/multiuser-instance-backup.test.ts apps/server/test/multiuser-backup-capture-updates.test.ts apps/server/test/multiuser-portable-import.test.ts`,
`/tmp/m16-import-backup-composed-source.log` (49 seconds). This includes real
native Mem0 SDK canonical bodies, current saved conversations, original files,
paused automatic authority, succeeded/unknown external journals, all new device
cursor corruption cases, and personal-import restart fences. This invocation uses
the source host; fresh compiled/package-host verification remains a distinct final
build step. It does not execute Docker daemon/native Hindsight recovery.


## Final consumer candidate and compiled checkpoint

Candidate `589d6ad7c4a36de21cb105a7be41a599d0fae1df` adds only the frozen
consumer increments after the earlier source-host 37/37 checkpoint:

- M13 original Web picker `23b347c9`/`ee4bb999` plus actual malformed import
  receipt RED `e674a68f` and fix `5df66796`. The bounded M16 review initially
  reported the completed-domain closure P2; unique complete declared coverage,
  per-domain states, exact phase and no-artifact validation now close it. Root
  picks are `21c834bc`, `b1f2fa33`, `1809c5d1`, `822eda00`.
- M14 actual named-source reader RED `ace31bdf` and fix `ceae83a5`: actual
  owned source inventory and exact original binding replace a guessed source.
  Root picks `c5d55633`/`6c186a64`; static review found no additional confirmed
  P0/P1/P2. M14's same actual two cases pass, including image and raw detail.
- M15 device-only OCR RED `d83705d1` and fix `2ff31228`, plus visible archive
  account-resume RED `ac16d97e` and fix `10a1de3d`; root picks
  `0cef4324`/`b2adce9c` and `2108df2f`/`589d6ad7`. Bounded M16 reviews found
  no additional confirmed issue. Native original-entry positives remain M15's
  executed evidence; this review did not rerun an emulator or physical device.

Only the incoming commits' new validation sections were appended when peer
history differed; the existing root history and runtime adapters were retained.
Shared/Android bilingual catalogs agree at 8421 keys, and the scope checker exits
0. An initial manually typed nonexistent `check-scope-inventory.mjs` command
failed MODULE_NOT_FOUND without running a checker; the actual
`node scripts/check-scope-contracts.mjs` then passed. This is a verification-command
correction, not a product failure or a skipped check.

Fresh `npm run build:central` at this candidate exits 0,
`/tmp/m16-final-central-build.log/.exit`. The existing Vite large-chunk advisory
is nonfatal. Then:

```
MOTE_M16_COMPILED_HOST=1 MOTE_M16_PACKAGED_BACKUP=1 node --import tsx --test --test-concurrency=1 apps/server/test/multiuser-instance-backup.test.ts apps/server/test/multiuser-backup-capture-updates.test.ts
```

passes **23/23, exit 0, no skips** in 24 seconds,
`/tmp/m16-final-compiled-backup.log/.exit`. The primary instance suite uses the
fresh compiled production process and package CLI projection, including process
restart, actual native Mem0 SDK canonical data, conversations, original files,
execution retirement and successful/unknown external journals. The appended
capture-journal suite exercises the actual source host and stopped archive helper;
it is not mislabeled as a second compiled-host test. No real Docker daemon/volume
or native Hindsight recovery was exercised. Required affected is a separate
ongoing command recorded after completion.


### Fifth required failure: duplicate CLI admission after composition

`npm run check:affected -- --base origin/codex/mote-multiuser-integration`
with the documented installed JDK21/SDK exits **1** at runtime candidate
`589d6ad7`; `/tmp/m16-required-affected-fifth.log/.exit`.
Desktop 492/492, Server 2562 pass/0 fail plus the existing default macOS sandbox
opt-in skip (2563 total), Web 505/505 and the other workspaces/root 81-case
suite passed before the final root client suite failed 1/5. Android JVM and the
later Central runner were not reached. This command is not a passed required
gate. Documentation-only commit `af7d0fb8` does not alter that runtime evidence.

The real composition combines M16's older outer fresh-self call with M14 c18's
new per-request shared-transport admission. One private read therefore performs
two identical fresh checks rather than the expected one. This is a composition
responsibility defect, not an environmental permission failure. The production
regression already failed `4 !== 3`; durable `8fd349ac` strengthens it to the
exact path sequence and reproduces the extra self request in
`/tmp/m16-cli-shared-admission-red.log`, exit 1. The fix removes only the CLI
wrapper's duplicated handshake/import. Shared `ingressRequest` retains stable
account validation, fresh self and pre/post-await abort checks for every actual
private HTTP request. No startup-only authorization or weaker replay boundary is
introduced. The unchanged sequence then passes the complete root client suite
5/5, exit 0, `/tmp/m16-cli-shared-admission-green.log`. Actual M01/M03 CLI
replacement-deployment/original-ACK cases and the new required run are recorded
separately after completion.

Heavy work was explicitly released when the failed command ended, before the
queued Android narrow checks; the planned Desktop build was postponed. No
healthy test was restarted due to the platform disconnection notification.


## Authorized M12 archive composition

Merged M12 public `4a0e82dbb28908e6ec34a6703e86fcd1229dfaf5` as `bed65864`
after its own actual lifecycle/portable RED→GREEN and bounded review. No conflict
or default-domain fallback was introduced. Todos uses the existing synchronous
canonical transaction; Actions explicitly preserves its current personal state.
This follows the original JSON-v2 `EvidenceStore.exportArchive/importArchive`
Todos section. The companion `archive-export.ts` bundle is a different v1 format;
its name is not evidence of the JSON-v2 version.

New durable backup RED `2affb338` runs real A/B M03→M06→M12 model publication,
approval, actual M05 issuance and succeeded/uncertain native receipts, plus manual
Todos with different states. `/tmp/m16-backup-actions-red.log/.exit` exits 1:
17 total, 1 already rejected by the existing foreign-key boundary and 16 failures
(including the parent). The restored inherited instance policy remained enabled;
fourteen incomplete table/column cases incorrectly published. These are actual
production-path failures, not a failed fixture or skipped input.

The minimal existing-helper correction adds the 13 exact required table/column
sets and retires Actions authority in both inherited/private YAML and SQL before
publication. No claimed flag, issuance ID, native event ID, ACK or task linkage is
cleared to allow replay; Todos and completed model history retain exact bytes.
The same test passes **17/17, exit 0, no skips** in 13 seconds,
`/tmp/m16-backup-actions-green.log/.exit`: all thirteen individually dropped tables
and two renamed mandatory columns reject before target publication, while the
positive recovery preserves A/B canonical data and external facts, rejects old
credentials and remains inactive through two actual source-host process restarts.
A fresh compiled-host pass and final combined required remain necessary after
this runtime increment.

CLI responsibility correction `7fb3d4be` additionally passes the actual M01/M03
CLI plus root-client combination **9/9, exit 0**, including same-URL replacement
with only self/zero private body and missing/wrong original ACK rejection;
`/tmp/m16-cli-shared-admission-composed.log/.exit`. Independent M13 bounded review
finds no new confirmed issue in that two-line transport delegation.
