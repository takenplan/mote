# Memory evaluation context and neutral procedure restoration

Date: 2026-10-20. Status: **PLAN ONLY — independent pre-implementation review pending**.

Plan ID: `memory-evaluation-context-restoration-v1`.

- Exact source base and implementation head before work: `bcff7bab6109a7c99acde3decb5712a072e1b045` (`origin/main`, PR 194 included).
- Worktree: `/Users/utopiafar/.codex/worktrees/92bf/mote`; branch: `codex/memory-evaluation-context`.
- Sole source/test implementation owner: `memory_adr_audit`; sole complete-check driver: root task. Independent reviewer: separate Sol High reviewer `memory_plan_reviewer`.
- Seal: submit the SHA-256 of this file's exact bytes with the review request. Approval binds that SHA, this base/head, scope and assumptions. Editing the plan after sealing requires a new hash and review of the delta. This file cannot include its own whole-file hash.
- No source, Skill or test modification and no implementation/testing before explicit `APPROVE`. Approval is engineering review, not new product policy approval.

## Problem, accepted behavior and exclusions

Two scoped production caller defects remain at this base: `scope/memory.ts:252` derives the model's now from source `capturedAt` and selects old semantic extraction/consolidation procedures despite pinned strategies. The shared envelope places these values directly in `currentTime`/`displayCurrentTime` and `procedure` (`packages/agent/src/task-context.ts:42–43,57,69,73–76`). Independent review inherits both. Old consolidation says to await owner confirmation although the accepted host contract publishes reviewed relations atomically without it.

Restore the existing manual/automatic evaluation-time and neutral-strategy contracts. Keep original event/authorship/observation time distinct, preserve independently authorized input contexts inside a transport package, and retain all public evidence, policy, version and publication guarantees. The earlier investigation is at commit `35348520`, `docs/audits/memory-runtime-contract-investigation-2026-10-20.md`; that documentation PR is not this source base.

Excluded: automatic count/maxWait admission changes; batching/retention/resource/default changes; more candidate limits; new confirmation or retry steps; public HTTP time override; client UI or wire changes; provider installation; live paid models; personal material; migration/backfill or historical paid replay. PR 194's independently progressing integration windows and successors must remain intact.

## Original production behavior, not merely documentation

All paths below remain readable in the single-user runtime at this base and are reference contracts, not a request to restore that composition.

| Journey | Existing original behavior and exact source |
| --- | --- |
| Manual extraction | `memory-pipeline.ts:473–475` freezes `evaluationTime=input.contextTime??jobTime` at creation. Work members without an automatic package use that job clock (`:545–552`). `:1023` sends the first target member's semantic clock, otherwise the job clock. Explicit retries/restart retain the saved value. |
| Automatic input / multiple recipes | `memory-input-authorization.ts:26–48` records one `received_at` per original input and shares it across selected recipes. Duplicate delivery cannot mint another clock or grant. `material-memory-work.ts:68–89` carries that receipt clock through delayed Material readiness. |
| Mixed automatic package | `material-memory-work.ts:191–201,214–233` allows compatible inputs with different receipt times to share transport. The job clock uses its first input, while `workPackage.inputs` preserves each input's own time. `memory-pipeline.ts:552,1023` chooses each member's corresponding input clock and the call's first target member. `memory-work-contract.ts:25–32` explicitly says one member's clock must not replace another's. |
| Coding preparation | `memory-pipeline.ts:967` passes the first preparation member's clock to understanding; reuse identities include the relevant task/member context. It does not use newest authored/captured time as now. |
| Feedback | `memory-pipeline.ts:619` freezes the job clock in the feedback request; `memory-feedback-planner.ts:38,53` supplies it as the planning query clock. Frozen member vectors retain their own semantic contexts. |
| Owner reply | `memory-owner-questions.ts:40–48` interpretation is a separate reply-understanding request with no supplied `contextTime`. After a resolved reply, `:70–73` creates re-evaluation using the original questioned member's clock, otherwise the parent job clock. Answering does not make the old original newly received. |
| Integration | `memory-lifecycle.ts:86` freezes manual window time at request; `:175` freezes automatic window time when its eligible window is admitted, after waiting. `memory-integration.ts:95` uses that fixed window time for both domains and review. It does not use source dates, upstream extraction clocks or the oldest arrival merely because they are available. |
| Neutral programs | Selected extraction uses `memory-strategy` (`memory-pipeline.ts:983`), integration uses `memory-integration` (`memory-integration.ts:95`); the selected policies decide semantic admission. Independent review remains mandatory. |

