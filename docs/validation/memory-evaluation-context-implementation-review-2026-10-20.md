# Memory evaluation context: implementation review

Current decision: **I1 CLOSED; I2 CLOSED; no remaining blocking findings in the reviewed source scope**. The final source is committed head `4925a706d3baeced085230eeea9533676ab6fa30` plus Activity runtime delta seal `e4b0291c85fa0780dc7d3833dae05b75e6fb406a1accee572475f77818e7f88b`; complete original-base runtime diff seal is `8c078baaac996ab7cd02566c2e24a7dee7c40491f84c459527ce43294670b980`. Complete checks and delivery remain pending. Historical findings and decisions below are preserved.

Date: 2026-10-20. Reviewer: `memory_plan_reviewer`, independent Sol High.

Decision at this snapshot: **CHANGES_REQUIRED — one blocking U1 propagation gap**. This is an actual-source implementation review, not pre-implementation approval and not a substitute for tests or delivery checks.

## Exact reviewed inputs

- Source base/HEAD: `bcff7bab6109a7c99acde3decb5712a072e1b045`; branch `codex/memory-evaluation-context`; implementation uncommitted.
- Tracked runtime diff command: `git diff -- apps/server/src packages/agent/src`; SHA-256 `0bb8c5271ea356cc5b02e6421e32e77a2542550331c0a0704f1efa8f092f61ac`.
- New runtime helper: `apps/server/src/scope/memory-evaluation-context.ts`; SHA-256 `2143a0a20ed7716e6e507df0684df1b218d3afa560b483dac5bbb9e5a423ddf9`.
- Scope: 13 tracked runtime files plus that helper. No Agent source, Skill, public protocol schema or client runtime change is in this reviewed diff.
- Design authority: [sealed v2 and bounded-delta pre-implementation receipts](memory-evaluation-context-plan-review-2026-10-20.md). This review does not replace or retroactively expand them.

Both runtime hashes and HEAD were independently verified. Tests were still converging; their files/results are outside this static review's evidence. Later source changes invalidate only the corresponding reviewed input/delta, not unchanged findings.

## Blocking finding

**I1 — Legal pinned recipes without `workContract` still omit the per-input evaluation clocks from model context.** `scope/memory.ts:256` only constructs `memoryWork.members`, its semantic-time instruction and the other frozen member vectors when `selected.binding.workContract` is present. New tasks may legally select retained personal recipe versions 2/3/4 or an installed recipe without that optional field (`memory-strategies.ts:29–35`, `memory-strategy-contract.ts:9,19`). This is supported selection of a fixed definition, not migration of an old saved task.

For a compatible automatic package containing originals received at different times, the new private `evaluationContext` correctly preserves all input clocks. In the no-workContract path, however, extraction and independent review receive only the first target's top-level `contextTime`; later target clocks are not sent at all. Their source `capturedAt/receivedAt` fields are different time roles and cannot reconstruct the frozen semantic receipt clock. Coding understanding likewise has no `selectedWork` member vector in this case. The fix therefore does not yet meet v2's complete mixed-input propagation contract for every supported pinned recipe.

The original single-user pipeline did not equate semantic member context with the range-evaluation flag: `memory-pipeline.ts:986` also supplies work members for automatic work packages and owner-question/review paths. The approved design explicitly retains old fixed policy/output contracts rather than silently upgrading them.

Before closing I1, convey the host-frozen per-input semantic contexts to these legal legacy/custom-policy model calls while preserving their selected output/coverage contract, native boundaries and read scopes. Do not resolve the gap by changing old recipe definitions, adding range-evaluation coverage requirements to them, forbidding their selection, or collapsing their clocks. Add a generated real-entry regression with a no-workContract fixed recipe and two different reception clocks in one actual package; inspect final extraction and independent-review envelopes, source-time independence, retained old output behavior, and applicable Coding understanding. If the chosen correction changes an approved responsibility or contract boundary, obtain the bounded delta review before that implementation batch.

## Reviewed contracts that match the approved design

