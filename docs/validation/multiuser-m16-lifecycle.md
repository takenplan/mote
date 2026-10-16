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
