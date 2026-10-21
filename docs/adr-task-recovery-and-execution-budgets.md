# Task recovery and task-type execution budgets

Accepted: 2026-10-15, by the owner. The owner subsequently authorized applying
these principles to all Central task registrations and failure handling,
reproducing failures with generated fixtures, and opening a PR after verification.
Historical failures must not be rerun. Defaults are in [task execution
policies](task-execution-policies.md); verification and deployment scope are
recorded separately from this decision.

## Decision

### Default bounded task retries (accepted 2026-10-21)

The owner requested automatic retries by default and explicitly selected **two
retries after the initial execution: at most three charged attempts per round**,
including eligible unknown read-model outcomes. This supersedes the 2026-10-20
per-query confirmation requirement below for this bounded read recovery. It
also supersedes the old family defaults of one, four or five attempts. Existing
explicit operation overrides, such as the foreground embedding query's single
attempt/1200 ms boundary, remain documented exceptions.

Central keeps one scheduler and the same input, recipes, model interpretation,
independent review, publication checks, timing, fairness and user journey. A
retry repairs the failed stage. Valid extraction drafts, accepted chunks,
reviewed outputs and published siblings are reused after their existing current
input checks. A raw completed query rejected by host validation remains immutable
rejected evidence; a fresh failed-stage query gets its own generation and
issuance. The existing maximum two independent review queries and finite
in-session correction sequence apply within each attempt. These are separate
budgets: three task attempts do not mean at most three supplier requests.

The durable logical attempt is separate from the renewable execution fence.
Resource/offline/admission waiting suspends the same attempt without an extra
charge. A wholly known-not-started capacity reservation can be refunded; a later
busy response cannot erase an earlier executed, pending or unknown call in that
attempt. An actually charged interruption, shutdown or lease loss retains its
charge. Restart and internal parent/ACK/program continuation cannot reset the
round. At the cap, a suspended last attempt can complete its remaining stages,
but no new attempt is sent. Only an explicit authenticated owner Retry action
can start another bounded round, retaining the previous round's count/history.
No historical terminal work is reopened or counters reset on deployment.

Automatic unknown read-query replay requires an exact trusted physical cleanup
receipt for that call, fresh account/input/model authority and remaining budget.
The complete callback includes local child, tool queue and workspace cleanup;
engine cancellation/lease release alone is insufficient. Another host using the
same database waits while the physical owner is active. Only its exact original
cleanup closure can mark it quiescent, including after its business fence is
revoked; this cannot settle the remote outcome or authorize publication. Abrupt
process death without such proof stays a visible cleanup prerequisite. PID,
lease expiry, elapsed time, failed usage or absence of a result is not proof.
Pre-tracking historical calls are not backfilled or automatically swept.

Replay writes a distinct policy authorization event. It does **not** fabricate
owner confirmation, successful settlement, remote non-execution or zero fees.
The old call remains unknown/unsettled; bounded repetition can duplicate remote
charges. No additional confirmation dialog is required for an eligible read
query within the selected policy. Existing owner acknowledgments stay historical
facts. Native calendar delivery, OAuth/login/session setup, media worker calls,
plugin probes/invocations and provider CRUD retain their exact operation,
idempotency, approval, execution-fact and cleanup/reconciliation contracts. A
pending ACK is normal waiting; the default never grants a second mutation.
Invalid input/configuration, required owner input, unsupported effects, revoked
or stale authority and unclassified internal exceptions are not repaired by
blind repetition.

The owner's switch from Fast to ordinary service applies to the next new model
retry attempt through a new immutable, tier-only snapshot of the same original
model/reference under unchanged authorization. Historical snapshots, usage,
prices and all other frozen settings remain. A suspended attempt restores its
own snapshot. The original tier remains a checkpoint dependency, so a request
speed change does not invalidate already accepted chunks. Configuration changes
cannot revive a revoked lease. Portable task exports exclude model snapshots
and their lineage; whole-instance backup retains them, and deletion follows the
same fenced domain lifecycle.

KEEP all cancellation, account isolation, source/privacy, worker and strict
independent-proof boundaries. CHANGE eligible failure recovery to a visible
finite default and immutable failed-stage generations. REMOVE confirmation as
the default for eligible automatic read replay, interrupted-attempt refunds and
internal round resets. EXCEPTION: explicit narrower budgets and unsupported
physical/effect reconciliation remain prerequisites. UNKNOWN: historical remote
outcomes/fees, supplier-internal request counts and any incident's cause.