The original member `contextTime` is a semantic receipt/evaluation clock. Current scoped code uses the same name for source projection metadata, and the scoped catalog deliberately validates it against source metadata (`scope/memory-data.ts:112`, `memory-catalog.ts:45–57,104–117`). These meanings must not be silently conflated or the current catalog time fence removed.

## Bounded design

### 1. Private host-owned evaluation snapshot

Introduce a required current private Memory task evaluation snapshot, with a validated ISO offset timestamp for the job/window and a complete immutable mapping of its selected evidence IDs to their semantic evaluation clocks. Names may be `evaluationContext:{time,inputs:[{id,time}]}`; preserve this distinction from record `capturedAt`, record `receivedAt`, catalog `member.contextTime`, execution timestamps and authorization clocks. No HTTP client/model supplies this snapshot.

Use existing JSON task/receipt storage; do not add an old-version adapter, ALTER/backfill routine, scanning startup job or a second scheduler/store. Validate IDs are unique, belong to the frozen input/read catalog, and every target/context member has one clock. Missing or malformed current input fails closed; never infer a missing old clock from source time, current wall time or `created_at`. Completed canonical Memory/answers and stored outputs are not rewritten. No startup work repairs pre-change tasks.

Manual admission freezes one creation clock **only on the first durable operation admission**, before async model/resource work. All batches and recipes of that manual operation inherit it. Same operation ID/request retries read the existing saved input first, retain its clock and model snapshot, and run ordinary request-identity/conflict validation; an otherwise identical repeat must not conflict because a fresh timestamp was generated. This applies to manual integration and owner correction task constructors too. The owner-correction note's creation timestamp remains its own already explicit timestamp.

### 2. Automatic receipts, readiness and mixed-input packing

At the synchronous original `ingress.onAccepted` receipt boundary, freeze one host reception clock for each newly accepted original, shared by its recipes. Persist it beside the existing policy snapshot in `mm_capture_intakes`; duplicates and refused receipts retain their original outcome. This is an evaluation snapshot, not a new authorization field. Do not derive it later from M06 completion or an original event date.

An automatic Material's evaluation source is the original input event that owns its producer: `memory.materials` has its validated `captureId`; M06 pipeline/file/image work has its validated `originalRef` resolving to the canonical capture. Verify that capture belongs to the Material's transitive canonical members before selecting its saved receipt. This matches the existing original input-key → Material-work receipt chain. A grouped Material uses its actual producer input receipt; it must not guess earliest/latest member time. Rebuilds of that producer retain its receipt clock. All constituent original authorization checks remain in force. Before implementing, enumerate every current `MemoryIntake.accept` caller and prove this producer relationship; if another supported caller cannot supply it, stop for a bounded plan delta rather than adding a wall/source-time fallback.

Carry that Material/input evaluation clock into `mm_intakes`, independent of readiness `created_at`, and preserve it across restart. `MemoryIntake.accept` currently compares complete capture receipt policies, and `execute` uses full `json` equality as both count and package key. **Exclude only new evaluation-clock metadata from these compatibility comparisons**; continue comparing every existing generation/settings/binding/strategy/required field. Do not include the clock in a grouping key, or inputs accepted at different times would accidentally lose their current batching, due/count behavior and reuse. Keep the existing selected-row order (`created_at,id`), count/maxWait behavior, maximum items and structural packing unchanged.

Pass each selected intake's own clock through the private `admit` port, freeze it for all evidence ranges derived from that Material/input, and retain the full per-input mapping in the job. Mixed packages use the first selected input for job-level planning; each actual extraction batch chooses its first target's evaluation clock for top-level model now. Context-only evidence never chooses the target call clock. Cross-recipe tasks from the same reception share that reception clock. A mixed package does **not** overwrite later members with the first/maximum clock.

### 3. Member semantic clocks without weakening catalog source-time checks

Keep scoped `MemoryWorkMember.contextTime` and all existing catalog source/declaration receipts exactly source-bound. Add a distinct internal `evaluationTime` to scoped member vectors, populated solely from the private frozen task map. The shared internal work instruction uses `evaluationTime` when supplied for relative evaluation, explicitly distinguishing it from source `contextTime`; the original single-user path continues its existing member `contextTime` behavior. This is an internal host envelope change, not a client/wire/schema permission extension.

`frozenMemoryCatalogMembers` carries the frozen evaluation value from the original persisted task, while preserving all existing `contextTime`, attribution, source, unread-body and visibility checks. Include semantic evaluation values in member identity and relevant generation/query/review inputs so differing semantic contexts cannot silently reuse a verdict. Continue to verify original evidence times through the existing catalog receipt. A feedback planner can select existing member keys, never set/modify evaluation times or create a time-derived grant.

