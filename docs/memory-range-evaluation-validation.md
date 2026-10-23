# Memory range evaluation: validation

This matrix covers the accepted [range-evaluation ADR](adr-memory-range-evaluation.md).
All automated source text, model output and transport credentials are generated
fixtures. The matrix records required outcomes and implemented regression
assertions; executed check results belong in the evidence section below.

The resource-subdivision rows and executed results below record the 2026-10-13
implementation boundary. The 2026-10-14
[simplification decision](adr-ask-evidence-quality-and-simple-context.md) supersedes
automatic halving and artificial target-count clipping; actual capacity failures
now retain the original unfinished scope. Current wide-target, lease and activation
regressions are recorded [separately](validation/query-lease-and-memory-activation-2026-10-14.md).

## Contract and state transitions

| Input / transition | Required outcome |
| --- | --- |
| New versioned recipe → job | Freeze `range-evaluation@1` from the exact binding. |
| New unbound reviewed API/raw job → job | Pin the new contract even with omitted `recipes` and no work package. |
| New manual job → unbound fallback / explicit old binding | The fallback uses the new contract; an explicit old binding takes precedence and retains legacy planning/validation. |
| Existing saved no-field job → reopen / explicit retry | Remain legacy; no upgrade or automatic replay. |
| Internal no-review path → work | Retain legacy behavior; do not claim independently reviewed range completion. |
| Full target assessment → `checked` | Independent review supports selected candidates and exact target ownership; commit their normal result/checkpoint atomically. |
| Full target assessment → `no_candidates` | Independent review still runs; zero selection records exact completed range coverage. |
| Partial/unread/truncated assessment → `incomplete` | Require a concrete reason; keep the range unfinished and block publication/checkpoint, without count-driven recursive splitting. |
| Invalid output/quote/coverage → repair | Repair only the failed stage within existing bounds and the same grant; invalid or subset output never completes. |
| Specific missing context / essential owner fact | Keep the existing `needs_context` or `needs_owner_input` lifecycle and its scope/authority fences. |
| Measured context/output failure → resource subdivision | Child ranges are disjoint, gap-free, source-bound and independently reviewed; grouping does not consume text recovery depth. |
| Unrecoverable resource failure → terminal work | Preserve unfinished ranges and the exact resource failure; never trim the result into apparent success. |
| Source change, deletion or revocation → late result | Reject publication and checkpoints under the existing fences. |

`checked` and `no_candidates` describe assessment of the exact supplied target,
not a whole-document assertion or exhaustive fact recall. Explicit incomplete
assessment currently projects a blocked execution step and a failed Memory batch
with `memory_evaluation_incomplete`; its coverage/reason remain available. A batch
without a successful commit does not publish partial proposals. Existing successful
siblings and their checkpoints remain valid.

## Generated regression matrix

