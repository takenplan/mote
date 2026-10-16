# M08 scoped Ask and query host

Implementation review freeze; full M08 acceptance remains pending. Composes
accepted PR134 (M10/M06/PR132) and real M07 runtime1536d485. No protected branch,
main, CI workflow, existing user data or peer workspace is changed.

KEEP: existing Agent Harness and transports, evidence disclosure ledger, Material
originals, M07 Memory provider/read binding, M04 model/price leases and forks,
M05 shared executor and grants, static Insight renderer and delegation controls.
CHANGE: all chats, turns, compaction, durable fragments/units, artifacts and trace
metadata have composite owner keys. Host context and copied exact source allowlist
flow through SQL, providers, tool reads, every model attempt and publication.
REMOVE: production global Store, owner-selected model/tool arguments and legacy
query/runtime fallback. The old single-owner composition stays quarantined.
EXCEPTION: tests use loopback scripted providers, real Harness/SQLite/executor.
UNKNOWN/pending: final subtask restart/retry matrix, complete legacy delegation
registration audit, final combined/compiled/affected checks and independent review.

## Host contract

`AskHost.bind(context, {sourceIds?, assertCurrent})` accepts only a genuine context
issued by the same host. `undefined` means account-wide sources; `[]` means none.
The sorted deduplicated allowlist is copied and immutable. Models and HTTP bodies
cannot choose owner. MCP must normalize its own `[]`/all credential convention
explicitly and keep narrow lists intact; ordinary private HTTP is not an MCP API.

- `query(input,{signal?,id?,onProgress?})`, `insight(input,execution?)`: request-bound
  foreground execution, retaining original parent credential fence through commit.
- `start(id,input,mode?)`: durable background operation under M05 grant, explicit
  logout does not revoke already admitted background work. Cancel, pause, disable,
  deletion and changed evidence still fence all later attempts/publication.
- `reader({signal?})`: real query-visible read facade. It provides `agent` (existing
  ContextReader), `browse/search/retrieve`, typed-ref `read(refs,{offset,length,scope})`,
  `context`, `status`, `fileCatalog(sourceId,args)`, and `assertCurrent()`.
- `agent` provides directories, Material catalog/read, segments, source items/history,
  timeline, file blocks, actual measured Activity/media, Memory and evidence/images.
  Source scopes and complete transitive Material sources apply before candidate
  ordering/LIMIT/provider keys. Cursors bind user, collection, all filters and scope.
  Every awaited return rechecks all observed original/Material/Memory pins, request
  signal and parent authority. Merely knowing a screenshot/Coding/raw archive UUID
  does not grant raw disclosure. Formal originals replace raw candidates.
- `retrieve` uses the scoped FTS index; optional legacy global semantic embeddings
  are not mounted. Its coverage describes query-visible candidates, not exhaustion.

Ready named partial Material artifacts use the exact M07 original projection and
fingerprint. Pending block bodies are excluded. Memory cards, conversation answers,
compaction and child prose are fallible context; citation requires fresh original
receipts in that actual attempt. Images require explicit expansion and actual M03
pixels, not a path/URL or OCR/navigation record.

## Durable work and lifecycle

Root lease, exact conversation incarnation/revision, evidence lineage, child forks
and successful artifacts are persisted. Coordinator tasks do not occupy model
slots while waiting. Model and price settings never re-resolve after admission.
M05 stores a small public task receipt; the complete bounded Insight artifact is
retained in owner-scoped storage. Trace/progress metadata excludes payload prose,
credentials and provider errors.

Portable export includes conversations, turns and completed-run artifacts. It
excludes active tasks/grants/models/workspaces/traces/incomplete runs. Restore
validates owner/deployment, all exact current original parents and source scopes,
rebinds current source incarnations and recreates data only. It is idempotent by
operation and payload hash; it never schedules a model call or revives authority.

## Current fixture evidence

Composed real Harness/chat/query/Memory/Insight/portable interface matrix18/18,
0skip/fail/cancel, exit0 (`/tmp/m08-interface-18.log/.exit`,55.3s).
Server typecheck exit0 (`/tmp/m08-interface-types.log/.exit`); scope/import/SQL
inventory check exit0. Earlier fixture failures are retained as diagnostic logs,
not passes. These are synthetic fixtures, not final M08 acceptance or live checks.

## Reviewed pin regression and delegation delta

M11 independently reproduced a P1 at e7ebbf44 through the host reader and actual
MCP SDK: capture X, external Memory await, delete/recreate X, capture X could
replace the first pin and publish the earlier deleted body. The reader now keeps
first Evidence/Material/Memory observations and rejects conflicting hash/revision/
version/incarnation; validation callbacks cannot replace them. Original independent
host probe unchanged on a disposable patched archive:1/1 exit0, leaked=false
(`/tmp/m08-m11-original-pins-fixed.log/.exit`). Independent exact-commit host+SDK
recheck remains pending. Durable retained scenario is multiuser-ask-read-races.