Do not erase or relax `memory-catalog.ts:117`. The new private mapping is revalidated against the saved task and host-only construction at admission/re-entry; it is not accepted from a model's returned coverage or arbitrary tool payload. Agent compaction must preserve the new value on every listed member (currently unknown member fields survive as range fields in `packages/agent/src/memory-context.ts:46–48`; add a focused assertion rather than relying on that accident).

### 4. Integration's independent window clock and PR 194 successors

Manual integration freezes its explicit request clock as above. An automatic integration window freezes its semantic clock once, in the same fenced transaction that first freezes a nonempty eligible `selection/pending` set **after** the existing due/count gate. This preserves original `MemoryLifecycle` window-admission semantics; row creation at upstream publication is only scheduling metadata. Both personal/Coding domain children share that saved clock. Retry, restart and staged publication retain it.

PR 194's `pending` successor windows represent disjoint slices of that one frozen selection. Their private JSON must inherit the root window's semantic clock unchanged, alongside existing settings, binding, pending pins and original due clock. Independent successors must still progress if a prior child fails/pauses/cancels. New independent windows freeze their own admission clock; an empty/deferred window does not invent work or borrow another window's time.

### 5. Full consumer propagation

| Consumer | Planned handling |
| --- | --- |
| Extraction and independent review | Top-level `QueryInput.contextTime` is the frozen first target evaluation clock (manual/integration batches therefore agree); member evaluation clocks remain explicit. Reviewer and repair re-review inherit it. |
| Coding understanding | Use the first target member in the preparation's own ordered scope, not the parent batch's unrelated first target or newest capture. Preserve target/context ordering and provenance grouping. `codingGenerationContract` binds the new evaluation values as well as existing policy/model/ranges. |
| Coding cache/publication | Stored preparation is reusable only under the exact updated generation contract, work contract, target ranges, model and evaluation values. Existing published interpretation text remains an untrusted lead, not a matching new complete candidate result. Do not mutate old preparations to match or republish old canonical outputs automatically. A new expressly authorized job may normally generate when old cache identity does not match; do not resume a paid old job under invented new context. |
| Feedback planning | Preserve the original job planning clock and complete original member map in the durable request; send that clock at top level. Replanning and child tasks inherit the relevant target and context values; successful sibling keys/results remain stable and complete. |
| Owner-reply interpretation | KEEP separate existing no-contextTime reply-understanding behavior, no old semantic Skill; this request is not retrospective Memory evaluation. Its admitted task/model and question fences stay unchanged. |
| Owner continuation | Re-evaluation inherits the original questioned member's evaluation clock and each preserved recipe/batch's own map; remap only the already-authorized Material block IDs after declaration. Do not replace it with answer time, new Material revision time, or another member's clock. |
| Native engine | Native draft invocation retains declared native adapter behavior and exact evidence; do not pretend an external engine consumed Mote's envelope. Mote's review, deletion comparison and publication use the restored fixed evaluation context. |
| Review/deletion/supersession | `memory-review.ts:43,99` inherits and records the correct clock; `memory-deletion-review.ts:24` keeps `skill:undefined`. Preserve `validFrom ?? receipt.contextTime ?? createdAt` precedence at `scope/memory-data.ts:149`; verify its default now receives the intended frozen evaluation clock. No unrelated valid-date or current/history policy change. |
| Query artifacts, issued outcomes and restart | Preserve exact saved query reuse, external issuance identifiers, unknown-outcome blocking and explicit confirmation boundaries. Same repaired current-format task and successful query reuse has no new model send. No task whose immutable input lacks the new context is rewritten/re-issued to obtain it. |

### 6. Neutral strategy programs

For scoped extraction with its pinned strategy choose `memory-strategy`; for scoped integration with its pinned integration/review recipe choose `memory-integration`. Keep `responseMode:'memory-extraction'`, exact selected prompts/output contract, readonly tools and independent review/repair behavior. Native engine generation may bypass Mote's generator; its independent Mote reviewer still receives the neutral integration/extraction program. Coding understanding and deletion comparison deliberately remain `skill:undefined`.

Do not edit old Skill content, catalog versions, source-specific defaults or old single-user explicit callers. The stale owner-confirmation sentence ceases entering these scoped policy calls because they select the already existing neutral procedure. Relations still apply only after independent review and exact host checks in the same fenced commit; no owner-confirm step is added and no eight-candidate integration contract is changed.