| Journey / high-risk combination | Required regression | Fixture coverage |
| --- | --- | --- |
| Fully assessed single range → 8, 32 or 80 selected candidates | Exact quotes and coverage pass without candidate-count subdivision or an index-64 ceiling. | `memory-range-evaluation.test.ts` |
| Useful claim in one member + other fully assessed members | Every target receives a reviewed disposition; one selected claim does not conceal unassessed targets. | `memory-range-evaluation.test.ts`, `memory-work-packages.test.ts` |
| Empty draft → review → exact zero-result checkpoint | Empty selection does not bypass independent review. | `memory-work-packages.test.ts` |
| Partial supported proposal + explicit incomplete target | No proposal/checkpoint commits, no semantic split, and the original range/reason remain unfinished. | `memory-range-evaluation.test.ts` |
| Missing target row, incomplete without reason, old capacity envelope in new work | Repair or fail under the new contract; no subset completion or hidden promotion of an old result. | `memory-range-evaluation.test.ts` |
| Two windows of the same original + cross-range candidate | Every supporting exact target declares ownership; matching record ID alone cannot erase a target window. | `memory-range-evaluation.test.ts` |
| Source replacement during independent review | All selected proposals/checkpoints are fenced; the changed source is not reinterpreted under the old grant. | `memory-range-evaluation.test.ts` |
| New raw Coding source or owner-correction note | Neutral new procedure removes old count quotas while preserving provenance, correction scope and evidence policy. | `memory-range-evaluation.test.ts` |
| Raw extraction repair → independent-review repair | Both stage repairs traverse the actual pipeline within the existing 20,000-character Agent question bound; the current review repair remains present and prior extraction repair does not displace review policy or stack into a second repair. | `memory-range-evaluation.test.ts` |
| Pinned reviewer inner failure / saved legacy pinned or unbound job → review repair | Current stage feedback reaches the reviewer; legacy raw work does not acquire a manufactured target coverage contract. | `memory-range-evaluation.test.ts` |
| Mixed short/long targets + repeated measured context failures + Unicode boundary | Structural member partition leaves the original text recovery budget; terminal leaf ranges cover the exact original without gaps, duplication or torn surrogate pairs. | `memory-range-evaluation.test.ts` |
| One completed sibling + output-limit failure → close/reopen → one explicit retry | Completed sibling/checkpoint survives; only unfinished work resumes under the fixed contract. | `memory-range-evaluation.test.ts`, `import-memory-progress.test.ts` |
| Oversized external-adapter answer + short unsplittable target | Existing answer-size bound rejects the complete output; no silent slice or apparent completed selection. | `memory-range-evaluation.test.ts` |
| Permanent input-budget failure at the text recovery bound | Every terminal range remains unfinished with the measured resource code. | `memory-range-evaluation.test.ts` |
| Public source ingress → Memory job API, explicit v5 or omitted recipes → app restart | Forty selected generated results commit with the frozen new contract through the real API path. | `memory-range-evaluation.test.ts` |
| Existing no-field job / explicit old recipe reaches legacy capacity → restart | Legacy saturation is retained; new code does not automatically replay or rewrite the task. | `memory-range-evaluation.test.ts` |
| Fresh defaults / exact old v2, v3 or v4 composition / missing capture-default row | New future defaults are correct; old scopes stay available, custom/source choices stay fixed. | `bounded-personal-defaults.test.ts` |
| Default upgrade fails halfway → rollback → restart | Choices, legacy scopes and migration marker roll back together. | `bounded-personal-defaults.test.ts` |
| Already authorized v3 receipt → upgrade → drain old → new receipt → restart | Old binding, authority and product stay v3; only genuinely new receipt uses v5, without historical backfill. | `automatic-memory-recipes.test.ts` |
| Same originals + legacy/new generation products or incomplete products | Only exact matching contract, ranges, policy and completed assessment permit reuse. | `memory-work-packages.test.ts`, `conversation-understanding.test.ts` |
| New conversation interpretation → 80 candidates + full reviewed target coverage | Producer stores its new product/contract identity and no semantic capacity envelope; legacy products remain legacy. | `conversation-understanding.test.ts` |
| Native preparation / reviewer failure / retained publication → restart | Draft and retained output reuse keep contract, exact evidence, policy and authority; no stale verdict promotion or duplicate model stage. | `memory-owner-material-prerequisite.test.ts`, `memory-review.test.ts`, Memory publication fixtures |
| Mixed owner question + context gap + independent completed target | The actual API keeps independent results, creates only the scoped feedback child, and preserves contract/resource counters for personal v2 and v5. | `memory-owner-questions.test.ts` |
| New raw job → review timeout / shutdown → vault restart | Resume independent review of the validated private draft without re-extraction; changed model configuration or extraction policy regenerates, and late old responses cannot write. | `memory-draft-recovery.test.ts` |
| New raw failed-review draft → source deletion / revision / owner cancellation | Purge private unshared draft text and publish no result; bounded draft accounting remains exact. | `memory-draft-recovery.test.ts` |
| Legacy action/event consumers + new Memory products | New selection semantics do not suppress unrelated action cues or claim compatible generation without an exact contract. | `semantic-products.test.ts` |
| Deletion comparison removes first/middle or all selected candidates | Remap candidate ownership indexes without erasing an explicit incomplete range/reason; no removed candidate can survive through stale indexes. | `memory-automatic-deletion.test.ts` |
| Version 2/3 product → ordinary archive navigation | Hide private candidate/accounting bodies while preserving the exact original references and product counts. | `semantic-products.test.ts` |

The historical count-saturation failure becomes the synthetic 8/32-candidate
regression above. It reproduces the deterministic host gate without copying
private source bodies or assuming the old model had omitted facts. Broader cases
exercise target coverage, source identity, restart, failure-stage recovery and
consumer compatibility instead of merely asserting an array length.