Ordered context.research units now use the existing input/receipt/control protocol,
stable task identities, full plan admission before async forks, current-generation
recovery and successful-child checkpoints. Parent citations require the actual
worker-delivered ranges, freshly revalidated. Harness yield is translated into a
checkpoint inside the M04 callback, so credential sanitization cannot turn the
semantic pause into a config error. Actual HTTP foreground disconnect carries an
AbortSignal; background admission retains its separate explicit lifecycle.

Current full focused matrix22/22,0skip/fail/cancel,exit0,84711ms:
`node --import tsx --test --test-concurrency=1 --test-timeout=60000
apps/server/test/multiuser-ask.test.ts apps/server/test/multiuser-ask-read-races.test.ts`
(`/tmp/m08-core-delta-22.log/.exit`). Types and scope/import/SQL exit0.
Final SIGKILL/compiled/combined/affected gates and remaining legacy query option
parity are still pending. This remains an implementation review freeze.

## Legacy query projection and real HTTP delta

Logical `reader.logicalHistory({sourceId,externalId,...range})` resolves the actual
current `pd_material_captures`/Material relation, including M06's distinct
`processed:<captureId>` origin. It does not guess that processed external IDs equal
the logical source-item key. Canonical formal originals replace raw history; raw
history is used only when no formal replacement permits it. New segment locators
are the existing immutable Material refs; old unowned artifact UUIDs do not name
new epoch data. Typed session/collection navigation reuses the existing parser,
intersected scope and owned query-visible anchor expansion.

The original MCP safe UTF16 window is extracted to one shared pure function;
Material, original and Memory text windows retain correct offsets and never split
surrogates. M11 found a P2 in segments exposing pending Material text; segments now
uses the same ready-block projection as materialRead, as do catalog/search. This
is a same-owner output-readiness finding, separate from the closed cross-await P1.
Context honors includeMemories/includeRecentSessions, bounded characters and signed
separate channel cursors. Status reports measured archive and real Memory watermarks.
Actual `/api/context/*` and `/api/agent-view/*` routes use this same scoped facade.
Memory's additional legacy filters await the real M07 scoped query extension.

Validation: targeted production HTTP/processed-original history/ready projections/
Unicode/context/stream cancellation6/6 exit0,7583ms
(`/tmp/m08-reader-parity-six.log/.exit`); admitted price snapshots/error redaction2/2
exit0 (`/tmp/m08-prices-errors.log/.exit`); actual two HTTP host processes SIGKILL/
restart1/1 exit0,41742ms (`/tmp/m08-ask-process-first.log/.exit`), with no replay of
successful child model transports. The process fixture supports emitted entry via
MOTE_ASK_PROCESS_ENTRY; compiled execution is still pending. M11's unchanged host
and SDK P1 probes both independently pass exactc66, as recorded in its review report.

The query disclosure fence now keeps a separate exact-original receipt alongside
Memory's unchanged semantic fingerprint. Raw originals have durable row
incarnations; formal originals include all transitive capture incarnations and
full stored receipts. Deleting and recreating the same UUID with identical text
cannot revive an earlier disclosure. Portable restore rebinds current receipts
only after validating semantic evidence and ownership.

Context budgets include the actual serialized continuation. Minimum-size first
cards reuse the existing compact navigation projection. Owner-bound durable
navigation checkpoints preserve both independent channels across restart without
repeating long provider cursors in the response. They contain navigation state,
are excluded from portable authority, and are cleared with Ask user deletion.
Raw capture source filters use trusted ingress bindings without adding fabricated
provenance or changing evidence fingerprints.

M07 exact/page query filters now flow through the real Memory reader, context
bundle, catalog and model opening without dropping source, time, device, coding,
kind or validity fields. Exact typed Memory reads pass the same filters. Both
HTTP and Harness share the actual context catalog. Source sync status comes
from the real owned M10 ledger through its read-only service, with no adapter I/O.

Conversation lists and turns use signed owner/scope/revision cursors. Stale
originals hide saved answer bodies and summaries; run listings retain safe
failure metadata. Cancel/pause on completed runs is idempotent. New owned Ask
artifacts have typed `artifact:` read locators with safe UTF-16 windows.

Explicit image attachments use genuine retained M03 upload receipts and current
logical heads. Their grant is host request input, never a model tool argument.
Pixels flow on demand through the existing image renderer and actual Harness;
ordinary UUID discovery grants no pixels. The exact attachment identity joins
all later model, artifact and publication fences, and current prior attachments
can remain available in later dialogue turns. Model selections remain M04 owned.

File directory discovery now reuses the existing literal URI-parent semantics.
Its owner/source-filtered SQL includes actual current M06 formal replacements
before grouping, ordering and LIMIT; raw archived/replaced bodies remain behind
their original reader. A directory response is metadata with a resumable signed
cursor; file entries expand their real canonical Material refs.

