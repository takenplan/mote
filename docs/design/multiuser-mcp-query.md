# M11 real query composition

M11 current unified consumer candidate is `c53c199876bbfee2acfe8c38ecda7403af7f809d`.
It retains accepted [PR #134](https://github.com/utopiafar/mote/pull/134) complete
head `7572b573b03437ff743652c13181b9fdcf251fda`, actual M08 production freeze
`3bda432740e2af374b71500e9ce21110de45837c` and M07 A/C freeze
`c5661258cc24628100878b59e96c0cebcb36ee57` (runtime
`84a405f5c52f951f05db975705c12c3bb646dd67`). The candidate also contains the
independently closed M11 operational-status correction and a test-only exact A/B
original publication wait. These are precise capability freezes; final
whole-module acceptance and M11 final gates remain pending.
No final M11 acceptance or own Draft PR is claimed. Integration remains
`6272a9b51ec92cc4c32e2ff1a1eeb4fa38b142ed`.

The host maps M01 read credential sourceIds=[] (account-wide) explicitly to
M07/M08 sourceIds=undefined. Their [] grants nothing. Narrow lists remain copied,
sorted and immutable. Every request retains credential revocation, account epoch,
source incarnation/revision, domain generation and SDK cancellation fences through
all awaits and final publication. Adding a source during an account-wide request
invalidates that request's captured enabled-source set; later requests can use it.
Tool arguments cannot construct UserContext or widen the credential.

## Actual inbound exposure inventory

All 20 existing read tool names use genuine scoped services. A separate write
credential exposes only `mote_put_item`. The legacy ConnectorContext/Store and
static tokens are quarantined, with no production read fallback.

| Surface | Actual implementation and evidence boundary |
| --- | --- |
| `mote_put_item` | Real M03 immutable intake into an explicitly granted existing source; actual automatic M06 processing for archive input. No external mutation or source creation. |
| `mote_sources`, `mote://sources` | Enabled owned source metadata and actual M10 connector ledger status; no adapter, model, credential read or external discovery to obtain status. |
| `mote_items`, `mote_history` | M08 current query-visible views and logical history through actual M06 pd_material_captures mapping, including processed:<captureId> origins. Current formal projection replaces raw archive/Coding/screenshot access; its canonical blocks retain the correct current-history flag. |
| `mote_materials`, `mote_material`, `mote_material_read` | Current formal Materials; complete transitive sources checked before candidates/LIMIT. Exact revision pins, ready-only partial text and shared UTF16-safe windows. |
| `mote_browse`, `mote_search`, `mote_retrieve` | Real scoped lexical query candidates and signed owner/scope/filter cursors. One complete expandable Material locator per entity; pending-only text cannot select a candidate before LIMIT. |
| `mote_file_catalog` | Literal existing URI directory/file paging over genuine M03 uploads and M06 formal replacements. Mixed-source candidates excluded before grouping/counts/LIMIT. Parent/source/scope/owner cursor replay rejected. |
| `mote_segments`, `mote_file_chunks` | Actual Material projections and original-linked processed blocks, ready-only text, exact source and revision fences. File chunk limits and offsets operate on canonical blocks; retired canonical IDs cannot map to a new revision. |
| `mote_read`, `mote_evidence` | Genuine query-visible original, Material, Memory and owned artifact reads. Existing session/collection navigation intersects trusted scope. Known raw screenshot/Coding/unowned artifact IDs do not grant disclosure. |
| `mote_context` | Actual Memory and record channels with inclusion flags, minimum1000 character budget, complete expandable Material locators and durable signed channel cursors. |
| `mote_status` | Actual own archive/index/Memory watermarks and connector ledger state; availability is not fabricated. |
| `mote_timeline` | Actual query-visible source views and safe evidence metadata. |
| `mote_activity`, `mote_media_activity` | Existing measured interval unions, activity/state sampling and media visibility/lock/playback filters. Measurement receipts do not grant raw original disclosure. |
| `mote_memories`, `mote://memories` | Real M07 provider-backed page/search/exact version reads. Full transitive original/value filters checked before provider keys/ranking/LIMIT. No SQL cached-body fallback. |
| inbound prompts/templates/subscriptions | None registered or advertised. Actual SDK inventory checks confirm this absence. |

The MCP architecture scanner inventories named tool/resource/prompt callbacks,
including quarantined legacy registrations. Actual SDK tests verify tool names,
resources and capability absence rather than treating empty fake responses as
restored capabilities. Outbound uses real SDK resources/templates/tools/prompts
metadata paging; it does not introduce arbitrary prompt execution or writes.

## Exact Memory reads

MCP consumes M07's exported raw fields and unified refined parsers. Source, time,
device, app, collection, coding scope, kind/status/tier/layer and canonical/history
filters are applied to every transitive original. The default content collection
includes M03 originals without an explicit privacy.collection value.

Page reads default to current canonical visibility. Explicit id/version reads
retain exact/history semantics unless includeHistory=false is supplied. A cursor
with an exact ID is rejected. The host first creates a synchronous opaque
pin(id,version,filters), reads only the selected provider key with the same filters,
then checks the pin after the await and before SDK publication. The complete
current row is a stability snapshot, never historical source authorization; no
unfiltered current-version provider prefetch is used to validate history.

Independent actual SDK audit records every external provider read: excluded
current/history requests issue no keys, while a legal narrow historical request
issues exactly its target-version key. Deletion during the selected-version read
invalidates the pin. Memory cards and citation metadata do not confer original
read grants on subsequent requests.

## Acceptance still required

The [validation record](../validation/multiuser-m11-mcp.md) separates development
receipts, closed independent findings and the older protocol-only full gates.
Remaining gates are final accepted M07/M08 capability composition, final whole
M11 independent review, actual combined/build/emitted/affected checks on that final
code, then a Draft PR with verified remote head/base. M07 daily, feedback,
owner questions, owner-only proposed/stale audit and exact fresh import attribution
are composed. Audit work is `usableAsMemory:false` and cannot be obtained with
an MCP credential or through `bindRead`; published query Memory remains the
read capability. Independent review is bounded, with final M07 gates separate.
M08 canonical paging, file range bridge and durable compaction are restored;
periodic working-memory/automatic Insight lifecycle and frozen InsightSnapshot
are composed with bounded independent evidence. Final M08 acceptance remains
separate. Checks/Component checks remain disabled and unrun.
Real credentials, personal data, live external providers/models, deployments and
physical-device validation are outside this task's authorization.
