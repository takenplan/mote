# M05: User-bound execution and Operations

M05 extends the single `ExecutionEngine` under the [multi-user ADR](../adr-multiuser-scope.md)
and [module plan](multiuser-modules.md). Its branch is
`codex/mote-multiuser-m05-execution`; its Draft PR targets only
`codex/mote-multiuser-integration`. M00/M01/M02 remain unmerged prerequisites.
The module branch starts at M01 `443726d2a95ef55db9466d06aa44ea1061ca56e4`
and applies M02 through `8ecccb8ecf0093cc655fadd8bbc5e1637220f9fd` locally.
The integration branch is not advanced by this work.

## Production boundary

`buildScopedApp` installs one `TaskExecution` host and one shared engine on the
admitted epoch-5 SQLite connection. It registers the `execution` user service,
starts scheduling in Fastify `onReady`, and stops admission/timers and the engine
in `preClose`, before closing accounts/storage. A second server connection shares
leases, resource locks and fairness through SQLite; it does not acquire a private
runtime per user. A trusted verifier fixture alone does not enable the task host:
production execution requires M01's durable account authority.

`ExecutionStorage` exposes only SQLite and metadata admission to the engine and
Operations projection. It does not open the quarantined `EvidenceStore` or install
its private schema. `StoreError` retains one shared class identity for legacy
algorithm consumers. Unsupported existing execution schemas are rejected before
DDL; there is no ownership backfill or automatic old-vault migration.

The production API is:

| Endpoint | Contract |
| --- | --- |
| `POST /api/tasks` | `{kind,operationId,input,dependencies?}`; only a trusted registered kind is executable. |
| `GET /api/tasks` | Current user's tasks and an independent user cursor. |
| `GET /api/tasks/:id` | State, attempts, safe failure receipt, progress, checkpoint names, result and external outcome. |
| `POST /api/tasks/:id/cancel` | Revokes the current lease and late publication. |
| `POST /api/tasks/:id/retry` | Own task only; an unknown external effect requires explicit `{confirmUnknown:true}`. |
| `GET /api/operations` | Existing incremental OperationSummary format, filtered before pagination. |
| `GET /api/operations/:id` | Own operation and scoped dependency/step progress. |
| `GET /api/operations/changes` | Pollable changes with a separate user sequence; no other user's IDs or activity count. |

All routes use M01 protocol 2, cookie/session binding, CSRF and final response
revalidation. A foreign task or operation behaves like a missing ID. Admin rights
do not select another user's execution service. Headers, bodies and model inputs
cannot replace host identity. No business handler is installed until its owning
module supplies a complete scoped implementation; unimplemented OCR, Memory,
Ask, import and external-action kinds remain unavailable.

## Trusted task registration and recovery

A trusted module calls `node.execution.register(UserTaskHandler)`, declaring its
kind, pool, capacity, explicit execution policy, input parser, optional admission
and host resource declarations. The execute callback receives `TaskRun` with an
immutable host `context`, scoped services, the current `ExecutionGrant`, signal,
checkpoint/progress methods and external journal methods. A handler uses
`run.services.get<PrivateData>('private-data')`; no global private Store escapes
through this interface. Model tools receive no capability to choose another user.

Submission validates input and derives task and operation identity from the host
user plus the caller's business identity. Duplicate admission is idempotent only
for the same immutable input and dependency set. A cross-user dependency is
rejected before grant/task insertion. The engine also rejects mismatched
ownership, cross-user operation ancestry, self dependencies and dependency cycles.

`task_authorizations` binds a durable grant to one task, user and account epoch.
`UserContextAuthority.restoreTask(grantId)` asks the host verifier to read this
record; serialized contexts and JSON lookalikes are invalid. The issued running
context additionally binds its credential identity to the current lease fence.
Every private service access therefore checks the account epoch, durable grant,
current task state, fence and lease expiry. Cancellation, completion, lease loss
and a new attempt invalidate retained private-service handles. Durable task
contexts never gain administrator capability.

Web logout or expiry of the admitting browser session does not revoke admitted
work. Account disable/reset, domain deletion, explicit cancellation, lost leases
and shared model withdrawal do revoke the corresponding publication authority.
Checkpoints and progress use the engine's fenced synchronous transaction; final
business commit and result storage are atomic with success. Completed checkpoints
survive replayable interruption and real process death. Another host cannot
publish through the old fence after lease recovery.

## Fairness, failures and resources

Claims order eligible users by durable last-started sequence, then retain the
existing operation fairness inside each user. Updating both fairness records and
claiming the step happen in `BEGIN IMMEDIATE`. A user with many distinct
operations cannot bypass user fairness. The existing pool/lane concurrency,
renewable leases and resource-availability checks remain shared across connections.

