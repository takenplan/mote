# M05: User-bound execution and Operations

M05 extends the single `ExecutionEngine` under the [multi-user ADR](../adr-multiuser-scope.md)
and [module plan](multiuser-modules.md). Its branch is
`codex/mote-multiuser-m05-execution`; its Draft PR targets only
`codex/mote-multiuser-integration`. M00/M01/M02/M04 remain unmerged prerequisites.
The module branch starts at M01 `443726d2a95ef55db9466d06aa44ea1061ca56e4`
and applies M02 through `8ecccb8ecf0093cc655fadd8bbc5e1637220f9fd` locally.
M04 PR #129 was independently verified at
`bc5323e1b5ee337c20dee58d4a8e9c25bc2adbbf` (implementation `e76f1fe6`).
Its four published commits are applied only to this module branch; the integration
branch is not advanced by this work.

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
user plus the caller's business identity. Operations retain the original business
family before the opaque account-bound hash, including the `workflow:actions:`
marker consumed by the Web change feed. Family never grants execution or access. Duplicate admission is idempotent only
for the same immutable input and dependency set. A cross-user dependency is
rejected before grant/task insertion. The engine also rejects mismatched
ownership, cross-user operation ancestry, self dependencies and dependency cycles.
Trusted domains may pass parent task/business identifiers as a separate admission
option or link existing business/task parents through their user-bound host.
HTTP task JSON cannot install ancestry. Membership propagation includes late,
nested children and retained history; parent attribution does not cancel work or
renew a grant. See [current parity journeys](../validation/execution-parity-2026-10-18.md).

`task_authorizations` binds a durable grant to one task, user and account epoch.
`UserContextAuthority.restoreTask(grantId)` asks the host verifier to read this
record; serialized contexts and JSON lookalikes are invalid. The issued running
context additionally binds its credential identity to the current lease fence.
Every private service access therefore checks the account epoch, durable grant,
current task state, fence and lease expiry, plus the engine's current input and
resource grant. Local abort and shutdown revoke that context synchronously, before
the durable state transition finishes. Cancellation, completion, lease loss
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

An optional host-only pool partition supplies an opaque capacity key, unit and
limit. A key can span pools; exact coordinator/physical-child tasks can share
one unit. M05 counts distinct units from durable running leases and this host's
unsettled local promises, and uses the same `capacityAvailable` predicate at
candidate selection and transactional claim. Reusing an already occupied unit
permits its genuine child to continue after a hot limit decrease. Unconfigured
pools retain their existing pool/lane limits. The callback is not accepted from
task JSON, creates no grant and changes no persistence or public task shape.
The Files host binds image keys to trusted owner/declared-kind metadata; actual
model gates and shared physical resources remain separate constraints.

Resource keys come from the registered host handler. A `user` resource is encoded
with its user ID; a `shared` resource deliberately serializes the same physical
resource across users. Caller input cannot turn a user resource into a shared
resource. Resource waits consume neither an execution slot nor a processing
failure attempt. Existing task-specific policy, typed finite retries, safe failure
receipts and checkpoint reuse remain in force; unclassified errors do not imply
safe replay.

M05 owns the `execution_stage_groups`/`execution_stage_fairness` service history,
attempt-fenced `execution_resource_releases`, and admitted `task_model_resources`.
The latter retain host-derived physical resource identity from M04, with no model
credentials or additional authorization.

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

## M04 production model snapshots

The production composition opens the real M04 `Configurations`, registers its
user routes and calls `execution.bindConfiguration(configuration)`. Task model
types alias the actual M04 types. A trusted handler declares `modelFeature`;
admission obtains a genuine lease with
`services.forUser(context).get('configuration').lease(feature,operationId)`.
`TaskRun.model.withModel` checks the execution grant before and after every
callback, including errors; `startUsage` and its meter methods run within fenced
transactions. Queries share `queryWithUsage` so failed calls retain their latest
reported usage, independent queries get independent IDs, and issuance follows
actual model authorization after resource waiting. A model lease is not a usage
fragment or a supplier request count.
Cached private service handles inherit the same input/resource grant, including
shared withdrawal, local abort and shutdown.
The wrapper carries genuine structured `ProviderFailure`/`ExecutionFailure` control
facts through a private callback outcome and rethrows after M04 post-validation,
preserving finite retries and capacity-wait semantics. Other callback exceptions
remain redacted as `model_execution_failed` by M04 rather than being labeled a
configuration problem. Concrete Agent failures are translated into fixed safe
codes before this boundary; host validation codes and job/batch/run/phase
identities accompany the existing safe failure receipt. An error message or
structural lookalike grants no retry authority. Withdrawal or cancellation
overrides an earlier transport failure.

The credential-free task receipt persists M04's opaque `snapshotId` and fixed
metadata. M04 owns the encrypted snapshot, original effective configuration,
model/transport/price, credentials and persistent resource generations. Task
receipt JSON never regains authority. Ordinary selection, configuration and price
changes do not select a new snapshot for an existing operation.

After restart, an eligible task is claimed with its original account grant and a
new running fence. A private host hydration phase permits only that exact task
and fence to resolve its genuine context while its model object is absent. All
account, durable-grant, input and lease checks remain active. The host calls the
real `configuration.restoreLease(context,snapshotId,expectedOperationId)`, verifies
its deployment/user/operation/feature/snapshot binding, removes the hydration
permit and rechecks the complete execution grant before exposing any `TaskRun`,
private service handle or handler callback. An existing but withdrawn live lease
never enters this recovery exception.

Missing/corrupt snapshot or key, changed account epoch, deleted configuration,
revoked credentials, withdrawn shared resource, wrong user/operation or changed
handler feature fail closed with a named blocked/stale result. There is no
`lease()` fallback to current settings. Host snapshot hydration is a known
pre-processing stage: a blocked restoration records `executionStarted:false`
and does not consume the task's finite processing-failure budget. Cancellation
or a newer fence during the await prevents the restored object from publishing.

Real M04/M05 production tests use synthetic provider settings and `withModel`
callbacks that return generated values locally. They verify restart recovery of
original selection, effective settings and price, user-owned accounting, and
revocation races without contacting any provider. The earlier interface-only
fixtures are not evidence for this combined runtime.

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
conflicts. Whole-instance offline recovery preserves complete SQLite task history and
parent-generation metadata while retiring old login and task execution authority.
The current archive schema requires the parent-edge generation table and its four
columns; missing mappings are rejected rather than recreated. M16 owns the
recovery orchestration and supported archive format. Portable task-history restore does not promise automatic resumption or
single-user historical recovery.

## Supersession and verification

KEEP: one engine, leases, checkpoints, finite safe retries, task-specific budgets,
operation fairness, lane capacity and transactional commit fences. CHANGE:
persistent host ownership, per-user fairness and private Operations cursors.
REMOVE: production owner access, copied task contexts, unscoped task control and
cross-user dependencies. EXCEPTION: quarantined old algorithm fixtures can omit
ownership; trusted host code is not an adversarial code sandbox. UNKNOWN: unfinished business handlers, real external reconciliation,
physical clients and deployment behavior await their respective modules.

Executed checks, exact implementation SHA and independent review findings are in
[the M05 validation record](../validation/multiuser-m05-execution.md).
