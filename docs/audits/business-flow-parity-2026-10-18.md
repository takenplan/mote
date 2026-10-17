# Business-flow parity audit: single owner and scoped production

Date: 2026-10-18. Status: static journey/contract audit; unresolved findings
follow existing ADRs and remain implementation or validation work. This report
does not authorize personal
data access, historical model processing or removal of an existing capability.

Current disposition: F01–F11 retain implementation or validation follow-ups;
F10 is partially corrected. F12, F13 and F10's stale-tail withdrawal are verified
in the combined candidate, as identified in the final readback below. They were
not present in the audited baseline or implemented by this corrective PR alone.

## Joint-integration follow-up — 2026-10-18

The original audit and corrective-branch evidence below retain their stated
baselines; branch-local delivery refers to `3753e30e70700bab0fd1029f71b632e0e67589be`,
not the final merged `main`. Later work in the main-integration candidate
addresses these previously separate findings:

- F10's obsolete recording-tail/empty/unsupported current projections:
  [recording revision receipt](../validation/main-multiuser-recording-revisions-2026-10-18.md).
- F12's retained-history, equality and derived-cache contracts:
  [integration receipt and source provenance](../validation/main-multiuser-integration-2026-10-17.md).
- F13's returned in-process original-decoder format failure settlement:
  [decoder receipt and HTTP-unknown contrast](../validation/main-multiuser-local-decoder-failure-2026-10-18.md).

Those source-bound fixes supersede the corresponding unresolved status in this
original snapshot; they do not close all 13 findings. F02/F03/F04 remain current
capability gaps, not old-version compatibility work. F10's canonical product/
Memory shape, F11's restore-only enablement question and other open items retain
their individual scope. Final combined checks, `main` and release readback belong
to the integration receipt, rather than being inferred from this static audit.

## Baselines and evidence rules

- Previous single-owner code baseline, fetched `origin/main` snapshot at
  `2c2627621e2598332ae8169845bc7343be7ed63e`.
- Shared branch point:
  `6272a9b51ec92cc4c32e2ff1a1eeb4fa38b142ed`.
- Scoped production examined:
  `b26e797b5427fd089fa4fc4fa8b0cc45909f24af`, the multi-user integration
  branch, before this working tree's corrective edits. File locations below
  describe that snapshot unless expressly stated otherwise.
- The active review branch is `codex/business-flow-parity`. Companion Agent input,
  shared recording-flow and archive-only backup corrections are implemented in
  this working tree. Their exact validation and final check results belong to the
  [companion validation record](../validation/shared-business-flows-2026-10-18.md),
  not this static audit. No correction has been deployed by this audit. The
  parent's earlier runtime inspection identified deployed Central as
  `central-main-6272a9b5-20261015`; the code baseline above must not be presented
  as its running revision.
- The owner subsequently clarified: “mvp版本。不需要考虑前向兼容”. The
  corrective MVP uses the current scoped baseline and does not migrate or repair
  historical tasks, infer their initiation purpose, or convert old backup
  records. Earlier code remains a business-contract comparison, not an upgrade
  compatibility commitment. This scope decision does not remove the current
  product responsibilities or remaining findings below.

Production reachability is decisive: scoped `src/app.ts:1–2` exports only
`scope/app.ts`. The latter registers ingress, processing, Memory, Ask,
connectors, Actions, MCP and lifecycle before starting M05
(`scope/app.ts:88–114`). Old algorithms remaining in source, or a green test
using `test/fixtures/legacy-app.ts`, do not prove a scoped user can exercise
the old capability.

The primary authority is [the multi-user ADR](../adr-multiuser-scope.md), read
together with [the module acceptance matrix](../design/multiuser-modules.md),
the existing feature ADRs and the actual old/new callers. The multi-user ADR
authorizes identities, isolation, account-bound queues, the new baseline and
temporary closure of unfinished private routes. It explicitly preserves domain
contracts. Neither an epoch change nor temporary fail-closed behavior is a
general authorization to change business scope, completeness, retention,
pricing/accounting or final user steps.

Module implementation ledgers are useful evidence of intended behavior and
tests, but a sentence saying KEEP is not evidence that every old responsibility
is wired. Conversely, old code and tests are not product authority when a later
owner decision supersedes them. The post-fork main changes are identified
separately below.

## Journey and supersession matrix

`KEEP` means retain the business contract; `CHANGE` means a specific documented
replacement; `REMOVE` requires an actual supersession basis; `EXCEPTION` is a
bounded qualification; `UNKNOWN` needs a decision or further validation. A
KEEP row with a finding is an implementation gap, not a claim of parity.