| Surface | Static finding |
| --- | --- |
| Current private map | The helper validates offset ISO times and unique IDs, rejects conflicting duplicate clock assignments, and refuses missing lookups. `assertInputs` checks complete target/read coverage and rejects extraneous map entries; `assertJob` still binds execution to the exact persisted task JSON. No model/tool clock setter was added. |
| Manual admission/idempotence | `admit` obtains the creation clock before asynchronous provider/model work, reuses existing persisted context/model, and rechecks both inside the insert transaction before comparing immutable input identity. Batch/recipe maps retain the first persisted context. Owner correction retains its explicit note timestamp and repeat-command check. |
| Automatic receipt/packing | `onAccepted` persists one clock per newly accepted original shared across its recipes; duplicates do not rewrite it. Only evaluation metadata is removed from compatibility comparisons; generation/settings/binding/strategy/required fields and existing due/count/order/size predicates remain. Each selected intake carries its own clock into the job map. |
| Trusted producer handoff | Processing hooks receive a frozen original identity from the validated effective/fixed input. This covers plugin `pending.input`, ordinary pipeline/analysis and direct named-image publication. Organizers pass their validated capture identity. Intake resolves the account's canonical original and requires transitive Material membership plus existing constituent authorization before using the saved producer receipt. It does not parse plugin payload as proof. |
| Named/derived evidence clocks | Material evidence projection retains its existing canonical-parent recursion. Admission assigns the producing Material receipt's clock to the returned canonical evidence IDs; identical projected IDs with conflicting proposed times fail closed rather than silently taking first/latest. No source/evidence timestamp is rewritten. Actual fixture coverage of named/derived cases remains required. |
| First target and Coding scope | For member-enabled paths, extraction chooses the first actual target clock, not context-only/latest source. Coding receives its own first scoped target clock. Its generation contract now includes evaluation context and neutral Skill identity, and stored preparation must match before publication/reuse. The I1 exclusion above remains blocking. |
| Automatic integration | Clock freezes after the due/count gate and a nonempty eligible selection, in the same fenced state save. Domain children use the window time. PR 194 pending successors retain the frozen time and original due metadata while staying independent of a prior child's outcome. |
| Feedback compatibility | Catalog/history now filter exact strategy binding and profile and retain source vectors without relabeling other recipes. Planning uses the immutable root clock. Child clock maps select the existing compatible target/context/read IDs; parent body carriers are not widened. |
| Owner continuation | The declaration remap filters new projected blocks against the prior batch's selected/read block identities, preserves each old input clock and per-batch strategy, and carries the questioned member's planning clock. Reply interpretation remains unchanged. Required partial-selection/recipe regressions remain test evidence, not established by this reading. |
| Source catalog fence | `memory-catalog.ts` only adds evaluation time to canonical member identity/vector construction. Its source `contextTime`, attribution, visibility and unread-body checks remain unchanged, including the exact source-time comparison. Agent compaction retains the new member field through its existing range spread; the approved focused assertion is still needed. |
| Independent review/deletion/publish | The neutral extraction/integration Skill selection and fixed top-level clock flow through existing review/repair. Coding understanding and deletion comparison remain without those semantic Skills. Explicit `validFrom` precedence, exact-version/fenced atomic publication and native draft invocation contracts are unchanged. |
| Successful/unknown model calls | Query saved-result validation, exact args-based key, issuance begin/settlement and unknown-outcome behavior are unchanged; time/member/Skill inputs participate in query identities. Stored Coding preparation now additionally checks its current generation contract. This establishes no new replay path in the reviewed changes, but actual interruption/restart call-count and high-risk multi-batch states still require fixture proof. |
| Old tasks/canonical products | The current private task schema requires the new snapshot; no backfill, adapter, startup migration or old-result rewrite was added. Missing-clock work fails closed rather than inventing a current/source clock. Canonical Memory reads retain their existing independent authorization path. |

## Verification limits and remaining work

This review ran no builds, tests, complete checks, UI, physical devices, native providers or live models, and used no personal material. It made no source/test/Skill edits. The only authored artifact is this review receipt.

Root reported that E2P held negatives, E3 prior failure/pause clock inheritance, E7 repair and E8 version-race fixtures were still converging. Those states, I1's newly identified supported-policy case, the remaining approved journey matrix and frozen-candidate affected-consumer checks must be reported separately. A static match to the plan does not mark those checks passed or establish semantic quality, merge readiness, deployment or delivery.

## I1 remedy plan decision

