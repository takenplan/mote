# Memory preserves a continuous domain batch

Status: accepted restoration of the original production journey, 2026-10-18.

External-stage boundary: the [plugin replacement decision](adr-plugin-center-memory-replacement.md)
changes declared stages inside this batch, not Mote's batch lifecycle, original
authorization, independent review or fenced publication. Mem0 supplies the pinned
CRUD/retrieval modules; Hindsight may supply its declared native draft stages.
Neither installs a second Mote scheduler or bypasses the final host save. Supported
bindings and validation limits are in [Plugin center](plugin-center.md).

The original production `memory.batch` handler at `2c262762` continuously prepared
evidence, extracted or reused exact candidates, corrected, independently reviewed,
staged and committed one batch. The interim scoped implementation through
`1c9be37b` replaced that continuation with three independently admitted tasks.
Dependencies and stage fairness ordered those tasks but did not preserve the
original batch continuation. It also discarded valid unified Coding candidates,
combined distinct provenance targets and created Owner questions before saving.

The scoped host restores one `memory.batch` task per final target batch. It
persists preparation, draft, review, prepared write and successful-save checkpoints
without workflow reentry between them. A retry preserves successful stages and
successful sibling batches. A completed save receipt prevents replay if the host
stops before task completion is projected.

The shared ExecutionEngine remains the only scheduler and authority for durable
tasks, leases and resource exclusion. A trusted handler can admit each model call
through the existing fair physical gates and acquire an owner-derived publisher
resource during its running continuation. Call protection budgets exclude
admission/resource waits; the first physical call or effect starts its attempt.
Static and dynamic publishers in separate processes share the same fenced locks.

Complete Coding understanding candidates may replace extraction only when their
host generation identity, policy, work contract, model snapshot and exact target
ranges match. Incomplete or mismatched preparation remains an untrusted lead for
ordinary extraction. Either path receives a fresh independent review. Final
target batching retains trusted source/device/provider/project/session identity;
semantic candidate domains remain the model's decision.

The save and its actionable Owner questions are one fenced transaction after
provider staging succeeds. An unfinished, unknown, failed or cancelled save cannot
create an answerable continuation.

| Disposition | Decision |
| --- | --- |
| KEEP | Account/configuration/source grants, immutable model snapshots, independent review, exact read receipts, unknown-provider journal, cancellation/deletion fences, safe diagnostics and successful siblings. |
| CHANGE | Restore one continuous batch with durable internal checkpoints, per-call admission, effect-scoped publication, exact Coding reuse and provenance grouping. |
| REMOVE | Independent extract/review/publish tasks, unconditional repeat extraction and pre-save Owner questions. Their tests and current-behavior documentation are superseded. |
| EXCEPTION | Current wire/storage only; no historical task migration, replay, fallback to the global host, additional paid retries or new owner steps. |
| UNKNOWN | Scripted providers establish host behavior. Live semantic quality, real provider accounts, physical clients and qualified cross-module concurrency require separate evidence. |

This decision preserves the existing context-reading, range-evaluation and Coding
product decisions. It changes the scoped orchestration adapter, not those product
policies or the model's responsibility for selecting and interpreting evidence.
