# M16 lifecycle and archive boundaries

This work starts at the clean M14 composition `9bc65b53d5823443ad1ecffb49d2c6eecc687927`.
All runtime validation uses generated accounts and disposable directories. The
M12 handoff is not authorized; its interface and final composition are pending.

| Disposition | Original capability | M16 responsibility |
| --- | --- | --- |
| KEEP | Domain export/delete/restore adapters, account epochs, task fences, external journals, fixed plugin releases and existing original layout | Invoke registered adapters through purpose-bound lifecycle grants. Retain unknown external outcomes. |
| KEEP | `npm run backup`, stopped-vault verification, SQLite backup including WAL, checksums, private modes and empty-target staged restore | Extend the existing entry and profile tooling to epoch 5; preserve deployment/account identities and canonical data. |
| CHANGE | Owner JSON v2 and metadata/data export buttons | Portable 3 explicitly identifies the current account, deployment, registered domains and exclusions; no reusable credential is portable. |
| CHANGE | Account disable and domain-local deletion | Durable account deletion revokes before cleanup. Metadata receipts distinguish logical revocation, pending reconciliation and completed physical cleanup. |
| CHANGE | Restore of historical work | Preserve intent, completed work and unknown-result journals. Restore cannot renew old login/task/plugin/external execution authority. |
| REMOVE | Owner/global export/import, owner-private statistics and online whole-instance overwrite in the new production host | No legacy fallback or administrator impersonation. |
| EXCEPTION | Stopped operator instance backup | Contains private account/configuration storage and key material required for consistency; it is not a personal export and has no ordinary-user HTTP download. |
| UNKNOWN | M12 domain contract and final M15/M13/M14 combination | Must be independently composed and validated before M16 completion; no handoff bypass. |
| UNKNOWN | Existing scoped ContentStorage encryption/decrypt, storage/index diagnostics and deployment update controls | Audit the old entry and preserve the intended management boundary; do not fabricate zero state or silently remove capabilities. |

The registry is the extension boundary, not a central list of business branches.
Every registered private domain must provide all three lifecycle hooks. A saved
operation records its exact domain set; a missing hook blocks that operation.
New domains are included by registration, including plugin-owned domain data.
Deletion ordering must retain provider/configuration dependencies until their
dependent erasures are settled. External `pending`/`result_unknown` never means
erased. Disabling an account does not itself promise deletion.

Personal import is a canonical-data merge/dedup capability, distinct from whole
instance recovery. The old v2 shape cannot be silently accepted as portable 3.
Validation of all sections and cross-domain parents must precede publication or
use a recoverable staging/transaction boundary; partial restoration must remain
inaccessible. No personal point-in-time restore feature is added.

## Stopped instance archive checkpoint

`npm run backup -- --data VAULT --out NEW_BACKUP [--config INSTANCE_YAML]`
keeps the old epoch-4 path and adds epoch-5 `mote-instance-backup` version 2.
It requires stopped Central/providers, complete canonical SQLite and referenced
original/native files, an explicit instance configuration, ordinary private
files and an exclusive destination outside the vault. SQLite backup runs against
a disposable copy including WAL, leaving the source untouched. The manifest is
published last; missing/unexpected files, paths, links, checksums, deployment,
SQL consistency, required epoch-5 tables/columns, installed package integrity and native Mem0 records are verified. A cold account with only usage/state metadata may retain an implicit unchanged default configuration; any durable initialization, credential, receipt or restore provenance requires its canonical YAML.
Known private SQL owner namespaces must name a safe canonical account before any owner path is resolved. Original completeness includes active physical pins and cannot be weakened by a future manifest timestamp; expired unpinned snapshots retain their original deadlines and unavailable metadata.
Unknown external Memory providers without a native snapshot protocol fail closed.

`npm run restore:instance -- --from BACKUP --data EMPTY_TARGET
--deployment-id EXPECTED_ID` verifies before staging and publishes by rename.
The deployment and user identities, canonical history, configuration and external
journals survive. Old credentials, task grants, model epochs and plugin snapshots
are retired. Memory/processing automation, plugin instances, connector sync,
outbound MCP and Ask automation stay paused until explicitly reauthorized. A
succeeded or unknown external effect is not replayed. The returned instance YAML
rebases local storage/log paths; no runtime is started by restoration.

