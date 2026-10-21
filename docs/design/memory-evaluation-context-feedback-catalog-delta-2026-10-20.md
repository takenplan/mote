# Feedback catalog compatibility delta

Date: 2026-10-20. Status: proposed; no approval claimed. Delta ID: `memory-evaluation-context-feedback-catalog-v2`.

Parent approved plan: `memory-evaluation-context-restoration-v2`, SHA-256 `4e85b9497a90dd95e3efe741baceeb025b3896bcf8f0432db4fffa0f60e08bef`. Exact source base and HEAD: `bcff7bab6109a7c99acde3decb5712a072e1b045`. Implementation is in progress under that approval. Before this delta, tracked runtime-only diff (`git diff -- apps/server/src packages/agent/src`) SHA-256 is `3c0910f62ccf79c8261882072553a93eb74ef3d3c0b4fb24527ef426f6a5123c`. Sole runtime/test owner remains memory_adr_audit; root remains sole complete-check driver.

## Evidence and boundary

The E5/E7 generated real HTTP job test in `scoped-memory-evaluation-continuations.test.ts` selects two trusted installed recipes whose `requires` choose different blocks of the same Material. Each recipe has one exact read catalog. Current scoped `MemoryFeedback.work()` collects **all** initial root recipe batches, then reconstructs every member with the caller's strategy. Its `payload()` previously also looked up every catalog member using the narrow batch clock map. The new complete clock map fence reveals that mismatch. Looking up the immutable root clock fixes the missing-clock error without granting body reads.

A real reviewed `needs_context` then selects a member belonging only to the other recipe through the actual planner `delegation_submit`. The child has that selected member in `inputs/contextRanges`, but inherits only the parent's `readInputs/evidenceReadRanges`. Actual child output fails `scope`. The original red was 2 failures in 10.68 s: selected-block owner reply 409 (separately fixed within approved scope) and differing-catalog batch `memory_input_changed`; after correcting clock lookup, the planner enters and its child reports `agent_host_validation` / `scope`. This is a newly exercised state, not evidence that cross-recipe reading was accepted.

An initial local implementation briefly merged selected root pins/ranges into child `readInputs/evidenceReadRanges`; its focused case passed. That merge was made before this authorization-boundary review, has been **withdrawn**, and is not approved or delivery evidence. Current child read carriers remain as before. No retrospective approval is requested.

The actual single-user contract is narrower: `memory-pipeline.ts:608–628` filters authorized members, feedback requests and allowed proposals by exact compatible strategy, profile, profile version and review fingerprint. `:644–650` repeats compatibility before selecting target/context chunks. The current scoped all-recipe metadata catalog is not sufficient evidence to authorize widening a child's body catalog.

The current ADR and scoped design explicitly preserve this restriction, so this is not choosing an old implementation over a later product decision: `docs/adr-memory-context-reading.md:15–17` says target/read catalogs retain the recipe, review policy and exact Material input fingerprints that authorized each range; feedback preserves those bindings, and shared original IDs/coverage keys cannot attach another recipe’s requirements or replace its context. `docs/design/multiuser-memory.md:216–218` further binds each context catalog to its original recipe and Material required products and rejects swapping in another recipe or neighboring artifact’s context. Root independently verified these citations; client performed the late-contract cross-check. The same-recipe contract resolves the uncertainty without a new product decision.

v2 delta from sealed v1 (`94b8d52248398e92f77246b234d567f9ad7f7a106e6ede4977cab18939de8c22`): add the current ADR evidence only; proposed implementation and limits remain unchanged. No boundary implementation has started.

## Proposed bounded restoration

Prefer preserving the existing single-user compatible-policy boundary, rather than introducing cross-recipe reading:

- KEEP each original recipe's selected blocks, existing parent `readInputs/evidenceReadRanges`, immutable root job clock, per-member clocks, readonly tools, quote authority, novelty rules, independent review and successful sibling checkpoints.
- CHANGE scoped `MemoryFeedback.work()` catalog and history construction to consider only root/descendant batches compatible with the caller's **exact frozen strategy binding and profile**. The binding already pins recipe, extraction and review versions/fingerprints, the current equivalent of the original strategy/profile/review compatibility fields. Do not relabel another recipe's member with this recipe. The immutable root snapshot still supplies the selected members' clocks.
- REMOVE the incompatible recipe's members from this planner's metadata authorization catalog. This restores an existing boundary, not a new denial policy.
- EXCEPTION none. Do not merge selected foreign-recipe ranges into body read carriers.
- UNKNOWN: none remains about same-recipe compatibility after the current ADR cross-check. Stop for a new delta if any additional catalog compatibility field is found necessary; do not infer authorization from root aggregation.

Minimum additional changed code: `apps/server/src/scope/memory-feedback.ts` only, already owned by this implementation. No schema, HTTP, Skill, route, source/Material grant, background job or new limit. Existing root-map time lookup remains host-only. `memory.ts` child read carrier behavior stays unchanged.

## Validation

1. Preserve a real same-policy target/background feedback journey, actual planner tool submission and actual child extraction/review; advance only semantic clock; assert job/member clocks and no replay after restart. Existing `multiuser-memory-08.test.ts:87–92` supplies that real path.
2. Convert the differing-recipe case into a regression: both original recipe workers run; a target requiring only the other incompatible recipe's block gets no useful authorized context, no planner model/body tool call or child grant. Its reviewed gap remains visible; the other recipe completes. Assert each catalog omits the other recipe's member, unchanged read carrier scope and exact retained clocks.
3. Existing multi-recipe batching, catalog guards and all relevant consumers remain required. Generated local providers only; single test process. No complete check, migration, old-task mutation, historical model replay, personal input or live paid model.

Approval must bind this file's exact SHA-256, source base/head and the stated compatibility assumption. Work on unrelated already-approved batches may continue while this boundary remains unchanged.
