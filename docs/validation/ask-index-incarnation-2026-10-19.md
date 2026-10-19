# Ask index admission incarnation

The original generated non-image journey on `9c03b631` failed a legitimate new
upload commit with `401 invalid_identity`: A's old ASR was held, B completed,
A deleted its source, an administrator reset A's password, and a fresh same-user
client recreated the same source and uploaded the same file IDs. Open and part
succeeded. Commit entered synchronous consumers and then rolled back. Independent
offline review recomputed the exact old epoch-0 Ask admission task, operation and
input collision. The internal throwing frame was not captured, so this is not a
claim of an observed internal Ask stack or a verified repair.

## Current responsibility

M03 owns reception, source/original identity and the transaction. M05 must reject
an old authorization epoch even on its existing-task idempotency path. Ask owns
its indexing notification identity. Stable capture/source IDs alone cannot
identify current authority after reset or same-ID recreation.

Ask now hashes the event together with the trusted epoch, existing source
incarnations, exact original receipts, and the root/transitive Material revisions
and incarnations. The current journal persists that admitted proof and verifies its digest and epoch.
Each consumed record checks only its own relevant source/Material/original pins,
so a retired capture sibling cannot invalidate unrelated pending or issued work.
An old notification cannot index replacement evidence under its old proof. Ordinary
duplicate notification within the same authority and originals keeps its task.
The internal journal uses a strict versioned proof envelope; the original event
body and SQLite schema remain unchanged. No previous rows are rewritten,
old grants renewed, compatibility replay added, or historical index scan started.

The production Ask retrieval/evidence/schema blobs are identical on `a0215837`
and `9c03b631`. This isolated candidate starts from the latter because the exact
ASR-held source-recreation journey also needs its current M06 intake-incarnation
and physical-settlement ports and M05 parent contract. It does not update Draft179
or import unrelated module changes into its branch.

## Prepared regression journeys

- Real M03 audio upload, automatic ASR, A-held/B-ready, source deletion, optional
  real admin password reset and same-user login, old-token refusal, same-ID source
  recreation, processing configuration, upload open/part/commit, new Ask grant,
  duplicate new batch, late-response fence, current A publication and B isolation.
  Both unchanged and incremented epochs are explicit cases.
- The complete exact-current-Material-revision reset/republication journey is
  retained and enabled. Source review found the unchanged M07 material-stage
  old-epoch collision before Ask; its separate owner repair is outstanding. This
  Ask-only delta does not close or qualify that full public journey.
- The existing processing graph helper retains exact task/event/owner assertions
  and independently reconstructs the exact qualified event digest from known
  fixture epoch, source pins, Material graph and raw receipts. A separate real
  M03 publication seam covers a known root/transitive Material pair.

KEEP: real startup/intake/publication, same stable IDs, owner/source/revision
fences, physical settlement, current duplicate idempotency, old-grant rejection,
B isolation and no paid historical backfill. CHANGE: Ask admission identity and
its consumption fence. REMOVE: stable event body as the whole admission identity.
EXCEPTION: generated loopback ASR and private fixture storage. UNKNOWN: repair
execution, semantic typecheck, complete failed files, consumers, independent
review, full gate, combined runtime and live/device checks remain unperformed.

Only light source/test preparation and Git/plan inspection were authorized for
this slot. No dependencies, builds, tests, model calls, API calls or database
opens were performed while preparing this candidate.

## Independent review follow-up: F01/F02/F03

The parent `582f624e` source review requested changes. Its whole-batch live proof
reconstruction could reject unchanged Y when X in the same capture batch retired.
The new current envelope stores the original proof. Admission and in-flight
publication check each actual record against the matching saved raw receipts and
its relevant source/Material dependencies. Authentication and stored digest are
still checked before consumption. This preserves valid per-record continuation;
it adds no scan, backfill, old-format interpretation or grant renewal.

