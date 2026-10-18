# M16 lifecycle and archive boundaries

The current LIFE-L01–L06 parity decisions are recorded in
[Lifecycle parity ADR](../adr-lifecycle-parity.md). The sections below retain
prior M16 checkpoints; the L06 and portable-delivery sections describe the
current implementation. Final validation is recorded separately in
[the parity validation ledger](../validation/parity-lifecycle.md).

This work starts at the clean M14 composition `9bc65b53d5823443ad1ecffb49d2c6eecc687927`.
All runtime validation uses generated accounts and disposable directories. The
M12 handoff was unauthorized at the initial checkpoint; its later authorized
resumption is recorded below. Its final composition is still pending.

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
are retired. Saved processing/Memory automatic settings, Memory desired state, Actions
enabled settings and outbound MCP enabled settings survive. New authenticated
input follows the existing domain admission paths. Stopped restore records plugin, connector, Ask and Actions future policy intent
separately from revoked authority. A later trusted password login admits one
current account/restoration coordinator, which creates fresh future authority
through the original domain ports. A succeeded or
unknown external effect is not replayed. The returned instance YAML
rebases local storage/log paths; no runtime is started by restoration.

The existing native profile restore keeps its operator-selected profile
configuration, returns the restored instance YAML path and does not silently
replace the profile. Use that returned file explicitly when selecting the backed
up instance configuration. External environment-secret references still require
the operator's original secret source. Downloaded model weights/logs are excluded.
This is an operator archive containing private configuration/key material, distinct
from credential-free portable 3. The [container follow-up](../validation/multiuser-container-backup.md)
replaces epoch-5 Docker refusal with fresh-volume staging and a single atomic
YAML storage-pointer publication, retaining old volumes and staying stopped.
Actual Docker volume, original Mote production startup/restart and native plus
managed Hindsight history reopening now have separate generated-data evidence.
Protocol tests alone do not establish those actual runtime results.
Hindsight reuses the existing pinned owned-volume protocol; no daemon/image is
started or downloaded automatically. This checkpoint does not declare that native
path or the whole module accepted.

## L06 policy intent and continuing authorization

The owner confirmed that trusted password relogin after a whole-instance restore
should resume future automatic processing, synchronization and discovery without
another per-domain confirmation. The [parity ADR](../adr-lifecycle-parity.md)
supersedes the earlier pending decision and blanket coordinator retirement.

| Disposition | Recovery behavior |
| --- | --- |
| KEEP | Policy settings, account identities, canonical data, completed results, successful cursors, cancellation and unknown external journals; retire all old credentials, grants, plugin snapshots and leases. |
| CHANGE | Record future intent per account and restoration identity. A successful password login admits an idempotent current-epoch M05 coordinator; normal logout and restart preserve this newly authorized work. |
| REMOVE | Blanket false/paused settings and the additional per-domain reauthorization step after trusted password relogin. |
| EXCEPTION | Explicit paused/stopped/disabled state and newer user choices win. Missing sources, changed plugin definitions or failed current capability checks require attention through existing domain controls. |
| UNKNOWN | Live-provider behavior and physical-device continuation remain separate validation. |

The coordinator can invoke only fixed domain restoration ports while its exact
restoration identity, account epoch, task ID and running grant remain valid.
Plugins are configured without enabled authority, checked through the current
package, then enabled using the latest configuration revision. A copied verified
hash or old plugin snapshot cannot substitute for that check. Connector timers
use current auto-sync selection and preserved provider cursors. Actions and Ask
receive fresh task identities and advance past the backup input frontier; old
pending windows, OAuth flows and unknown external requests are never requeued.
Successful canonical cursors and last-success times survive.

Processing and Memory retain their automatic/desired settings and admit new
input through their ordinary generation-fenced intake. Outbound MCP retains
its enabled policy but needs a current explicit discover/import request for a
new session. Actions review devices and native target registrations remain
retired. Pairing/exchange and an arbitrary task context cannot admit recovery
continuation; only the real password login entry can do so.

The generated policy-intent and future-authority tests use two accounts, real
HTTP configuration, stopped backup/restore and restart. The latter uses a local
generated model adapter and real watch/timer clocks for future discovery/sync.
Their evidence is separate from native provider, Docker, device and live-model
checks; see the validation ledger for actually executed results.

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

Original GC remains available at M03 `POST /api/ingress/gc {}` for the caller's
own domain. Production startup and an hourly host timer invoke the same collector
for each database-owned account independently of its login sessions. The host
binds and revalidates the exact owner and account epoch; this is no administrator
impersonation route. Shutdown stops the timer before domain teardown.