### Historical Memory query decision (2026-10-20; superseded above for bounded read recovery)

The owner explicitly chose to keep main's unknown-outcome protection: a Memory
query interrupted after issuance requires owner confirmation before repetition.
An existing authenticated task retry with `confirmUnknown:true` records that
confirmation; it does not establish the old outcome or rewrite failed/unknown
usage. Preserve the same task, model, inputs, successful stages and account
fences. A successful query result and its exact issuance settlement persist
together and may be revalidated/reused before a later domain save completes.

Definitively ended failures remain normally retryable. Concrete terminal provider
rejections and completed bounded host-validation failures may settle only their
exact external issuance, while keeping the query/domain failed and publishing
no Memory. Timeouts, network failure, unavailable providers, local abort, lease
loss and crashes retain unknown facts. Only concrete trusted types and fixed
terminal category/code tuples establish completed failure; strings, copied
errors and arbitrary provider fields cannot.

KEEP independent review, failed usage, cancellation and publication fences.
CHANGE the previous blanket assumption that every failed issued query remains
unknown; REMOVE unconditional automatic repetition of an unknown reviewer after
restart. EXCEPTION: owner-confirmed replay may incur another call while the old
fact stays unknown. UNKNOWN: unsupported remote reconciliation and lost result
bodies. Historical successful recovery reports retain their original scope;
they do not establish automatic replay under this current decision.

### Cross-client resource waiting (accepted 2026-10-18)

The owner reaffirmed this rule for every client and processing entry point:
when OCR, ASR, a language model or another finite execution resource is busy,
retain the task in a fair queue and resume automatically when capacity becomes
available. Failing to acquire capacity is not a processing failure. Waiting does
not consume execution time or failure attempts, has no generic terminal age,
and remains visible and cancellable. Independent resources may execute in
parallel. Recheck authority and current input before dispatch.

Central remains the sole workflow scheduler. Scoped media processing must share
the physical worker's admission identity, rather than creating separate capacity
for each user or original. A structured worker busy response is an internal
known-not-started fallback: release the claim and return the task to resource
waiting. Do not expose that response as a terminal parent or child failure.

Keep prepared/waiting work distinct from an issued external request. Restarting
while waiting must not invent an unknown external outcome. Execution ownership
leases and physical execution are separate: lease expiry cannot prove that an
issued call stopped, and a late response cannot restore publication authority.

The owner also approved minimal persistent execution-fact receipts: trusted
request identity, worker incarnation, execution state/times and fixed outcome
codes, with authenticated read-only reconciliation. They do not contain original
content, prompts or result bodies, and do not introduce a worker scheduling
queue. A duplicate request identity must not start concurrent duplicate work.
Unsupported remote-provider reconciliation remains explicitly unknown; neither
receipt absence nor a disconnect proves non-execution. Result-body staging is
outside this decision.

KEEP central scheduling, fairness, checkpoints, cancellation, authorization and
late-result fences. CHANGE scoped physical-resource admission and execution-fact
reconciliation. REMOVE busy-as-failure handling and queue time charged as work.
EXCEPTION: invalid input, missing configuration, revoked authority, actual
execution failures and issued unknown outcomes retain their distinct contracts.
UNKNOWN: remote outcomes without provider evidence and the incident's exact
lease-renewal interruption; neither is inferred from worker health.

This implementation targets the current wire/storage contracts only. It does
not repair, backfill or rerun historical data and adds no version compatibility
paths. Separate retention/capacity, Memory admission/context/retrieval, migration
cancellation, modular-composition and document-polling proposals remain outside
this work. The related current-entry-point decisions are recorded in
[scoped processing reliability](adr-scoped-processing-reliability.md).

### Task-type budgets

A durable task must not inherit a universal short processing deadline, such as
600 seconds. Each task type declares its own suitably generous default execution
or timeout policy when its workflow is designed and registered. This does not
require every task to run without a timeout. Workflows can gain stages and
complexity without acquiring an unrelated limit from the common executor.
Queueing and resource contention are normal waiting states, not failed
processing. They must not terminate the parent workflow by exhausting execution
attempts or a generic recovery window.

Task designers declare execution and recovery policy by task type and stage at
registration, rather than relying on a hidden executor fallback. The declaration
can specify a generous task-specific timeout or explicitly no overall timeout,
and separately describe call-level protection. Expected work and workflow
complexity inform this engineering choice; they are not a semantic classifier or
an automatic complexity score. A concrete model request, external protocol or
isolated worker can have an explicit, justified deadline. A workflow-wide limit
belongs to that task's declared policy. A value such as one hour is a possible
generous task or call default, not an approved universal replacement for 600
seconds. Existing explicit configuration values remain overrides at their
documented operation boundary; installation does not rewrite private profiles.

