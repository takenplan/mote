# ADR: Unified account host and user-journey contracts

Date: 2026-10-23. Status: accepted architecture; implementation in progress.

The owner accepted a modular monolith with shared SQLite, one execution engine,
one account-isolation host, shared evidence/processing capabilities and separate
Memory, Actions and Ask responsibilities. They authorized incremental refactoring,
final end-to-end validation, a PR and new Dev builds. Restoring the single-user
implementation is not the objective. Consistent behavior across accounts and
entry points is. Implementation details are delegated; new user journeys or
major architecture tradeoffs still require an explicit owner decision.

## Boundaries

Clients, HTTP, MCP and background admissions call the same domain use cases.
Each domain receives account-bound repositories, evidence, configuration, models,
workspaces and execution capabilities from the host. Domain code must not choose
an owner, access another account's resources or create a second scheduler. A
shared database is not sufficient isolation: indexes, cache hits, model input,
originals, references, plugins and late publications obey the same owner boundary.

Keep shared deployment and application-level isolation for the current invited-user
MVP. This does not promise process/container isolation or immunity from another
account's heavy workload. It introduces no quotas, microservices, per-user database,
new provider fallback or format migration. Keep current storage/wire baselines;
change a format deliberately only when its representation actually changes.

Shared capabilities describe facts and mechanisms, not a universal business Agent:

- Evidence identity, lineage, source dimensions, typed time and exact authorized
  ranges have one definition used by selection, ranking, pagination and disclosure.
- Decoding and complete-input interpretation can be reused only with matching
  account, input revision/ranges, procedure, model, policy and evaluation contract.
  Recheck current authority on cache hits and retain publication fences.
- Memory independently admits/reviews/publishes memories; Actions independently
  proposes/approves/executes effects; Ask independently retrieves, verifies and
  cites evidence for the current question. Sharing a summary cannot bypass them.
- Query Agents retain read-only tools; captured content is untrusted evidence.
  Models interpret intent and meaning; no semantic keyword dispatch is introduced.

## Lifetimes and authority

| State | Meaning and boundary |
| --- | --- |
| Session | Authorizes interactive access; logout expires it. It cannot remain an implicit background credential. |
| Account/source authorization | Current epoch, source scope and revocation fence every read and publication that requires them. |
| Automation intent | An explicitly authorized, durable request for future work; ordinary parameter edits do not silently revoke it. |
| Admitted task/window | Immutable input and configuration snapshot with a bounded task grant; new configuration applies to subsequent admissions. |
| Evidence incarnation/revision | An explicitly new intake can create a new incarnation; old queues, tasks and archives cannot resurrect deleted data. |
| External effect receipt | Records physical issuance and uncertainty; retry cannot blindly repeat a possibly completed effect. |

Store grant identifiers and immutable inputs, never serialized `UserContext`.
The host validates durable operation/task/policy records and current account
authority before issuing an execution context. Authentication alone does not
authorize a new owner grant. Only an explicit action with the required owner
capability can create or expand one. File reload, archived settings and model
output cannot do so.

## User-journey contracts

1. **Save and run.** All configuration entry points use one validated revision/CAS
   transaction for settings, durable intents and task admission. Local cancellation
   and other irreversible runtime effects follow successful commit. A stale snapshot never
   borrows a newer revision. Ordinary schedule/timezone edits preserve authorized
   future intent and reconcile its next task. Failed publication leaves previous
   authorization intact. A saved setting is distinguishable from running work.
2. **Automation.** The visible owner enable/disable action controls the actual
   policy. Ordinary parameter changes affect the next window. Pause/disable stops
   new admissions; the existing explicit immediate-stop action revokes unfinished
   work. Permission expansion requires explicit authorization. Defaults alone do
   not grant new background access. Missing required models produce an actionable
   waiting/unconfigured state, not a fictitious source or authorization failure.
   An explicit enable after a built-in policy loses its authority admits fresh
   future work; it cannot revive the old grant or old windows. Ordinary Memory
   disable/pause preserves already admitted intake tasks and jobs. It permanently
   closes earlier producer receipts to additional admissions, while preserving
   their authorized use by existing tasks. Unselected consolidation windows freeze
   their eligible members at this cutoff and keep their original due time; later
   arrivals cannot expand draining work. Explicit stop, incompatible recipe changes
   and source/account withdrawal retain their revocation behavior.
3. **Continuous intake.** Ready, eligible new evidence can advance Memory without
   an artificial count or six-hour debounce gate. Authorize the new target ranges
   separately from readable historical context. Revoked/paused historical receipts
   cannot block a valid new target or acquire retroactive authority. Processing
   prerequisites, complete input and independent review remain mandatory.
4. **Find and read.** The same source/time/range request selects the same eligible
   evidence in Ask, Memory context and MCP. Calendar events use their planned
   interval; observed activity uses observation time. Material navigation overlaps
   its members, but disclosure contains only eligible members. Internal canonical
   storage types do not replace the original user-visible source dimension.
5. **Delete and explicitly reimport.** A new explicit upload of the same bytes may
   create new authorized evidence. Old incarnations remain deleted. Retry of the
   same request remains idempotent; new permission is never inferred from an old
   queue or portable archive.
6. **Import capability.** Preserve the general import journey. Use supported,
   deterministic decoding and bounded model capabilities; unsupported content
   receives an explicit outcome. Do not assume unknown bytes are UTF-8, silently
   invent content, execute arbitrary shell commands or narrow the product to a new
   fixed-format policy. Broader binary/document support is not promised by this ADR.