Context packages use one stable Material locator per logical Material rather
than advancing a cursor after delivering just the first block. Expanding that
locator retains every ready block. Search candidate text and Material catalog
text predicates use ready blocks before candidate ordering/LIMIT, so pending
text is absent from candidate selection as well as rendered projections.

An artifact expansion now pins its complete artifact row, completed parent run
and conversation incarnation until the final return. Deleting the conversation
or replacing any of these rows during a later provider wait rejects the whole
response. Explicit query scope is checked against actual dependency originals
before disclosure and again at the final fence; matching scopes remain usable.
Source declaration reads also persist exact current declaration identities with
the run's dependency pins, without changing original or Memory semantic hashes.
A declaration replaced during a provider/model wait cannot publish old context.

Delegated yields retain their selected unit set and `any`/`all` wait mode in the
actual durable fragment artifact. A parent may resume after one finished child,
cancel an unnecessary in-flight sibling, and reject that sibling's late output.
Failed branches can retry their own fixed model lease while successful children
remain committed once. Optional child time/device ranges intersect the parent
range; model owner/source authority selectors remain invalid. Concurrent answers
against one conversation revision still admit only one appended turn.

## Complete original pages and bounded dialogue

Native ContextReader timeline/sourceItems now page canonical originals inside a
multi-block Material, retaining the exact Material revision and block offset.
Entity-card context pages have a distinct signed cursor projection. A later block
matching literal search is returned without preceding unrelated blocks; literal
space-separated terms remain AND candidates before LIMIT, as in the existing
query contract. `read_file_evidence` reads retained canonical file originals,
passes its explicit source offset through the real Harness bridge and retains the
same current original identity/fingerprint for citations. It creates no SQL-body
provider fallback or fabricated excerpt identity.

The shared pure WorkingMemory prefix/span planner is extracted from the existing
implementation and reused. Scoped conversations compact complete old prefixes
before exceeding the configured dialogue budget, including every ordered span of
a very long answer. Each model call receives an M04 fork of the admitted root
snapshot; successful spans are grant-committed as owner/run artifacts and M05
checkpoints, so pause/restart never repeats a committed span. The exact prior
summary is included in later compaction. Conversation publication retains the
existing 200-turn/4-MiB policy and exact conversation CAS. All source pins and the
request or durable grant are checked before every model request and publication.
Workers inherit host owner/source scope and intersect their declared time/device
scope, without the parent dialogue or saved query workspace. Models cannot add an
owner or source allowlist through delegation arguments.

Narrow WIP validation: compiled real Harness file range + explicit/automatic long
compaction + worker boundary4/4 EXIT0,32734ms; successful compaction span pause /
actual host restart / changed-current-settings + narrower worker time/device scope
+ canonical block paging + file range4/4 EXIT0,34419ms. Original shared long-turn,
failed-prefix and cross-turn compaction regressions4/4 passed separately. Earlier
whole-prompt-size and incomplete-time-interval fixture assumptions were corrected;
they are diagnostics, not passing receipts. These are partial checks before the
next clean freeze, full actual composition, independent review and affected gates.

## Reviewed real Memory and production listener composition

The feature composes independently reviewed real M07 through1d92401d, preserving
PR134/M10 processing readiness/connectors, Ask registration and the new generic
owner-question registration/pass/close. Original reader Unicode/navigation and
external-provider lifecycle races8/8 EXIT0; exact four real processing/Memory task,
grant and sequence inventory (including memory.materials), failed-child rollback
and no orphan checks2/2 EXIT0. No producer is disabled to preserve an old fixture.

Clean80cf83fa before this combination passed all50 focused Ask/read-race tests,
0skip/fail/cancel, EXIT0,209577ms. M11 independently passed literal paging/worker
and complete/durable compaction2+2, and the actual SDK complete3-block continuation
matrix plus original strict limit1 source case2/2 EXIT0. Its first restart fixture
had paged raw rows before the genuine producer then replaced them with formal
Materials; the stable positive now waits for real producer completion and retains
all limit/owner/source/restart assertions. Old failed diagnostics are retained.

The process fixture now boots actual production index and formal initialize-admin
CLI twice, uses real HTTP for all user actions, SIGKILLs between actual completed
and in-flight child tasks, then proves successful child transports are not replayed,
A/B snapshots remain fixed, only one owned turn publishes and B cannot read A's
artifact. Source1/1 EXIT0,44777ms. MOTE_ASK_PROCESS_ENTRY now names index.js for the
compiled check. The first diagnostic omitted the read observer connection's
ordinary SQLite busy timeout; this fixture setup is corrected without changing
production SQL or skipping any outcome assertion.

Final parity gate still open: the old lifecycle periodic working and automatic
Insight windows must reconnect to real scoped retained authorization; manual and
pressure-triggered compaction do not establish those scheduling capabilities.
Final combined/build/emitted/affected, whole-module review and Draft PR remain
pending. No CI workflow is enabled or reported as passed.