The existing native profile restore keeps its operator-selected profile
configuration, returns the restored instance YAML path and does not silently
replace the profile. Use that returned file explicitly when selecting the backed
up instance configuration. External environment-secret references still require
the operator's original secret source. Downloaded model weights/logs are excluded.
This is an operator archive containing private configuration/key material, distinct
from credential-free portable 3. Epoch-5 Docker profile publication is OPEN and
rejects before staging; its old copy-into-volume path cannot promise atomic restore.
Hindsight reuses the existing pinned owned-volume protocol; no daemon/image is
started or downloaded automatically. This checkpoint does not declare that native
path or the whole module accepted.

## Instance management boundary

The original `/api/software-update` and `/api/software-update/check` reuse the
read-only signed-release service and require a current administrator. HTTP cannot
select a repository, command, key or path; update/rollback remain explicit operator
CLI actions. The instance YAML's update configuration retains its startup semantics.

`/api/diagnostics`, `/api/diagnostics/events`, `/api/diagnostics/log-pages`,
`/api/diagnostics/logs` and `/api/support-bundle` require an administrator. They
reuse bounded ServerDiagnostics storage under `logs/instance`, with private-file
admission, but only project instance runtime metadata. Snapshot coverage declares
`privateContents:false, privateTraces:false`; historical raw trace bodies, identity
fields and arbitrary prose are never passed through. The old raw-log route now
returns curated metadata JSON lines. Owner Agent traces and old global private
queue/index/device statistics are not fabricated as zeroes. Their private scoped
contracts remain separate gaps. Ordinary feature inventory hides these management
routes; management grants never become a `forUser(otherOwner)` capability.

Original GC stays at M03 `POST /api/ingress/gc {}` for the caller's own domain.
An administrator cannot supply another user or invoke a global private GC fallback.
Retention, references, physical holds and snapshot expiry remain M03 responsibilities.

## Personal portable 3 import

The approved identity policy is the **same original deployment and account**.
The root envelope, every domain envelope and complete registered-domain coverage
must match before admission. JSON v2 and cross-account/deployment mapping are
rejected. This preserves the old canonical-data merge/dedup journey; it adds no
personal point-in-time recovery.

`POST /api/portable/imports {operationId, archive}` admits a generated UUID and
the parsed portable 3 JSON object. `GET /api/portable/imports/:id` returns its
persistent owner-qualified receipt. `GET /api/portable/imports?limit&cursor` uses
owner/deployment/epoch/collection/page-size bound cursors, like export history.
`POST /api/portable/imports/:id/cancel {}` can retire an uncommitted operation;
completed imports return 409 `archive_already_committed` because their canonical
merge has committed. There is no import download artifact.

The existing host lifecycle journal records kind `import`, original owner epoch,
normalized input bytes/hash and per-domain states, without persisting the input
JSON or minting task grants. Semantic progress does not assert a record total.
A failed/interrupted operation is retried by reselecting the exact JSON and
posting the same operation ID; changed input returns 409. Completed replay is
idempotent. Startup marks unfinished work failed/interrupted rather than replaying
its input. Current authority is required for admission, reads, pagination and
cancellation; another account or administrator cannot inspect its private receipt.

Domain-owned synchronous merge hooks publish private-data, ingress, processing,
Memory and completed Ask data in one shared SQLite transaction with the completed
receipt. Actual current provider bodies are checked outside the transaction;
intervening database changes, domain-policy changes, revocation and shutdown
prevent publication. Newly created immutable original directories are tracked for
rollback after a failed later domain. An original I/O failure is a failed import,
never a successful partial canonical restore.

Immutable histories conflict rather than overwrite. Current source observations
and Material heads retain their monotonic versions, including retired visibility.
A missing source is restored disabled, as in the previous import journey. Snapshot
expiry and current physical holds retain M03 semantics. Memory bodies/history are
data; missing records restore stale with builtin authority, without reviving an
old provider grant. Completed conversations restore with newly validated parent
receipts and no model execution. Current settings, execution journals, plugins,
connectors, MCP, owner-question continuations and automatic policies are explicitly
preserved in `coverage.preservedDomains`; their archive sections are not applied.
The canonical import suppresses only its own new synchronous automation events,
retaining preexisting events/cursors/policies so restored data cannot replay work.
Every added domain must declare merge or preserve explicitly; an absent import
policy blocks admission. The existing purpose-bound `restoreUser` adapters retain
their independent lifecycle semantics.
