# Common execution engine

> Applicability (2026-10-21): current production uses the epoch-5 scoped composition. The earlier `Perception` and Context DAG descriptions below retain their original runtime/API scope; the scoped continuous-batch section records the current execution port. Memory's expected task clock and neutral procedures, and confirmed caller gaps, are documented in the [runtime contract investigation](audits/memory-runtime-contract-investigation-2026-10-20.md).

Task types register their own explicit [execution policies](task-execution-policies.md),
following the [2026-10-15 decision](adr-task-recovery-and-execution-budgets.md).
There is no implicit short deadline. Coordinators can declare no workflow total;
concrete calls retain justified operation limits. Confirmed resource waiting does
not consume processing-failure attempts or a generic recovery window.

The default is initial execution plus two eligible automatic retries. Durable
logical attempt sessions survive resource suspension; round-reset events retain
prior counts. A successful earlier call prevents a later busy/not-started wait
from refunding the session. Charged stop/lease interruptions remain counted.
Only the explicit authenticated owner Retry path starts another round; internal
parent, program and exact ACK continuations preserve it. Current task/operation
views project maximum, retries used, remaining attempts, round and exhaustion.
A final suspended attempt is not displayed as exhausted while it can finish.

M05 stores content-free physical call ownership independently of execution
leases. Its exact callback cleanup closure records quiescence after child/tool
and workspace cleanup. Automatic declared read-query replay requires that
receipt, fresh authority and budget, and records policy permission separately
from owner confirmations. An active callback on another database connection
still prevents sending after an engine lease expires. A crash without cleanup
proof stays a prerequisite; neither a PID nor numeric usage clears the barrier.
Rejected raw query artifacts retain their exact output and settlement, while a
new bounded query generation repairs only that failed stage. See the current
[recovery decision](adr-task-recovery-and-execution-budgets.md).

`ExecutionEngine` is the authority for current steps. It persists their immutable input description, operation ID, pool, attempts, retry time, lease and commit fence. Domain handlers define admission checks, an asynchronous read/process function and a synchronous host commit. A stale or cancelled fence cannot commit. Output and the success state are one SQLite transaction; a failing commit rolls both back. Current storage epoch 5 installs its scoped schema and does not reconstruct historical jobs or receipts; see the [multi-user integration decision](adr-multiuser-main-integration.md) and [MVP baseline](adr-mvp-baseline.md).

Pool capacity is checked inside the claim transaction, including leases held by other database connections. Fairness uses a monotonic admission sequence per operation, independent of clock resolution. Configuration and capacity waits do not consume processing attempts. Typed safe transient failures have the registered finite limit; unclassified exceptions stop for diagnosis. A noncooperative plugin cannot hold shutdown or a cancelled slot indefinitely. Physical provider cancellation still depends on that provider honoring the signal; late local results remain fenced.

Admission waits yield an event-loop turn after persisting their decision and releasing the transaction, before a completion wake or explicit drain can pump again. Completion wakes in the same turn are coalesced. A large backlog of short admission waits must leave timers, provider callbacks and lease renewal runnable. This preserves existing pool limits, retry times, attempts and processing scope; it does not extend leases or processing deadlines. See the [admission fairness regression](validation/execution-admission-yield.md).

Operation membership has an inverse index by step and active state. State/lease projection updates use this path to reach the owning operations without scanning the full membership history on every admission wait or lease renewal.

Each retained step can keep one latest failure receipt with its fixed failure
category/code, state, attempt, phase and known host work/batch/run/cause IDs.
Receipts exclude provider prose, prompts, evidence and stderr; they are private
metadata with quota accounting and cascade when the owning step is deleted. A
receipt-write failure increments `execution.failureReceipts.writeFailures` in
diagnostics without replaying the business operation. A missing or unreadable
retired input cannot suppress the fixed failure fields.

