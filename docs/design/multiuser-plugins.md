# M09: User plugin instances and host lifecycle

M09 starts at the exact published M05 PR #130 head
`7f72e9040872dbbb351f3c9a22afa6f069aa59c8`. It includes the unmerged
M00/M01/M02/M04/M05 prerequisites, PRs #126–130, and targets only
`codex/mote-multiuser-integration`. It neither advances that branch nor changes
`main`, deployment state or repository Actions settings.

## Production ownership

`buildScopedApp` calls `registerScopedPlugins` after binding the real M04
Configurations to M05 TaskExecution. This restores the package and instance
control APIs, trusted worker loading, exact runtime registration, scoped task
dispatch, retained history bindings and user event subscriptions. A verifier-only
fixture does not install a task/plugin host.

The existing PluginCenter owns the shared immutable package catalog. Its
`catalogOnly` mode installs no legacy private-instance tables or check handler.
It uses the same shared ExecutionEngine for package installation. Only current
administrators can resolve/install/uninstall packages. Ordinary users can select
already installed trusted packages; request bodies cannot supply paths, modules,
download URLs or executable code. Package identity includes fixed source and
manifest, so different release metadata with identical ZIP bytes cannot silently
reuse another version's identity. Cached bytes are reverified before loading.

M04 ConfigService owns the `pluginInstances` user domain, including revisions,
validation, prepare/publish/rollback, file watching and effective configuration.
`plugin_user_instances` is its transactional runtime projection, not another
settings authority. A user may use the configuration API/file or plugin API;
both use the same domain schema and publication handler. Configuration fields
use the existing package manifest schema. Credential fields contain opaque
`personal:`/`shared:` references; reusable keys are never passed to workers.
Model execution uses M04/M05's actual fixed model lease.

Instance IDs can be identical for A and B. Every projection key, snapshot, event,
runtime cache and directory also includes host user identity. A plugin's public
inventory contains only that user's instances. Shared package views contain no
other user's instance IDs. Administrator status cannot select another user.
Plugin code remains trusted host code, including its filesystem/network powers;
neither Cordis nor the worker process is a malicious-code sandbox.

## Extension and downstream contracts

The executable release may export `createMotePlugin(configuration)` with
`components: [{id, version, surface, capability, invoke(input, host, signal)}]`.
Its descriptors must exactly match the fixed manifest's `components`. Loading
uses the existing WorkerPluginRuntime and one Cordis root with an independently
disposable BackendPluginScope for each user/configuration. Actual components
register in the existing FeatureRegistry. New extension packages require no
central business dispatch branch. UI contributions use declaration/result
validation; arbitrary remote HTML/React is not installed in the client bundle.

`ScopedPluginHost.registerAdapter(capability, adapter)` is a trusted host-domain
registration, not a user API. `adapter.bind(invocation)` returns only bounded
methods, `validateResult` checks the domain result, and optional synchronous
`commit` runs inside M05's fenced success transaction. An adapter that performs
asynchronous work must recheck `invocation.assertCurrent()` immediately before
its own publication. A missing adapter is explicitly unavailable and is reflected
in inventory; a declared component alone does not prove domain completion.

| Consumer | Required interface and responsibility |
| --- | --- |
| M03/M10 sources | `plugins.bindSource((context, sourceIds, assertCurrent) => ingress.bindSource(...))`; expose only `receiveCaptures`, `receiveSourceItems`, `readOriginal`, `pageOriginals`, `publishMaterial`. Source IDs come from the fixed user instance grant. Ingress rechecks the host context and supplied fence on every call and synchronous commit. It validates all source/capture/material dependencies. No SQLite, host path, context or user selector crosses RPC. |
| M06 processors | Register `processor`; consume fixed configuration, frozen source IDs, M05 `TaskRun` checkpoints/grant and bounded M03 originals/workspace. Validate outputs and publish through existing M02/M06 domain mechanisms in `commit`. No separate scheduler or global private Store. |
| M07 Memory | Register `repository`/`retrieval`/`engine`; retain an explicit history snapshot and `bindingRevision`. Provider namespace is host-derived `{ownerId: userId, instanceId, bindingRevision}`. `validateHistory` must verify exact namespace/keys/versions before release. Existing WorkerMemoryProvider/Memory publication validation remains M07's responsibility. Missing external providers never fall back to SQL bodies or a current/default release. |
| Model extensions | An adapter declares `modelFeature`; the host registers its M05 model task and uses the real durable M04 lease. The generic task route cannot bypass that model admission. Workers call a bounded host method; they receive no provider key or freely editable shared endpoint. |
| UI extensions/M13 | Register the supported UI capability and existing exact descriptor/result validation. Inventory follows the current API identity. Installing server code does not inject unbundled executable UI into clients. |

