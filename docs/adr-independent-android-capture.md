# Independent Android capture and prospective activity understanding

Accepted by the owner on 2026-10-24. This decision supersedes Android's mutually
exclusive screenshot/page-first behavior in the earlier page-fields ADR.

Each App selects duration, retained screenshots and structured extraction
independently. All eight combinations are valid. The default remains duration
only. Saving a draft or loading an adapter never starts collection or expands an
App's selected channels. Notification and media switches remain independent.
Each channel checks its effective policy, all visible windows, exclusions,
lock/battery state and configuration generation at its actual boundary.

Local content OCR is a separate explicit opt-in, default off. It may use a
privacy-approved temporary bitmap even when screenshots are not retained. OCR
is confined to the inspected foreground root: configured masks, occlusions and
private/editable/password/sensitive nodes are blacked out; unknown private bounds
or truncated inspection disable OCR. Relevant same-page UI changes invalidate the
node/mask context before OCR, throughout recognition and before persistence.
Pixels are recycled and never encoded, cached or uploaded when screenshots are
unselected. An OCR failure does not suppress an independently authorized screenshot;
a privacy refusal or stale authorization does.

Android emits only version 3 named observations. Each record has one object with
bounded named fields and explicit text/description/state/OCR provenance, and no
UI tree, node identifiers or coordinates. Explicit article/product rule authoring
compiles to the same current output. Desktop continues its active v1 producer;
Android v1 and superseded v2 uploads are rejected. No migration, dual writes or
retired Android reader is introduced.

A sampling UUID correlates independently acknowledged records. Its selected
channel flags describe intent, not successful persistence or synchronized pixels.
Duration is a separate observation and content records have zero duration.
Repeated identical message text does not establish message identity. Only real
observed identifiers and exact overlap justify deterministic text accumulation.
Rule packs retain exact App versions and portable subtree guards; generated
conformance does not prove live App compatibility.

Central deterministic Materials are readable independently of Memory. Media
observations form measured intervals without paid activity interpretation.
Automatic activity understanding has a separate default-off control and an
explicit model preset. The original receive transaction records prospective
admission/denial; restart, repeated delivery, model changes or later enablement
cannot authorize historical input. Correlated content is coalesced and processed
incrementally with durable bounded continuations. Disabling fences queued work
and late publication. All disclosed originals and prior inputs contribute deletion
lineage, not only the limited displayed quotes. Activity interpretation never
writes Memory or external effects; Memory keeps its independent review/publication.

Android local format 4 and portable settings format 2 are deliberate current
boundaries. A retired profile/archive is rejected without rewriting or deleting
its bytes. Before installing this Dev, finish or back up pending work using the
previous installation, then explicitly reset Android App storage and configure
its new selections. Upgrade Central to a build containing v3 intake before sending
new Android structured observations. Existing queue failures must remain pending,
not report success against an incompatible server.

Validation uses generated evidence and a dedicated hidden emulator. Physical App
compatibility, OEM lifecycle, long-running battery behavior and live model quality
require separate evidence; historical offline rules and previous passes do not
establish these properties.
