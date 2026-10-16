# M11 remaining real query composition

Protocol/source runtime freeze
`4175d4e9b9231d0741b14af4b4b8ebc6f099ded5`.
Accepted source/connector prerequisite [PR #134](https://github.com/utopiafar/mote/pull/134),
`7572b573b03437ff743652c13181b9fdcf251fda`,
is composed. M07 `a6bc94c43e34ce91439cfeff6ad669264610d1d1` is an independently
reviewed interface freeze now composed on this feature, NOT final accepted M07.
M08 has supplied a stable core reader freeze; final M08 acceptance is still pending.
No final M11 acceptance or own Draft PR is claimed yet.

Host adapter must map M01 read credential sourceIds=[] (account-wide) explicitly
to M07/M08 sourceIds=undefined. Their [] grants nothing. Narrow sourceIds must
remain copied/sorted/immutable, with credential/source incarnation/account/domain/
cancellation assertion passed as assertCurrent. Never mint UserContext from tool
arguments. SDK AbortSignal must be passed into request-bound Ask work and every
long-running retrieval; durable M05 grants do not replace MCP request authority.

## Existing inbound exposure inventory

The existing [MCP registration](../../apps/server/src/connectors/mcp.ts)
registers 21 tools and one resource.
It registers no private prompts, resource templates or subscriptions. Its
single-user ConnectorContext/Store must never become a production fallback.

| Tool | Real final capability/fence |
| --- | --- |
| `mote_put_item` | Actual M03 immutable source intake, exact write grant; no read/private API/source creation. Implemented. |
| `mote_sources` | Scoped enabled metadata only. Implemented. |
| `mote_items` | Query-visible current source projection; formal Material replaces assembled raw item. Phase M02 source read must be rebound. |
| `mote_history` | Query-visible immutable source history; no Coding/raw screenshot UUID bypass. Phase source read must be rebound. |
| `mote_search` | Actual query-visible lexical candidates with source dependencies before SQL candidates/LIMIT; phase raw FTS source read must be rebound. |
| `mote_materials` | Actual scoped current Material catalog, complete transitive sources before LIMIT/cursor. Already real M02/M06; apply final query-exposure policy. |
| `mote_material` | Exact current Material revision metadata through same query reader. Pending. |
| `mote_material_read` | Bounded original text projection and exact current refs; source scopes checked, original paths not exposed. Already real M02/M06; apply final disclosure policy. |
| `mote_file_catalog` | Scoped query-visible file metadata, obey existing archive/Coding/material replacement rules. Pending. |
| `mote_segments` | Actual owned processed segment projection. Pending. |
| `mote_browse` | Query reader's actual bounded candidates, evidence grants and cursor. Pending. |
| `mote_retrieve` | Real retrieval candidates/ranking with source-restricted keys before provider calls. Pending. |
| `mote_read` | Exact query-visible capture/Memory/artifact read, UTF16-safe bounded windows, no UUID-only raw grant. Pending. |
| `mote_context` | Existing context package behavior over actual scoped Memory and source query views. Pending. |
| `mote_status` | Real owned archive/index/Memory/source watermarks and counts, no fabricated availability. Pending. |
| `mote_timeline` | Real scoped query-visible timeline; exclude high-frequency raw screenshots/Coding events. Pending. |
| `mote_file_chunks` | Actual owned file transcript/extracted chunks and paging. Pending. |
| `mote_activity` | Existing measured content-free capture/activity intervals, not Material metadata or calendar-duration guesses. Pending. |
| `mote_media_activity` | Existing measured playing intervals and visibility/lock/playback filters, scoped before aggregation. Pending. |
| `mote_memories` | Restored genuine MemoryHost.bindRead page/read/search/provider body/versions, [] semantics and exact final pins. Full legacy query filter projection remains part of the M08 composition. |
| `mote_evidence` | Actual original evidence disclosure and current request grants; no known-UUID shortcut. Pending. |

Resource source-catalog at mote://sources uses the same immutable source facade.
The new memory-catalog at mote://memories uses the genuine M07 request capability,
with identical owner/source/pin fences and no cross-tool original-disclosure grant.
If later query adapters introduce any prompts/templates/subscriptions, explicitly
inventory and bind each callback to identical host authority. Outbound discovery
already lists actual resources/templates/tools/prompts with real SDK paging;
no private implicit prompt execution or hidden external write is authorized.

## Additional final composition scenarios

- Same A/B Memory/capture/tool/resource IDs and provider namespaces; same user
  broad versus narrow source cursor; full transitive mixed-source Material and
  Memory excluded before provider keys/ranking/model input/LIMIT.
- Empty MCP read scopes explicitly become undefined; narrow scopes never become
  omitted; account-wide/current enabled sources still obey query visibility.
- Browser switch, parallel SDK requests, reconnect/restart and credential epoch
  remain fixed. Read credentials never acquire ordinary API/write authority.
- Revoke/cancel/source delete during opening/provider/model await and immediately
  before result/artifact/turn publication; exact disclosed original and Memory
  pins revalidated after later awaits. Original independent M07 page/delete P1
  is closed at a6; keep that actual provider barrier regression.
- Exact current raw-text/image disclosure required for citations. Memory cards,
  screenshot UUIDs, OCR navigation and derived summaries alone are not original
  quotation/pixel receipts. Actual M07 image grants feed the existing harness.
- Provider failure never returns cached SQL Memory bodies; fixed errors/logs do
  not include another source, owner, provider prose or credentials.
- Restore actual status/activity/file/processed/Coding surfaces through shared
  frameworks. Do not register empty/mock service results to complete inventory.
- Actual production HTTP+SDK requests exercise this stack, followed by focused,
  all-scope/multiuser combined, fresh Server/Web, emitted process smokes and the
  required affected command on final composed code; independent final review.
- M11 own Draft PR targets integration `6272a9b51ec92cc4c32e2ff1a1eeb4fa38b142ed` only after these module gates; final
  remote head/base must be read back. CI Checks/Component checks stay disabled.