## Supersession and responsibility classification

| Category | Disposition |
| --- | --- |
| KEEP | Account/source grants, refused intake, original event/authorship/observation times, source-bound catalog clocks, settings/recipe/model pins, source/device/project/session grouping, current structural batching, output/coverage/quote validation, readonly tools, model/resource fairness, deadlines/cancellation, independent review, retained-history/privacy behavior, explicit validity dates, native boundaries, staged/fenced atomic save and Owner question timing. |
| CHANGE | Add private persisted job/receipt/window evaluation contexts; propagate separate per-member evaluation clocks; restore original first-target/preparation/window clock rules; select neutral host programs for fixed scoped policies and reviews. |
| REMOVE | Source `capturedAt` as the new evaluation-now selector; recomputing semantic time at execution/retry; old generic semantic procedure injection into selected scoped policy calls. |
| EXCEPTION | Source-bound scoped catalog `contextTime` remains source metadata; new member `evaluationTime` carries restored semantic behavior. Reply interpretation keeps its separate original current-time behavior. Exact already successful queries are reused only within unchanged current-format input/identity; native generation has its own provider contract. |
| UNKNOWN / stop condition | Any current automatic publisher whose owning original cannot be proven; unclear new private-task identity or a consumer that would require a public schema/client change; incompatibility with exact staged external receipts. Investigate and obtain delta review before implementing around it. Semantic quality, real-provider cost, external ongoing calls and deployment are not established by generated tests. |

## Minimum files and owners

One implementation owner changes only the following bounded surfaces after approval; no parallel edits or duplicate implementations.

- `apps/server/src/scope/memory-schema.ts`: current private task evaluation schema; no public request clock.
- `scope/memory-intake.ts`, `scope/memory-integration.ts`: receipt clocks, compatibility projection, window freeze/inheritance; preserve the original scheduler predicates and PR 194 behavior.
- `scope/memory.ts`: first admission/idempotence, all task constructors and descendant remapping, final clock/neutral Skill choice.
- `scope/memory-data.ts`, `scope/memory-catalog.ts`: map lookup and source-safe scoped member vectors; retain metadata/authorization fences.
- `scope/memory-coding.ts`, `scope/memory-feedback.ts`: correct scope-specific clock and identities/feedback inheritance.
- `apps/server/src/memory-work-contract.ts`: internal optional `evaluationTime` representation and explicit scoped time-role instructions, preserving original runtime semantics. `packages/agent/src/memory-context.ts` only if needed to preserve explicit compaction; otherwise assert existing preservation.
- A small private helper `scope/memory-evaluation-context.ts` may centralize construction/validation/projection to avoid duplicated source-clock fallbacks. Do not introduce a service, table owner or additional runtime.
- Focused regression files and existing Memory fixture helpers listed below. If deterministic midnight control requires wiring, allow a constructor-injected **semantic clock only** through the existing scoped fixture/app dependency path (`scope/app.ts` / existing build options); never change global Date or execution/lease/authorization time, and do not expose a user setting/environment toggle. Such wiring must remain within this exact purpose.
- Adjacent docs/validation may record actual implementation/results, using `35348520`'s investigation as history. Root owns broader documentation, PR, merge and complete check coordination.

Do not modify shared public protocol schemas, Android/Desktop/Web product flows, Agent tool permissions, price/model routing, execution engine policy, old Skill files or third admission-timer candidate. Any additional ownership surface requires a recorded delta before implementation.

## Regression plan: real entry points, final envelopes and state transitions

Use generated records and the real `buildApp` → scoped M01 cookie HTTP → ingress/M06/M07 → registered Agent/provider protocol path. Extend the existing fixture, do not replace it with direct hand-assembled `QueryInput` as the sole proof. Inspect actual serialized provider envelopes and stored private identities. Use source dates far from the reception/creation time; separately control semantic clock at midnight without changing lease/authorization clocks. Unit checks supplement real HTTP paths.