Server shutdown first stops feature admission and recurring scheduling in Fastify's `preClose`, then closes the shared executor while handlers and storage are still available. After execution settles and HTTP requests drain, `onClose` disposes feature/plugin resources and closes storage. Handler removal on a live shared executor similarly stops only that handler's claims and interrupts its local work; it does not cancel the queued backlog. `cancelled` remains terminal for explicit cancellation.

| State at shutdown | Durable state and restart behavior |
| --- | --- |
| Queued, never started | Remains `waiting`; restart can schedule it without losing the task. |
| Model/configuration admission wait | Retains `blocked`, its reason (including `model_missing`) and zero attempts; existing readiness rules can resume it. |
| Retry wait | Retains its retry time, attempts and recovery deadline. |
| Running replayable program/substep | Becomes `waiting/interrupted`; the revoked signal/fence prevents late commits. Completed checkpoints and artifacts stay `succeeded` and are reused on replay. |
| Issued file processor with unknown outcome | Retains an `unknown` request record, including when the provider ignores abort. Restart blocks another request until the owner confirms retry; a disposed runtime cannot erase the record with a late response. |
| Non-replayable synchronous query, Insight or Import execution | Records `failed/interrupted` and requires explicit retry, rather than resubmitting an unknown model request. Admission/confirmation blocks remain intact. |
| Succeeded, failed, stale or explicitly cancelled | Retains its existing state; shutdown does not reopen it. |

These are durable scheduling states. A provider can still be executing remotely after local shutdown; abort revokes local publication authority and does not establish that the remote call stopped. Generated fixtures exercise the real `app.close()` order, model readiness after restart, substep checkpoints, unknown outcomes and explicit cancellation; they do not constitute physical-device or live-model validation.

Material publication records index intent without writing FTS. A separate `material.index` step and `material-index:<materialId>` Operation commit the search projection and restored search authority together. Index failure never rolls back published text or reruns its organizer/model. Owner metadata exposes independent index state and an index-only retry. A revised, disabled, retired or deleted Material invalidates the old index generation before it can commit.

Ask, Insight and Import features bind their business runtimes to `ServerFeatureScope`. Disposal revokes route and agent contributions, cancels their own current execution steps, aborts model/container signals, waits for fenced local work and releases their handlers/timers. Shared execution pools and unrelated features stay available; retained results and original uploads remain archived. Initial import expansion also fences uncooperative late results and removes late temporary output. Generated application fixtures exercise disposal during all three business operations and container expansion.

Screenshot OCR uses the shared execution engine. Its immutable raw-image identity avoids treating newly generated OCR text as a changed input to its own step. OCR caches share an image result while preserving independent observations. Current scoped M06 processing can also run authorized image-understanding steps under its selected processing policy and image recipe. This background processing is separate from an authorized query agent's on-demand original-image read; enabling either does not grant the other's authority. The legacy Perception composition calls `Perception.prepare()` and `ExecutionEngine.tick()`; `Perception.tick()` is its explicit fixture/drain entry point.

The Context DAG uses the same engine. Domain code validates input fingerprints, checks lane enablement and commits artifacts; it no longer owns leases or retries. Current writes create canonical execution steps directly; old DAG authority and historical receipt reconstruction are removed. Shared cached steps are linked to every workflow operation through `execution_operation_steps`. File processing is a replayable program: the engine owns both the pipeline and each artifact-producing substep. Restart reuses completed extraction, while a failed diarizer alone reruns. Parent/summary dependencies, cancellation, restart leases and commits use the same engine. Dynamic substep definitions are reconstructed on replay and serialized by stable identity, so switching configuration cannot race the old definition. Missing-model and configuration admission blocks do not consume an attempt; audio has a per-file duration bound, not a daily-minutes budget. Memory batches use the same current authority: the former ready queue, worker map and dispatcher are removed. The shared engine claims batches and atomically commits memories, evidence checkpoints and success. Exact quote validation and its two-generation repair contract remain domain behavior. Model generation counts remain distinct from execution attempts. Resource claims serialize the same evidence across SQLite connections while independent evidence can run concurrently. Completion observers and lifecycle activation do not claim work; lifecycle retry windows and disabled settings still govern activation. Leases renew every 10 seconds and expire after 30 seconds if the process dies, independently of a potentially long model deadline. Query, insight, import, lifecycle, action analysis and embedding also use canonical steps, with an owner-only Operations read model; see [execution closure](operation-import-insight-closure.md) and [Operations](operations.md). This does not imply that client WorkManager or external workers are owned by the central executor. `perception_jobs` is the current ingestion outbox and domain status projection; it does not restore historical execution authority. Historical engine fixture tests did not use live model calls; current cleanup validation is reported separately in the MVP record.

