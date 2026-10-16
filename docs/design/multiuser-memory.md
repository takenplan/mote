# M07 scoped Memory

The module uses one shared SQLite connection, the shared M05 executor and the
existing Memory strategy, exact-evidence, independent-review and immutable
provider publication contracts. The production builder installs MemoryHost
before starting execution. It consumes real M06 Material publication inside the
M05 transaction; no legacy private Store or additional scheduler is constructed.

This is an implementation freeze awaiting final independent delta review,
combined checks and Draft PR. It is not completed module acceptance.

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
