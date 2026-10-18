# Scoped image controls and instance media assets

The 2026-10-18 Files parity assignment restores the original ImageProcessing
controls and MediaAssets journeys in the shared host. This records the adapted
responsibilities; validation and remaining integration gates are recorded in the
[Files regression record](validation/parity-files-2026-10-18.md).

Image processing uses the existing M04 account configuration, M05 execution and
M06 processor/recipe runtime. It does not mount the legacy ImageProcessing host.
The independent image switches retain their original defaults: enabled and
understanding enabled, concurrency 1 within 1–8 per declared image stage kind, provider revision `1`, external
OCR disabled, and query original-image disclosure disabled. The selected image
profile and endpoint come from the existing file policy and actual selected model
reference. Saving the image profile changes future admissions. Existing bound
plans stay exact, including unfinished images; changes to image execution flags
reconcile unfinished authorized work against that existing plan. Completed images
require explicit complete/recompute, and a provider revision participates in image
cache/receipt identity for newly executed work. Already accepted steps remain valid
for completion; completed images require explicit recompute. The separate file
automatic switch is unchanged. Image tasks retain the executor-validated stage
kind for pool accounting even if installed capabilities later change. Unsupported
current task inputs retire; they are not reinterpreted or migrated.

Historical preview reads only current owned image metadata and accepted receipts.
It binds a source/time query, inclusive `after`, exclusive `before`, account epoch,
fixed original-row watermark and ten-minute token, with at most twenty previews
per account. Confirmation creates an ordinary durable M05 orchestration task.
Its existing M06 retry ports submit pages of 200, checkpointing each admission
and yielding during long pages so execution leases remain renewable. It checks
current source, attachment, head and account authority again at execution. A
consumed, expired, foreign-account or old-epoch token grants no work. Startup and
profile/model installation never create a historical scan.

MediaAssets and the pinned MEDIA_CATALOG are shared instance resources. Existing
central-runner/dev-server media-worker supervision remains the only supervisor;
workers can start before models exist and observe later explicit installation.
Health distinguishes installed weights from a ready authenticated runtime.
Install, cancellation and local-bundle import require an administrator. The
shared installer retains pinned size/hash checks, range resume and atomic
publication, adds role exclusion across hosts sharing the same directory, and
preserves stopped failure/cancellation state without starting downloads on restart.
Only an exact selected managed endpoint receives its fixed instance worker
credential. Installation selects no account service, changes no account model
configuration and grants no access to user evidence.

A missing managed model blocks an already authorized processing intent before
physical I/O. Once installed, the existing fixed M05 `processing.recheck` handoff
can resolve that intent's actual M04 reference under a genuine retained grant.
Only an exact ready managed binding is resubmitted against the current original
and bound plan; unavailable workers remain durable waiting. This handoff does not
revive cancelled/completed work, settle unknown calls, or create an ambient owner
context. Instance media status exposes neither credentials nor host directories.

| Disposition | Boundary |
| --- | --- |
| KEEP | Original image defaults, future profile selection, explicit historical complete/recompute, receipt proof, current evidence fences, private account configuration, one M05 engine, pinned asset catalog and existing worker supervisor. |
| CHANGE | The image controls adapt M04/M05/M06 instead of the legacy composition; media assets have instance scope and administrator mutations; managed readiness can resume genuine unfinished processing intents through the existing recheck handoff. |
| REMOVE | Missing production perception routes, shared credentials copied into account settings, separate legacy image queues, and a requirement to manually retry an image after installing its selected missing managed model. |
| EXCEPTION | A derived endpoint is displayed for the selected account model reference. Endpoint/processor edits use the existing File Processing connection/profile controls; the image page cannot mutate a shared instance credential or create duplicate endpoint authority. |
| UNKNOWN | Real weights, real OCR/ASR quality, physical-device behavior, deployment/runtime installation on the owner's host, and integrated client/full-gate results until separately performed. |

The settings are canonical account configuration and participate in its existing
portable export. Historical preview tokens are transient. Historical execution
cursors are not portable execution authority; stopped instance backups retain the
current cursor tables, while native/portable recovery keeps M05's existing grant
retirement rules. A cursor's displayed task state comes from M05, including failure
or retirement. Account/domain deletion removes the cursors and previews. Existing
vault repair, compatibility paths, real weight downloads and historical replay
are outside this assignment.

This supersedes the earlier scoped-host omission of perception/managed-media
controls. It preserves the account/resource and recovery boundaries in the
[multi-user ADR](adr-multiuser-scope.md) and the
[processing reliability decision](adr-scoped-processing-reliability.md).
