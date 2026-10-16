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
