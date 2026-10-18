# Memory original journey parity validation

Scope: MEM-M01–M08 from the 2026-10-18 multiuser journey audit. Original production
baseline: `2c2627621e2598332ae8169845bc7343be7ed63e`; fixed implementation starting
point: `2c78ca8d52a7d17fae20962cf68d09a717ffc73a`. These scenarios exercise
`buildApp`, authenticated HTTP entry points, the real scoped Memory host, Agent
provider transport/tool loop and durable executor. Provider responses and all
source content are generated. Legacy composition tests are additional regression
coverage, not evidence that the scoped production journey works.

| Item | Durable production regression |
| --- | --- |
| M01 | `scoped-memory-parity.test.ts`: exact shared output contract/example in extraction and independent review. |
| M02 | Same-original cross-batch `context_evidence`; same IDs under two owners; foreign tool request denied; cross-original actual-read dependency versus unread catalog; deletion and restart; separate catalog metadata fences allow unread-body revision through actual target publication while rejecting changed disclosed metadata. |
| M03 | Independently reviewed legal empty output; missing coverage; incomplete partial proposals blocked without batch publication; original job retry after restart preserves completed sibling task IDs/attempts. |
| M04 | `multiuser-memory-integration-domains.test.ts`: actual personal/coding split, independent reviews, either domain fails while the sibling commits, restart and same-job retry preserve completed domain. |
| M05 | Oversized publication drains through frozen bounded successors, preserving due-time wait, successful supersession, restart and cancel/stop fences. Observation-only publication creates no consolidation window; observations do not satisfy `minChanges` or enter the integration prompt. |
| M06 | `multiuser-memory-coding-preparation.test.ts`: same-ID dual-owner clean Coding intake, independent understanding, work/event Material, exact complete candidate reuse versus ordinary extraction for context gaps, independent review; two sessions plus ordinary input keep three final batches; restart reuse, incomplete retry and cancel/delete/account-disable late results. |
| M07 | Both extraction and independent review receive `quote_not_found` correction before quote-backed coverage checks, and retain content-free candidate/span diagnostics. |
| M08 | Eight independent generated originals keep subsequent model work pending/running behind a provider gate while the first reviewed batch is already searchable; persisted draft/review/prepared/saved checkpoints remain within one continuous task, without stage dependency reentry. |

`multiuser-memory.test.ts` and the existing scoped Memory suites additionally cover
source withdrawal, cancellation, account disable, original-image review, external
provider unknown results, binding changes and deletion. Broad-check results must
be attached to the frozen candidate; prior successes are not relabeled.

## Execution dependency and validation boundaries

The qualified Execution API seam `f416966727bdb182c0fd2921a94a57be43e5a987`
provides operation parent aggregation and is included as an explicit dependency.
The qualified shared semantic-contract seam
`ece742f090a9d2502775184b0396e073050e4de9` is likewise included; Coding and
the legacy processor now share the same pure product parser rather than importing
a retired Store host. The remaining Execution module changes restore effective
configured `memory.models` concurrency. The standalone Memory branch removes the
publisher lock from model work and retains per-original exclusion. More than two
simultaneous configured model calls are
cross-module checks; they require the frozen Execution dependency and are not
claimed by standalone two-slot fixtures.

Local preparation used Node `v26.11.1`, ABI `147`. `npm ci --ignore-scripts` and
shared/Agent builds completed; ignored native installation is not a readiness
claim. The actual Server and Mem0 SQLite resolver preflight must pass before the
required affected check. No lockfile or shared dependency symlink was changed.

The PR description and its attached external validation receipt record the final
candidate SHA, exact commands, exit statuses, evidence paths and required
affected-check receipt. Preliminary WIP successes are not relabeled as frozen
candidate validation.
Physical devices, live models, real provider accounts and native service
deployments remain UNRUN. SDK fixture checks are reported separately. No personal screenshots or production data were collected or replayed.


## Import/Ask consumer completion observation

The retained `query-import-context.test.ts` consumer journey starts at HTTP import,
explicitly confirms its preview, then checks native Ask declaration paging and
original-citation isolation. A current Material correction must reject the
already-reading query; the next query must read the corrected attribution and the
same maximum-length import note.