| Journey / state transition | Input, expected output and responsibility | Disposition / authority | Inspection result |
| --- | --- | --- | --- |
| Upload / ZIP → private preview → confirmation → saved records | Retain exact container/member bytes; account for every supplied input; preview must describe actual readiness; publication is idempotent and independent of later OCR/Memory success. | KEEP; media-import contract, upload/processing decoupling, exact import attribution. CHANGE owner-qualified paths, M05 grants and read-only mapping instead of uploaded-data shell access. | Actual scoped `processing-imports.ts`, map, manifest worker and commit examined. Relative Markdown media relationships remain absent in both old and new paths; misleading model warnings remain possible. See F07. |
| Owner imports a Central directory | Explicit trusted host directory → archived originals → same review/publication flow. Ordinary clients must not obtain arbitrary host paths. | CHANGE administrator-only host capability per multi-user ADR; REMOVE ordinary-user access. | New `processing-imports.ts:152` rejects every directory request, including an administrator. The admin capability is not restored; F08. |
| New file / source-item original → extraction → formal Material | Save ACK stays distinct from processed/indexed. Apply selected source/MIME/profile; honor archive-only choice; no hidden model fallback. | KEEP; M06 processing and named-profile contracts. CHANGE per-user original/model/configuration bindings. | Shared processor runtime/recipes and typed outputs are used. M06 now processes ordinary source-item originals too. Canonical processed origin loses time/device candidate fields; automatic-scope equivalence still needs F09's checks. |
| Audio semantic turns, summary and image interpretation | Retain extraction on optional derivative failure; preserve every selected turn, speaker and uncertainty; each product has its own actual status. | KEEP; existing 200-turn grouping and per-page summary limits are retained, not new regressions. | Scoped `processing-analysis.ts:40–51` and old `file-processing.ts:588–598` examined. Existing 200-turn rejection remains explicit; the configured flags remain separate from processing status. |
| Declared image attachment → selected processing → caption composition | Exact retained parent/archive declaration gates admission; OCR, image original and named interpretations compose with the caption. Retaining bytes does not mean archive-only processing. | KEEP; file-source-context ADR and existing image/attachment contract. CHANGE per-user attachment incarnation and task fence. | Admission seam is real (`ingress.ts:156–172`). Composition conflates archive retention with archive-only profile; F05. |
| Coding session → clean conversation → understanding → independent Memory review | Clean conversation evidence is necessary, but event/work products and original-span attribution are independent responsibilities of the existing understanding stage. The current actionCues contract remains empty. | KEEP under system-refactor ADR and Coding generation contracts; no owner removal found. | Scoped producers clean dialogue but do not invoke the old conversation-understanding processor. F01. |
| Screen / structured page → ordinary Memory plus daily observations | Separate capture-event input; dates remain capture-specific; daily observations do not silently become selected long-term Memory. | KEEP; daily-event and range-evaluation ADRs. | Scoped capture organizers, capture intake grants and daily `requires` selection examined. They use the shared pure builders and separate daily selection. Not an assertion of real-model recall completeness. |
| Original intake → automatic Memory → pause / drain / stop / restart | New durable intake freezes authority. Pause drains accepted work; stop revokes; resume/rebuild does not grant historical work. Extraction and independent review remain separate. | KEEP; plugin-center, system-refactor and daily-event ADRs. | `memory-intake.ts:27–55`, `memory.ts:200–215`, per-job controls and provider bindings examined. Current code preserves these distinctions. Historical/capture timing and unusual recipe combinations still need generated acceptance, F09. |
| Manual Memory / integration / owner questions | Exact selected evidence and model snapshot, independent review, choice/free text/unknown/defer, scoped continuation and publication. | KEEP; manual-selected-output and owner-clarification decisions. CHANGE scoped jobs/routes. | Real scoped job and question handlers are wired. This audit did not rerun every state transition; creation-versus-start UI semantics remain in the separate client/entry audit. |
| Builtin / Mem0 / Hindsight → read / edit / delete / binding switch | Respect provider authority, version pins and cleanup journals; no SQL-body fallback if external authority is absent. | KEEP under multi-user ADR and Memory parity contract. EXCEPTION explicit unsupported visual/native-provider modes. | Shared validators/review and scoped namespace/read/journal paths inspected; package/SDK and unknown-result correctness rely on existing owning-module evidence, not a new executed provider test. |
| Ask / MCP retrieval by meaning | Preserve configured semantic/vector retrieval alongside literal retrieval and truthful degradation. Equal IDs and candidate ranking must remain account-scoped. | KEEP existing feature; CHANGE requires a scoped producer, not reuse of a global index. | Scoped source/Material query is FTS/literal only. Existing global indexer is deliberately not mounted; semantic/vector replacement remains missing, F04. |
| Model discovers a source from its owner description | Search source name or description; show a bounded relevant preview; obtain exact current declaration before relying on it. | KEEP, explicitly required by file-source-context ADR. | Scoped source search filters name only and supplies a ref after discovery; description-only discovery is lost, F06. |
| Model call / yield / retry / failure / process death → usage | Observe actual tokens and duration, preserve unknown values, include failed/interrupted and resumed fragments, group by operation/agent/module/skill without duplicate charges. | KEEP, explicitly preserved by multi-user/model ADR and query quality/accounting decision. | New lease receipt is immutable after its first result and lacks original agent/module attribution. Failure and crash samples can be lost; F02. |
| Gmail / calendar / Lark sources → scoped sync | User connection, selection, source provenance, provider timestamps, cursor/dedup, tombstones and exact bytes survive retry/restart. | KEEP; CHANGE isolated vault/CLI credentials and M05 connector workers. | Shared Gmail, Google Calendar and Lark adapters are actually instantiated (`connectors.ts:126–136`), with scoped sources/vault. Recording adapter had a parallel business implementation; the companion change now calls a shared flow. F10 separates that correction from remaining archive/consumer differences. |
| Recording transcript + optional audio backup | Original export, canonical transcript and provider time remain separate from optional backup. Backup alone must not authorize a second ASR job. | KEEP existing recording contract; current explicit owner correction covers the demonstrated divergence. | Original scoped adapter published raw export, additional paragraph source-items and backup audio through ordinary processing. The companion correction owns shared behavior and archive-only backup tests; F10. |
| Calendar/Tasks action proposal → approval → external ACK | Queries are read-only. User approval freezes target/operation; unknown result cannot be blindly replayed; independent todos do not gain external permission. | KEEP; action-first ADR and M12 decision ledger. CHANGE per-user targets and review authority. | Actual discovery, catalog, exact evidence validation, per-user proposals and native delivery/ACK journals are wired. No blanket claim for every external provider/device; full consumer mapping is outside this static report. |
| Inbound MCP reads / source-bound writes; outbound selected resource/tool import | Session ownership stays fixed; writes only to allowed existing sources; outbound tool must be explicitly selected and read-only. Retain content and membership or fail explicitly. | KEEP; CHANGE user credentials/connection references and source incarnations. EXCEPTION existing MCP response/resource boundaries. | Actual SDK host and scoped Ask/Memory/source readers are used. 100,000-character text and 100-result outbound import bounds also exist on old main; they are not newly introduced quotas. No read can choose another user or mint a processing grant. |
| Retention policy / logical capacity → recurring cleanup / admission | Nonzero configured retention must execute; max logical vault bytes must stop intake with an actionable capacity response; physical/shared overhead remains distinct. | KEEP existing configured instance policies; no owner removal found. Do not introduce per-user quotas or automatic eviction. | Config still accepts `retentionDays` and `maxStorageBytes`, but scoped consumers are absent. F03. |
| Encryption / decryption / snapshot expiry / GC | Original retention, content encryption, temporary processing snapshots and logical deletion remain distinct. Mixed `.plain`/`.aes` and explicit conversion remain supported. | KEEP; CHANGE user keys/paths. EXCEPTION active pins and late physical I/O. | Current M03/content-storage/GC paths inspected. Explicit GC respects references/pins. Scheduled physical cleanup coverage differs from old startup/hourly maintenance and needs F03 follow-up. |
| Personal export/import → canonical merge | Explicit account/deployment/domain coverage, exact bytes/history, missing-source disabled state, no renewed execution grant. | CHANGE to portable 3 is authorized; REMOVE global-owner import/export. Same-account/deployment merge is documented by M16. | Domain registry, transaction and rollback paths inspected. This audit does not independently establish every native-provider backup or corruption case. |
| Stopped whole-instance restore → reopen / resume | Preserve canonical originals, accounts/history and succeeded/unknown external facts; retire invalid credentials and task publication rights. | KEEP data/reconciliation; CHANGE identity/epoch fences. UNKNOWN historical provenance for newly mandatory reauthorization steps beyond that requirement; follow existing recovery ADRs. | M16 deliberately pauses automation/plugins/connectors/outbound MCP and clears execution targets after restore. Whole-instance continuity remains unverified; keep current safe behavior while addressing F11 under existing ADRs. |
| Ordinary evidence revision → retained answer / stale Memory | Exact normalized equality is a no-op; ordinary change retains historical dialogue and stale statements; true privacy deletion still erases/blocks. | CHANGE explicitly approved on main after the shared branch point. | PR160's post-fork contracts are absent from the audited scoped baseline. F12 is a separate follow-up, not a claim that M00 newly removed them. |