## Trusted delegated lanes (2026-10-10)

The existing delegated-agents pool derives lanes from host-registered coordinator profiles; children inherit their parent lane. Background effective capacity is min(agentConcurrency,32), interactive capacity is interactiveConcurrency, with no borrowing/preemption. Claims count leases by lane inside the same SQLite transaction, including other connections. Durable query recovery preserves successful child artifacts and a bounded workspace; citation permission still requires fresh delivery. Capacity cooldowns do not consume failed-processing attempts; typed actual failures retain their registered finite policy. See [ADR](adr-system-refactor.md).


The scoped production composition binds the existing `ask.models` pool to trusted
interactive/background lanes and binds `memory.models` to the live instance
Memory concurrency setting. A settings publication wakes durable queued work;
a reduction leaves running work to settle normally. Physical harness gates,
account fairness, resource locks and commit fences remain in place. See the
[scoped parity supersession and regression matrix](validation/execution-parity-2026-10-18.md).

## Continuous scoped batches

A host-registered continuous batch may choose `modelAdmission: 'per-call'`.
It remains one durable Execution task. Each logical attempt retains its
immutable M04 snapshot; a new charged attempt may derive the tier-only retry
snapshot described above without changing earlier checkpoints. Each `withModel` invocation independently enters the existing account-fair
physical gates and creates its own measured usage receipt. Capacity waits do not
start the task's first physical attempt or consume a call protection budget.
Subsequent calls receive their own protection budget inside admission.

The host-only `TaskRun.withResource` port derives the owner from the current
context. It shares the engine's static resource locks through a fence-bound
`execution_dynamic_resources` reservation, acquiring only for an actual effect.
Acquisition waits retain the running continuation, recheck the grant and hold no
resource. Static publishers in other processes see the same reservation. Release,
cancellation and lease recovery cannot leave a current lock behind; reservations
and pending requests from expired fences are reaped. Durable resource requests
share account/operation turns with ready static publishers. These turns use the
existing engine fairness tables and one consistent order across resource keys;
new arrivals cannot win by racing a local polling timer. A static peer must pass
the same `capacityAvailable` predicate as tick and transactional admission,
including live limits, durable leases and unsettled local work. An already
running continuation does not acquire another pool slot. Reacquiring a released
static resource restores visible ownership for that effect and then its released
state. A fence-bound attempt-charge receipt prevents interruption of an unstarted
call from refunding an older failure. These current tables are required by stopped
backup admission as well as the source inventory. Resource names and owners are never model or
client capabilities. Domain source/configuration checks still run after waiting
and before every external effect and fenced commit.

This port restores Memory's original single `memory.batch` continuation; it does
not add a domain scheduler or require model stages to reenter the task workflow.

Automatic consolidation splits a frozen pending set into bounded, disjoint
selections. The remaining window does not consume the preceding selection's
results, so it has no success dependency on those batches. A failed, paused or
owner-blocked batch leaves independent selections runnable under the existing
concurrency, resource locks, original due clock and count threshold. Retrying a
batch reuses its successful stages; it does not replay completed siblings.
Cancelling one job affects its selection and genuine derived work, while the
disjoint remainder may continue. This replaces the former implicit cancellation
of the remainder through the success dependency. Global Memory stop, revoked
authority and changed or deleted inputs retain their existing fences. Existing
historical dependency failures are not automatically reopened.
