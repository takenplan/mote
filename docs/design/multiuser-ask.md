# M08 scoped Ask, conversations and Insight

M08 reuses the existing Agent Harness, transport, evidence disclosure ledger,
Material original projection, Memory readers, static Insight renderer, delegation
controls and complete-prefix working-memory planner. The feature composes PR134
and reviewed real M07 through c5661258cc24628100878b59e96c0cebcb36ee57;
final command receipts and delivery status are recorded with the module Draft PR.

KEEP: model-led retrieval, fresh original citations, fixed model/price snapshots,
M05 shared execution, finite typed retry, working lifecycle threshold OR maximum
wait, Insight lifecycle interval AND increment threshold, and recent-turn retention.
CHANGE: all private data, tasks and publications inherit a trusted host user;
periodic admission retains that user's grant instead of a global owner's authority.
REMOVE: production global Store access and owner selection by model/tool arguments.
EXCEPTION: validation uses generated data and loopback scripted external I/O.
UNKNOWN: fixture execution cannot establish live model quality; final command
receipts remain separate from the implemented contracts. No old data is cleared or assigned an owner.

## Host read and execution contracts

`AskHost.bind(context,{sourceIds?,assertCurrent})` requires a genuine context from
this host. `undefined` grants account-wide sources; `[]` grants none. Lists are
copied, sorted and deduplicated. Identity cannot come from JSON. MCP normalizes its
own credential convention explicitly and retains its request revocation fence.
Ordinary private HTTP rejects MCP credentials.

- `query(input,{signal?,id?,onProgress?})` and `insight(input,execution?)` retain
  request cancellation and parent credential authority through final publication.
- `start(id,input,mode?)` admits durable background work through M05. Logout does
  not revoke that admitted grant. Pause/cancel, disabled account, deletion, changed
  exact inputs and revoked policy authority prevent later publication.
- `reader({signal?})` provides the real ContextReader plus browse/search/retrieve,
  typed-reference read, context, status, file catalog and a final `assertCurrent`.
  Directories, segments, items/history, timeline, file originals, measured Activity
  and media, Memory, evidence and images use existing production data paths.
- Full-account owners may list/read their own constrained run results. A narrow
  binding still requires the exact source scope; user-bound cursors retain every
  query flag and scope. This does not widen a conversation's admission scope.

All transitive Material sources are restricted before candidate order, ranking,
LIMIT and provider keys. Ready blocks of partial Materials use the exact M07
projection; pending bodies stay undisclosed. Formal originals replace raw entries.
Knowing a raw screenshot/Coding/archive UUID does not grant original access.
File pagination counts canonical blocks, preserves exact revisions, and respects
explicit limits. Native source-item kind matches its canonical record source;
entity and Material catalog kind retain the Material type. Tombstones remain
owner metadata and are excluded from model queries, including includeDeleted.
Text windows preserve Unicode scalar boundaries and exact ranges.
Query-visible history maps genuine M06 processed originals through Material links.

Every asynchronous return rechecks the complete observed original receipt,
Material revision, Memory version, account/source authority and request signal.
Pins retain their first exact snapshot; a later read cannot overwrite it. Artifacts
also pin their run and conversation lifetime, and apply the requested source scope.
Conversation summaries, Memory cards and child prose are fallible context. Only
originals disclosed in that model attempt can authorize a citation. Images require
explicit expansion and real M03 pixels. Traces, errors and usage omit secrets and
private payload prose. No legacy global vector index or fake Memory fallback is used.

## Working memory, children and durable recovery

The shared planner retains complete prefixes and UTF-16-safe spans of long turns.
Summary spans use real M04 forks of the admitted root snapshot. Successful spans
are stored as owned artifacts/checkpoints and are reused after pause or restart.
Workers inherit owner and source authority, intersect time/device scope, and do
not inherit the parent's dialogue or mutable workspace. Dependency, selected
any/all wait, cancel and explicit retry use existing delegation controls and M05.
Successful children do not replay after restart. Conversation incarnation/revision
CAS prevents a concurrent old run from publishing into a changed conversation.

## Periodic lifecycle authorization