Coverage for feedback/timeout child counter inheritance, explicit-old-binding
planning precedence and contract-aware retained journals must be checked with the
affected lifecycle fixtures. A file's presence or a mocked output does not prove
the corresponding production entry point or ordering passed.

## Composed-policy integration checks

Personal v5 combines the separately reviewed context-reading and range-evaluation
changes. Its fixed components are personal-extraction v3 and personal-review v5;
personal v4/extraction v2/review v4 keep their context-reading fingerprints and
legacy work contract. Default regression checks must cover v2→v3→v4→v5 and
grandfathered v2/v3/v4 receipts without historical authorization.

The generated integration journey in `memory-feature-composition.test.ts` uses
public source ingress, formal Material publication and the Memory job API. It
requires both model phases to actually read authorized original context, saves
more than 32 selected candidates with independent review and no count-driven
split, then changes the source through its API. The resulting current detail/list
counts must report input invalidation separately from processing failure and
remain stable across restart without another model call.

2026-10-13: `node --import tsx --test apps/server/test/memory-feature-composition.test.ts`
passed 1 test, 0 failed and 0 skipped. The composed application saved 40 generated
observations through independently reviewed target coverage. Both extraction and
review actually called `context_evidence` for an exact continuation outside that
target; the read did not add a coverage row or trigger semantic subdivision. A
source revision through the API withdrew the dependent current products and
reported zero processing failures plus input-invalidated batches in both detail
and list. Closing/reopening the application preserved those states without a new
model call. This proves the composed host journey with a scripted model, not real
model interpretation, personal-data quality or physical-device behavior. The earlier
PR checks below remain historical evidence for their original definitions.

## Commands and executed evidence

Before opening or updating a PR, run `npm run check:affected` for Server and the
affected Agent/shared/Web consumers under the [development guide](testing.md#early-integration-and-candidate-checks).
Targeted generated checks use `node --import tsx --test` with the fixture files above
after shared/Agent build prerequisites. Additional native/UI checks depend on the
changed behavior and are reported separately.

Targeted generated checks on 2026-10-13:

- `node --import tsx --test apps/server/test/memory-range-evaluation.test.ts apps/server/test/memory-feedback.test.ts`:
  29 passed, 0 failed (24 range-evaluation and 5 context-feedback regressions),
  including both actual pipeline repair stages and exact target recovery.
- `node --import tsx --test apps/server/test/memory-draft-recovery.test.ts`: 8 passed,
  0 failed, using the real unbound `MemoryPipeline` constructor. Positive synthetic
  extraction and review responses supply the new target coverage contract.
- `node --import tsx --test apps/server/test/model-profiles.test.ts apps/server/test/memory-pipeline.test.ts`:
  33 passed, 0 failed.
- The two mixed owner-question/context-gap API cases in
  `memory-owner-questions.test.ts`: 2 passed, 0 failed, covering personal v2 and v4.
- Read-only generated dual-repair prompt probes: raw Personal, raw Coding, and
  their correction-note variants produced review questions of 19,019, 19,097,
  19,381 and 19,424 characters, within the existing 20,000-character Agent bound.
  They retained the current review repair and omitted the prior extraction repair.

Final affected-component check on 2026-10-13: `npm run check:affected` passed
with 2,427 passing tests and two skips. The plan included `check:i18n` and
`check:central`: Shared, Agent, Server and Web builds/typechecks/tests, the
generated Central runner and release-tool checks. The thousand-original HTTP
import/background-worker fixture completed in approximately 226 seconds.
The installed Codex synthetic Responses fixture and macOS sandbox check were
skipped; neither is claimed as performed.

The live-model results, final commit and deployment status are recorded separately.
Physical-device, OCR/transcription accuracy and container deployment checks were
not performed for this internal Memory contract change.

## Live and deployment boundary

The owner authorized five fresh evaluations in an isolated private copy using the
existing Codex App Server and `gpt-6.1-sol`. Record actual calls, configuration,
delivered ranges, final reviewed coverage, exact proof, usage and failures in the
private ledger. New candidate selection is reviewed for supported usefulness and
material omissions; candidate count alone is not a quality score.

These fresh evaluations do not retry or modify the five production failures, and
do not reprocess successful siblings or authorize the rest of the historical
archive. No real screenshots or credentials enter fixtures or Git. Live-model
results, generated-fixture results, physical-device/media accuracy and deployment
are separate claims. Deployment remains pending owner confirmation and requires
verifying the delivered commit/version; an isolated pass is not deployment.
