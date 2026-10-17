# Scoped file-processing page: limited interface checkpoint

Declared limited backend/consumer checkpoint:
`5030430002bd9971d481c8b1ba4c235ab45b6c26`. This extends prior
`a2cbf3aaf1ae2f2fbfe5f647cf9a4f23dfdc1695` with saved/default explicit profile
entry points, saved local health and the minimal reviewed applied-plan personal
archive module. Own18 bounded profile/health/direct-consumer checks, account
physical-deletion health journey, Server/scripts/scope and strict selected test
noEmit passed. Independent bounded review of the new profile/health delta is
pending. This is PREP for listed routes, not a whole M06/final joint freeze.
Do not use a later arbitrary HEAD as a test dependency.
The original file-processing page, names, source/MIME rules, explicit preview
and explicit reprocessing are retained. The same M04 configuration transaction,
M03 originals, shared processor registries and M05 executor remain authoritative.
There is no second endpoint/key store or per-account runtime.

## Read and save

`GET /api/file-processing` returns:

- `revision`: decimal string for the same personal M04 revision.
- `settings`: complete scoped processing settings, including enabled/automatic,
  timeout/audio limits, summarization/turn/understanding defaults and speaker
  settings. Endpoint and key fields are absent.
- `policy`, `policyConfigured`: the original version1 graph, or an unsaved
  preview derived from actual current selections when no graph was saved.
- `models`: `{personal,shared,selections}` from M04. Personal profiles contain
  redacted settings; shared connection metadata is read-only.
- `processors`, `execution:'central'`, `runtime:'cordis'` and `capabilities`.
  Existing file recipe capabilities remain at their original keys; image recipe
  capabilities are separate under `capabilities.image`.

`policy.services` contains only
`{id,name,kind:'asr'|'image'|'file'|'model',reference:{kind:'personal'|'shared',id}}`.
A service never contains endpoint/key/model copies. An omitted analysis
modelServiceId retains the original explicitly configured account file-model
selection; a declared missing reference never substitutes another connection. Profiles retain the existing
processing-profile schema: id/name/processorId/parameters, optional serviceId and
modelServiceId, diarizationProcessor/summarize and optional imageRecipe. Rule
shape is `{sourceId?,type,profileId}`; a source-independent `*/*` fallback is
required. Existing source/MIME specificity and processor parameter validation
are reused. Missing connections remain explicit blocked work, never a fallback
to another account or a global model.

`PUT /api/file-processing` accepts
`{revision,settings,policy,models?}`. Optional models is a complete personal M04
`{profiles,selections}` value. All provided domains replace together at one CAS
revision; a no-op need not increment it. The existing M04 stable-profile-ID
masked-secret booleans retain their exact saved secret. Invalid values reject
before publication; stale revision409. Shared connections cannot be edited here.
The return value is the current redacted GET shape. Never place a display boolean
into a different profile or synthesize a new endpoint/key pair.

`POST /api/file-processing/match` accepts `{sourceId,mimeType}` and returns
`{rule,profile,services,fingerprint,archiveOnly}` for the current saved/default
graph. Matching does not admit work or grant model access.

## Preview and explicit reprocessing

`POST /api/file-processing/preview` accepts
`{revision,sourceId?,type?,profileId?}` (`type` defaults to `*/*`). It returns
`{token,revision,count,skipped,bounded,items:[{id,title,profileName,rule}]}`.
The same Files owner/head/enabled-source/attachment projection is used, with
source/MIME filters before LIMIT. Original limits are retained:1000 scanned,
100 selected,20 live previews per account,10-minute expiry. Archive-only,
unavailable-original and physically running files are skipped. Capacity/expiry
stress and complete rendered integration remain unverified at this checkpoint.

`POST /api/file-processing/reprocess` accepts only `{token}`. It checks owner,
account epoch, configuration revision and current file proofs before any mutation.
It returns `{queued}` after one synchronous existing SQLite transaction admits
all selected work. Changed/expired/foreign/consumed preview409. A failed batch
rolls back every admission and keeps the preview retryable. Successful reprocess
consumes the preview; a lost successful ACK requires a new preview rather than
silently replaying an old operation. The original explicit reprocess action
acknowledges unknown old outcomes through the existing file retry mechanism;
it does not settle earlier external facts. A still-live request remains blocked.

## Processing and lifecycle boundaries

Named source/MIME/default rules and original-only archive apply at new trusted
admission. Completed results and per-file cancellation are retained across saves.
Changed unfinished work receives a fresh existing M05 coordinator/grant. Global
disabled work stays genuinely blocked with `processing_disabled` and zero
attempts, including newly accepted automatic originals; restart/enable does not
revive per-file cancellation. No model child executes while disabled.

## Explicit profile selections

The existing root upload revision `processingProfileId`, Imports
`imageProfileId`, and POST `/api/records/:id/attachments/:attachmentId/processing`
`{processingProfileId?,mimeType?}` now bind the selected profile before ordinary
automatic admission. Preflight uses current M04 outside SQLite; owner, source,
head, retained parent/archive/object and profile binding are rechecked before
publication. Root commit and attachment duplicate ACKs preserve their existing
plan. Missing parent404, unknown profile409 and reference-only conflict remain
failures, without publishing a new capture or task.