Worker RPC is `host.call(method, argsArray)`; the host spreads the arguments
onto that invocation's registered method. For example, M03's
`receiveSourceItems(sourceId,batchId,items)` is called with
`host.call('receiveSourceItems',[sourceId,batchId,items])`. Workspace callbacks
remain host-side for M06 and do not cross JSON as code. `emit` is a host-owned,
fenced progress/event capability. The RPC parent ID binds replies to the exact
live invocation. Callbacks after completion/close cannot acquire another call's
authority.

The acceptance fixtures actually generate and install a trusted local ZIP,
verify its fixed manifest/archive, run its worker callbacks, register Cordis
components and consume real M02/M04/M05 services. These are not claims that M06,
M07, real Mem0/Hindsight multi-user domains or M13 clients are complete. Those
unfinished domains remain unavailable in ordinary production composition.

## Admission, pause, stop and history

Explicit `check` verifies actual registration for the exact configuration before
enable. Neither check nor installation scans history or invokes models. Task and
history snapshot admission are separate; history additionally requires the
instance's explicit `history` grant. Each receipt persists owner, account epoch,
instance generation, exact package/version/digest, component contracts, original
configuration/source grants and binding revision. It never serializes a usable
UserContext. M05 supplies durable task identities and current attempt fences.

Pause/disable closes new admission while prior authorized receipts drain. Resume
does not scan a gap or grant history. Stop, removal or any authorization-grant
change increments the durable generation and invalidates old callbacks,
subscriptions and receipts. Ordinary configuration/release changes preserve an
already admitted task's exact version/configuration; they do not change B.
Namespaces and runtime data remain fixed to the old configuration for retained
history. Active instances and retained receipts protect their package from
uninstall; immutable cached code is retained separately from data deletion.

All RPCs/results/events recheck instance and M05 authority around awaits. Domain
commits and event insertion are synchronous fenced transactions. Event cursors
are independent per user; subscribers retain their issuing host context and
snapshot. Logout revokes browser subscriptions, while already authorized M05
background tasks retain their durable grant. Stop, account disable/reset,
cancellation, deletion, lost leases and shutdown prevent late publication.

Runtime directories validate every ancestor below the admitted vault and use
host-generated deployment/user/configuration hashes. They never use user-chosen
filesystem paths. Closing/releasing one snapshot does not dispose a retained
sibling scope or another user's instance. Shutdown drains the shared executor,
then closes plugin workers/Cordis, configuration and SQLite in that order.

## M16 lifecycle coverage

The `plugins` lifecycle owns instance definitions, their grants/fences/receipts,
runtime handles, instance-local files, event logs and subscriptions. Canonical
source, processing, Memory and external-provider data remain with their domain
hooks; deleting a plugin instance does not assert those external bytes were
erased. M16 must invoke every relevant domain, and must not treat the host receipt
as a whole-user erasure claim.

Portable export includes only this user's credential-free instance definitions.
It clears enablement, all grants and credential references and explicitly
excludes runtime files, provider-domain data, receipts, subscriptions and events.
It is not an instance-data backup. M04's configuration export omits this sensitive
extension domain. M04 restores only its registered default; M09 restores its
validated definitions through a separate, purpose-bound grant.

Restore validates the full envelope, format, duplicates and installed package
contracts before journaling anything. Reusing an operation with a changed payload
conflicts. Definitions are staged durably, then applied through the same
ConfigService on the target user's next access. They remain disabled, unchecked,
without source/history/capability grants or credentials. M16 must restore M04
configuration before that access; no old YAML or receipt mints new authority.
Whole-instance offline backup must preserve SQLite, M04's snapshot key/config,
immutable package cache and plugin instance directories together. Its coordinator
and archive format belong to M16; this does not promise per-user point-in-time
recovery.

KEEP: Cordis, FeatureRegistry, fixed releases, ConfigService, one executor,
M04 snapshots, M05 persistent grants and domain publication. CHANGE: private
instance/configuration/runtime/event ownership. REMOVE: fixed `mote-owner`
provider selection and install-as-history-authorization. EXCEPTION: legacy
algorithm fixtures use an explicitly supplied fixture owner and remain
quarantined. UNKNOWN: real providers/models, clients, physical erasure and whole
instance recovery await their domain acceptance.

Executed checks and review findings are recorded in
[M09 validation](../validation/multiuser-m09-plugins.md).
