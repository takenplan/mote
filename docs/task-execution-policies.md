# Central task execution policies

Each task registration selects an explicit policy from
`apps/server/src/execution-policy.ts`, with an operation-specific override where
needed. The executor has no implicit two-minute or 600-second deadline. `null`
means no workflow total, rather than a very large timer. The
[decision](adr-task-recovery-and-execution-budgets.md) separates task lifetime,
call protection, resource waiting, safe failure retries and model correction.

## Registered defaults and their reasons

| Task family | Execution budget | Actual failure attempts | Reason and narrower protection |
| --- | --- | --- | --- |
| Ask/Insight coordinators and delegated work | No workflow total; an explicit internal caller deadline can cap an admitted fragment | Query/Insight observation 1; replayable delegation up to 4 | Can yield to children or wait for model capacity. Each admitted Agent owns its configured model/tool/correction budget. Non-replayable observations are not resubmitted on restart. |
| File pipeline and summary coordinator | No workflow total | Child steps own finite retries | Extraction, diarization, alignment and model stages cannot inherit time already spent by earlier stages. Successful artifacts and summary pages are checkpoints. |
| Local ASR, diarization and OCR calls | One hour by default; existing explicit file `timeoutMs` is a per-call override | Up to 4 typed safe failures | Managed audio workers already have a one-hour subprocess limit. Call time starts after admission; unknown file outcomes retain their issued-call guard. |
| Model sessions | One hour of admitted work by default; explicit profile values or `null` preserved | Outer task policy; finite output correction remains separate | Counts actual model/tool/repair work, excluding host gate waits. HTTP requests retain their five-minute default and ten-minute maximum; Codex owns internal model requests. |
| Actions extraction | No outer total | Up to 2 typed safe failures | Agent sessions own their admitted-work budget; an outer timer must not charge model-queue waiting. |
| Memory batches, lifecycle windows and provider preparation | No multi-stage workflow total | Batch up to 4; lifecycle extension declares a finite bound | Individual model calls retain protection. Prerequisite and child waits are not execution failures; failed children are not reopened by an outer loop. |
| Material organization, deterministic DAG and derived-image work | 15 minutes per admitted operation | 1 for deterministic work | Bounded current-input processing. Larger workflows keep separate checkpoints; semantic/model work has no outer model-queue timer. |
| Material FTS, consumer planning, image exclusion and Memory input binding | 5 minutes per admitted operation | 1 | Bounded local/metadata projection without external model waits; input/version fences remain. |
| Background embeddings | 5-minute operation protection; each HTTP call 45 seconds | Up to 4 typed temporary failures | Single-vector transport and bounded responses. Query vectors retain their explicit single-attempt deadline after pool admission and existing lexical recovery. |
| Recording discovery, metadata, transcript and media acquisition | No combined phase deadline | Up to 5 typed temporary failures | Phases contain multiple CLI/HTTP/archive operations with concrete transport limits; readiness and invalid export structure remain separate. |
| Import prepare/commit and source archive | No workflow total | 1; concrete children/calls own recovery | Can decode containers, organize inputs and invoke an Agent. Unknown exceptions need diagnosis, not another identical full import. |
| Plugin installation/check and bookkeeping/reconciliation | One hour per operation, or no total for an explicit orchestrator | 1 actual failure | Generous control-work protection; pending reconciliation is a declared wait. |
| Format decoding and asset hashing/encryption/staging | 15 minutes after a local worker slot is acquired | Caller owns recovery | Supports large originals and retains subprocess cleanup; queueing consumes no processing budget. |
| Memory deletion comparison | No default total over all candidate/rule comparisons | Existing per-call correction/recovery | Comparison count varies; each model call has its own policy. Explicit internal caller/test limits remain supported. |

The policy families provide a one-hour baseline for an actual isolated operation.
Registrations deliberately select narrower local work or no workflow total by
responsibility; this does not make every task a one-hour task. A source-AST
regression checks that every production registration declares its policy.

The fixed Python Source Pack sandbox retains its separate 30-second default and
120-second maximum for one hash-pinned script invocation. Its timer starts after
subprocess creation, alongside existing memory, filesystem and network limits.
Health probes, OAuth expiration and preview lifetimes are separate protocols.

## Waiting and recovery