Keep these mechanisms separate:

- Task lifetime and durable progress, including queueing and dependency waits.
- A specific call's transport deadline or worker safety limit.
- Execution ownership leases, renewal and fenced publication.
- Resource admission and the next eligible dispatch time.
- Safe execution-failure retries and model-output correction rounds.

Removing a generic task deadline does not remove cancellation, authorization,
shutdown, lease expiry, worker cleanup or stale-result fences. A lease expiring
does not prove that an external call stopped. Actual elapsed time and progress
remain observable even when they are not a hard execution limit.

## Failure handling contract

Classify failures from structured transport facts and host validation contracts,
not keywords, captured evidence or provider prose. Distinguish lack of execution
capacity from an input exceeding a model's context or format capability.

| Failure or transition | Required handling |
| --- | --- |
| Confirmed resource contention or a confirmed execution-capacity rejection before processing begins | Persist resource waiting, release execution slots and resume automatically when eligible. Do not consume the processing-failure budget or end the parent because a generic attempt/recovery deadline elapsed. Shared backoff prevents repeated immediate requests. |
| Model output that fails a repairable host validation contract | Return trusted, specific validation feedback to the model and allow a finite correction sequence. Repair the failed stage, retain valid drafts/checkpoints, and validate again before publication. Do not blindly restart the whole workflow. |
| A replayable transient execution/transport failure | Use the task type's finite safe-retry policy. Establish replay safety from known non-execution, idempotency or a confirmed failed outcome; keep this budget distinct from capacity waiting and output correction. |
| Deterministic invalid input or an unsupported operation under unchanged conditions | Stop the affected execution with a precise reason. Examples include a corrupt archive or an unsupported format with no configured handler. Repeating identical work is not recovery. A changed input or configuration can support a later explicit run. |
| Missing configuration, credentials, model/runtime dependency or required owner input | Expose the actual prerequisite and wait for repair/action. Do not repeatedly invoke the model or pretend a program failure is a request for owner context. |
| An issued call with an unknown outcome | Retain known issuance and outcome facts; do not use the known-not-started capacity recovery path. Timeout, disconnect, local cancellation and lease expiry do not establish non-execution. Eligible read replay follows the bounded 2026-10-21 policy with exact physical cleanup and fresh authority; side effects retain their original reconciliation/idempotency contract. No unknown fact becomes settled merely by retrying. |
| Cancellation, revoked authority or a stale input | Stop the old authorized execution and reject late publication. Neither model repair nor resource recovery renews authority or revives obsolete work. |
| An unclassified internal exception | Preserve a safe failure receipt for diagnosis. Do not infer that another attempt is safe, that the input is invalid, or that capacity is unavailable. |

A deterministic validator rejecting one model output does not prove another
generation will fail. Finite output correction is required where the host knows
how to ask for a valid correction. A task declares its repair boundary; exhausting
that sequence reports the remaining validation failure. The 2026-10-21 decision permits a bounded new failed-stage generation after
that sequence ends; it never reuses a rejected query as a new attempt or
blindly restarts valid stages. Existing model-repair limits are
not increased by this decision. Evidence changes, revoked grants and unknown
execution are not repairable output errors. Feedback uses host-controlled
instructions; captured content remains untrusted evidence.

Resource recovery is durable waiting, not an unlimited stream of outbound
retries. Recheck resource eligibility and current authority before dispatch,
preserve fair scheduling and avoid holding a transaction or physical execution
slot while waiting. A prolonged wait remains visible and cancellable; this
decision adds no queue cap, expiry, retention rule or automatic terminal age.

## File and worker admission

Reuse the central durable executor for resource admission. Transcription and
diarization on the same physical worker share capacity; central alignment and
language-model stages do not hold that ASR resource. A worker's explicit
pre-execution busy response, with Retry-After, provides a fallback for occupancy
that the central scheduler cannot observe. Central state, API and diagnostic logs
must use the same next-eligible time and waiting reason.

Both parent pipeline and child stages need consistent waiting, attempt and
deadline semantics. Changing only the error category after claim is insufficient:
the current claim already increments attempts. Central lease release must not be
mistaken for physical worker release, and an unknown call must not be treated as
either proven idle or permanent occupancy of the whole service.

