# Google/Gmail evidence-change audit

Date: 2026-10-17. Base: main `6272a9b51ec92cc4c32e2ff1a1eeb4fa38b142ed`.
All fixtures are generated; no personal archive, real account or model was read.

## Scope and accepted boundary

The owner confirmed that changes belong at the lowest processed evidence actually
visible to the model. Pagination and provider counters must not cause Memory
rewrites. Exact comparison is an acceptable first step; model-based semantic
equivalence is a future direction. Ordinary invalidation must retain old dialogue
with a status notice; that separate module is not implemented here.

The original discussion's finer dependency and follow-up policies were assistant
proposals, not separately accepted owner decisions. Existing source authorization,
attribution, historical processing grants and explicit erasure ADRs remain in force.

Only `connectors/gmail.ts` changes in production. Google Calendar needs no change
for the confirmed noise cases below. Shared `sources.ts`, Material, EvidenceReader,
Memory, conversation and cache implementations are inspected and unchanged.
Lark PR #145 is independent. Multiuser PR #134 and cumulative #136–#138 overlap
connector consumers and require porting review after integration; their WIP is not
part of this main-based fix.

## Actual identity and model-input path

1. Google `googleItem` builds title/body, calendar interval/status, URI,
   `modifiedAt` and provider created/updated times. `semantic` compares this
   projection before deriving a revision from its hash, etag and prior revision.
   An etag-only change already retains the old revision.
2. Gmail `gmailItems` builds 32,000-character chunks, title, URI, dates,
   participants, labels, thread and attachment descriptors. It excludes observation
   time from its initial revision hash. `collect` additionally pins an archived
   complete `messages.get(format=full)` JSON through `document.fileId`, then chains
   each new revision to its prior revision. Raw fields absent from the extracted
   text still matter: e.g. Reply-To and attachment locators remain archived.
3. `SourceStore.commitBatch` hashes the schema-parsed complete SourceItem excluding
   only `observedAt`; a revision cannot acquire different content. New heads
   invalidate previous evidence and emit supersede changes. New capture receipts
   can authorize automatic Memory input; duplicate ACKs cannot renew them.
4. The built-in source-item organizer publishes literal `source-record`,
   `source-metadata`, original attachments/assets and immutable anchors. Its text
   metadata includes source modification time and calendar state. EvidenceReader's
   source Material presentation decorates the canonical anchor with the head's
   document metadata, including Gmail labels/participants/dates. This presentation
   is used by the Agent evidence tool. Memory dependencies retain canonical anchor
   identity, original lineage and `memoryEvidenceFingerprint`.

The regression invokes that real Agent evidence tool without a model, and checks
that the model-facing result, source records, full raw original bytes, asset hash,
Material revision/read, Memory fingerprint and input receipts stay identical on
counter/key-order replay, including a closed/reopened SQLite store.

## Field/state matrix

| Change within the same logical source item | Required behavior / result |
| --- | --- |
| Google page token, page order, sync token, etag only | Existing revision, duplicate ACK, no supersede; proven through the connector and restart. |
| Google updated/modified time, provider creation time | New immutable revision. Modification time is model-visible; provider creation metadata is retained conservatively. |
| Google title, description/location/recurrence, interval, timezone, status, safe URI | New revision when the normalized evidence changes. Time/status/title/body/URI covered; existing all-day/DST and cancellation regressions retained. |
| Gmail history-page order/duplicates, sync cursor, observation time | No new version when the current mail response/evidence is otherwise unchanged. Existing paging/delta tests cover these paths. |
| Gmail top-level `historyId` alone, or JSON object key order at any depth | Reuse the complete prior original, SourceItem revision and Material. Fixed here. |
| Gmail labels, thread, Subject/From/To/Cc/Date, internalDate, body | New immutable revision; labels/time/state are not erased. Covered individually. |
| Gmail other headers, attachment name/type/locator/size, unknown provider fields | Full response comparison remains conservative; raw changes create a new version. Reply-To, attachment/type/locator and unknown classification data covered. |
| Gmail label/header/MIME/attachment array order, sizeEstimate | Still compared strictly. No broader equivalence claim or unverified field exclusion. |
| Missing optional attachment MIME on an identical replay | Missing stays missing. Fixed an `undefined` versus persisted absent-property comparison that otherwise generated repeated revisions. |
| A → B → A, deletion/restoration | A new head never revives the old revision. Reversion and source deletion/rescan are covered. |
| Reference retention | No original JSON stored; existing metadata/state behavior remains. No widening of collection or access. |
| Owner attribution/source description change | Existing versioned context invalidation/fences apply; no connector bypass added. |
| Explicit privacy deletion/forget, ordinary dialogue invalidation, late Memory result | Existing owners and production rules apply. No change to erasure, historical visibility or model commit fences in this PR. |

Google documents `historyId` as the last modifying history-record ID, while labels
are the labels currently applied to the message, and `internalDate` determines
inbox order. See the [official Message resource](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages).
These distinctions motivate excluding only the counter, not mail state or time.

## Confirmed failures and minimal correction

- RED on main: a two-chunk message with identical content and only advancing
  `historyId` returned `imported: 2, duplicates: 0` instead of two duplicate ACKs.
  Complete JSON bytes produced a new archived file ID, included in source equality.
- RED after the first fix: a message whose attachment omitted optional MIME still
  returned `imported: 1` on an identical poll. The constructed descriptor explicitly
  contained `mimeType: undefined`, while persisted JSON omitted that property.
- GREEN: compare complete parsed original responses excluding only top-level
  `historyId` with structural equality; preserve arrays and all other fields.
  Equal replays reuse the existing full original and its historical counter.
  Construct absent optional MIME fields consistently with persisted JSON.

## Supersession check

- KEEP: exact text/state/time/attribution, complete raw originals, unknown fields,
  source/account identity, immutable hashes/history, A → B → A, read-only OAuth,
  reference retention, deletion, scope/pause/cancellation and paid-work fences.
- CHANGE: Gmail original reuse on a counter/key-order-only replay, and optional
  MIME absence representation. Old versions are not backfilled or rewritten.
- REMOVE: equating these transport/serialization differences with new evidence.
- EXCEPTION: retain the original counter and original bytes on equal replay; do not
  mutate old metadata, introduce another archive layer or attach a second asset.
- UNKNOWN: semantic paraphrases, other provider-field equivalence, real OAuth/API
  behavior, live-model quality, and independent history/cache fixes.

## Validation

Targeted Google tests and the new Gmail regressions pass. Full required
`npm run check:affected -- --base origin/main` and independent review results are
recorded in the PR after completion. This report distinguishes synthetic provider
transport with real connector/store/Material/Agent tool paths from a live account
or model run. No merge, deployment or CI activation is included.