The [legacy descriptive metadata delta](../design/memory-evaluation-context-legacy-metadata-v1-2026-10-20.md), exact seal `8c3798e3cc2abf960ac0f8b4480f0f50f011ebc357c996ab1002e571a32d0fc1`, received prospective independent **APPROVE** in the [plan-review receipt](memory-evaluation-context-plan-review-2026-10-20.md). It preserves legacy output/empty-review behavior while carrying per-range time metadata outside `memoryWork`, including scoped Coding propagation and generation identity. At this approval the reviewed runtime diff remained `0bb8c5271ea356cc5b02e6421e32e77a2542550331c0a0704f1efa8f092f61ac`; the remedy was not yet implemented. I1 remains open until the corresponding source delta and required evidence are assessed.

### I1 additional reachable consumer: legacy cross-batch context reads

During the in-progress remedy, root identified and this reviewer independently confirmed another I1 consumer gap by static reading. At the pre-type remedy snapshot `9a81597fdaef0fcc1a07600b3264a567d6665506e86040c479d19af5dbbf4131`, `memoryEvaluationMetadata` describes only the current call's initial target/context vectors. A legacy extraction still has `evidenceReadRanges/readInputs` for its complete same-policy plan. `MemoryHost.reader` permits reads within those existing pins, and Agent `bridge.ts:627–642`'s real `context_evidence` handler returns the permitted page via `project(fresh, ...)`. That projection carries source dates but not the private semantic evaluation time.

Thus two automatically received inputs with different evaluation clocks, packed into separate target batches, can expose a second input through the first batch's context tool without giving that continuation its frozen evaluation clock. Nothing in the current descriptive vector supplies it when the second input is neither an initial target nor an initial context member. This is a statically reachable missing consumer, not a claimed executed reproduction. Range jobs' complete semantic member catalog does not prove legacy calls carry the same data.

I1 remains blocking until the owner supplies a bounded existing-read-clock metadata design and prospective approval, implementation and generated real tool-read evidence. The correction must describe only the already authorized exact read intervals and preserve unread-body/citation distinctions; it must not widen body carriers, change legacy output/coverage, add tasks, infer the clock from source time or promote an old recipe. The already approved optional `QueryInput.taskContext.memoryEvaluation` type declaration does not close this propagation gap.

The owner subsequently submitted legacy metadata v3, seal `14749414da47f8c09314d667c3f71d981c744d1e00d5651e2ba97176d2dedefa`. It received prospective **APPROVE** in the plan-review receipt at tracked runtime snapshot `5f42e45112fdd11633815c93083a056d019e068d029ee35564a7e0c703289df6`, before read-clock increment implementation. This records the approved remedy and preserves the finding's chronology; implementation/evidence closure remains pending.

## Final I1 implementation delta review — CLOSED

Date: 2026-10-20. Reviewer: the same independent `memory_plan_reviewer`, Sol High. Source base/HEAD remains `bcff7bab6109a7c99acde3decb5712a072e1b045`; implementation remains uncommitted at review.

The reviewer independently verified final tracked runtime diff SHA-256 `632330eb843cf5532e6290166f0d823678628221a4d57bac9415552df9a36878` using the original diff command, and helper SHA-256 `2143a0a20ed7716e6e507df0684df1b218d3afa560b483dac5bbb9e5a423ddf9`. The final scope is 14 tracked runtime files plus the unchanged helper: the original 13-file implementation and the separately approved one-field Agent type addition. This follow-up reviews only I1's three approved runtime surfaces and that optional type; unchanged original scope findings are reused, not described as a second complete source review.

**I1 is closed at this exact source snapshot.** Static inspection confirms:

- `memory.ts` constructs `memoryEvaluation` for legitimate selected recipes without range work contracts, using the complete host-validated target/context members. Each existing `evidenceReadRanges` interval receives its clock from the immutable private map; no body carrier or interval is added.
- `memory-work-contract.ts` explicitly projects descriptive fields, excluding coverage keys, fingerprints, completion state and result IDs. Its permitted-read vector is exactly `{id,offset,length,evaluationTime}`. The instruction separates semantic and source clocks and requires actual reading before citation/support; it does not impose coverage or change legacy selected output rules.
- `memory-coding.ts` filters initial member vectors to the actual Coding scope and reconstructs its read-clock list from those exact scoped read intervals, requiring a containing frozen descriptor with a clock. It retains the scope's first target now. `codingGenerationContract` includes the complete serialized evaluation metadata, so a changed read-clock list cannot match the previous generation identity.
- `packages/agent/src/types.ts` adds only `memoryEvaluation?:unknown`; no index signature, parser, serializer, bridge/reader, public route or tool-authority change appears. Legacy empty review detection remains based on `memoryWork` and native origin, so descriptive metadata does not upgrade that contract.

