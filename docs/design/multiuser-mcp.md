# M11: user-bound inbound/outbound MCP

This is the independently implementable protocol/source phase of M11. The
feature starts at remotely verified PR #133 head
`470516b7ed4ab7ee8b0fba344883c6b42bb7ce56` (tested M06 runtime
`07ad9ddb17a0d2cd0004c50958670145b1457446`), including PR #132 and
M00/M01/M02/M03/M04/M05/M09. Integration remains
`6272a9b51ec92cc4c32e2ff1a1eeb4fa38b142ed`. The feature now also composes
remotely verified accepted M10 Draft PR134 complete head
`7572b573b03437ff743652c13181b9fdcf251fda`, runtime
`2ae03155ef766655f4996977e4eedcc0a2177e9d`, through feature-only merge
`56bcb1cf6e46304254318fed659efe861113c6ae`. M10 was independently reviewed
in `/tmp/mote-m11-review-m10.md`; its closed execution conversation is not reused.

**M11 is not fully accepted.** Accepted PR134 is composed. Current M11 core
`96f955a687279b110c17cca20251a00ae996f3b7` also composes genuine M08 partial
production freeze `73244e11f4625f3c1e0674b1f8629d8295c05b76` and M07 closure freeze
`443c201a9159d77120d990a1b2d888cb2015d139`. These are stable
interface/core freezes, not final M07/M08 module acceptance. All 20 original read
tools now use genuine scoped readers. Logical processed history, UTF16 windows,
partial ready-only text, navigation, context inclusion/budget/cursors, actual
source status, file directories and exact Memory filter/pin consumption have
real SDK coverage. Final dependency alignment and whole-module gates remain;
no mock neighboring service supplies capabilities.

## Host identity and protocol

`buildScopedApp` registers `ScopedMcp` on the shared admitted SQLite connection,
M01 Accounts, M02 PrivateData, M03 IngressHost and M04 Configurations. There is no
second Store, database, executor, owner directory or default-user adapter.
The existing pinned MCP SDK implements Streamable HTTP on `/mcp` and the actual
SDK client implements outbound requests.

Only M01 `mcp-read` and `mcp-write` Bearer credentials authenticate `/mcp`.
The host has a separate verifier/issuance method for restricted UserContext;
`authenticate()` still excludes MCP credentials. Restricted contexts never
administer the instance. Browser cookies cannot select or replace a session's
owner. Each session captures its immutable credential, account epoch, source
scopes and host context. Every HTTP request requires the same credential as its
session; a foreign or missing session receives the same404. Account/credential
state and domain generation are revalidated on each request, tool/resource read
and before response publication. SDK cancellation participates in tool fences.

M01's mint route resolves requested source IDs through the owner's actual
repository. Private source-incarnation pins are stored in credential metadata.
`mc_source_epochs` persists source insertion/deletion incarnations and separate
in-flight change revisions through SQLite triggers, including another connection.
Renaming source metadata preserves token ownership; delete/recreate cannot revive
its old scoped token. Tokens issued before M11 with selected scopes but no pins
must be reissued; no missing pin expands permissions. Empty read scopes retain
M01's explicit account-wide read meaning. Write credentials require exact sources.

POST initializes/dispatches, GET/DELETE use the SDK session transport. Sessions
are process-local; after crash/restart an old session ID is404 and an unchanged
valid credential can explicitly initialize again. Global/static owner and legacy
MCP configuration tokens are never fallback credentials. Origin and forged host
identity selectors are rejected before dispatch; responses disable caching.

## Actual source and query surfaces

MCP content reads use actual M08 AskHost.reader and M07 MemoryHost.bindRead.
The former direct M02 read facade is removed. Every SDK query creates a fresh
request capability with immutable credential source scope, source incarnation/
revision fences, AbortSignal and all observed original/Material/Memory pins
revalidated after awaits and before publication. Account-wide requests also
freeze the enabled source set: adding a source during a held read rejects that
request while the credential remains usable on the next request. Explicit query
source filters never widen credential authority. Strict SDK schemas reject
unknown authority selectors and unsupported fields rather than dropping them.
The [query composition plan](multiuser-mcp-query.md) tracks all 21 original tools
and remaining legacy parity gates individually.

| Surface | Current production composition |
| --- | --- |
| `mote_put_item` | Real immutable M03 source intake; existing explicit source only; no source creation or external mutation. Archive input enters real automatic M06 processing. |
| `mote_sources`, `mote://sources` resource | Authorized enabled source metadata and actual owned connector ledger status; independent A/B same IDs and no external I/O for status. |
| `mote_items`, `mote_history` | Genuine query-visible source views; raw screenshot/Coding/archive UUID bypasses denied. Logical history follows actual M06 current formal mapping, including processed:<captureId>. |
| `mote_materials`, `mote_material`, `mote_material_read` | Real current M06/M02 Materials through M08, transitive source SQL before LIMIT, exact revision pins and ready-only text. Shared UTF16-safe windows preserve complete characters and exact coordinates. |
| `mote_search`, `mote_browse`, `mote_retrieve` | Actual query-visible scoped FTS candidates and authenticated user/scope/filter cursors, before ranking/LIMIT; no global single-owner embeddings fallback. |
| `mote_file_catalog`, `mote_segments`, `mote_read`, `mote_context`, `mote_status`, `mote_timeline`, `mote_file_chunks`, `mote_activity`, `mote_media_activity`, `mote_evidence` | Real M08 reader handlers. SDK verifies all names, owner/source isolation and measured interval unions. Ready-only segments, actual directory/file paging, typed navigation, context flags/budget/durable cursors and real status are covered by SDK regressions. Full M08 acceptance remains separate. |
| `mote_memories`, `mote://memories` resource | Genuine M07 page/read/search/exact historical provider bodies. MCP empty/all scope maps explicitly to undefined; a nonempty allowlist is retained. Every request snapshots source incarnations/revisions. Full query filters precede provider keys; exact reads use M07 opaque selected-version pins with no current-body prefetch. All observed Memory/original pins are rechecked before SDK publication. Cards remain derived context and do not grant original disclosure to another tool. |
| inbound resource templates/prompts/subscriptions | No private template/prompt/subscription is registered in this phase. Their absence is explicit, not a simulated successful empty Memory query. |

