# ADR: Shared business flows and account-scoped hosts

Status: accepted, 2026-10-18. The owner explicitly requested removal of the
internal 20,000-character Agent guard and duplicate Coding contracts, one
business flow with account isolation, a comparison of the old and new paths,
and no automatic ASR for recording audio backups.

## Decision

An installation with one account and an installation with several accounts use
the same business procedures. Account identity changes authority, configuration,
storage namespaces, task ownership and publication fences. It does not select a
different interpretation, processing scope, recovery rule or product producer.
Domain procedures accept already-bound ports; they do not choose a default
owner, hold a global private Store or create another scheduler. The scoped
production composition remains the only production baseline. The old builder
remains an isolated characterization fixture, never a single-account fallback.

The recording domain shares discovery windows and pagination, account and
recording identity checks, selection filtering, transcript export outcomes,
independent audio backup and phase successors. The legacy host adapts its
existing durable execution steps and archive, while the account-scoped host
adapts M05 and its own journal and M03 archive. Both execute `RecordingFlow`.
Metadata, transcript and media failures retain independent stage facts; a
successful sibling cannot erase another stage's error. Existing configured
network acquisition recovery policy remains authoritative. Each durable discovery
page starts its existing recordings before awaiting later pages; duplicate IDs
within a scan do not repeat completed phases. Metadata corrections create a new
source revision even when export bytes are unchanged. Source withdrawal fences
provider reads, and re-enabling the source allows the existing explicit retry.

Saving a provider's audio backup does not request ASR. The trusted host tags
that original as `recording-audio-backup`; this is a transport disposition,
not a classification of user text. Intake retains its bytes and makes it
available to Files, playback and original-record navigation without admitting
automatic processing. An explicit owner processing request still uses the normal
account-scoped audio pipeline and unknown-result protections. Ordinary uploaded
audio retains its configured automatic processing, even if caller-supplied
metadata uses the same words. The disposition survives data export/restore,
which does not restore execution authority.
For a backup without processing products, Files export contains its manifest and
the retained original bytes, with the same owner/source checks during streaming.
It does not manufacture a transcript to satisfy the former export prerequisite.

The owner explicitly clarified that this is an MVP with no compatibility work
for older versions. The current baseline does not add historical task-purpose
inference, format migration, a startup repair pass or a special retry protocol.
Current-version restart, data restoration and explicit owner processing retain
their existing authorization and physical-result protections. The old host is
only a characterization fixture for the shared domain contract. Scoped work
stores the three required current phase receipts directly; aggregate display
errors are derived from them, without old boolean mirrors or inferred receipts.

Internal Agent `question` retains its nonempty contract but has no arbitrary
20,000 UTF-16-character cap. External HTTP schemas keep their own input
contracts. Actual provider input/output capacity, protocol byte boundaries,
authorization, cancellation and execution deadlines still apply. A local input
contract failure is permanent with `executionStarted:false`; a native capacity
rejection remains a permanent processing-limit result. Neither is retried as
a temporary provider failure. The complete Coding coverage contract is passed
once through its existing task context, with no reduction of original evidence,
authorized ranges or independent-review responsibility.

## Supersession

| Disposition | Contract |
| --- | --- |
| KEEP | Clean original Coding dialogue, exact evidence ranges and coverage, model interpretation, independent Memory review, actual transport/model limits, privacy and unknown-result fences. |
| KEEP | Provider transports/decoders, one production executor, account-bound credentials/configuration/workspaces and every across-await publication check. |
| KEEP | Original recording export, empty versus unsupported versus not-ready outcomes, independent audio backup, existing explicit processing and successful-stage reuse. |
| CHANGE | Recording hosts call one domain flow instead of independently implementing business transitions. Private persistence and authority remain host adapters. |
| CHANGE | Internal Agent input validates its actual contract; the obsolete 20,000-character field rejection is removed from both runtimes. |
| REMOVE | Duplicate Coding coverage instructions; generic retry classification of an invalid local request; automatic ASR caused solely by backup intake; shared error fields as the only record of independent stage failures. |
| EXCEPTION | Old fixture storage and execution-step representations need not migrate to the scoped schema. Their observable domain contracts still require parity. |
| EXCEPTION | This rollout does not initiate historical reprocessing or erase past results, fees or unresolved calls. No old-vault migration or deployment is implied. |
| REMOVE | Extra compatibility work for earlier task records, including purpose inference, startup format repair, a second origin journal and special owner-retry transitions; the owner's MVP clarification supersedes that proposed work. |
| UNKNOWN | Other scoped business differences remain findings in the audit, not accepted removals or claims of equivalence. Real suppliers/models and physical-device behavior need separate evidence. |

This completes the internal-input cleanup in the
[simplified-context decision](adr-ask-evidence-quality-and-simple-context.md),
applies the existing [Memory batch context](adr-memory-batch-context.md)
representation to Coding, and reaffirms the no-ASR-fallback boundary in
[recording outcomes](adr-recording-outcomes-runtime.md). It refines the
[multi-user scope ADR](adr-multiuser-scope.md) by making shared business behavior
explicit; none of its identity or data-isolation requirements is weakened.

## Audit and validation

The [business-flow comparison](audits/business-flow-parity-2026-10-18.md)
separates approved identity changes, post-fork main changes, confirmed missing
responsibilities and unresolved behavior. Finding a difference is not permission
to silently adopt it. This corrective change does not claim that all audited
gaps have been repaired.

The [validation record](validation/shared-business-flows-2026-10-18.md) identifies
generated adapter, recording, restart and backup/explicit-ASR journeys, failed
attempts, the required affected-component check and unperformed live checks.