## Confirmed gaps and ADR-directed follow-ups

### F01 — Coding understanding and its work/event products are not restored

Priority: high; business responsibility regression relative to the shared
baseline. The old production composition registers
`mote.coding-conversation-understanding@4` and connects
`MemoryPipeline.understand` to a durable context processor. It supplies selected
conversation pages, exact generation/model/time/Material contracts, awaits the
processor and returns its versioned outputs. See old
[`app.ts:616`](https://github.com/utopiafar/mote/blob/2c2627621e2598332ae8169845bc7343be7ed63e/apps/server/src/app.ts#L616)
and the retained equivalent `test/fixtures/legacy-app.ts:607–634`.
The processor produces separate summary, events, work records, Memory candidates
and an action-cues field; summary/event/work/Memory claims carry exact original
spans and are not interchangeable with long-term Memory cards
(`conversation-understanding.ts`, `semantic-extraction.ts:25–38`). The current
contract requires action cues to remain empty. Restoring this producer must not
introduce a new action-generation product. The system-refactor ADR preserves Coding reuse
only under its exact full/unsaturated generation contract; it does not remove
the producer when reuse is unavailable.

The scoped path has `conversationRecords` cleaning
(`scope/processing.ts:50`, `memory-capture-materials.ts:45,53,69`) followed by
direct selected extraction/review (`scope/memory.ts:200–215`). Its production
composition does not register or call that understanding processor.
The [Memory parity ledger](../design/multiuser-memory-parity.md) establishes
organizer and clean-dialogue coverage, not this missing product producer.

KEEP the clean-dialogue protection and independent review. Restore the existing
understanding responsibility through M05 and exact scoped input/output contracts,
preserving work/event consumers and the existing empty action-cues contract. A
unified implementation is possible only if those responsibilities survive.
Removing the intermediate implementation is an
engineering choice only if its business products, exact evidence and consumer
behavior survive. Do not silently substitute selected Memory for event/work
history. Required regression: same-ID A/B Coding session → understanding products
→ independent review → event/work retrieval, partial/saturated work, correction,
failure, restart and one successful-stage reuse.

### F02 — Usage loses fragments, failure samples and attribution

Priority: high; accounting completeness changes even if the UI totals function
is reused. Old `usage.ts:28–35` creates a running receipt and persists each
`onUsage` update before finish; `:40–44` folds every operation fragment.
The API supports time/filter/agent/module/skill grouping
(`features/usage.ts:8–13`).

New `scope/configuration.ts:325–330` sets `agentId` and `moduleId` to
`__unknown__`, sets `skillId:null`, uses the lease ID as the only receipt ID,
and returns an existing receipt without applying a later result. M05 deliberately
recovers the same model receipt (`task-execution.ts:146–160`). Thus a failed
attempt followed by successful retry, or yielded/resumed work under that lease,
can retain only the first fragment's status/tokens/duration. `memory.ts:197–198`
does not carry observed tokens into its failure receipt.
`processing-analysis.ts:62,79`, `processing-import-map.ts:42` and media processing
`:517` record only a successful terminal result. A process death before terminal
recording has no equivalent running/onUsage receipt in this path. Revocation
also blocks the ordinary `grant.commit` metering path; consumed physical work
must remain distinguishable from revoked publication.

KEEP unknown billing values and exact owner/model attribution. Restore durable
per-attempt/per-fragment measurement within the existing usage/lease framework;
deduplicate receipt replay without equating another physical attempt to the same
charge. Preserve original agent/module/skill dimensions. A narrower accounting
product would require an owner decision and honest UI coverage; it cannot claim
equivalent cost accounting. Required tests: observed tokens → failure → same-task
retry success; yield → resume; SIGKILL after observed usage; cancellation/revoke
after issued call; duplicate ACK without duplicate charge; B unchanged.

### F03 — Accepted retention and capacity settings have no scoped enforcement

Priority: high. `config.ts:64–69` still accepts nonzero `retentionDays` and
`maxStorageBytes`; scoped `Configurations.open` registers those built-in domains
(`scope/configuration.ts:91–95`). Old `features/storage.ts:14–15` invokes
`store.prune` at startup and hourly. Old EvidenceStore enforces logical capacity
before storing captures and reserved metadata (`evidence-store.ts` intake and
`reserveMetadata`; locate the exact old version on main rather than relying on
line offsets in the diverged working tree).

Scoped `app.ts` does not start the old feature/maintenance loop, and the scoped
domain code does not consume either setting. `Originals.gc:138–146` removes
unreferenced/expired objects, not capture rows by configured retention date;
`ingress.ts:252–256` exposes explicit per-owner GC. Snapshot expiry has its own
separate contract and does not implement retentionDays. The result is an
accepted nonzero privacy/retention choice that stops taking effect, and a
previously effective logical capacity ceiling that no longer stops intake.
Defaults `retentionDays:0` do not make the nonzero journey irrelevant.

KEEP exact source deletion/Memory/answer invalidation and the distinction between
logical capacity and physical overhead. Following the owner's direction to use
existing ADRs, restore the existing instance-wide settings rather than inventing
per-user quotas or eviction behavior. The admission and multi-user ADRs preserve
that contract; no new account-level replacement policy is adopted. Until a
supported replacement exists, unsupported configuration must be explicit rather
than silently accepted. Validate startup + elapsed retention + late processing,
archive/snapshot/reference modes, shared object references, active physical pins,
at-capacity metadata/capture/file intake and pending-client queue preservation.

### F04 — Semantic/vector retrieval remains an acknowledged unimplemented capability

Priority: high for semantic recall, medium for literal-only deployments. Old
production uses the configured `Indexer`, background capture/file embedding,
hybrid retrieval/rank fusion and explicit degraded coverage (`indexer.ts`,
`features/storage.ts:13,17`). New Ask evidence/search uses owned SQL literal/FTS
candidate selection; status says `scoped-fts5` (`scope/ask.ts:115`).
The [KEEP controls ledger](../design/multiuser-keep-controls.md) explicitly says
the lexical producer is current and hybrid/vector retry is not restored.

The old unscoped index must stay removed. Its absence does not establish that
the business semantic-retrieval capability has an authorized replacement.
Restore the configured embedding/vector producer within account scopes, keeping
lexical/semantic ranking and truthful degradation. The owner permits release
with recorded unresolved gaps; current lexical-only coverage remains an
implementation limitation, not a replacement retrieval contract or permission
to enable a new paid provider. Required evidence: generated synonym/paraphrase retrieval, combined
lexical/semantic ranking, A/B identical identities, source withdrawal, model
unavailability/degraded metadata and restart. Static source inspection cannot
measure real semantic recall.

### F05 — Archive retention is mistaken for an archive-only image profile

Priority: high; confirmed conditional logic mismatch, user-outcome test still
needed. `scope/memory-capture-materials.ts:78,81` uses
`original.retention==='archive'` for unavailable processing and
`image.archiveOnly`. Old `image-materials.ts:12` derives archive-only from
`policy.profile.processorId==='archive'`. These are different user choices:
the file-source-context ADR explicitly allows retained archive originals with
processing, and independently selected original-only archive profiles.

`material-organizer-contract.ts:157` returns no image original/interpretation
named blocks when `image.archiveOnly` is true. For a declared archived image
attachment processed under an OCR/VLM profile, caption composition can therefore
omit the original-image/understanding named products and their actual pending or
failure state. OCR chunks and asset locators may still exist; this is not a claim
that all archived images or all pixel reads fail.

KEEP the separate retention and processing choices. Use the actual pinned
processing plan/profile and actual accepted named products. Test a caption with
archive retention plus a non-archive image profile, both default and custom
recipes, pending → ready/failure → restart/retry, and explicit archive-only as
the negative control. No new product policy is necessary to correct this
conflation.

### F06 — Source-description discovery is narrowed to source names

Priority: medium. Old `source-context-catalog.ts:18–23` matches source name OR
owner description and returns a relevant preview. The accepted
[file-source-context ADR](../adr-file-source-context.md#discovery-and-processing)
specifically requires this model-selected metadata search.
New `scope/ask-evidence.ts:151` applies the query only to the source name;
`:166` can expand a declaration only once its exact reference is known. The
catalog wrapper (`scope/ask.ts:98`) calls that same sources method.

Trigger: the user remembers text in a folder/source description but not its
name, and the model searches that phrase. The source is omitted even though its
current declaration is otherwise readable. KEEP both fields searchable with
current declaration pins and bounded preview; retain read/disclosure checks.
This is metadata retrieval, not forbidden keyword intent classification.

### F07 — ZIP/Markdown media relationship gap predates the scoped migration

Priority: medium; original defect, still present. Old and new paths separate
media processing from text mapping. Old `imports.ts:133,283–287,385–390` excludes
media from model inputs and directly merges warnings. Scoped
`processing-imports.ts:48,89,100,108` does likewise. `format-worker.ts:34–37`
decodes Markdown as literal UTF-8 and emits `attachments:[]`; it does not rebuild
relative media links. This does not prove every ZIP emits a missing-image
warning: deterministic automatic text decoding does not run that model.

There is also a new interface inconsistency: `processing-import-map.ts:17–21,39`
allows UUID references from all `job.files`, while the later path lookup
(`processing-imports.ts:102–105`) accepts only content inputs. A mapped attachment
UUID belonging to excluded media cannot survive canonical validation. A prompt
alone cannot repair this contract.

Follow the existing media and source-context contracts: reconstruct explicit
local Markdown links against the exact same import archive, preserve canonical
parent/file relations and truthful archived/pending/missing facts, then use
existing processing/composition. A prompt/status-only change leaves the
relationships broken. Keep asynchronous preview and explicit selected historical
retry/rebuild; correcting file existence authorizes neither automatic historical
paid replay nor a new OCR wait. Path normalization, traversal, duplicates and
safe exact matching remain engineering obligations.

### F08 — Administrator host-directory import has no production route

Priority: medium; unimplemented retained capability. Old directory intake lives
in `imports.ts:169–190`. New `scope/processing-imports.ts:152` rejects a directory
before inspecting administrator authority. The multi-user ADR narrows arbitrary
host-path access to administrators; it does not state the capability is removed
for everyone. Ordinary uploads correctly remain safe.

KEEP denial for ordinary users. Restore an explicit administrator/operator path
within the existing import lifecycle, following the retained administrator
contract. No retirement or replacement workflow is adopted. A normal file-upload journey
does not validate server-side directory traversal/import or existing CLI callers.

### F09 — Processed Material loses time/device fields; automatic scope also needs proof

Priority: high for time/device-scoped retrieval. Old source-item organizer
`origin()` uses `sourceContentTime` and the original `deviceId`
(`material-organizer-contract.ts` shared origin helper; old
`material-organizers.ts:116–119`). Scoped `publishArtifact`
(`processing.ts:526–534`) instead gives processed Materials only source/external
identity, without `origin.firstAt`, `lastAt` or `deviceId`. These fields are not
merely optional display metadata to the consumers:

- `scope/ask-evidence.ts:117` applies a requested device filter against
  `origin.deviceId` before candidate ordering/LIMIT.
- `:122–123` applies time bounds against
  `coalesce(origin.firstAt,h.created_at)`. A file processed today from an older
  recording/source time is therefore selected by Material creation time rather
  than its original time. Retaining document.recordedAt elsewhere does not repair
  this candidate SQL.
- `memory-data.ts:59–61` falls back to an original's observation timestamp and
  source ID when synthetic evidence lacks these fields; `memory.ts:203` uses
  synthetic capturedAt for contextTime. Provenance may still retain recordedAt,
  so this is not a claim that the model necessarily assigns every event the
  wrong occurrence date.

Trigger: an older recording/file is synchronized and processed today, or a query
selects the original client device. The formal replacement can be omitted from
the original day/device result even though its body is stored and readable by
an exact locator. KEEP source content time, observation time and device scope
independently, and carry the existing authoritative origin projection through
M06 publication and its derivatives. Validate date-bounded/device-bounded lookup
of the real processed replacement before and after restart, not just a direct
record read.

There is a separate automatic-scope completeness risk, not a confirmed universal
regression. New
`processing.ts:117–124` admits a coordinator for almost every accepted original,
including source-item originals; selected archive-only plans and declared parent
attachments have explicit exceptions. Old FileStore, screenshot perception and
Material organizers had different admission owners. New
`memory-capture-materials.ts:40–42` suppresses the old source-item organizer for
an original without attachments so M06 becomes the canonical body producer.
That changes which settings can block ordinary message/Coding/calendar text from
becoming a formal searchable Material. M06 named rules/source-item decoding are
real, but the equivalence cannot be inferred just from sharing a processor.

KEEP saved/processed/indexed distinction, owner source description, source/MIME
rules, and the accepted recording time semantics. Test representative raw text,
Coding, mail/calendar, structured page, screenshots, imported text/image/audio,
reference/archive/snapshot modes with processing automatic/enabled changes,
missing media model and ordinary text model, source corrections, restart and
duplicate ACK. A process-wide setting or archive-only rule must not silently
broaden model work or make a prior non-model source unreadable without a product
decision. This matrix is required validation, not permission to restore old
unscoped data access.

### F10 — Recording phases are shared; the canonical archive contract remains incomplete

The scoped adapter before correction (`scope/connector-recordings.ts:93–107`)
publishes the raw export and individual paragraph source-items and admits the
backup audio as a normal original. Old recorder semantics retained one canonical
transcript/export relationship and did not interpret “back up audio” as permission
for another ASR pass. User authorization for this turn explicitly covers restoring
shared recording business logic and making backup archive-only. The companion
change implements `connectors/recording-flow.ts`; both the legacy recorder and
scoped adapter call its execution and successor plan. This is shared phase
logic, not proof that their persisted business products are equivalent.

The current working-tree correction preserves independent transcript/media
receipts and completed siblings through retry/restart; checks source enablement
before provider reads; consumes each durable discovery page before requesting
its successor; deduplicates repeated IDs within a scan; and revises scoped
evidence when unchanged raw bytes receive changed title, URI or document time
metadata (`scope/connector-recordings.ts:73–156`). The trusted
`recording-audio-backup` disposition suppresses automatic processing admission
without blocking an explicit owner processing request
(`scope/processing.ts:117–124`). Its unprocessed file can be read, played and
exported as a manifest plus
the original audio. Export reads 64 KiB chunks through existing current-owner,
source/head and publication fences (`scope/processing-files.ts:64–81`,
`file-export-tar.ts:13–33`). It does not manufacture a transcript. Static final
delta review found no additional blocking defect in these changes; the audit
author did not independently execute their tests. The companion validation
record owns generated single-/dual-owner, phase-failure, paging, metadata,
backup, authority and restore results and the final affected-component gate.

Accepted MVP scope: the shared flow and trusted backup disposition apply to the
current scoped baseline. The owner explicitly excluded forward compatibility;
historical task-purpose inference, old backup relabelling and queued-work repair
are outside this correction. There is no pending owner choice to pause or
migrate those old tasks. Current-baseline backup intake, its ordinary explicit
processing entry point and existing unknown-result protections remain the
validation contract. No historical processing or repair is claimed.

Remaining contract gap: legacy `FileStore.transcriptRevision`
creates one canonical transcript capture with chunks
(`connectors/recordings.ts:117–124`). Scoped storage still writes a raw export
and individual segment source-items, which M06 can publish as separate
Materials (`scope/connector-recordings.ts:83–93`). The parent's generated
two-recording journey observed four vendor/segment Materials after the
unwanted ASR Materials were removed. This changes the downstream evidence and
Memory input graph; it is not merely account-qualified storage. The existing
simple-context ADR requires one canonical paragraph body while retaining raw
JSON. Follow that shared canonical transcript/archive contract, with exact raw
bytes and segment locators serving the same body. It does not require one
physical database row. Raw/segment storage must not create divergent complete
semantic inputs, and evidence must not be silently deleted to manufacture parity.
The owner's latest instruction selects the existing ADR, not a new archive model.

Concrete remaining revision journey, confirmed by static trace: recording R1
contains two segments; its next provider revision R2 contains only the first.
The expected current transcript has one segment, with the removed tail retained
only as history. The scoped adapter updates `:export` and `:segment:0` but never
withdraws `:segment:1` (`scope/connector-recordings.ts:89–92`). The latter keeps
its independent current source head. `PrivateData.receiveSourceItems` hides
predecessor Materials only when that same external ID is revised
(`scope/private-data.ts:115–118`), so an already processed tail Material remains
visible and eligible for Ask retrieval (`scope/ask-evidence.ts:109–126`). Legacy
`transcriptRevision` publishes one canonical file revision and moves its file
head; current chunk search joins that head, excluding the superseded tail
(`files.ts:120–140,202–210,320`). This is a concrete stale-input consequence of
the archive-shape difference, not just duplicate storage. A two-to-one segment
revision through actual scoped sync and retrieval remains a required regression;
the audit author did not execute it. The shared canonical archive contract
must handle segment replacement, empty/unsupported revisions and retained
history together.

Web/Android currently consume mainly the aggregate recording error; exposing
per-phase state in the server does not prove that users can inspect independent
failures through those clients.

KEEP source discovery range, timestamp/attribution, raw bytes, provider-format
failure, stable revisions, audio-backup choice, independent recovery and no
surprise historical replay. Live-provider/ASR accuracy, native UI behavior and
canonical archive/Memory equivalence remain unverified here. A failed old image
receipt is not evidence that the recording repair recovered it. F13 remains a
separate confirmed decode-failure settlement gap.

The parent assigns canonical recording revisions and F13 to a separate
main/integration workstream. They remain unresolved in this report's `b26e797b`
plus corrective-PR snapshot; parallel work is not counted as delivered here
before its commit is verified in the eventual target.

### F11 — Whole-instance restore adds mandatory reauthorization steps

Priority: whole-instance execution-continuity equivalence remains unverified. The
[M16 design](../design/multiuser-lifecycle.md#stopped-instance-archive-checkpoint)
states that restored Memory/processing automation, plugin instances, connector
sync, outbound MCP and Ask automation remain paused until explicitly authorized.
It also retires old credentials/model/task/plugin authority and clears native
execution targets. Retaining old succeeded/unknown external facts and refusing
blind replay are required and must remain.

The multi-user ADR authorizes safe whole-instance recovery and continuous account
fences; it does not by itself settle every new manual enablement step. This audit
did not recover the earlier human conversation that may have approved M16's
precise reauthorization policy. This remains a documented CHANGE with UNKNOWN
historical provenance and unverified whole-instance resume equivalence. Following
the owner's direction, apply the existing recovery, epoch, grant and unknown-call
ADRs: data restoration does not mint execution authority; successful/unknown
calls are not replayed; invalid or revoked authority is not restored. Keep the
current fail-closed implementation while the gap is open, without adding a new
automatic reauthorization rule or a generic manual-confirmation product. Ordinary
same-instance restart remains separate and resumes still-valid authorized
checkpoints after validation. M16's design record explicitly gives cited ADRs
precedence; its current checklist is not a new independent policy decision.

### F12 — Post-fork main history/equality decisions are pending integration

Priority: high for the eventual combined release; separate follow-up. Main
PR160 was added after the shared `6272a9b5` baseline. Its owner-directed ADRs are
present on `2c262762` and absent from `b26e797b`:

- [Evidence revision and retained dialogue](https://github.com/utopiafar/mote/blob/2c2627621e2598332ae8169845bc7343be7ed63e/docs/adr-evidence-history-retention.md): ordinary supersession marks answers stale while retaining answer/citations/history; privacy deletion still clears them. Scoped `ask.ts:90–94` instead clears an earlier answer after a general evidence validation failure and uses contextStale. The neighboring scoped tests encode the earlier behavior and cannot overrule the later owner decision.
- [Derived-cache Memory retention](https://github.com/utopiafar/mote/blob/2c2627621e2598332ae8169845bc7343be7ed63e/docs/adr-cache-memory-retention.md): changed/removed derived caches retain dependent cards as stale; exact immutable replay is a no-op; direct original deletion remains destructive.
- Normalized evidence equality versus transport-envelope churn is part of that main integration; provider-only changes must not be treated as a new semantic record just because the scoped representation differs.

These are owner-authorized main changes not yet ported, rather than a new M00
policy regression. The parent has identified a separate integration workstream;
this audit does not implement it or authorize duplicating that work. Required
eventual regression: ordinary revision → retained old answer + stale Memory →
restart/follow-up → genuine tombstone/privacy deletion, including exact replay
and recursive derived cache invalidation.

### F13 — A known deterministic recording decode failure leaves an unknown call

Priority: high for processing erasure/recovery; discovered during this turn's
generated real connector/decoder regression, reported by the parent implementer
and independently traced in source here. This is separate from the backup
disposition fix. A DingTalk export with a nonempty unknown paragraph shape is
correctly retained, and decoding correctly reports
`ExecutionFailure('permanent','recording_transcript_format_unsupported')`
(`connectors/dingtalk-recordings.ts:48–54`). Automatic deterministic original
processing reaches the same decoder through
`connectors/original-processors.ts:6–10` and
`scope/processing.ts:496–505`.

`ProcessingHost.io` records an issued call/activity before invoking the local
processor (`processing.ts:557–559`). Its error-settlement test at `:564` accepts
specific ProviderFailure facts, StoreError, ZodError and SyntaxError, but does
not recognize this completed deterministic decoder rejection. The finally block
therefore leaves `mp_activity.state='unknown'` (`:566`) even though this concrete
local parsing operation has ended with a known format result. Domain deletion
then returns `result_unknown` because that row survives (`:548`), and restore
correctly refuses unresolved activity rather than treating it as erased.

KEEP genuine unknown external-call guards and the explicit purpose-bound stopped
worker reconciliation path. Fixing this requires evidence of deterministic/local
completion at the actual boundary; accepting every ExecutionFailure as settled
would be unsafe because that type also represents cancellation, stale grants,
transport uncertainty and other operations. Do not clear unknown rows merely to
make the backup roundtrip test pass. The parent split the backup-only format
roundtrip into a clean fixture; this does not count F13 as repaired.

Required regression: ordinary generated connector → retain unsupported raw bytes
→ deterministic decode rejects → exact physical activity settlement and safe
delete/restore; contrast with a held or lost external transport that must remain
unknown. The audit author did not execute that regression; the parent validation
report owns its failed run and final status.

## Coverage, limits and next validation

This audit read the actual old production assembly and the scoped production
assembly; the multi-user ADR/module matrix; processing, file/source context,
daily-event, system-refactor, Memory review/range, action-first and current main
history/cache decisions; and the owning module parity/design ledgers. It followed
the code paths described in the matrix, including admission exceptions, model
dispatch, formal publication, usage recording, source discovery, retention/GC,
domain import and whole-instance restore documentation. Searches were used to
locate producers/consumers, not as proof that absence of a string proves absence
of a capability. Each confirmed gap above includes the positive path or decision
that its replacement lacks.

The parent also statically traced Desktop `source-sync.ts:199–264`: files,
calendar and Coding keep the same staging/scanning/queue/flush/domain adapters;
account binding chooses the new Ingress/old wire transport and verifies each
owner ACK. No removed Desktop source type was found in that entry. This is
source-level evidence only; native/UI behavior was not re-executed. Server
recording orchestration was a distinct parallel implementation and is the
specific flow being consolidated in this change.

No full application/test suite or product database journey, external model,
physical-device test, private screenshot, real provider, paid replay, import retry,
deployment or production write was run by the audit author. Existing module
reports remain evidence only for their exact SHA/scope. F13 records a generated
failure executed by the parent during the current turn, with independent static
verification of its type/settlement chain here. This is not a statement
that all 17 modules are complete or that every unlisted behavior is equivalent.

The following remain explicitly outside the completed static coverage:

- Frontend/native/CLI control-by-control caller mapping, focus-free UI behavior,
  picker/permissions and offline client ACK journeys: parent/consumer audit.
- Exhaustive provider-specific OAuth, pagination, recorder source semantics,
  native Mem0/Hindsight physical backup/erasure and every installed plugin's
  configuration: owning modules and generated cross-domain journeys.
- Real-model semantic quality/latency, actual OCR/ASR accuracy, provider charging
  details and physical device lifecycle: separate authorized observations.
- Exhaustive pairwise configuration/recipe/provider/state space; F09 lists the
  high-risk combinations that should precede a parity-complete claim.
- Human authorization provenance for every implementation-ledger CHANGE:
  UNKNOWN remains UNKNOWN until an actual owner decision or superseding ADR is
  found. A new requirement must not be inferred solely from “multi-user”.

Confirmed contract gaps do not require the owner to approve their old behavior
again. F01 work/event/Memory-candidate responsibilities, F02 complete accounting,
F05 retention/profile separation, F06 description search, F08 administrator-only
directory import, F09 authoritative time/device fields and F13 deterministic
completion should be restored against the existing decisions. F01 does not
authorize adding action products: its current `actionCues` contract is empty.
F12 integrates already accepted post-fork decisions in its separate workstream.
F09's wider automatic-processing matrix remains validation work.

## ADR-directed disposition and release follow-up

The owner subsequently directed: record unresolved issues, publish after
validation, and use existing ADRs without further confirmation. This removes a
pending owner-decision gate. It does not make incomplete implementations complete
or authorize new paid processing, quotas, automatic historical repair or grants.

| Finding | Existing authority | Adopted follow-up |
| --- | --- | --- |
| F03 retention/capacity | [Request admission](../adr-central-request-admission.md), [multi-user scope](../adr-multiuser-scope.md), existing configuration contract | Restore instance retention and logical-capacity enforcement. Full capacity rejects new intake; do not invent per-user quotas or automatic eviction. |
| F04 semantic retrieval | [Retrieval projections](../adr-plugin-center-memory-replacement.md), [account boundaries](../adr-multiuser-scope.md) | Restore configured scoped embeddings/hybrid retrieval. Disclose current lexical-only coverage; do not mount the old global index or silently enable a paid provider. |
| F07 media/history | [Simple context](../adr-ask-evidence-quality-and-simple-context.md), [file-source context](../adr-file-source-context.md) | Repair new-input relationships and truthful asynchronous readiness. Historical retry/rebuild remains explicitly selected through existing entry points; no automatic backfill or OCR/ASR/Memory replay. |
| F10 recording products | [Simple context](../adr-ask-evidence-quality-and-simple-context.md), [shared flows](../adr-shared-business-flows.md) | One canonical transcript relationship with preserved raw bytes and exact segment locators. Storage may have multiple records without creating different semantic producers. |
| F11 restored execution | [Task recovery](../adr-task-recovery-and-execution-budgets.md), [multi-user scope](../adr-multiuser-scope.md), [shared flows](../adr-shared-business-flows.md) | Preserve still-valid recovery, epoch/grant fences and known external facts. Restored data does not confer authority. Keep current safe behavior while whole-instance continuity remains unverified; introduce neither automatic reauthorization nor a new generic manual checklist. |

F01/F02/F05/F06/F08/F09 and the unresolved parts of F03/F04/F07/F10/F11 remain
implementation or validation follow-ups for the release record. F12 and F13,
and F10's stale-tail withdrawal, are handled in the separate combined integration
candidate; its exact source and checks must be cited before claiming delivery.
No additional owner confirmation is pending for these recorded directions.

## Combined candidate readback

The combined runtime is `6e4032e0ff7a31dbf6528d6703f5d9d8f0b1cc57` (tree
`508a09cb70ec9202aad6225372039446023ef4ad`), a verified descendant of the
corrective branch's runtime freeze `9e9f112c`. Other integration work incorporates
F12's approved history/equality/cache behavior, F13's precise deterministic
decoder settlement, and F10's stale-tail withdrawal while preserving history.
Their source-bound validation, two real Codex Ask runs and declaration-only
correction are identified in the [validation record](../validation/shared-business-flows-2026-10-18.md).
That record retains the full affected command's nonzero result and separately
identifies the passing corrected declaration and supplemental consumer checks.

F01–F11 remain release follow-ups to the extent described above; the shared
recording phases, backup disposition and stale-tail repair do not close F10's
canonical archive/Memory graph or client status gap. This candidate readback is
not a claim about an installed deployment. Commit presence in the actual release
must be verified separately before reporting delivery.