The reviewer read the actual generated regression assertions in `scoped-memory-evaluation-legacy.test.ts` and `multiuser-memory-coding-preparation.test.ts`. They exercise legal retained recipes 2/3/4 through real ingress and delayed M06; mixed distinct receipt clocks in serialized extraction/nonempty review; unchanged legacy empty result/receipt; scoped Coding metadata and restart; and actual legacy cross-batch `context_evidence` turns in both extraction and independent review. The cross-batch case asserts exact equality with the original allowed read intervals, denial of a third original, actual B body disclosure with its own clock available on continuation, first-target now, eight provider HTTP turns/four successful query issuances and no replay after restart. The identity test changes only a read-clock value and rejects reuse.

Execution evidence is **owner-reported**, not reviewer-executed: 5/5 focused cases passed in 16.728 seconds, including the stated HTTP/issuance/restart assertions; Agent build and Server typecheck passed. Root separately verified the final runtime/helper seals and clean whitespace. This reviewer ran no tests, builds or typechecks and has not relabeled those checks as independent execution. Fresh focused evidence, frozen-candidate `check:affected`, other planned high-risk states and delivery/target-branch verification remain with the owner/driver.

The reviewer subsequently read `/tmp/mote-memory-i1-focused-2026-10-20.txt`, the owner's explicitly labeled verbatim transcript of exec session `68060`, final chunk `f9e2cf`, exit 0. It records the exact candidate seals, command selecting `I1:|candidate reuse` in the two named test files, all five case names, 5 passed/0 failed/0 skipped and 16728.232 ms. It is a transcript of returned tool output, not an original raw process log or an additional run. The fresh focused matrix log was still running when supplied and is not counted as passed here.

No further blocking source findings remain from this bounded review. Closing I1 does not certify whole-project tests, live semantic quality, actual native providers, devices, merge readiness, deployment or delivery.

## I2 — Activity coverage identity consumer omitted — OPEN

The root driver's fresh full affected-check candidate at HEAD `4925a706d3baeced085230eeea9533676ab6fa30` reported failure in `multiuser-memory-07.test.ts:82`, the existing complete owner-question journey. Root's focused diagnostic identified the exact failure as `assert.ok(work)` at `:87`: the source-filtered attention page had no Memory card. Earlier assertions had established one published supported sibling, an `awaiting_context` batch, one owner question and B's denial. The reply/continuation part had not yet run. This is root-executed evidence, not a run performed by this reviewer.

Independent static inspection at that committed head confirms the causal mismatch: `scope/activity.ts:30` still computes `work_activity_member` as `hash([range, evidenceHash, strategy])`, while canonical scoped members now include the per-input evaluation time as a fourth component. Both the `target_states.member_key` expression and coverage LEFT JOIN at `:43` use the old key. A successful task's rank zero does not override the unmatched coverage row in that CASE; with no matched owner/context-gap state it falls through to waiting rank two. The attention filter therefore omits the real unresolved Memory work. The existing test expectation is the accepted E6 consumer contract, not an obsolete fixture.

I2 requires the minimal Activity identity-consumer correction: use the exact member's frozen private task clock while retaining original record counting, grouping, source filters, state precedence, authorization and metadata-only projection. No source/wall-time fallback, task migration, broad `awaiting_context` state override or weakened original test assertion is justified. The sole owner is preparing a bounded pre-implementation delta; plan approval will not itself close this implementation finding. No source/test edits or test execution were made by this reviewer.

Root stopped and cleaned its prior complete-check run; its interrupted/cleanup evidence and eventual fresh complete run are tracked by root, not represented as a passing check in this receipt.

The owner subsequently submitted the [Activity identity delta](../design/memory-evaluation-context-activity-delta-2026-10-20.md), seal `e99096236f92c2d5ce9daef3bd6d6dd05ab55495be171fda4012ec01f9798180`. It received prospective independent **APPROVE** in the plan-review receipt, bound to original base `bcff7bab6109a7c99acde3decb5712a072e1b045`, pre-delta head `4925a706d3baeced085230eeea9533676ab6fa30` and committed runtime diff seal `018f905b2dbdfc5334ab7a01963d7f47b7040966942c98099eac9c11e3103029`. Activity and the original regression were unchanged at approval. I2 remains OPEN; plan approval is not evidence that the consumer has been repaired.

