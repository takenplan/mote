# Multi-user integration with the main evidence lifecycle

Date: 2026-10-17. Status: implementation under validation.

The owner requested merging `codex/mote-multiuser-integration` into `main`,
resolving conflicts and repeating the complete regression. The production entry
point remains the scoped composition from [M00](adr-multiuser-scope.md). The
single-owner composition remains an explicitly imported algorithm fixture.

## Responsibilities preserved across the merge

| Disposition | Decision |
| --- | --- |
| KEEP | Deployment/account ownership, real credential verification, durable M05 grants, private provider credentials, strict current original/citation reads, epoch-5 server storage and wire protocol 2. |
| CHANGE | Port main's retained historical dialogue lifecycle to production M08 and normalized provider revision handling to the scoped connector adapters. A textual merge into the legacy fixture alone does not deliver these behaviors. |
| REMOVE | Ordinary evidence revision as implicit historical prose deletion; cache identity as the sole historical privacy dependency; test scripts that pretend a wire-1 server proves the wire-2 client. |
| EXCEPTION | Explicit deletion, original expiry, logical item tombstones and explicit Material retirement continue retracting dependent history. Current access restrictions still block disclosure. Unknown lineage remains unavailable; no original or model authority is fabricated. |
| UNKNOWN | Old data already erased cannot be recovered. Real-provider behavior, model quality, physical devices and operating-system permission prompts require separate checks. An old Gmail head with neither a retained raw original nor a raw fingerprint cannot prove equivalence; its first observation remains a conservative revision. |

## Scoped historical dialogue

This applies the existing [history decision](adr-evidence-history-retention.md)
to `scope/ask.ts`. Owner-bound host receipts record retained source, original and
Material incarnations, including recursive Material inputs and prior dialogue.
They remain internal to the host. They grant no original read, citation, tool,
task lease or model permission.

Ordinary Material/source changes retain the original answer and citations with
`evidenceStale`/`contextStale`, clear affected summaries and change the conversation
revision. A temporary hidden Material projection during reimport is ordinary
withdrawal. Explicit retirement uses a separate durable event; it cannot be
inferred from that temporary visibility floor. Current Material source exposure
is checked even when the answer refers to an earlier revision.

Persisted SQLite triggers retract affected turn prose, summaries, run results,
artifacts, traces and model checkpoints on destructive evidence transitions.
Inherited-only followups keep the original privacy roots even when they acquired
no new evidence pins. Source tombstones cover every retained generation.
Recreation with the same public ID does not revive an erased answer. SQL triggers
do not require connection-local JavaScript callbacks and participate in the
writer's transaction.

Deleting a disposable M07 evidence anchor marks dependent history stale and
withdraws its persisted summary and prepared conversation revision before the
anchor lineage disappears. It preserves the answer and retained root receipts;
cache removal alone does not become privacy deletion.

Before execution starts, M08 backfills unread pre-receipt turns from their
canonical retained graph, in owner-bound transactions and conversation order.
It does not mint user contexts or grants. An unavailable graph is not guessed;
existing access restrictions can continue to block it without being reclassified
as owner-requested retention deletion. Measured activity retains its preexisting
metadata-only handling of redacted records; content reads and citations keep
their stricter checks.

Conversation revisions now represent snapshot changes as well as publications;
`turnCount` is the actual turn count. Historical-page cursors bind the revision,
so a delayed older response cannot restore a retired view. Web and Android check
`evidenceDeleted` before looking for a result, because a deleted wire-2 turn
intentionally omits its result.

Turn/run evidence tuples use exact JSON set semantics when inheriting prior
dialogue and when validating existing repeated tuples. Otherwise each turn
recursively copies all earlier inherited copies and proof work grows
exponentially. This coalesces only complete identical values; different hashes,
receipts, source incarnations, read kinds and immutable Material revisions keep
their independent strict validation. It adds no semantic equivalence rule.

## Personal export and recovery

Ask exports remain data only. Recovery validates owner/deployment, canonical
retained hashes, declarations, recursive parents and complete ordered turn
prefixes. It rebuilds host receipts from those parents rather than importing
authority. An omitted predecessor cannot turn an inherited answer into a
rootless answer. Run and artifact recovery uses the conversation closure and
does not recreate tasks, snapshots or model calls. Erased turns roundtrip only
as empty erased receipts, and erased completed run products are omitted.

Memory retains the scoped M07 lifecycle: changed interpretation inputs mark
records stale and default discovery excludes them. The existing human audit
read path still requires retained authorized roots. This does not claim physical
provider/Memory body erasure merely because a read is blocked. The legacy
EvidenceArchive algorithm continues to follow its separate
[cache/Memory decision](adr-cache-memory-retention.md).

## Provider revisions and clients

Lark's counter-only document transport fields and Gmail's top-level `historyId`
do not change exact normalized evidence. Unknown Gmail raw MIME fields, content,
attachments and actual A→B→A changes remain revisions. Scope, encrypted vault
ownership and immutable original metadata remain intact.

Appearance uses main's semantic roles, synchronous first paint and device-local
preference across the scoped account lifecycle. Theme transport does not grant
retired documents access to private IPC. Existing navigation and account
generation guards remain in place.

The profile CLI uses the public scoped `/api/health` contract, without a retired
owner credential, so native startup works before the first account is created.
The old `/api/status` owner route cannot establish scoped deployment readiness.
Current `test:profiles` exercises real scoped profile startup; the old Wire-1
profile journey remains explicitly named `test:profiles:legacy-wire1`. Recovery,
upgrade/rollback, logging and private-data journeys are recorded separately in
the current regression matrix rather than inferred from the old fixture.

Durable regression scenarios live in `multiuser-history-retention.test.ts`,
`multiuser-history-independent-review.test.ts`, scoped connector tests, native
history instrumentation and the current wire-2 browser runners. Historical
validation reports keep their original scope and results; a new integration
report records this merge's actual executions.
