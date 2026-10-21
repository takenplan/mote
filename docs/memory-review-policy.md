# Bounded memory review reuse

New Memory candidates receive an independent read-only model review. The host always validates schema, exact quotations, citation membership, supplied ranges and current evidence versions. A successful internal review and host validation activate Memory automatically; no owner confirmation step is required.

Visual claims may instead cite a host-verified delivered image view. The reviewer
must independently read its own current original or a region covering retained
visual proof; the draft's pixel receipt supplies no reviewer delivery authority.
Dropping an unsupported claim does not require a redundant pixel request. OCR
quotes retain the text contract; generated interpretation is not original proof.
See [image processing](image-processing.md#independent-memory-image-proof).

`bounded-exact-review@1` permits reuse only for a previously reviewed, identical bounded extraction. It does not classify text, topics or intent, and never trusts a candidate's own claim that it is low risk. The key covers the candidate JSON, outer citations, all semantic request fields, the host-owned task time, the admission rules, full original records including source/speaker/time/version metadata, a digest of the selected model configuration, and the current deletion-policy snapshot. Changed credentials, models, scope, source metadata, dates or instructions invalidate reuse. Consolidation, open archive retrieval and requests without a frozen task time always receive a fresh review.

The intended contract pins a manual job's model current-time context to its persisted creation time, including retries after midnight; automatic intake retains its reception-time context separately from original event time. Both model runtimes consume the same context contract. The current scoped host instead derives that input from original timestamps and does not persist the intended evaluation clock in its task input. This confirmed deviation and the required regression scope are recorded in the [runtime investigation](audits/memory-runtime-contract-investigation-2026-10-20.md); this guide does not approve the changed meaning or claim it is repaired.

Reuse is process-local and archive-local, limited to 128 entries and 8 MiB of output, with a five-minute expiry. It is an optimization, not authoritative storage. Restart or eviction requires an independent review when no durable successful query checkpoint exists, subject to the issued-call recovery guard below. Entries are copied on read, and shutdown clears them. Cache hits validate both the new draft and saved verdict again and check source/config snapshots before and after validation. Cancellation, deletion, validation failure or changed inputs prevent reuse and commit. No pending model result is shared across callers.

A candidate stores a host-authored receipt with the policy, decision, draft run, original independent review run, model when reported, frozen task time, validation time input digest, exact result hash and deletion-policy snapshot. Reuse retains the original reviewer identity and does not create a second usage receipt or count unknown usage as zero. A fresh independent review can activate an identical current draft that has not yet been admitted, using the new receipt. The Web detail shows internal review history and effective state; old records do not receive invented review history.

A useful recovery case is a successful model review followed by a failed database commit: the candidate and checkpoint roll back together, and retrying the same durable job may reuse the verified review without paying for another review call. All result and checkpoint writes still pass the execution engine's cancellation/version fence.

Extraction drafts have a separate durable stage store. After host validation and before review, a draft is saved against its exact batch, semantic request, complete originals, model configuration and policy/skill identity. Review timeout or shutdown retains that draft for revalidation, while an uncertain issued review follows the bounded read-query recovery conditions below. Review timeouts do not split extraction ranges. Drafts are private, unindexed, absent from job API payloads and excluded from Memory until review and commit succeed. Each vault retains at most 128 drafts/8 MiB, with a 512 KiB per-draft bound and normal storage accounting. Completion, source invalidation/deletion and job cancellation purge dependent drafts; changed inputs invalidate reuse. Eviction permits regeneration. No draft reuse creates another model usage receipt. The process-local verdict cache alone does not authorize replay after restart.

## Scoped issued-query recovery

The owner selected bounded automatic retries on 2026-10-21: at most two retries
after the initial charged attempt, including eligible unknown read-model calls.
Automatic replay requires the exact original physical callback to be proven
quiescent, fresh account/input/model authority and remaining round budget.
Restart, a PID disappearing, lease expiry or failed usage does not establish
cleanup. Untracked historical calls are not backfilled or automatically swept.

Replay retains the old unknown/unsettled journal and uncertain fees and records
a separate policy authorization, never an invented owner acknowledgment. Calls
without those prerequisites and side effects keep their original reconciliation
or authenticated owner-retry requirements. Only an explicit owner Retry starts
another finite round after exhaustion; it neither approves a candidate nor
restores revoked authority. Valid saved stages and original frozen settings stay
bound; a new retry attempt may apply the approved tier-only model snapshot.

A definite HTTP rejection or a completed bounded host-validation failure settles
the exact external issuance while retaining failed usage and no accepted output.
These failures use the same finite failed-stage retry policy. Proven non-execution retains
its separate accounting. An exact successful query result and its settlement
are persisted atomically, revalidated after restart and reused without another
model request even if the later domain save was interrupted. Successful siblings
remain unchanged. See the [recovery decision](adr-task-recovery-and-execution-budgets.md#default-bounded-task-retries-accepted-2026-10-21).

## Validation

`apps/server/test/memory-review.test.ts` covers configuration/scope/clock changes, invalid outputs, cancellation/deletion races, cache expiry/count/byte bounds, archive isolation, immutable receipts, automatic activation and a real SQLite checkpoint rollback/retry. The existing 400-day Memory fixture covers individual and batch ingestion and replay through the shared executor.

`scripts/test-memory-review-policy-live.ts` compares always-review and reuse with local Codex Server `gpt-5.6-luna` using six generated cases: injected product display, proposal versus completion, third-party attribution, a project-scoped constraint, a temporary resource request and cancellation versus external execution. Each policy performs six first-time reviews; the optimized policy repeats the identical six inputs without additional reviews. A separate model call evaluates both first-pass outputs against the same explicit rubric, and the host checks exact citations and byte-identical reused answers. This measures avoided duplicate review calls, not a reduction in calls for novel candidates, total extraction cost or general model quality. Usage remains unknown when the runtime does not provide it.

Deletion comparisons operate after the ordinary review and are not inferred from string similarity. Same-conclusion candidates sharing old original identities require a model-identified new supporting evidence ID that also passes host provenance checks. A review cache hit repeats the current deletion comparison; commit rechecks the deletion snapshot and result hash. See [Memory updates](memory-updates.md#automatic-activation-and-deletion-intent-2026-09-27).

The complete deletion comparison has no default total deadline across all related rules. Each model call retains its own declared protection, and the parent cancellation signal remains effective. An explicit internal caller or test may set a total deadline; expiry does not silently approve unexamined rules. This differs from the review cache's five-minute TTL. See [task execution policies](task-execution-policies.md). Derived-context dependency IDs stay host-only and undergo current source/privacy authorization again when a model request is admitted and before its result is accepted.
