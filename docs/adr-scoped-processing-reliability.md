# Scoped processing reliability and accounting

Accepted by the owner on 2026-10-18. This decision applies to current execution
and does not authorize historical data repair, replay, backfill or compatibility
paths. Verification is recorded separately in
[the regression record](validation/scoped-processing-reliability-2026-10-18.md).

## Decision

The [resource waiting decision](adr-task-recovery-and-execution-budgets.md)
applies to all entry points. Central remains the workflow scheduler. Physical
worker contention returns tasks to durable waiting; minimal execution-fact
receipts support authenticated reconciliation without storing result bodies.
Remote providers without a reconciliation contract retain unknown outcomes.

Memory extraction, independent review and publication remain distinct stages.
Keep account fairness and the existing publication consistency lock. Within an
account, ready model stages rotate by least recent service before operation
fairness is applied. A continuous stream of new extraction batches must not
starve ready review. Do not introduce a fixed extraction/review quota, extra
parallel publication or preemption of running work. Earlier reviewed results
may become available sooner while some new extraction starts later; this does
not promise higher aggregate throughput or change input admission rules.

Preserve fixed host error categories, validation codes and task/run/phase
identities before crossing credential-isolation boundaries. Ordinary execution
errors must not masquerade as missing configuration or requests for owner
context. Do not retain arbitrary error messages, stacks, evidence, credentials
or full traces. Error classification does not grant additional retries or relax
evidence and output validation.

A model configuration lease owns authorization and a frozen configuration. It
is not the identity of a billable measurement. Each independent query or actual
reexecution creates a separate durable usage fragment. Preparing a fragment
does not prove a request was sent; resource waiting is excluded from execution
duration and run counts. Mark issuance at the real send boundary. Replace the
same fragment's cumulative samples, retain received usage on failure, and fold
distinct fragments without dropping cumulative/complete/unknown semantics.
Checkpoint reuse creates no additional consumption. Neither fragment count nor
host task attempts can substitute for an unavailable provider request count.
Missing prices and unavailable usage remain unknown, not zero or actual cost.
Cancellation or revoked execution authority may interrupt only the already
owned measurement, retaining its known quantities as incomplete. This narrow
termination capability cannot create a receipt, add tokens, issue requests or
restore access, and cannot recreate an erased account's data.

Feishu and DingTalk recording connections use the existing connection-detail
navigation and isolated per-account, per-instance credentials. Deployment
prepares supported fixed CLI versions. The page provides configuration and
authorization/reauthorization; the owner completes platform authentication.
Use the required recording permissions, not an unrelated recommended-permission
bundle. Do not migrate global credentials, mutate global CLI installations or
fall back silently to another executable/version. Real authorization and first
sync require separate owner validation.

## Supersession check

| Disposition | Boundary |
| --- | --- |
| KEEP | Account isolation, central scheduling, publication lock, independent review, exact evidence validation, finite safe retries, configuration snapshots, cancellation/deletion fences, unknown-outcome protection and existing retention. |
| CHANGE | Fair service between ready Memory stages; safe execution diagnostics; usage identity and cumulative accounting; current recording authorization UI and deployed CLI contracts. |
| REMOVE | Always admitting new extraction before ready review; arbitrary execution errors labeled configuration failures; lease-ID-only usage deduplication; failed execution discarding known usage; aggregate numeric-only usage merging; host-command-only recording authorization. |
| EXCEPTION | Actual configuration/authority failures retain their category. A known nonexecuted busy request is distinct from an unknown issued call. Unsupported provider reconciliation cannot supply missing facts or result bodies. |
| UNKNOWN | Historical failure causes and charges, supplier data never returned, live model quality, and real organization permission/download/sync behavior until explicitly checked. |

This supersedes the lease-as-receipt identity in the M04 configuration design
and the extraction-first behavior of current scoped Memory scheduling. It does
not adopt the separate ADR-audit capability batches or change retention,
capacity policy, Memory migration cancellation, independent module composition
or document polling defaults.