## Final I2 implementation delta review — CLOSED

Date: 2026-10-20. Reviewer: `memory_plan_reviewer`, independent Sol High. **I2 is closed** following static review of the approved three-path correction and reading the sole implementation owner's actual RED/GREEN evidence. This is implementation closure, not a new pre-implementation approval, an independently executed test run, or full-gate completion.

Independently verified final identities:

- Original base `bcff7bab6109a7c99acde3decb5712a072e1b045`; pre-delta/current HEAD `4925a706d3baeced085230eeea9533676ab6fa30` with the Activity increment uncommitted.
- `git diff -- apps/server/src packages/agent/src` contains only Activity and hashes to `e4b0291c85fa0780dc7d3833dae05b75e6fb406a1accee572475f77818e7f88b`.
- Complete runtime diff from the original base hashes to `8c078baaac996ab7cd02566c2e24a7dee7c40491f84c459527ce43294670b980`; the earlier I1/helper identity remains unchanged within the committed portion.
- `scope/activity.ts`: `9c742158f0ff51c165ddbd4d6b501598db2b0da07e9d58486a304af178cecfdb`.
- Existing `multiuser-memory-07.test.ts`: `8b4f2eebdf939c2c65e30ba412df170efd5c92676c5b6dd5b319e1d8056778d4`.
- New `scoped-memory-evaluation-activity.test.ts`: `0b8bb23b26c4a781ad2f1a577f7e07a4090f22c9f634e1610d907c48acc60c24`.

The runtime change matches the approved boundary. A correlated metadata lookup selects each target's own time from its frozen batch map by exact evidence ID. The four-argument UDF hashes the canonical ordered tuple and returns NULL when no string clock exists. Both the projected member key and coverage JOIN use that same value. No rank expression, record/source/group identity, pagination, owner predicate, public Activity field, body read, state mutation or fallback was changed. The existing test adds only page/detail/branch equivalence and foreign-owner denial; all original complete-journey assertions remain.

The new actual ingress/M06/M07 two-clock case proves why the per-input lookup is required: one independently reviewed original completes with no candidates, the second retains its owner gap, and Activity page/detail consistently show two originals, one complete and one needing input. Assertions cover branch progress/group identity, foreign detail denial, absent public evaluation metadata and zero model calls on Activity read/restart. Reading the test confirms it uses real model-protocol coverage and existing semantic-clock injection, not fabricated stored coverage or a changed state shortcut.

The reviewer read the owner's raw tee logs and identity manifest `/tmp/mote-memory-activity-final-identity-20261020.json`, and independently verified the recorded log hashes:

| Owner-executed evidence | Result read by reviewer | SHA-256 |
| --- | --- | --- |
| `/tmp/mote-memory-activity-red-20261020.log` against unchanged pre-fix runtime | 1 failed at the exact missing attention card; 4697.942208 ms | `eb59dfb5b6e9c0cbae1bfe16e5eba7fc683f755429f9998989a5e9ca74984a42` |
| `/tmp/mote-memory-activity-green-20261020.log` | 16 passed, 0 failed/skipped; 50328.88 ms, including the original full owner-question journey and new mixed-clock Activity case | `9f4670e3d7c036a7c716ca3842065acbac512ad2323dae11a180312f2e4df699` |
| `/tmp/mote-memory-activity-neighbor-import-20261020.log` | The initially unselected final original-file import-prose case passed separately; 5522.110875 ms | `776fcd49197964cb5328d2ae14fdae804c1788378ad98ab28121c72a365b4305` |

The owner reports exit 0 for both GREEN processes, all original `-07` cases covered across those sequential selections, awaited fixture cleanup and no subsequent source/test change. This reviewer did not launch those tests or independently repeat process cleanup; it inspected their code, raw output and identity evidence. The initially unselected case is explicitly separated rather than represented as part of the 16-case command. The original failed/interrupted complete gate remains non-passing and non-reusable. Root owns a new frozen candidate and fresh complete checks; source closure here does not claim merge readiness, deployment or delivered behavior.
