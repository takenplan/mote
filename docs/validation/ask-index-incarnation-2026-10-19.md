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
and incarnations. Consuming the journal recomputes that identity, so an old
pending notification cannot index a replacement under its old authority. Ordinary
duplicate notification within the same authority and originals keeps its task.
The event body and SQLite schema are unchanged; no previous rows are rewritten,
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
- Exact current Material revision republished under fresh reset authority receives
  its own current admission. A further same-epoch publication remains idempotent;
  prior successful task identities and grants remain historical.
- The existing processing graph helper retains exact task/event/owner assertions
  and recognizes that the event ID is authority-qualified rather than a hash of
  stable body IDs alone.

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
