# M06 scoped processing pipeline

Prerequisite: Draft PR #132, exact published head
`cdc5c34c36fc5743049007ee2c76d705fde3dd7f`, containing M00/M01/M02/M03/M04/M05/M09.
The protected integration base remains
`6272a9b51ec92cc4c32e2ff1a1eeb4fa38b142ed`. No prerequisite PR is merged.

## Production responsibility

The production composition registers ProcessingHost, its ConfigService domain,
M03 intake hook, M05 handlers and M09 processor adapter before starting the one
shared executor. This reuses FileProcessorRuntime, its Cordis registry, pinned
file recipes/output validators, document-decoder child process, binary OCR/ASR
HTTP transports and acoustic alignment. No legacy Store, second database or
second scheduler is constructed.

The `processing` user configuration stores only processing choices and bounds.
M04 retains all media connection endpoints, credentials and fixed model/resource
generations. Its `ocr` and `asr` selections use the explicit `mote-media` protocol
with the existing binary media worker interface. Language-agent dispatch rejects
that protocol. Shared media references cannot be combined with a user endpoint;
workers receive request bytes and the fixed connection's key, never a caller key.
Text and document extraction require no model selection. M04 snapshot hydration,
usage attribution and M05 typed failure handling remain authoritative.

M03 receipts continue to attest saved originals only. New originals admit a
durable, no-model M05 pipeline coordinator in the intake transaction. The child
processing task has its own original model lease and checkpoint. Explicit
processing uses the same pipeline. The coordinator waits for the child and
publishes normalized Material through M03/M02 in M05's success transaction.
`saved`, `processed` and Material `indexed` observations are separate; Memory
indexing belongs to M07 and is never advertised as completed here.

All private tables, keys, cached artifacts and configuration generations include
host user identity. Artifact fingerprints bind the exact original, recipe,
processor version, processing snapshot and durable model snapshot. Equal bytes
across accounts never share result entries. Every stage checks the current
account/task grant, canonical original/source/head and optional fixed plugin
snapshot before and after awaits and immediately before storage/publication.
Changing processing settings increments only that account's generation. Model
selection changes retain M04's established next-request snapshot semantics.

The M09 adapter exposes fixed-source `readOriginal`, `pageOriginals` and
`processOriginal` through the actual worker RPC. The latter admits this same M05
pipeline and validates the initiating plugin task and retained processor grant
through completion/restart. It exposes no database, workspace path, user selector,
model key or arbitrary endpoint. M03's tracked workspace callback stays inside
trusted decoder code. Cancellation, stop, source/head withdrawal, account revoke,
processing deletion and plugin-grant withdrawal fence late writes.

## Lifecycle ownership

M06 owns processed stage artifacts, cache entries, processing generation and
publication references. Canonical originals/workspaces remain M03's domain;
canonical Material and its FTS remain M02's domain; tasks/checkpoints remain M05;
configuration/model snapshots remain M04. M16 must compose all of these domains
for whole-user erasure and whole-instance recovery. A domain receipt does not
claim those other domains are physically erased.

Portable processing export states its exact coverage and excludes active task
authority, model snapshots and workspaces. Restore validates parent originals,
checksums and canonical Material parents before any publication; it never renews
old task grants. Whole-instance recovery retains the original SQLite plus M03/M04
artifacts and resumes eligible checkpoints under fresh M05 attempt fences.

KEEP: shared weights, Cordis processor/output/recipe contracts, existing decoder,
binary media transport, M04 leases and M05 task budgets/fairness/checkpoints.
CHANGE: private input/configuration/workspace/cache/publication ownership.
REMOVE: unscoped processing Store and default-owner dispatch from production.
EXCEPTION: trusted plugin and operator code is not a malicious-code sandbox.
UNKNOWN: real credentials/models, physical clients and deployment are unrun.

Acceptance evidence and remaining coverage are recorded separately; this design
is not a claim that unperformed journeys have passed.

## File-derived products and downstream handoff

The existing read-only Agent, semantic-turn prompt/grouping validator and image
understanding/pixel decoder now run from the same scoped composition. M04's
`file` lease supplies the language model; media profiles cannot enter that agent.
Summary pages disclose only this original's extracted records, with inherited
source attribution, exact evidence IDs, bounded ranges and citation validation.
Each completed page and its token usage persist before the next page. Restart
continues the admitted model snapshot and reuses only matching own checkpoints.
Semantic grouping preserves every original turn, text, speaker, overlap and
uncertainty; invalid grouping uses the existing Agent output-repair loop. Image
interpretation must actually read the M03 original pixels, validates geometric
regions against the encoded raster, and remains separate from OCR text.

A no-model derivative coordinator admits these M05 model tasks after extraction.
Summary, semantic transcript and image interpretation publish their own Material
with exact extraction-Material revision and original dependencies. Optional
analysis failure never relabels a saved original or independently published
extraction as missing. Automatic flags and explicit `/api/processing/derivations`
use the same handlers. Existing document/Agent/image/output limits remain in
force, including 64 MiB document decoding, 8 MiB direct images, 200-turn semantic
grouping and 8000 UTF-16 units per processing segment; stage payloads additionally
obey the 32 MiB scoped artifact storage bound. Long summaries use 20-record pages.

`onMaterialPublished((run, {id, revision}) => ...)` is a trusted synchronous host
hook inside the same M05 success transaction as publication. M07 can use
`execution.forUser(run.context).submitSync(...)` to persist a no-model intake with
its own durable grant. That consumer subsequently performs model admission under
its fresh TaskRun. A completed publisher context cannot authorize later work.
Thenable listeners and synchronous model admission are refused. Throwing rolls
back publication and child admission; nested admission uses a savepoint even when
the listener catches the exception and lets the outer publication succeed.

M10's parallel supplied-original intake extension must preserve this receipt
hook and each original's trusted format when the branches are composed. This
module's accepted prerequisite remains PR #132; a not-yet-created M10/M07 stack
is not implied by its own acceptance evidence.