| ID | Journey and controlled transition | Required assertions |
| --- | --- | --- |
| E1 | Manual HTTP extraction; old-source dates; two batches and two recipes; model held across semantic midnight | One first-admission clock; every batch/recipe and independent reviewer uses it; source/catalog metadata retains old dates; duplicate operation ID does not change context/model/tasks; changed request conflicts. |
| E2 | Automatic two fresh receipts at different semantic times; duplicate ACK; delayed M06 readiness; same policy and multiple recipes; mixed transport package | Reception clocks persisted before readiness; same input's recipes agree, different inputs retain separate `evaluationTime`; no receipt time enters compatibility/grouping key; same package/member count and existing due/count behavior; call now uses first actual target, not max/context-only. Denied receipt remains denied after resume/restart. |
| E3 | Manual integration; automatic due wait then frozen selection; both domains; more than maxItems | Manual request vs automatic admission clocks correct; both domains/retry/restart retain clock; PR 194 successor disjoint pins inherit the root clock and progress despite prior child pause/failure; independent new window uses its own clock. No observation-only window. |
| E4 | Two Coding sessions plus ordinary input; exact full candidate preparation vs mismatch; understanding retry/restart | Each preparation first-target clock is correct; neutral policy only for Mote extraction/review; exact context match reuses valid candidates with independent review; changed clock/policy/work/model/ranges cannot reuse old complete candidates; published old interpretation remains only a lead. |
| E5 | Reviewed `needs_context`; real feedback planner; target/context replan; restart before child admission | Planner job clock frozen, per-member evaluation/source fields preserved through compaction/history; no novel clock/ID accepted from proposal; successful siblings and original unknown-outcome fences unchanged. |
| E6 | Real Owner question publication and response; interpretation across clock advance; remapped continuation | Question appears only with successful save. Reply interpretation keeps its independent no-clock contract; re-evaluation inherits questioned input/member clock, original recipes/ranges, and new declaration IDs only. Unknown/defer has no unauthorized work. |
| E7 | Generated personal/daily/custom strategies and integration; independent review/repair; native draft; deletion comparison | Final `requiredSkill/procedure` is exactly existing neutral program for each selected policy; no old confirmation instruction; selected review policy stays authoritative; native generation bypass is explicit; deletion/understanding have no semantic Skill. Readonly/evidence scopes unchanged. |
| E8 | Reviewed `supersedes` without/with `validFrom`; target version race; cancellation/revocation | Correct fixed receipt clock becomes default `supersededAt`; explicit original `validFrom` wins; atomic published/new + versioned old history; race/late result cannot partly save or create actionable question. |
| E9 | Successful query checkpoint saved before draft/review projection; unknown issued call; restart; current clock advanced | Exact success reused with zero extra physical calls/usage; unknown remains blocked and no implicit confirm/retry; no successful artifacts relabeled into changed time/policy identity. Pre-change missing-context tasks are not mutated, auto-repaired or replayed; retained canonical Memory remains readable subject to existing authorization. |
| E10 | Scoped catalog source/metadata/body controls plus A/B same IDs | Retain source-time mismatch rejection, declaration/visibility/source withdrawal and unread-body distinction; new semantic map cannot borrow B/another task's time or expand input grants; no body read merely to validate the catalog. |

Keep existing assertions, input scale, timeouts and real entry points in neighboring fixtures. A focused RED must demonstrate the old caller defect at the old base where practical, then the same generated case must pass. Existing first failures and different-input nonreproductions remain separate evidence; this fix does not assert a real image quality incident is solved.

Expected focused suite neighborhood: new `scoped-memory-evaluation-context.test.ts`; `scoped-memory-parity`, `scoped-memory-catalog-parity`, `scoped-memory-issued-query`, `scoped-memory-native-admission`, `scoped-memory-owner-publication`, `multiuser-memory-coding-preparation`, `multiuser-memory-integration-domains` and existing feedback/Owner question paths. Use `node --import tsx --test --test-concurrency=1` with explicit selected files after required library preparation; exact commands are chosen from installed package scripts and reported before execution. Do not run a whole Server suite or `check:affected` as a module owner.

## Resources, completion and approval gate

Dependencies/environment are prepared by the separate environment owner; do not install or modify lockfiles. Focused work uses one bounded test process, loopback generated providers, temporary isolated data and hidden/no UI. Record actual call counts, awaited task states, process cleanup and elapsed time; do not claim semantic quality, actual native provider or live-model evidence from scripts. No personal screenshots, real credentials, external writes or deployment.

After implementation converges, report exact new head/diff and focused evidence to root. Root alone freezes the composed candidate and runs affected Server/Web/Agent/shared consumers and necessary journeys; the existing global check lock must not be taken from another live driver. This plan does not mark checks passed, authorize merge/deployment, or count a documentation review as pre-implementation approval.

Stop here pending independent explicit `APPROVE` of this sealed plan. Any changed clock semantics, member/catalog treatment, private-input handling, producer proof, test entry point or minimum ownership surface needs a recorded plan delta and the applicable independent review before that change.