The instance's existing `storage.retentionDays` again removes expired ordinary
captures at startup and hourly. Zero retains them indefinitely. The strict cutoff
uses the final state-series observation, otherwise the original source content
time, matching the former `context_end`; receipt time and event duration do not
extend it. Canonical `ig_file_revisions` records identify the actual file-manifest
and retained file-processing paths excluded by the former `file_versions` policy.
A generic source item's `kind: file` alone grants no exclusion. File identity
survives expired transport sessions and personal export/import.

Retention reuses the explicit capture-deletion transaction, withdrawing dependent
Materials, readable Memory evidence, saved answers and traces. Its owner-bound
capture-deletion journal prevents an old or newly named transport batch from
restoring the same event ID. A newly authorized event ID and another account's
equal ID remain independent. File forgetting keeps its existing blocked decision,
generation and explicit allow-again contract; its host removal does not add an
ordinary capture-retry tombstone. Source removal retains its existing separate
incarnation boundary.

The collector removes expired or revoked upload staging, expired workspaces,
unreferenced originals and expired snapshot inputs under the existing reference
and pin rules. Generic import staging uses the same cleanup as its original
import entry, including removal of completed files with no capture or import-job
links. A live physical pin protects bytes. Any unresolved ingress or processing
activity blocks physical reclamation for that owner, including after the pin's
deadline and across restart; elapsed time alone does not establish that a worker
or external action stopped. Other owners can
still be maintained. Generated validation is recorded in
[the maintenance journeys](../validation/parity-lifecycle-maintenance.md).

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

Ask's initial event-journal backfill is an atomic first-install migration. It is
not rerun at every startup: otherwise a later personal archive merged into an
earlier recovered instance could become new automatic input on restart despite
the import publication fence. Normal producer triggers retain their existing
notification behavior after initialization.

Instance archives additionally preserve M13's per-owner/device OCR update journal
and its separate high-water counters. Both table/column sets are mandatory.
Pre-write validation rejects a missing counter, an event ahead of its counter,
negative/unsafe/noninteger sequence state, or an incomplete schema. It accepts a
counter above surviving events after capture deletion and preserves it exactly.
Personal import still excludes this derived journal; the M13 current-artifact
reader reconciles missing notifications without re-admitting a task.


## Decision provenance and closure ledger

