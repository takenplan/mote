# Shared owned Files/Imports adaptation: staged delivery

This closes shared production seams for the original Web/Android consumers; it
does not introduce another FileStore, ImportManager, executor or user database.
The [original recording ADR](../adr-recording-outcomes-runtime.md),
[speaker/correction ADR](../adr-speaker-range-and-display.md) and
[file source ADR](../adr-file-source-context.md) keep their semantic requirements.
The [joint matrix](../validation/multiuser-joint-validation.md) remains pending.

## Read checkpoint: implemented, narrow validation only

The existing M06 registrar installs `scope/processing-files.ts`. It reads current
M03 originals, source heads, M06 artifacts/publications and actual M05 task
receipts through owner-bound SQL. Source/owner/query filters precede pagination.
It creates no private rows, model work or execution authority. The existing M02
cursor key is passed only through trusted composition to PrivateCursor.

| Entry | Contract |
| --- | --- |
| `GET /api/files` | Optional sourceId, query (original title), mimePrefix and limit1–100; signed opaque nextCursor binds deployment/user/full query/limit. Current enabled source heads only. No other account's rows or cursor. |
| `GET /api/files/:captureId` | Owned original capture, sourceId, originalRef, exact size/hash/availability, item metadata, actual M06 saved/processed/indexed/derivations in `processing`, and actual admitted M05 `job` or null. No synthetic legacy queue/summary counts. |
| `GET /api/files/:captureId/chunks?offset=N` | Current extraction's complete structured segments, 100 per page with nextOffset. Existing Capture-style text and fileEvidence preserve artifact/chunk identity, timing, anonymous speaker/uncertainty/overlap and document/image location. M06 artifact IDs are64hex; shared schema retains UUIDs for existing algorithm fixtures and accepts those actual scoped IDs. |
| `POST /api/files/:captureId/playback {}` | Delegates to M03's account/credential/epoch-bound play ticket. Returned URL is the authenticated Ingress3 original reader, preserving byte Range. Fetch with the original Api/native credential and required protocol headers; renderer audio/image uses the authenticated bytes/Blob. The URL alone does not remove M03 auth. |
| `GET /api/files/:captureId/export` | Current transcript JSON/Markdown/CSV, current available derivations and exact original/artifact manifest in the existing USTAR+gzip format. Pure existing formatting/tar code is extracted once for legacy and scoped consumers, with an authority check at stream boundaries. Existing64MiB export bound remains. No raw original, credential or other account's content is included. |

This checkpoint does **not** close reference-only catalog files, proposed review,
manual correction, speaker-name confirmation, acoustic override/sample assets,
cancel/retry/forget or complete original legacy recording export outcomes. Those
remain explicit shared Files work; neither the current transcript export nor a
generic Material list substitutes for them.

## Remaining shared Imports contract

Android's actual entry uploads `{id,name,sizeBytes,mimeType}`, sends raw4MiB parts,
commits to an archived file ID, then creates a preview ImportJob using stable
requestId and explicit instruction. Both clients need real list/detail,
capabilities, preview/ambiguity, confirm, retry/resume, cancel and archived bytes.
M03 has account-bound original/parts/commit/receipts; M06 has deterministic/media
processors and artifacts; M05 owns execution; M07 owns downstream Memory.

The original ImportStore cannot be mounted: it reaches the retired unscoped
Store, SourceStore, FileStore and runtime. Keep its pure schemas, decoder,
manifest/disposition validation and review-gate semantics. Unconfirmed parser
rows must remain staged and outside query-visible evidence. M03 intake completion
and automatic M06 publication cannot be used as preview/confirmation success.
Ordinary import must not regain shell/host-path authority. Administrator-only
host import stays separate. Model interpretation uses existing M04 leases/M05
tasks and generated external transports in validation; no semantic keyword rules.

The joint thread owns this shared backend adaptation. M13/M14/M15 own their
original thin UI/native consumers and final acceptance. They were notified to
avoid a second backend projection. Until a tested shared freeze is published,
these Imports/write paths remain OPEN rather than faked or silently removed.