The former single-owner working/Insight lifecycle is restored with its existing
settings and algorithms. `POST /api/ask-automations` is its ordinary-owner grant
admission boundary: strict input selects `working` or `insights`, source scope and
optional existing increments. It freezes the existing `memory.lifecycle` settings.
Working may select a conversation; Insight may select an exact time/device range.
The default starts at the current journal watermark. `includeExisting:true` is an
explicit authorization to consider retained earlier increments.

This boundary is necessary because a configuration lifecycle subject or a
capture/Memory task grant cannot authorize account-wide periodic queries. It adds
no new model procedure. Configuration edits do not silently renew an old grant or
change an admitted window. A stopped or restored definition requires explicit
fresh admission. Pause/resume keeps the original M05 task, generation and grant;
explicit retry reuses the exact failed window and its original snapshots.

One existing M05 coordinator waits persistently for each admitted policy. There
is no second scheduler or interval loop. Real conversation publication, M06 ready
Materials and Memory publication wake already admitted coordinators. These
notifications convey identities only; they never create read or execution grants.
Generic task submission cannot mint another policy coordinator.

Candidates are owner/source/range restricted before the increment threshold and
window limit. A transaction freezes the window, selected changes, conversation
revision or archive manifest, original receipts, Memory catalog and source
incarnations. Model/price leases freeze at window admission. Automatic Insight
uses the real personal-insight Harness, original evidence and static renderer;
new arrivals wait for a later window. Host-only Memory `recordPins` intersect
id/version/fingerprint before provider keys and order/LIMIT; normal and ranked
cursors bind this manifest. Exact/history reads keep the actual version's proof.

`GET /api/ask-automations[/:id]` observes owned state. `POST /:id/pause`, `resume`,
`retry`, `stop` retain the existing lifecycle controls. Policy generation/state is
rechecked by descendants at execution and publication, so a detached child grant
cannot outlive cancellation. Completed windows and successful fragments are durable.

Manual and automatic Insight retain the existing `InsightSnapshot` contract:
start-of-run provenance, series/version linkage, scoped source states, processing
and Memory coverage, and measured sampled intervals. The scoped admission stores
the exact archive/Memory manifest with the owned run and supplies the same public
snapshot to the Harness and completed result. Person-level interval union and
device-duration measurement reuse the existing algorithms; missing samples never
establish inactivity or work time. Static completed snapshot metadata survives
export/restore, without restoring a manifest as new execution authority.

## Domain lifecycle and validation

Ask exports completed conversation/turn/artifact data, excluding active grants,
models, tasks, workspaces, traces and incomplete runs. Restore validates exact own
parents and current visibility, is idempotent, and schedules no model calls.
The `ask-automation` domain exports only policy definitions with
`activeAuthority:false`. Its delete hook revokes policies/tasks and exact owned
links; restore creates inactive definitions without tasks. Another user's data
and authority remain unchanged.

Validation maps are recorded in [M08 validation](../validation/multiuser-ask.md).
A passing narrow case is not whole-module acceptance. CI remains disabled and
unrun. No deployment, real credentials, user data or live external model call is
part of this work. Client account/UI integration and instance restore orchestration
remain the M13+ and M16 responsibilities.

## Retrieval and directory parity

The parity restoration keeps source discovery by literal name or owner-written
description, a 300-character matching preview, and a separate exact-description
read. Direct source, device and context-directory reads accumulate host-only
configuration receipts immediately. Stable configuration and exact declaration
versions are checked before subsequent provider sends, artifacts and final
conversation publication. A normal sync status or `lastSyncAt` change does not
invalidate these receipts. Metadata never authorizes an original citation.

The optional account-selected `embedding` feature uses the same embedding
transport, vector worker and reciprocal rank fusion as the original reader.
New accepted originals and published Materials admit owner-bound M05 indexing;
only current readable candidates can enter either rank channel. Source scope,
all transitive Material sources, privacy, exact projection and original receipts
are applied before the worker ranks candidates and again before disclosure.
Internal Ask and external ranked retrieval share this path and report lexical,
hybrid and degraded outcomes, including empty degraded results. Historical
content is not automatically re-embedded at installation, startup or selection.