Write sessions expose only the write tool. They do not gain read or ordinary
private HTTP API rights. Signed paging cursors remain durable
deployment/user/collection/filter-bound cursors. Source scopes are checked before
reading pages, history or Material dependencies. Original filesystem paths and
raw Original read capabilities are never granted to MCP SDK clients.

The M00 architecture scanner now inventories MCP tool/resource/prompt callbacks
as private surfaces, including quarantined legacy registrations. Runtime SDK
inventory checks verify the 20 read tool names, the write-only alternative and
the two actual resources. No inbound private prompts/templates are advertised.

## Outbound user instances

M04's `mcpConnections` user domain owns `{connections:[{id,enabled,url,token,
sourceIds}]}`. Its strict schema, revision/CAS, file watching, private files,
prepare/publish/rollback and declared-sensitive token projection are the actual
configuration framework. Credentials are omitted from views and portable
configuration exports. Invocation HTTP bodies select only an owned connection
ID and bounded resources or one explicitly confirmed read-only tool; they do not
carry raw bearer secrets or choose an owner.

`POST /api/connectors/mcp/discover` discovers resources, templates, tool metadata
and prompt metadata with SDK paging. `POST /api/connectors/mcp/import` uses the
existing resource/text or explicitly confirmed read-only tool import contract.
No arbitrary prompt execution, unsolicited external tool, local shell or stdio
command is introduced. The existing administrator-owned instance
`connectors.allowLocalMcp` boundary governs local HTTP targets; ordinary users
cannot enable it. The existing URL and pinned-address/DNS/redirect transport
checks are reused. Authorization is checked both before and after DNS lookup.
`allowLocalMcp` retains its existing restart-required setting: saving a candidate
does not change the effective policy. Real host shutdown retires old outbound
invocations; after restart, the saved boundary is enforced before external I/O.

Every invocation constructs a fresh SDK client/headers/session for its owner and
connection. Config publication invalidates and retires only changed connection
fingerprints. Unchanged connections of the same user and other users continue.
Healthy sessions terminate before local close. Revoked/cancelled
handles close locally without renewing authority for external cleanup. Imports
serialize by owner/connection/source, preserve complete-resource membership
manifests and retract only that selected resource's old tail. SDK/result/cursor
errors become fixed codes with no provider exception prose or credential values.

Source existence, settings, persistent revision, account epoch, credential,
configuration fingerprint, signal and exact selected existing item heads are
bound before remote reads. All selected resource results and manifest changes
publish together through real M03/M02 nested transactions. Revocation, source
delete/recreate/toggle, capture deletion, cancellation or config refresh during
I/O cannot reintroduce a deleted record or publish late results. Retry rereads
the external resource and reuses only identical owned immutable revisions.

## Lifecycle and supersession

MCP lifecycle exports membership manifests only; it excludes credentials,
configuration connections, SDK sessions, handles and operational source status. Delete sets a durable domain
tombstone/generation, revokes that user's M01 MCP credentials, removes manifests
and operational status
and joins local handles/sessions. Restore validates its envelope and duplicate
identities, restores metadata only and never renews old credentials/sessions.
Source epoch tombstones retain only owner/source IDs and counters needed to
prevent old authority revival. M16 still owns the complete user deletion ordering,
including M04 credential/configuration cleanup and M02/M03 data lifecycle.

KEEP the SDK, network constraints, strict source schemas, immutable intake,
membership snapshots, shared services and M01 credential registry. CHANGE
single-owner ConnectorContext/Store to host-bound user/source facades and user
configuration instances. REMOVE production static-token fallbacks and global
session/client/configuration caches. EXCEPTION trusted host code and deployment
operators retain server plaintext access; this is not a malicious-code sandbox.
UNKNOWN final M07/M08 composition, full-module acceptance, physical clients,
real credentials/providers/models and deployment until actually verified.

## Restored outbound source status

The existing remote MCP importer reported syncing, idle/lastSyncAt and a fixed
import failure code. The scoped importer now retains that flow. Its owner-bound
`mc_source_status` record pins the source incarnation and connection fingerprint;
metadata renaming keeps the last status, while source recreation or connection
replacement cannot expose an obsolete result. Both MCP sources and Ask source
views use `ScopedConnectors.registerSourceStatusReader`, the same status reader
used for real adapter ledgers. Reading status opens no external adapter or client.

The SDK import queue supplies current handle liveness. A persisted syncing record
without its live invocation is reported as interrupted, including after restart;
no old credential gains permission to write a late status. Status does not prove
that M06 indexing or Memory extraction completed. Domain deletion removes these
records. They are explicitly excluded from portable metadata restoration, along
with connections and live handles, and do not revive external authorization.
