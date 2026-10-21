# Central task execution policies

Each task registration selects an explicit policy from
`apps/server/src/execution-policy.ts`, with an operation-specific override where
needed. The executor has no implicit two-minute or 600-second deadline. `null`
means no workflow total, rather than a very large timer. The
[decision](adr-task-recovery-and-execution-budgets.md) separates task lifetime,
call protection, resource waiting, safe failure retries and model correction.

## Registered defaults and their reasons

| Current Central policy family | Execution protection | Default charged attempts | Scope |
| --- | --- | --- | --- |
| `orchestration` | No workflow total | 3 (initial + 2 retries) | Coordinators retain successful children; internal continuation never resets a child's cap. |
| `deterministic` | One hour per admitted operation | 3 for eligible transient failures | Deterministic invalid input remains terminal; the cap does not make it repairable. |
| `localProcessing` | One hour; explicit worker/file call overrides retained | 3 | Media first reconciles the original exact worker request and cleanup. No duplicate live execution. |
| `modelCall` | One hour of admitted work; continuous Memory protects each physical query rather than a multi-stage total | 3 | Memory, Ask/Insight, file analysis and action extraction use the current M05 policy. Existing Agent correction and two-pass independent review remain separate finite budgets. |
| `networkAcquisition` | One hour per declared operation; protocol readiness/transport deadlines remain separate | 3 | Typed temporary acquisition failures; missing credentials/readiness are prerequisites. |
| `control` | One hour per operation | 3 for eligible transient failures | Unclassified bookkeeping errors require diagnosis; native/plugin/provider effects retain exact operation reconciliation. |

Explicit current operation overrides remain: `ask.embedding-query` has one
attempt and 1200 ms for foreground retrieval with its existing lexical
continuation. Per-request/profile timeout values and `null` retain their existing
meaning. The quarantined legacy composition also has explicitly narrower
registrations; its older query/action/lifecycle bounds are not the current M05
family defaults. No old-version migration or alternate scheduler is added.

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
workflow and completed children. Normal shutdown and expired ownership leases represent interruption and retain
an already charged attempt. They do not prove that physical work ended. A
suspended resource wait resumes its same logical attempt and count. The default
permits two automatic retries, never an unbounded outer loop.

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
late body. For eligible read-model calls, exact completed local cleanup and fresh authority
permit bounded policy replay without a separate confirmation dialog. A distinct
policy replay journal retains the old unknown call; it is not an owner
confirmation or remote settlement. Native/media/plugin/provider operations keep
their original exact reconciliation contracts. An abrupt crash without cleanup
proof remains a prerequisite, even if the execution lease expired.

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
