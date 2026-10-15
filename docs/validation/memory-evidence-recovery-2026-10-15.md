# Memory evidence recovery — 2026-10-15

The owner selected integration option A, independent image verification when
needed, honest planner failures, durable safe failure receipts and accurate log
counts. [The ADR](../adr-memory-evidence-delivery-and-failure-state.md) records
the decision and supersession boundaries. This record separates executable host
invariants from live semantic acceptance and deployment.

## Journeys and durable regressions

| Failure and original path | Intended behavior and regression |
| --- | --- |
| Connector archive → Material → Memory → integration reader: a permitted Material card disappeared because a raw recording ancestor was unreadable. | Exact current cited Material proof covers only its own ancestor for disclosure; raw APIs remain denied. Generated Feishu and DingTalk journeys use actual connection/selection/archive/Material/extraction/review APIs and the real Bridge. |
| Integration called `memories`, received HTTP 200 with empty arrays, then saved an empty success and advanced the cursor. | Preflight rejects unreadable inputs before charging a model; no actual body/original delivery blocks completion and retains the exact window/cursor across restart. Read-and-no-change remains valid. Explicit retry overwrites a bounded receipt; step deletion cascades it. |
| Image processing → generated interpretation → Memory quoted interpretation JSON as though it were original pixels. | File/attachment/screen Materials expose original locators independently of OCR/interpretation readiness. Text uses delivered OCR quotes; visual claims use exact delivered original views. Interpretation quotes are rejected. |
| Image extraction read pixels but review merely trusted its draft; or an unread image became `no_candidates`. | Each reviewer needs its own covering pixel receipt for retained visual claims. Metadata, prepared or failed delivery, another image's OCR, an unrelated crop and model-authored receipts cannot prove coverage. OCR sufficient for the same original needs no pixel call. |
| Image task → restart, late derived product, original replacement, attribution change or deletion. | Frozen output selection and grant identity persist; stale/private originals cannot send or publish. Resume preserves the extraction draft but repeats independent review. Open integration and bounded deletion review retain their exact image scope, even under a general query-deny policy. |
| Native text-only engine received a parent with visual proof and could fail after remote staging. | Hindsight rejects unsupported visual parents before service/worker/bank calls, retains an explicit input failure across restart and requires manual recovery. OCR-backed text keeps its existing path. |
| Native input preparation was counted as delivery before the engine accepted it. | Actual app/API tests hold a native prepare pending and reject a visual input with real Hindsight preflight. Receipts stay empty until successful, currently authorized native handoff; an unsupported local input produces no remote calls or delivered-body receipt. |
| Feedback planner threw an unknown error, retried the same paid input four times and projected `waiting_for_input`. | Unknown execution errors stop once; typed temporary provider facts retain bounded retry. Failed zero-unit planning is reported as failure, successful siblings and unfinished ranges remain. True context stops/questions are unchanged. |
| Failed parent/child task lacked a useful final cause after a trace fell out of the ring. | Latest per-step safe receipt retains fixed cause/phase/attempt/run identities, survives restart and respects deletion/quota. Receipt persistence failure cannot cause paid replay and has its own diagnostic count. |
| Ordinary events/trace toggles/restart produced a trace count inconsistent with the retained ring. | One insertion/eviction path counts only real trace entries; generated tests cover load, ring overflow and tracing on/off. Persistent-log and ring totals remain separately reported. |

Primary new suites are `memory-integration-delivery.test.ts`,
`memory-image-journey.test.ts`, `memory-image-proof.test.ts` and
`execution-failure-receipts.test.ts`. Existing feedback, delegation, import,
diagnostics, source, coding and Web Activity regressions cover consumers and
historical compatibility. All automated screenshots/content are generated.

## Checks

`npm run check:affected -- --base origin/main` completed with exit 0 after the
final code change, against `origin/main` at `fcc28671`. It selected all protocol
consumers: `check:local` and Android `:app:testDebugUnitTest`. JDK 21 and the
installed Android SDK were provided only to that command. All checks ran in the
background. The affected source fingerprint was unchanged during the final run.

| Final check | Result |
| --- | --- |
| Bilingual catalog and TypeScript workspace/script type checks | Passed; 8,233 messages synchronized with Android. |
| Desktop | 442 passed across 55 files. |
| Server | 1,830 passed; 1 skipped. |
| Web | 387 passed. |
| Agent | 312 passed; 1 skipped. |
| Diagnostics / Shared | 5 / 183 passed. |
| Release, security, proxy, backup and worker script group / CLI | 80 / 4 passed. |
| Actual central runner noisy restart, bounded logs and private-content fixture | Passed. |
| Android debug JVM | 319 passed across 68 suites, no failures/errors/skips; Gradle build successful. |
| Separate server and Web production builds | Passed. |
| Diff whitespace and documentation relative links | Passed. |