Known capacity waits persist their reason and next eligible time without using a
processing-failure attempt. They release execution leases and preserve the parent
workflow and completed children. Normal shutdown and expired ownership leases
represent interruption, not a confirmed processing failure. Unknown issued file
calls still prevent automatic duplicate requests under the existing guard.

Scoped media resolves a physical listener identity from its frozen M04 snapshot
before task admission. Different users and originals share that listener's
capacity; independent listeners remain independent. A durable queued task has no
issued-call receipt. Model-task protection starts after its physical model gate
opens. OCR/ASR transport issuance is recorded immediately before sending, rather
than before preparation or capacity waiting. Restarting queued work therefore
does not manufacture an unknown external outcome. Structured known-not-started
busy responses retain a `not_executed` call fact and return the task to waiting.

An actual issued request remains a separate fact from the renewable execution
lease. The authenticated local workers accept a trusted request identity and
keep content-free metadata in a private SQLite journal: worker incarnation,
stage, execution state, times and fixed outcome codes. An identical request ID
cannot start a second execution. Authenticated scoped status reads can establish
that the first call is still running, failed or completed. A missing fact, an
unsupported provider or a former incarnation's unfinished fact remains unknown.
There is no worker scheduling queue, provider-message classifier or result-body
cache. A completed call without a durably accepted artifact requires an explicit
ordinary retry (`processor_result_unavailable`); it cannot publish a missing or
late body. Explicit unknown-outcome replay confirmations remain separate from
evidence of completion and do not erase the old unknown fact.

Worker metadata cleanup follows the existing account/processing deletion
operation. Exact request/scope/snapshot cleanup intents survive execution-task
deletion. A purpose-limited configuration capability can erase those receipts
using their frozen transport without restoring a model lease or business
execution authority. A running receipt or unavailable erasure remains pending.
Native receipt files also follow the profile directory lifecycle; Docker uses
the profile's private worker-facts volume. No new time-based retention rule is
introduced.

Resource waiting does not expire under a generic six-hour window. Actual typed
failures have the registered finite attempt bound; explicitly task-specific
recovery windows remain supported. Unclassified exceptions are not assumed
transient. Model validation receives trusted feedback and finite correction;
revoked authority and deterministic invalid inputs do not enter that loop.

Managed ASR extraction/diarization and managed OCR use opaque physical-listener
resource keys shared across stages and database connections. Worker busy feedback
sets a persistent shared cooldown. Five seconds is a busy availability recheck
interval, not an estimated finish time. Custom OCR services retain configured
concurrency while sharing their explicit busy cooldown. Independent central
databases do not gain distributed fairness or exactly-once worker execution.

The persisted next-eligible time drives API and structured waiting diagnostics.
Model gates recheck cooldown after admission. Web requests do not translate a
model execution budget into a second wall-clock deadline that includes waiting;
explicit cancellation remains available.

Memory model work first rotates between users, then between ready host-declared
stages, then between operations. Continued extraction arrivals therefore cannot
indefinitely precede an already ready review. Stage service history survives
restart; cancelling a waiting stage does not consume a turn. Concurrency limits
and running work are unchanged. Local ASR alignment releases its settled physical
worker resource before continuing; resource release is bound to the current
execution fence, so a later claim must acquire capacity again.

## Existing work and validation

No historical terminal task is reopened and no historical attempt counter is
reset on deployment. New file defaults do not revive old failed work. Manual
retry retains current-input, permission and unknown-outcome checks. Original
uploads, completed artifacts and retention rules remain intact.

Registration and parent replay do not retry a terminal failed child. Explicit
manual recovery may retry its failed children without discarding successful
checkpoints. Unpublished intermediate Agent rounds remain in-memory session
state; they are not an exactly-once or cross-restart checkpoint guarantee.

An automatic Insight window can replace its precisely linked failed observation
only during that window's scheduled, finite typed-transient recovery. The old
observation remains failed. Restart alone, an unclassified outcome, a permanent
failure or cancellation does not authorize a replacement observation.

A confirmed import retains its canonical commit identity across lease
interruption and resumes after its saved record position. Only that internal
execution grant can continue an `importing` job; the owner confirmation API still
requires its reviewed preview, and completed imports are not rerun.

See the [generated regression and verification record](validation/task-execution-policies-2026-10-15.md).