| Supersession | Contract |
| --- | --- |
| KEEP | Original discovery, exact descriptions, semantic/hybrid ranking, degradation reports, failed-question history and retry, and three public Context modes. |
| CHANGE | Host-owned source receipts, vector candidates, model snapshots, cache, usage and durable indexing are bound to the authenticated account and current authority. |
| REMOVE | Directory reads without dependencies, lexical-only replacement of configured semantic retrieval, always-completed history projection and ignored public response budgets. |
| EXCEPTION | Internal Ask has no approximate result quota. The existing embedding transport prefix, public Context response paging, cancellation and invalid-grant publication boundaries remain separate contracts. No automatic paid history backfill is admitted. |
| UNKNOWN | Generated loopback fixtures establish lifecycle and isolation contracts; live embedding/model quality, provider behavior and physical clients require separate evidence. |

Deterministic failures retain the user's question, scope and safe error in the
canonical conversation. They remain visible after navigation and restart and can
be asked again with the existing UI. They do not become assistant context or
working-memory increments. Explicit same-run retry retains the prior failure and
can append the completed turn. Expired, cancelled or revoked executions cannot
publish a late failed or completed answer.

## Public Context response paging

External Context HTTP and MCP calls retain their response-size contract. Browse
and search enumerate canonical owned entities with resumable cursors, apply the
explicit `maxCharacters` response size, and report `truncated` consistently with
`nextCursor` and coverage. The existing accepted range is 1,000–24,000 characters;
the effective response cap and default remain 16,000 characters. Status reports
the effective cap. The first card can use the established compact preview; if its
metadata still cannot fit, the call returns an explicit 413 response.

The public browse mode returns source or project navigation collections. It
consumes duplicate members of the collections already emitted before advancing
to the next page, and preserves the typed navigation reference and search scope.
Its existing 200-candidate scan window retains a resumable cursor when exhausted.
Search enumerates canonical candidates without browse aggregation. Ranked
retrieval retains relevance order and per-call retrieval/degradation metadata,
reports omitted suffix cards through `truncated`, and rejects pagination cursors.
Its existing UTF-8 response-byte boundary also remains in force.

Cursors authenticate the user, deployment, source capability, mode, complete
query, requested limit and response size. Durable host checkpoints keep a minimum
response page usable and survive a normal server restart. A card omitted because
of response capacity is available at the next cursor. These public response
limits do not apply to the internal Ask tools or original reads.

## Optional semantic retrieval

The account's optional `embedding` model selection uses the same private/shared
reference, immutable model/price snapshot, credential revocation and measured
usage contracts as other features. It sends standard `/embeddings` requests to
the selected connection. An absent selection keeps the existing literal path;
it never borrows the chat model or another account's connection.

New accepted captures and new ready Material publications admit scoped M05
indexing work. Each vector retains the exact original fingerprint, incarnation
receipt and selected model transport identity. Restart, changing a selection and
querying retained data do not start a historical paid reindex. Existing vectors
remain a private disposable projection and are omitted from portable Ask exports.
Ask deletion removes the account's vectors and index intents.

Both the Agent's `search_context` and public Context ranked retrieval use the
shared optional vector scan and reciprocal rank fusion. Literal matches keep the
existing newest-first channel; cosine order supplies the semantic channel. The
owner, complete source capability, current ready canonical block, original
privacy, time and device scope constrain vector metadata before Top-K. Only the
bounded returned originals are loaded and pinned. After the asynchronous provider
and scan, current vector metadata and exact original receipts are rechecked.

The existing embedding transport prefix policy (20,000 UTF-16 code units), two
concurrent indexing/query calls and 1,200 ms ranked lookup deadline are retained.
The prefix is reported as semantic-index coverage with full-text literal fallback;
it is independent of the removed internal Ask result quotas. Per-call metadata
retains hybrid/literal mode, vector scan coverage and explicit degradation even
when a result is empty. Provider or vector failure leaves current literal results
available; caller cancellation and revoked authority still fail the read.