The two skipped tests are the macOS sandbox-isolation fixture and the installed
Codex synthetic-endpoint fixture; they are not reported as performed checks.
Focused image/native/delivery and publication-retry groups overlap the full
suites above. Their counts are not added again. The first broad run caught an
old publication-retry model fixture returning citations without actually
reading originals. It now reads stored originals and emits delivery before
returning its verdict, and verifies that a publication-only retry reuses the same
receipt without another generation or review. No production delivery guard was
relaxed to accommodate that fixture.

## Isolated real-data acceptance

The owner authorized real text and a small number of existing screenshots in an
isolated copy. Both runs used the configured `gpt-6.1-sol / high / default`,
65,536 output tokens and null configured timeouts, without Fast. Background
admission was disabled and only explicitly selected evidence was exposed.
Private originals, tokens, model outputs and reports remain outside Git with
0700 directories and 0600 files. Main data and running services were not changed.

Text: one demonstrated historical window's two current v2 Memory cards passed
the formal manual integration API, lifecycle and actual model Bridge. The model
received two Memory bodies and three distinct canonical originals; eleven
delivered ranges totaled 1,398 characters including repeat reads. It selected no
new integration, completed the manual window and retained a delivery receipt.
The manual cursor correctly stayed unchanged; automatic cursor progression is
covered by generated regressions. Selected production versions and the production
cursor were checked unchanged. One actual outer model session completed without
paid retry: 63,865 input and 334 output tokens, 37,760 cached input tokens.

Image: a new empty private archive imported one explicitly authorized existing
image through the formal file path, reused its existing OCR product, and selected
only its new original-image output for formal Memory work. Real extraction and
independent review used different runs, each with three confirmed pixel views of
that same original. The one target was explicitly assessed as `no_candidates` in
both phases; one batch completed and no Memory was published. Human inspection
found that preserving uncertainty about third-party attribution and relative
dates was appropriate. No visual-understanding model was additionally invoked.
The two sessions reported 185,026 and 279,598 total tokens respectively. An early
acceptance-wrapper setup failure occurred before model-session creation and
made zero model calls; it is retained separately from the successful run.

These live cases validate actual evidence delivery and independent image
assessment followed by legitimate empty selection. They do not prove real
nonempty visual Memory publication, new integration relations or broad historical
semantic quality; those positive publication branches use generated fixtures.
Usage is thread-cumulative; underlying request counts and actual fees remain
unknown, not zero. No unrelated phone-source records or other archive content
were exposed.

## PR #121 review correction

The review identified that comparing draft and reviewed statement strings could
drop the old view-coverage requirement after a paraphrase. Generated regression
tests reproduced the bypass before the fix: a rewritten claim could cite an
unrelated smaller crop, and two partial crops could replace a full-image proof.

Matching now uses the evidence anchor and original hash. Every still-cited
group's draft-cited view needs one covering view actually cited and delivered in
this review. Multiple crops can cover separate proofs; they cannot be stitched
to satisfy one larger required view. Uncited extraction reads and entirely
discarded groups add no coverage requirement. The conservative grouping boundary
is documented in [image processing](../image-processing.md).

New unit cases cover rewritten statements/titles, reordered candidates,
same-image multiple crops, smaller/unrelated crops, covering/full views, wrong
anchor/hash and unused reads. Formal generated file → Material → extraction →
real Bridge → independent review regressions verify that a paraphrase with an
uncovered crop never publishes, while a paraphrase with the full image does.
The focused proof, image-journey and review suites passed 37/37. After the final
code change, `npm run check:affected -- --base origin/main` exited 0: Server
1,834 passed/1 skipped, Desktop 442, Web 387, Agent 312 passed/1 skipped,
Diagnostics 5, Shared 183, script group 80, CLI 4 and central-runner fixtures
passed. Android's JVM task was successful with all inputs up-to-date, reusing its
319 existing test results. The server production build and diff/documentation
checks also passed. The two conditional skips are the same ones identified
above. This correction uses generated content only; it adds no real-data/model
run or historical reevaluation.

## Historical scope and release boundary

Five historical integration windows have demonstrated empty-body delivery,
covering 42 distinct candidates and 63 empty Memory tool calls. A sixth uncertain
window is excluded. A private plan preserves those exact input identities and
trace-report proof. A fresh read-only check found all 42 still published at v2
in the Memory layer; execution must check current versions and authorization
again. This is a proposed reevaluation scope, not a claim that every candidate needs a
new consolidated card. Historical reevaluation is not executed by this change.
The owner decides after the implementation and acceptance are reviewed.

No physical-device run, new screenshot collection, deployment, production
history replay or general historical image-quality reevaluation is included.