Two generated mixed-batch regressions hold the real organizer/admission pools or
actual embedding responses. They DELETE X through the real public route and
require same-ID redelivery to return `410 capture_deleted`, with X still absent. They then require Y's original
event/proof and (when issued) original task/model/grant to finish; deleted X must
not publish its late result. Legal same-ID source-lifetime recreation remains in
the separate original cases; it is not an ordinary-capture tombstone bypass. No
listener is disabled and no journal/task/vector is hand-inserted. These tests remain unexecuted.

The independent test oracle reads actual current epoch/incarnations and raw
receipt fields but receives the known fixture graph from its caller; it never
calls a production-private identity method. The eight-kind graph, three organizer
operations, exact operation/task/grant, no-model, B and rollback/orphan assertions
remain. The M07 public republication closure is an explicit dependency, not a
newly measured M07 incident or a skipped/softened assertion.

The environment/build PASS on the unchanged parent `582f624e` is not a build or
runtime result for this child. Child source preparation, independent review,
semantic checks, controlled F01 RED/GREEN and all consumer runs remain separate.

## Child admission reauthorization follow-up

Review A084-F01 identified another asynchronous boundary: M05 authorizes a child,
awaits its real M04 fork, then authorizes it again before admission. A record can
retire in that interval. The parent now handles only a `not_found/404` rejection
whose same exact input is still invalid on recheck, after the parent grant,
trusted context and original global model lease are reasserted. If the record
is still current, or the original error is a model/configuration/scheduler/storage
failure, that error still reaches the parent’s existing failure classification. This is not a general submit-error
catch, retry, or grant renewal.

A prepared regression holds the real returned M04 fork lease, verifies the exact
X child operation after M05's first authorization, DELETEs X, preserves its 410
redelivery fence, then releases the second authorization. Y must be admitted and
complete from the original event. A companion changes the real model configuration
to revoke credentials during that same hold; its global failure must remain
visible as M05’s `stale/grant_revoked`, and neither child may issue a paid request. These are new unexecuted
regressions, separate from parent-pool and HTTP-response timing barriers.

The previously accepted independent proof oracle and exact processing graph
assertions are unchanged. The complete enabled exact-revision public case remains
byte-identical and requires composition with the separately reviewed M07
`66a576fd` source (including its schema responsibility) before a joint public
GREEN can be claimed. No unbound M07 overlay is included in this Ask child.


## Pair test observation follow-up

The driver's first four-file run on pair `db1ff614` (tree `58770858`) ended
naturally with 78 passes and three failures. This is evidence for that exact
pair, not for the later test-only child. All five M07 cases, all five sibling
cases and the complete Ask exact-revision case passed in that run.

Both Ask source-incarnation variants failed while comparing B's admission rows:
the snapshot retained a `waiting` task that legitimately became `succeeded`.
Its ID, input, grant and epoch were unchanged. File indexing had finished, but
B's independent Ask admissions had not been awaited before the snapshot. The
prepared correction waits for all actual B admissions to succeed using the
existing bounded state barrier. It preserves full row/state comparison and adds
final equality of B's grants, exact journal proofs and complete Material read
after A's original release/late-result assertions. It adds no fixed sleep,
budget increase, subscriber suppression or forced scheduler state. A's late
assertions were unreached in the failed pair run and remain unverified here.

The processing rollback case reached its failing hook and verified rollback of
child tasks, task authorizations, Material and publication, with committed intake
retained. Its final legacy observation read top-level `kind`; the current private
proof uses `event.kind`. The prepared assertion keeps exactly one capture event
and one Ask admission, compares the full current proof to the independent known
raw-capture graph oracle, and checks its digest and exact owner-bound task,
operation, input, grant epoch and absence of model authority. All original
rollback negatives remain. No old-format compatibility path is introduced.

Only the two test files and this validation note change. The full enabled F03
body remains byte-identical (`549746af…`). This child has not been installed,
built, typechecked or tested. Root owns the bounded three-case first run and the
later complete new-source union validation, including whole processing and all
consumers; the parent's 78 passes cannot be combined with three later passes to
claim a new 81-case whole-file pass.