The Q006 gate exposed a fixture assumption: two `100 × 10 ms` loops treated
asynchronous import admission as a one-second completion contract. A generated
source-persistence gate reproduces `importing` with zero committed records while
the original commit task and worker are still running. Releasing that gate lets
the same job finish normally; it requires no retry or additional confirmation.
The fixture now observes the exact route-launched `importTasks` promise and still
asserts successful terminal status, both committed records, completed executor
state and worker cleanup before all existing Ask/correction assertions. It uses
the existing server test-runner bound; product timeouts and import behavior are
unchanged. Frozen before/after SHA, logs and the fresh full-gate result belong in
the external validation receipt; the failed Q006 run remains failed.


## Continuous-batch review corrections

The independent review of `1c9be37b` identified F01 (three independently admitted
stage tasks), F02 (unconditional extra Coding extraction), F03 (mixed provenance
target batches) and R01 (actionable Owner questions before save). The interim
three-task design is superseded by [the continuous-batch ADR](../adr-memory-continuous-batch.md).
Existing tests encoding that interim design were rewritten around original batch
drain semantics, checkpoint reuse and actual publication.

| Scenario | Production entry and evidence |
| --- | --- |
| F01 | `scoped-memory-parity.test.ts`: continuous backlog, early searchable result, one actual batch task and persisted checkpoints; `multiuser-memory.test.ts`: pause drains the admitted batch. |
| F02/F03 | `multiuser-memory-coding-preparation.test.ts`: real Coding ingress, exact reuse (understanding + independent review), context-gap nonreuse (understanding + extraction + independent review), two short sessions plus an ordinary original in one job, three final target batches. |
| R01 | `scoped-memory-parity.test.ts`: held same-owner publisher, independent owner progress, no question or reply capability before save, cancellation/model withdrawal; successful save then actual unknown reply. `scoped-memory-owner-publication.test.ts`: real installed provider worker held before put, cancelled put and failed readback/unknown journal. |
| Publication/native calls | Shared supported context from two nonoverlapping target batches deduplicates under the actual publisher. `scoped-memory-native-admission.test.ts` uses the installed native adapter and generated HTTP service/relay callbacks to verify shared A/B model admission and exclusion of capacity waiting from usage fragments. This is a scripted service, not a live backend or model check. |
| Restart | `multiuser-memory-index-continuation.test.ts`: real `initialize-admin` and `src/index.ts` child processes, ordinary upload and Coding ingress over HTTP, SIGKILL during independent review, exact understanding/draft reuse, successful other-owner task/attempt unchanged and distinct interrupted/completed usage fragments. |
| Shared resource port | `execution-continuation.test.ts`: three actual processes share the durable lock, two same-owner saves serialize while another owner completes; pre-call wait does not spend an attempt, between-call wait exceeds the protection budget safely, wait/acquired cancellation, revocation and expired-fence rejection leave no reservation. |

The before/after fixture evidence records the original Memory source identity
separately from the host port/test overlay. A static failure and a failed fixture
precondition are not relabeled as a successful dynamic counterexample. Final
frozen-source commands, hashes and statuses belong in the external manifest.
The full affected gate, the configured greater-than-two model check with the
qualified Execution dependency, native consumers, physical devices and live models
remain separate validation obligations.


## Concurrent process observer regression

The frozen `3a9d2fa5` targeted server run completed 210 tests: 209 passed and one
failed while the parent of `multiuser-memory-outcome-process.test.ts` read
`execution_steps` from a live child database using a zero-wait SQLite connection.
The actual error was `database is locked`; an isolated retry passed and does not
override that failed run. The observer now uses the existing generated-fixture
read-only connection with the same five-second lock wait as the live host. The
other Memory process observers use the same contract.

`generated-memory-observer.test.ts` holds an exclusive transaction in another
real process. It proves the former observer fails while the bounded observer
waits and reads the committed value. This changes fixture observation only;
product deadlines, grants, model calls, unknown-result assertions, physical
worker retirement, successful sibling receipts and exact erasure checks remain
unchanged. The seven-test process follow-up covers that regression, actual index
restart, unknown external outcome, admission, review, feedback and Owner reply.
The broad failed receipt remains in the evidence manifest; a fresh full affected
gate is still required on the final candidate.