Profiles may come from the saved named graph or the displayed unsaved current
M04 defaults. Selecting a default does not silently save a policy or borrow a
shared/person B connection. Original default IDs `central-image`,
`profile.audio.local-dialogue`, `profile.audio.http`, `profile.text.utf8` and
`profile.document.generic` remain explicit aliases to those processor choices;
`archive` remains itself. Editor rows are not duplicated for aliases. An
unfinished explicit default plan can resume under a fresh coordinator when its
current connection becomes available. Completed/cancelled files stay retained.

Imports override only signature-confirmed image media. Audio in the same batch
keeps its own MIME rule. Preview remains private and unprocessed until explicit
confirmation. Archive-only media reports `processing.required:false`,
`state:'skipped'`, `stage:'archive'`, with no fabricated successful OCR, searchable
text or Memory completion. Media progress `required` is optional for older data.

## Saved local service health

POST `/api/file-processing/test-local` accepts only `{serviceId?:string}` and
returns the original `{version:number,execution:'local',asr:boolean,
diarization:boolean,wespeaker?:boolean}`. An explicit service must be a saved ASR
service pointing at a complete current M04 connection. With no serviceId it uses
the current ASR selection; unsaved default `asr-local`/`asr-api` refer to that same
selection. Endpoint/key request fields are rejected. Only a mote-media loopback
connection is probed, with GET `/health`, the existing10s/4096-byte bounds and no
inference/upload. Nonloopback configuration rejects400 before any transport.

One existing-executor `processing.health` control task records the physical
issuance and M06 activity. A response held across logout cannot return to the
retired request. Account deletion waits on actual pending physical work; its
exact late completion may settle that issuance before physical cleanup, without
restoring any task grant or returning a retired result.

## Personal applied-plan archive and remaining limits

The optional processing-v1 `policyPlans` section retains immutable plan history
and bindings for same-instance/original-account data merge. Current target
settings, binding and controls win; no task/grant/preview/unknown fact is imported
or settled. See [the module contract](multiuser-policy-personal-archive.md).
Reviewed owner production77 plus its mechanical prepare→preflight naming fix are
composed; Joint's own27 archive plus4 then-current profile cases passed31/31.
New defaults/health have separate checks and are not retroactively assigned to
that31-case receipt.

These retained capabilities remain OPEN:

- Non-default installed image-recipe execution.
- Shared-instance/default-model change observation and component-version startup
  reconciliation beyond explicit current-owner M04 saves.
- Complete downstream-only stage reuse beyond the verified raw ASR/speaker case.
- Final same-SHA compiled/client/native/backup/Hindsight union, whole affected
  gate and final joint PR.

a2cb verifies raw-stage reuse for downstream-only speaker changes, connection
change invalidation and explicit full reprocessing. Those execution receipts
are separate from27706804 and do not close all remaining recipe/lifecycle rows.
Current bounded evidence and historical failures are recorded in
[the joint validation ledger](../validation/multiuser-joint-validation.md).

## Custom image recipe products (narrow candidate, not final union)

Installed non-default image recipes use the existing versioned ImageRecipeRegistry
and the same M05/M06 executor. Each named step pins its exact recipe fingerprint,
owned original, accepted dependency artifact hashes and current file/configuration
fences. OCR stages keep actual transcript artifacts. Understanding/derived stages
retain a typed `mote-image-product-v1` artifact with the exact original digest,
encoded pixel dimensions and complete interpretation/regions; they publish
separate `image-interpretation` Material, never fabricated OCR text. Empty region
descriptions remain in the typed product. A recipe may legitimately have no OCR.

`processing.derivations` exposes named outputs (`image:<name>` or
`image-ocr:<name>`). `processing.indexed`/`index.material` can be true from such a
visible product while primary extraction `artifactId`/`materialId` are absent;
consumers must use that derivation's explicit Material/artifact identity. An
original that never ran OCR has no `rawArtifactId`. Previously accepted exact OCR
can remain retained raw history after explicit recipe replacement, even when its
current primary Material is retired. Removed named outputs are withdrawn from
current reads without erasing accepted versions. Existing source/original privacy
withdrawal still fences every output.

An interpretation without an OCR Material parent supplies Memory only the
existing authorized-original-image navigation anchor: the interpretation's text
is not original Memory evidence. The existing `read_image` capability must inspect
actual pixels. Data-only recovery validates typed body hashes, original hashes,
plan ownership and accepted Material dependencies; it restores no old task grant.
This candidate still requires bounded independent review, affected consumer
checks and the final composed gate before whole capability acceptance.

## Shared dependency recheck (owner-approved B, bounded pipeline scope)

The shared M05 host may derive a fresh `processing.recheck` control grant only
from an actual, same-owner, nonrevoked unfinished `processing.pipeline` intent.
The old grant is never restored into a context. The recheck's ordinary running
M05 lease supplies its new non-administrator TaskRun context; the normal user task
submission API explicitly rejects this kind. There is no userId/context mint API.

Admission compares the applied plan's actual shared-resource generation hash,
then checks account epoch, current original/head/source, per-file/original and
attachment incarnation, cancellation, and unresolved physical issuances. Identical
notifications dedup by intent and instance revision, including after restart.
Fresh M04 dependency resolution binds its callbacks to that genuine recheck
context. The control task performs no provider/model call or model lease; any new
processing coordinator obtains its own fresh M04/M05 admission. `intentTaskId`
retains the original intent's cancellation/revocation chain for the new work.
Completed units, unknown calls, privacy withdrawals, deleted files/accounts and
unchanged references do not replay. This finite freeze covers unfinished root
pipelines; already completed extraction followed by a separately failed derivative
is not claimed closed by this matrix and remains an explicit next acceptance seam.