7. **Pause and resume transport.** A paused source leaves queued data pending for
   the same account; a true conflict is distinct. Individual accepted receipts are
   recorded even if a later split request fails. Account switching does not move
   queues, and automatic retries cannot undo source withdrawal or deletion.
8. **Accepted operations.** Logout stops interactive access and device collection;
   a central operation with its own admitted durable grant continues under that
   grant. Explicit cancellation, account revocation and publication checks still
   apply. This does not promise restart replay for operations without persisted
   inputs or grant arbitrary background access to session-only queries.

Existing product information architecture remains authoritative. Report accepted,
waiting, running, completed, paused, cancelled, conflicted, revoked and unknown
results according to the operation's actual facts. Backend module boundaries do
not create new navigation sections or duplicate settings editors.

## Supersession

| Disposition | Decision and affected assumptions |
| --- | --- |
| KEEP | [Multi-user scope](adr-multiuser-scope.md): account host provenance, private resources, shared SQLite/executor, no default owner, admin/private distinction, current authorization fences. |
| KEEP | [Configuration transactions](adr-unified-configuration.md): validation, prepare/publish/rollback, CAS and post-commit irreversible effects; [shared flows](adr-shared-business-flows.md): one business algorithm and account-bound adapters. |
| KEEP | Exact originals, independent Memory review, model interpretation, explicit Actions approval, read-only query tools, result-unknown protection and no compatibility/migration path. |
| CHANGE | Module-specific coordination in configuration, Actions, connectors and Ask automation becomes a common configuration-to-intent contract. Enabled defaults and frozen policy snapshots no longer substitute for the actual owner enable/disable journey. |
| CHANGE | Memory intake distinguishes new targets from historical context; evidence consumers share source/time/member eligibility rather than duplicating canonical projections. |
| CHANGE | Portable import uses operation-bound authority after acceptance; the test expecting session logout to cancel accepted import is superseded. Streaming download remains session-bound. |
| REMOVE | Refreshing CAS behind stale data; treating every edit as revocation; six-hour ready-Material debounce; internal source type as user source filter; pause-as-conflict; session-dependent accepted import. |
| REMOVE | Parallel business implementations used solely to keep old fixtures green, once their valuable scenarios have been moved to current use cases. No blanket deletion before scenario coverage. |
| EXCEPTION | Domain-specific stages, real provider/OS constraints, trusted plugins, deployment administration and physical-effect recovery remain distinct. One contract does not mean identical algorithms for every domain. |
| UNKNOWN | Performance envelope, real-provider/model quality, actual device permission/lifecycle behavior and deploy-specific environment restrictions need separate evidence. |

This refines the ADRs above and supersedes conflicting local rules in
`design/multiuser-{configuration,connectors,actions,ask,memory,processing,lifecycle}.md`.
Implementation must inspect code, tests, UI, configuration, jobs, prompts and
instructions together. Historical audit records retain their original results;
they are not current acceptance claims.

## Current implementation seams

| Responsibility | Shared boundary and consumers |
| --- | --- |
| Configuration save and intent | `ConfigService` owns CAS and atomic publication; `ConfigurationCoordination` carries opaque explicit-actor provenance to Actions and Ask effects. Connectors save their declaration and plugin together at the caller's revision. |
| Configuration and unfinished processing | One final publication participant follows all domain snapshots. It may derive a fixed handoff only from genuine unfinished original intent. Per-original configuration targets preserve unrelated work, and task execution waits for physical cleanup while retaining unknown-effect fences. |
| Account and operation resources | `UserContextAuthority` and `ScopedServices` issue and restrict genuine session, task and bounded import capabilities. `Configurations` supplies model/configuration resources; domains do not synthesize an owner. |
| Evidence selection and disclosure | `evidence-projection` supplies trusted source/time/member eligibility to Ask candidates and `ScopedMemoryData`; exact range validation uses the same source dimension. Canonical IDs and hashes remain stable internal identities. |
| Fresh Memory admission | Producer receipts authorize `targetCaptureId` and exact target IDs; frozen historical `readInputs` remain separately validated context. `MemoryIntake` publishes immediate readiness to the existing task engine. |
| General imports | Shared decoding and disposition validation distinguish supported originals from unsupported bytes; request incarnation and deleted-request tombstones keep retries separate from explicit new intake. |
| Client settlement | Desktop ingress outcome classification is shared by capture and source sync; transport validates each receipt before durable queue settlement. |

Existing `ExecutionEngine`, account-bound model query/usage and original-workspace
ports remain the shared execution mechanism. Actions semantic products and Memory
range evaluation have different procedures, output schemas and evaluation contracts;
they must not be merged into one cache merely because their originals overlap.
Exact prepared-result reuse within a matching contract remains valid and must
recheck authority. This phase does not claim a new cross-domain model-result cache.

Legacy-builder tests remain algorithm/history evidence, not production journey
acceptance. The new regression chains use current host entry points. Removing the
remaining legacy builder requires transferring its distinct valuable scenarios;
that later retirement is tracked separately from the current runtime changes and
must not be reported as already completed.

## Rollout and validation

Deliver vertical chains: configuration → intent → worker/status; intake → exact
evidence → Memory/Ask; transport → receipt → queue recovery; operation admission
→ current authority → publication. Shared contracts have one integration owner.
Do not create another `new-scope` runtime or rewrite domains in parallel without
their consumers. First establish small collaborating slices and grow them.

Follow [the journey validation ladder](testing-unified-user-journeys.md): isolated
module tests, then a few collaborating modules, then consumer checks, and only
after those stabilize run E2E. PR and Dev-build evidence must identify the exact
commit and distinguish generated fixtures from physical-device/live-model checks.
Track progress and failures in the [implementation record](validation/unified-user-journeys-2026-10-23.md).
