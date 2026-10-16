# M07 scoped Memory

The module uses one shared SQLite connection, the shared M05 executor and the
existing Memory strategy, exact-evidence, independent-review and immutable
provider publication contracts. The production builder installs MemoryHost
before starting execution. It consumes real M06 Material publication inside the
M05 transaction; no legacy private Store or additional scheduler is constructed.

Feature readiness, independent review, final source/emitted/affected receipts and
remaining external limits are recorded in
[the validation ledger](../validation/multiuser-m07-memory.md#final-feature-receipts).
Integration/main merges remain a separately authorized action.

## Identity, evidence and read capabilities

Every private table, FTS candidate, dependency, provider key and namespace binds
the trusted host UserContext. Equal upstream Material IDs, bytes, entity names
and user-supplied provider credentials never establish shared identity. Namespace
identity includes owner, instance and immutable binding revision. Source and
block attribution retain declared narration, context versions and time metadata;
the uploader does not establish the semantic subject.

Material original blocks project to deterministic owner-bound mm_evidence IDs.
The shared fingerprint covers the original projection, including attribution and
provenance. Named ready artifacts restrict the selected original blocks even
when the overall Material remains partial. Summary and interpretation Materials
lead back to original dependencies; they never become original quotations.
Image anchors bind real M03 bytes, SHA256 and M06 Material revision. Both the
extractor and independent reviewer must obtain actual pixels for visual claims.

MemoryHost.bindRead(context, {sourceIds?, assertCurrent}) is a host-only narrowed
capability. It exposes read(id, version?), page/opening/search, exact Material
projection, original evidence, fingerprint assertions and image reads. Undefined
sourceIds means the trusted account's complete scope; [] means no sources.
Callers must explicitly adapt any transport's different all-sources convention.
The allowlist is copied, normalized and frozen at binding. All transitive
pd_material_sources must fit it before SQL ordering/LIMIT, provider keys and
semantic ranking. Cursors bind the complete allowlist and query filters.
Parent request/grant checks apply before and after provider awaits and every SQL
access. A current-evidence assertion does not claim external provider availability.
Read/search always use the actual active external provider and verified body
hash; failure never falls back to the SQL body mirror.

## Durable extraction, policies and publication

M06 publication synchronously admits a fresh no-model M05 intake task with an
immutable Memory policy receipt. It does not retain a completed M06 TaskRun.
Existing source, capture, document, personal, coding and named-artifact recipes
resolve through MemoryStrategies. The original extraction windows and integration
policy use per-user receipts and version watermarks. Every selected original
range receives a durable bounded batch, exact coverage and retained model output;
long evidence is not silently truncated. Policy changes revoke incompatible
pending automatic receipts. Pausing drains admitted work, and stopping fences
only that owner's automatic receipts/windows; admitted manual work remains valid.

A job and its complete child plan atomically register a no-model M05 admission
coordinator before asynchronous child leases. Restart resumes that exact plan,
including a manual job with no automatic intake to recover it. Cancellation
fences admission, and binding migration drains pending admissions.

Each job pins one genuine M04 immutable root model configuration. Extraction and
independent review fork separate M04/M05 usage leases from that root. Changing
current selection does not change an admitted job's model. Generation, binding,
Material readiness, original fingerprints, related versions, deletion snapshot,
account/grant and cancellation fences apply across execution and publication.
Successful outputs persist before checkpoint completion. Recovery reuses those
outputs; interrupted model requests may retry under their original authority.

Publication uses the existing per-user coordinator and prepare/write/readback/
commit sequence. Owner correction reuses the existing correction algorithm,
creates a real host-attributed M03 owner note and publishes through the same
M05/provider coordinator without a model. It never infers owner confirmation from
uploaded text. Exact historical versions retain their immutable provider binding.

## Providers and lifecycle

Builtin storage, the actual Mem0 SDK repository/retrieval mode and actual
Hindsight engine mode are connected through M09 fixed releases, instances and
M04 credentials. Native Hindsight text consolidation persists operation intent
before issuance and observes a known completed result after a lost response;
unknown issuance is surfaced instead of blindly replaying inference. Visual
input in its text-only engine mode is explicitly unsupported.

Binding prepare drains admitted work, verifies the real target and stages all
current and retained published historical versions. Every version's complete
transitive sources are checked before provider setup, verification or disclosure,
then rechecked across awaits. Activation checks the exact catalog, revision and
grant. It never silently changes an active binding on partial failure.

External writes and deletes retain exact namespace/key/digest journals. Cancel,
retirement and domain deletion fence publication and queue cleanup. Reconciliation
observes or removes only recorded keys, including a put whose response was lost;
it does not replay unknown writes. Logical removal is not proof of physical
provider erasure. Unavailable or unverifiable cleanup remains pending/unknown.
Purpose-limited domain lifecycle capabilities allow literal export/cleanup after
ordinary runtime or account retirement without granting new inference authority.
Portable export reads all exact current/historical bodies from their actual
providers and rejects a concurrent catalog change. Portable restore validates
owner/deployment and original evidence and restores
stale builtin records, never task/model/plugin execution authority. M16 owns
whole-user lifecycle ordering and retention of cleanup resources.

KEEP: original semantic attribution, exact evidence, independent review, existing
strategy/policy registries, immutable provider records and one publication
coordinator. CHANGE: authority, data keys, model leases, candidates and lifetime
fences bind the host user. REMOVE: default owner and legacy Store production
dispatch. EXCEPTION: trusted plugins are not a malicious-code sandbox. UNKNOWN:
real provider accounts, credentials, models, devices and deployment are outside
this task; synthetic HTTP fixtures prove the production seams exercised only.

## Existing owner review, history and import responsibilities

The MVP changes the old proposed/stale wire modes. The old opening reader
consumed proposed candidates and the evidence reader opened stale historical
cards. Proposed drafts now stay in the same M05 extraction/review checkpoints
until independent review and the single publisher finish. Human inspection uses
`GET /api/memory/audit?kind=proposed` and `/api/memory/jobs/:id/review`; it
cannot publish a proposal directly. Published/invalidated history inspection
uses `/api/memory/audit?kind=stale` and `/api/memory/audit/:id?version=N`.
These full-owner audit responses explicitly return `usableAsMemory:false` and
are absent from `bindRead`. An exact retained original and its visibility are
required even for audit; current and selected history rows are pinned across
provider awaits. External audit reads call the actual provider and verify the
body digest. Failure never discloses an old SQL copy. Query readers continue to
receive only reviewed, published, currently valid Memory. This supersedes the
old opening-candidate input, while keeping owner review and retained-history
inspection. Withdrawal/deletion of an original still withdraws that disclosure.

The old `imports.ts`/`ImportAttributionStore` contract survives at fresh M03
receipts. A full owner web/client submits optional `importDeclaration` with
`id`, positive immutable `version` and literal `instruction` (12,000-character
existing limit) alongside a capture/source-item batch or upload manifest.
M03 freezes it for this source and binds only newly committed, nonduplicate
originals before invoking existing intake subscribers. A repeated import cannot
replace prior context. Task, device and source-bound capabilities cannot create
owner prose. Host Material publication opens exact canonical declarations from
its transitive originals, separately for every block. Neither a source publisher
nor a model can inject or widen a dangling pin. Canonical private-data export,
delete and restore include declarations/bindings; restoring prose grants no
processing, extraction or continuation authorization. Old archives with another
coverage contract are rejected before writes; no old data is cleared.

`MemoryHost.onPublished(receive): unsubscribe` is a host-only synchronous
same-transaction notification. Its actual M05 `TaskRun` and immutable event
`{jobId,automatic,memoryIds,materialIds}` identify the committed publisher's
exact inputs/results. Grant checks surround subscribers; a subscriber may
submit its own already-authorized durable coordinator in the same transaction.
The event grants no full-account read or periodic working/insight policy.
Those owning domains must admit their own retained M05 policy grant from an
explicit trusted owner context; a configuration lifecycle subject or narrowed
MCP request cannot be promoted to such a context.

### M13 original manual model consumer

The manual `/api/memory/jobs` request may carry the same owned `modelReference`
and personal `modelOverride` as M08. M07 consumes the existing M04
`leaseReference` seam; it does not change the global Memory default, endpoint or
key, and shared resources retain M04's fixed model restriction. The explicit
request metadata is retained in the durable job input so a retry of the same
operation cannot substitute another requested model. Existing automatic jobs
and requests without those fields retain their original task form and lease.

M13's original explicit-Material selection reads
`GET /api/memory/materials/:id?revision=<sha256>[&recipes=<JSON refs>]`. It reuses
canonical M07 materialEvidence normalization and declared recipe requirements,
returns `{materialId,ref,revision,recipes,status,evidenceIds}`, and admits no task
or provider/model authority. Exact historical/noncurrent revisions reject;
canonical dependency pending returns `waiting`. A ready preview remains subject
to the real admission's provider, model, grant and lifecycle checks.

Manual job input can additionally supply `materialRevisions` mapping every
selected Material ID to its exact revision. A provided map must cover all and
only the selected IDs; it cannot fall back to current versions for omitted
entries. Existing callers without the map retain their original current-input
semantics. The admitted M07 pins remain the existing durable task source of truth.
