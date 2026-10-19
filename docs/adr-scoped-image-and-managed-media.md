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

The image limit is enforced by M05's host-only capacity partition, across the
existing processing pools. The partition key uses trusted ownership and the
validated declared stage kind. A genuine image-stage parent and its exact
physical OCR/understanding child share one capacity unit; the child binding is
read back from the same owner's durable task metadata. Each owner's OCR,
understanding and derived kinds independently use the current 1–8 setting.
Image pipeline coordinators do not impose a second fixed total. This supersedes
the temporary shared 2/4 pool ceilings and the separate Perception row-count
admission gate, which could not enforce the original settings consistently.
Unconfigured pools keep their original limits. Existing instance model gates,
managed/custom local listener resource keys, cooldowns, user fairness, durable
leases and publication fences still apply. Lowering a limit leaves issued work
intact and delays new units; local execution promises still settling count
alongside durable leases. Existing cancellation, physical cleanup and unknown
external-result rules are unchanged. No public DTO or storage schema
changes, capacity migration or second scheduler is introduced.

Intake idempotency follows the retained original incarnation and attachment
binding, rather than the transport batch. Redelivering an acknowledged original
does not retry a failed task, refresh its grant, or start another image/Memory
interpretation. Explicit retry/recompute remain separate owner operations. A new
allowed original incarnation or attachment binding can admit its own task.

A retired task can still have a known local HTTP transport in progress. M06
records only its actual opaque listener key until that transport settles. The
host-only M05 `processingResourceKeys` port checks the real task's owner/grant
and returns only the processor keys already pinned by its M04 lease. Admission
waits on the same known local listener, using the existing availability recheck;
publication retirement never becomes evidence of physical completion. This adds
no task authority, public DTO, scheduler or persistent format. Existing durable
resource locks, worker busy responses and unknown-external-result rules remain
responsible for their existing boundaries; this local fact is not a distributed
worker-completion claim.

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

Image understanding retains the original recipe's optional OCR semantics. A
current, trusted blocked/failed/cancelled OCR child may lack a product; its
optional consumer can still inspect the original. Pending/stale dependencies,
unresolved external calls and retired root/source/account grants cannot grant
that permission. The default successful OCR publication and automatic derivative
flow stay intact; its missing-OCR path uses the existing scoped image-stage and
understanding ports. Default interpretations keep `image`, and custom products
keep `image:<step>`. Completion renews unfinished OCR while retaining accepted
interpretations with their actual dependency receipts, including an originally
absent optional OCR. The root retains the original unfinished OCR failure after
independent interpretation publication, so Files and managed-readiness recheck
keep their existing states and recovery authority. Late OCR does not
retroactively become the interpretation's input. OCR seed
evidence remains complete, range-accurate and untrusted; the model harness's
existing hard limits remain explicit failures. See the
[optional OCR regression record](validation/image-optional-ocr-2026-10-19.md).

| Disposition | Boundary |
| --- | --- |
| KEEP | Original image defaults, future profile selection, explicit historical complete/recompute, receipt proof, current evidence fences, private account configuration, one M05 engine, pinned asset catalog and existing worker supervisor. |
| CHANGE | The image controls adapt M04/M05/M06 instead of the legacy composition; host capacity units restore the original owner/kind limits across physical child pools; media assets have instance scope and administrator mutations; managed readiness can resume genuine unfinished processing intents through the existing recheck handoff. |
| REMOVE | Missing production perception routes, shared credentials copied into account settings, separate legacy image queues, accidental shared 2/4 image ceilings and duplicate row-count admission, a requirement to manually retry an image after installing its selected missing managed model, and raw historical-image SQLite positions in public task progress. |
| EXCEPTION | A derived endpoint is displayed for the selected account model reference. Endpoint/processor edits use the existing File Processing connection/profile controls; the image page cannot mutate a shared instance credential or create duplicate endpoint authority. |
| UNKNOWN | Real weights, real OCR/ASR quality, physical-device behavior, deployment/runtime installation on the owner's host, and integrated client/full-gate results until separately performed. |

Other task kinds retain their declared public progress unchanged; the host projection
is opt-in by known task contract and has no owner selector or execution capability.

The settings are canonical account configuration and participate in its existing
portable export. Historical preview tokens are transient. Historical execution
cursors are not portable execution authority; stopped instance backups retain the
current cursor tables, while native/portable recovery keeps M05's existing grant
retirement rules. SQLite cursor/watermark positions stay private; only the account's queued count
and actual M05 task state are exposed. A pure handler-declared M05 public-progress
projection applies to persisted metadata too and remains after execution handler
retirement, service restart and source retirement/forgetting; hiding one route or changing only new writes is insufficient. It
rewrites no stored data and grants no execution. Global row positions are not account
progress or evidence of another account's activity. A cursor's displayed task
state comes from M05, including failure
or retirement. Account/domain deletion removes the cursors and previews. Existing
vault repair, compatibility paths, real weight downloads and historical replay
are outside this assignment.

This supersedes the earlier scoped-host omission of perception/managed-media
controls. It preserves the account/resource and recovery boundaries in the
[multi-user ADR](adr-multiuser-scope.md) and the
[processing reliability decision](adr-scoped-processing-reliability.md).