The central executor remains the workflow authority. A worker-side persistent
job queue, distributed coordinator, new queue limit or short-job priority policy
is outside this implementation. Independent central databases cannot coordinate merely by
sharing the current SQLite lease mechanism.

## Supersession check

| Disposition | Boundary |
| --- | --- |
| KEEP | One central execution authority; archived originals and upload acknowledgements; successful checkpoints; fair scheduling; source/privacy/configuration checks; cancellation, leases and fences; unknown-call guards; finite safe-failure retries and finite model correction; existing model bindings and retention. |
| CHANGE | Each task type explicitly registers its own generous default timeout policy and recovery policy when the workflow is developed. Confirmed resource waiting is separate from failed execution and must propagate through parents without ending the workflow. Call limits are independent from task lifetime and waiting. |
| REMOVE | A short common deadline as the default task lifetime; queue wait consuming processing time; every busy response consuming a failed-processing attempt; resource waiting ending merely because the common four-attempt or six-hour rule elapsed; unclassified exceptions assumed transient; log-only retry delays differing from scheduling. |
| EXCEPTION | Specific model/transport/worker limits remain possible with an explicit rationale. Model context overflow is not worker contention. Actual transient failures can retain finite recovery. Issued unknown calls, stale authority and deterministic failures keep their restrictions. User-configured limits require an explicit transition decision. |
| UNKNOWN | Performance and quality of real long inputs under the declared defaults; multi-worker or independent-central coordination; identity and physical release history of the worker involved in the incident. |

This supersedes conflicting policy in [execution-engine](execution-engine.md),
[provider-failures](provider-failures.md), [file-processing](file-processing.md)
and the task-wide deadline interpretation recorded in the dated
[audio timeout validation](validation/audio-processing-timeout.md). Current behavior is described by [task execution policies](task-execution-policies.md);
the dated validation retains the old implementation and results. The bounded
recovery wording in [recording outcomes](adr-recording-outcomes-runtime.md),
[range evaluation](adr-memory-range-evaluation.md) and
[system refactor](adr-system-refactor.md) continues to apply to actual failures,
not confirmed resource waiting. The retained total-deadline wording in the
[Ask simplification decision](adr-ask-evidence-quality-and-simple-context.md)
does not establish a universal task deadline under this decision. The
[request admission decision](adr-central-request-admission.md) and
[honest Memory failure states](adr-memory-evidence-delivery-and-failure-state.md)
retain their authority. No new semantic fallback or smaller substitute input is
approved. Dated validation results remain historical evidence.

Inspected assumptions include the executor's default timeout/attempt/window,
parent/substep replay, file and format workers, query/delegation/import/lifecycle
deadlines, provider cooldowns, model correction contracts, runtime configuration,
failure projections, tests and repository instructions. Existing tests that
expect busy exhaustion or a log-only delay describe behavior to supersede; they
do not decide the intended policy. Runtime migration must inspect the affected
prompts, UI, configuration, jobs and consumers before claiming completion.

The implementation replaces the executor's implicit two-minute limit and
large-number no-deadline stand-ins with explicit registered policies. It separates
file pipeline/call deadlines, starts format/asset timers after slot admission,
and removes model-budget wall-clock wrappers around query queues. HTTP providers
can omit an Agent total while retaining their request timeout. Memory/source/DAG
coordinators no longer inherit a short total across their child calls. Nested
model correction remains finite; outer lifecycle recovery cannot blindly reopen
a terminal child. The shared execution protocol projects resource waiting;
provider adapters retain transport facts and task types own recovery decisions.

## MVP scope and validation

Historical terminal failures can be rerun manually in MVP. Do not build a
historical recovery migration, reset attempts on deployment or automatically
reopen old work. The 2026-10-21 default removes per-call confirmation only for eligible bounded
read recovery. It does not itself execute a historical owner retry or waive an
unsupported physical/effect prerequisite. The separate Android Memory
continuity issue is outside this ASR repair.

Implementation validation must use generated content and real product entry
points: long multi-stage work, bulk resource waiting and eventual progress,
model validation feedback and finite correction, deterministic failures, unknown
outcomes, cancellation/authority changes, restart, checkpoint reuse and agreement
between API/logs/actual dispatch. Cover contention across stages and independent
resources, and any multiple-worker/central topology that is explicitly supported.
The initial documentation-only discussion ran no fixtures. Implementation
fixtures and final affected checks are recorded in the [verification
record](validation/task-execution-policies-2026-10-15.md). Private historical
scenarios are not automatically counted as passed tests; physical-device and
live-model validation remain separate.