Resource keys come from the registered host handler. A `user` resource is encoded
with its user ID; a `shared` resource deliberately serializes the same physical
resource across users. Caller input cannot turn a user resource into a shared
resource. Resource waits consume neither an execution slot nor a processing
failure attempt. Existing task-specific policy, typed finite retries, safe failure
receipts and checkpoint reuse remain in force; unclassified errors do not imply
safe replay.

Before an external effect, the handler must durably call `external.begin(key)`;
`external.complete()` records a confirmed successful outcome. Every call has a
fixed issuance ID and immutable user/epoch/key/time facts in `task_external_calls`;
retry confirmations are separately retained with their user/epoch/time. An issued call whose
response is lost remains durable after cancellation, shutdown or process death.
Admission blocks it as `external_result_unknown`; ordinary retry cannot clear it.
Only the same authenticated user can explicitly confirm another attempt. That
confirmation leaves the previous issuance unknown, even if the new call succeeds.
Deletion checks every unresolved issuance, including earlier confirmed retries. The
external domain still owns idempotency and reconciliation; a local abort or lease
expiry never proves that the remote effect did not happen. This module makes no
external calls itself.

## M04 model contract and explicit limitation

The integration composition calls `execution.bindConfiguration(configuration)`
with the existing M04 `Configurations` host. A trusted handler declares
`modelFeature`; admission obtains a genuine lease with
`services.forUser(context).get('configuration').lease(feature,operationId)`.
`TaskModelHost` is a structural subset of M04's existing
`assertLease / withModel / recordUsage` signatures, not a second model resolver.
`TaskRun.model.withModel` checks the execution grant before and after the callback;
`recordUsage` additionally runs within its fenced transaction. Model selection,
fixed transport, configuration and price remain owned by the original M04 lease.

Only its credential-free receipt is persisted, while the real lease remains in
memory. M04 explicitly provides no durable snapshot ID or recovery API in this
iteration. After process restart or another host claiming that task, the missing
live lease produces `blocked/model_snapshot_unavailable`, without selecting a new
model, refreshing configuration, or deserializing the receipt into authority.
Explicit retry does not silently obtain a different snapshot; a newly authorized
business operation may take a fresh lease. Actual M04 composition remains a joint
integration check because M04 is an independent, unmerged prerequisite. Synthetic
WeakMap leases test this exact interface without real providers or credentials.

## M16 lifecycle contract

The `execution` domain registers all three purpose-checked lifecycle hooks.
Export is one consistent transaction containing only this user's task metadata,
original account epochs, states and dependencies. A handler must explicitly
supply `portableInput` to export credential-free input; other inputs are marked
omitted. Coverage explicitly excludes credentials, active authorization,
checkpoints, progress, results, failure receipts, model snapshots and detailed
external journals. It is a
scoped task-history export, not a complete execution checkpoint backup.

Delete first fences the domain and revokes all task grants, then aborts local
work. Known outcomes permit idempotent removal of task, dependency, resource,
projection, change, generation and user-fairness records. A minimal domain deletion
tombstone remains to prevent new admission. Unknown external outcomes return
`result_unknown` and retain the journal for reconciliation. M16 may use
`pendingExternalForDeletion` and `settleExternalForDeletion` with a genuine
execution-domain delete grant after independently observing each fixed issuance,
then repeat deletion. Multiple unresolved calls require an explicit issuance ID;
contradicting a settled outcome is rejected. This cannot issue a
new external call or retry a task; ordinary user contexts cannot invoke it.

Restore validates envelope, coverage, all IDs/inputs, dependency completeness and
an iterative acyclic graph before writes. It restores history with revoked grants
and the original epoch. Nonterminal entries become
`blocked/restore_authorization_required`; neither history nor an old model receipt
mints fresh authority. Same-operation replay is idempotent and a different payload
conflicts. Whole-instance offline recovery preserves the original complete SQLite
state and durable task grants; M16 owns its orchestration and supported archive
format. Portable task-history restore does not promise automatic resumption or
single-user historical recovery.

## Supersession and verification

KEEP: one engine, leases, checkpoints, finite safe retries, task-specific budgets,
operation fairness, lane capacity and transactional commit fences. CHANGE:
persistent host ownership, per-user fairness and private Operations cursors.
REMOVE: production owner access, copied task contexts, unscoped task control and
cross-user dependencies. EXCEPTION: quarantined old algorithm fixtures can omit
ownership; trusted host code is not an adversarial code sandbox. UNKNOWN: actual
M04 combined runtime, unfinished business handlers, real external reconciliation,
physical clients and deployment behavior await their respective modules.

Executed checks, exact implementation SHA and independent review findings are in
[the M05 validation record](../validation/multiuser-m05-execution.md).
