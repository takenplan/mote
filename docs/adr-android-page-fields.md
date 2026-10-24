# ADR: Android visible fields and independent capture choices

Date: 2026-10-10. Updated: 2026-10-24. Status: accepted by the owner.

Android uses App configuration as the primary capture setup entry. Before first
start, it previews the saved scope and generated record formats. Saving settings
or importing an adapter does not start collection or expand the App's authorized
scope. Permissions provide a return path to the original setup flow.

Each App independently selects measured foreground duration, screenshots and
structured visible content. Any combination, including none, is valid. A new
installation defaults to duration only. Screenshot saving follows the explicit
screenshot choice regardless of field extraction success or failure. Missing
rules or fields never create an unselected screenshot channel. Projection mode
supports screenshots and duration; structured content requires accessibility.

The collector maps configurable named fields using declarative rules pinned to
an exact installed App version. Rules select regions or repeated containers through
resource IDs, roles, ancestors, original child positions and optional portable
subtree hashes. Fields explicitly declare their source and scalar/list cardinality.
Message text, quoted text, displayed counts, progress, app-generated summaries and
other observations keep their original names and source distinctions. Rules do
not classify intent or topics, invent links or IDs, execute code, fetch hidden
content, or use semantic keyword dispatch.

Privacy filtering precedes field reads. Editors, passwords, sensitive subtrees,
hidden or occluded values and masked areas are excluded. Original child indices
remain intact. Descriptions require a safe, fully visible matched leaf; composite
container descriptions are unavailable. Portable subtree hashes are retained
without widening when filtering changes a shape. Hashes that depend on original
export IDs are not runtime mapping contracts.

Optional on-device OCR supplements structured capture only when explicitly
selected. Temporary pixels pass the same authorization, privacy and current-state
fences. If screenshots are off, pixels are released after local recognition and
are never persisted or uploaded as an image. OCR values retain `source: ocr`;
privacy-review OCR is not silently reused as saved content. A privacy rejection,
locked device, stopped collector or stale page/configuration cannot produce a
late content record.

Android uploads the current version 3 named observation format. One immutable
transport record contains one object, named observed values and their sources,
observation times and adapter/App versions. It contains no UI tree, coordinates
or screenshots. Scope is always `visible_window`; successful extraction does not
establish completed reading, attention, playback duration, agreement or an action.
Article/product authoring rules normalize to the same version 3 output.

Each accepted observation is immediately persisted in the durable queue. Independent
time, screenshot, structured and OCR records share a sampling correlation ID.
Only the standalone duration observation counts measured foreground intervals;
content and image records have zero duration. Multiple cards or correlated records
must not multiply elapsed time. Sampling gaps remain unknown coverage.

Central deterministically publishes readable materials with original evidence,
field source labels and provenance. Missing object identity is not replaced by
title matching. Separate observations and repeated values are preserved. Materials
remain partial, and originals remain independently pageable under existing
retention and source authorization.

Central automatic Activity organization has a separate default-off setting and
explicit model preset. It processes newly accepted authorized captures, independently
of Memory recipes and Memory enablement. The model interprets actor, activity,
object, event state and relationships, preserving original dated observations,
state transitions and uncertainty. Disabling fences pending work and late results;
previously saved activities remain. Replays, imports, restarts and historical
material rebuilds do not grant fresh model authorization.

| Boundary | Current decision |
| --- | --- |
| Capture authorization | Per-App independent duration, screenshot and structured choices; importing rules never widens them. |
| Field meaning | Configurable named values with explicit source; structural matching only. |
| Privacy | Input/password/sensitive exclusion, masks, visible safe values and current-state fences. |
| Persistence | Immutable queue IDs, per-record ACKs, immediate local persistence and existing retention. |
| Central interpretation | Readable materials and optional model-based Activity, independent of Memory. |
| Validation | Generated fixtures prove contracts; current physical App/OEM behavior and OCR quality need separate evidence. |

This updates the initial page-first/screenshot-fallback decision. The current
operational contract is [page capture](ui-page-capture.md); provenance and migration
exclusions are in [rule documentation](../adapters/ui/README.md). The central
boundary remains consistent with [central perception](central-perception.md) and
[material architecture](material-architecture.md). No old-data migration, dual
writes or extra compatibility reader is introduced by this decision.