These choices implement the existing self-hosted private-library direction; they
are not a new sharing, cloud recovery or workflow product. The owning discussion
and its adoption are recorded in [Multi-user scope: Decision and provenance](../adr-multiuser-scope.md#decision-and-provenance).
The original multi-user recommendation is linked there as thread
`<internal-task>`; this ledger does not invent separate
approvals for its individual implementation details. The parent additionally
confirmed original-deployment/original-account personal import and delegated
ordinary technical decisions. The earlier M16 checkpoint had no pending owner
decision; the later L06 continuing-authorization decision is recorded in the parity ADR.
The historical M12 handoff denial was honored; the parent has since explicitly
confirmed that handoff succeeded. M12 final lifecycle/backup composition remains
a separate gate.

| Problem | Decision and existing authority | Reason / impact | Executed verification / remaining limit |
| --- | --- | --- | --- |
| A disabled account must still be erasable without private impersonation. | Purpose-bound durable lifecycle grants, revoke ordinary access before erasure; retain unknown outcomes. [Multi-user scope: host contracts](../adr-multiuser-scope.md#m00-executable-boundary), [domain lifecycle contract](multiuser-modules.md#domain-lifecycle-contract), [recovery failure contract](../adr-task-recovery-and-execution-budgets.md#failure-handling-contract). | Reuses the shared SQLite, domain adapters and single executor; admin status never grants another account's private service. Physical completion includes credential metadata and the final current domain set. | Actual HTTP deletion, delayed unknown cleanup, A/B SQL/hash checks, reset-password and registry-race RED→GREEN; no real account was deleted. |
| Personal import must preserve the previous merge/dedup journey without accidentally becoming historical execution recovery. | Same original deployment/account, complete declared coverage, five canonical domain merges in one synchronous SQLite transaction; explicitly preserve current settings and execution authorization. [Storage and recovery / Supersession](../adr-multiuser-scope.md#supersession), [MVP baseline](../adr-mvp-baseline.md), [M16 matrix](multiuser-modules.md#模块改造与验收矩阵), [transaction and external results](multiuser-public-contracts.md#同步事务外部结果与恢复). Identity policy is explicitly approved by the parent. | Keeps one private library, immutable data and current merge/dedup; adds no per-user PITR, cross-account mapping, old credential or model-call replay. New registered domains declare merge/preserve rather than extending a central business switch. | Actual source-host personal import 14/14 and combined backup/import 37/37; restoreUser adjacent 11/11; final current compiled/required checks remain separate. |
| A personal merge can otherwise create fresh automatic work on the next restart. | Suppress only the import's synchronous automatic events and restrict old Ask journal backfill to atomic first installation. [Task recovery: failure contract](../adr-task-recovery-and-execution-budgets.md#failure-handling-contract), [system refactor: KEEP fences and one engine](../adr-system-refactor.md), [public recovery contract](multiuser-public-contracts.md#同步事务外部结果与恢复). | Keeps normal producer triggers and previously authorized events; no history migration, new queue or automatic reopening of old work. | Actual earlier instance backup → later personal archive → restore/import → restart valid RED→GREEN; first-install positive and normal new publication positive; import suite 14/14. |
| A successful export or UI receipt must describe its actual authorization and coverage. | Owner/deployment/epoch-qualified persistent receipts, exact bytes/hash, current download authorization, semantic progress and explicit exclusions. [Multi-user scope: Ownership/Privacy/Storage](../adr-multiuser-scope.md#decision-and-provenance), [Central request admission: structural pages exception](../adr-central-request-admission.md#supersession-check). | Reuses existing UI entry points and bounded transport pages, without record-total claims, arbitrary backlog quotas or successful empty domain fallback. | Historical Range/ETag/cancel/epoch/pagination fixtures described the earlier retained artifact. Current direct delivery has length/digest checks, cancellation and no-content Activity metadata; see parity validation. |
| A backup can be internally checksummed yet omit required originals, tables or durable notification counters. | Verify required schema, references/pins, bytes and safe owner paths before staged publication; preserve both OCR journal tables and exact high-water counters. [MVP write admission](../adr-mvp-baseline.md), [multi-user new baseline](../adr-multiuser-scope.md#new-baseline-and-write-admission), [capture journal contract](multiuser-capture-browser.md). | Rejects half recovery without rewriting existing data; deleted-highest events do not rewind a device cursor. Personal import excludes this derived journal and uses the existing bounded read reconciliation. | Actual native SQLite/files/process round trips, corruption/link/path cases; six checksummed journal corruptions RED→GREEN and 7/7; later composed 14/14. |
| Restoring data must not authorize previous external effects again. | Preserve successful/unknown journals and future policy intent; retire old credentials/task/plugin grants, then create fresh future coordinators only after trusted password relogin as specified in the L06 section. [Recovery failure contract](../adr-task-recovery-and-execution-budgets.md#failure-handling-contract), [multi-user recovery boundary](../adr-multiuser-scope.md#decision-and-provenance). | Separates recovery of canonical records from execution rights and does not infer non-execution from timeout, cancellation or process death. | Actual generated external journals and restart tests, native Mem0 SDK canonical bodies; no live provider or real external action. |
| Existing management pages contain private one-owner assumptions. | Admin finite instance metadata and signed read-only update checks; no impersonation, fake zero private queue/index metrics or HTTP update execution. [Multi-user Privacy](../adr-multiuser-scope.md#decision-and-provenance), [ConfigService responsibility/transaction](../adr-unified-configuration.md#responsibilities-and-transaction). | Retains existing settings/navigation and file configuration authority; configuration changes and deployment remain explicit operator actions. | Actual management post-await revocation RED→GREEN and Web consumer; private storage encryption/index gaps are not represented as restored. |
| The old Docker copy-into-volume restore cannot promise atomic epoch-5 publication, and no Docker daemon is available for verification. | Keep the verified native stopped-instance path; reject unsupported Docker epoch-5 publication before mutation and report this as an OPEN retained-capability gap, not accepted removal. [Module M16 backup scope](multiuser-modules.md#模块改造与验收矩阵), [ConfigService UNKNOWN container validation](../adr-unified-configuration.md#compatibility-and-validation), [AGENTS completion rule](../../AGENTS.md). | Recommended to the parent: retain the explicit gap until atomic volume publication and real daemon recovery can be implemented/verified. No silent scope reduction, daemon start, deployment or synthetic claim of Docker acceptance. | Native source/compiled/package paths have historical positive evidence; approved read-only Docker version check reports daemon unavailable. Docker publication and native Hindsight-volume validation remain unexecuted/incomplete. |

The last row records the original M16 checkpoint. The
[container follow-up](../validation/multiuser-container-backup.md) supersedes its
blanket Docker refusal with staged fresh-volume publication. The daemon became
reachable and actual volume/Mote production/native-and-managed Hindsight recovery
now pass; the linked ledger keeps exact runtime SHAs and the final current gate
separate from historical checkpoints.

The cited ADRs take precedence over a local shortcut. A conflict with these
boundaries must be reported to the parent with a recommendation before changing
product direction. Current final checks, exact SHAs and remaining gaps are listed
in the [validation ledger](../validation/multiuser-m16-lifecycle.md); historical
passing checkpoints do not validate later runtime changes.


### Authorized M12 resumption after this candidate freeze

After candidate `589d6ad7` was frozen and its required check started, the parent
explicitly restored the original M12 conversation. Earlier handoff restrictions
are historical; M16 began bounded read-only review only after that new trusted
instruction. This does not retroactively include M12 in the running candidate.
Its Actions unknown-result deletion correction, explicit Actions/Todos import
policies and complete offline table/column plus authority-retirement contract
remain owning-module prerequisites for a later combined freeze. No ended
M14/M11 conversation is awakened, and no previously rejected operation is
reissued through another thread.


### M12 domain composition and stopped archive authority

The authorized M12 freeze `4a0e82db` (runtime `5172f099`) is now composed.
Its synchronous Todos hook extends personal canonical merge to six domains;
Actions declares preserve-current explicitly. This retains the original
`EvidenceStore.exportArchive/importArchive` JSON-v2 Todos behavior without
inventing Actions personal historical merge. The companion tar-bundle exporter
is `mote-data-export` v1, not that JSON-v2 format. Registry-driven coverage and
clients must allow these explicitly declared extra domains, rather than fix the
number of merged domains at five.

The stopped archive now requires all columns of the thirteen Actions/Todos tables
(173 core tables total). Restore preserves inherited instance and actual private
YAML Actions settings, advances SQL policy/authorization generations, clears
review-device and policy-task authority, retires target registrations and revokes
operations. Exact claimed/issuance/native-ID/ACK/task linkage, successful history,
unknown external facts and manual Todo content/state remain unchanged. This is
the same [multi-user recovery boundary](../adr-multiuser-scope.md#decision-and-provenance)
and [unknown-result contract](../adr-task-recovery-and-execution-budgets.md#failure-handling-contract),
not a new approval or backup framework. Keeping enabled policy intent does not
replace a retired Actions watcher, review-device grant or target registration;
recovery never manufactures first-issuance eligibility.


## Portable consistency and direct delivery

LIFE-L03 replaces the whole-connection change counter with exact owner-qualified
SQL read witnesses. Direct SQL adapters record their exported projection;
`PrivateSql` records owner-bound reads automatically. Independent reads begin
before awaiting external providers, and all settle before final validation. The
host rechecks the observed results, authority, configuration and domain/import
policy registry in the final SQLite transaction. B's changes and A's unexported
task progress do not invalidate A's archive. Changes to observed A data prevent
publication. No SQL transaction spans provider I/O; external Memory retains its
existing body/provider checks.

LIFE-L04 restores one user action: `GET /api/export` generates and directly
delivers the current full portable 3 archive, including retained original bytes.
Web automatically saves this response. Android stages and verifies its length,
MIME type and SHA-256 ETag before opening the selected output document. Both
clients fence a late response when their account changes. A retry is a new
current export request. No export start/history/content/retry HTTP API remains,
no historical receipt authorizes a new download, and no central archive BLOB is
written. Work may retain progress/audit metadata and exposes no archive artifact.

The host releases request bytes when delivery finishes or disconnects. Canonical
content deletion invalidates any in-flight full response in the same SQL
transaction; later stream chunks recheck that state and current authorization.
Snapshot deadlines fence delivery even if maintenance is delayed. Offline bytes
already delivered to a user remain that user's copy. No latest-copy, count or
TTL policy is introduced. Import receipts and their existing control flow remain
separate from export transport.

KEEP full originals, exact bytes/digest verification, canonical merge and data-only
import. CHANGE observed-data consistency and direct request delivery. REMOVE
unrelated-account conflicts and retained archive downloads. EXCEPTION external
outcomes and already downloaded user copies keep their existing boundaries.
UNKNOWN live-provider and physical-device results require separate checks.

Personal import preserves the original same-vault capture delete journal: a
portable archive containing a locally journaled deleted ID fails before any
canonical publication. The journal is owner-qualified, so B's same capture ID
does not block A. A genuinely new ID can merge into an earlier recovered
instance; restoration of a whole stopped instance preserves that instance's
canonical records and delete journal together. File-forget tombstones remain
authoritative. No imported archive replays deletion decisions against live data.
