# ADR: Lifecycle parity on the scoped host

Status: accepted for the parity implementation, 2026-10-18. Acceptance of the
implementation and its composed runtime remains a separate validation gate.

## Decision and provenance

The owner requested functional parity with the usable single-owner baseline
`2c2627621e2598332ae8169845bc7343be7ed63e`, using the current scoped wire and
storage formats. The delegated parity discussion confirmed two decisions:
personal full export remains one generate-and-download action without central
download history, and trusted password relogin after whole-instance restoration
resumes future policy with fresh authority without further per-domain approval.
These decisions refine [multi-user storage and recovery](adr-multiuser-scope.md)
and supersede the pending L06 choice and retained portable artifacts described
by earlier [M16 checkpoints](design/multiuser-lifecycle.md).

## Supersession

| Disposition | Decision |
| --- | --- |
| KEEP | Domain-owned adapters, full retained originals, private account boundaries, one executor, current formats, strict retention cutoff, existing instance capacity setting, successful cursors, cancellation facts and unknown external journals. |
| CHANGE | Run retention/GC for database-owned accounts at startup and hourly without a login session. Enforce the shared logical storage ceiling in the scoped write path. Use exact observed owner dependencies for portable consistency. |
| CHANGE | Deliver the current full portable archive directly through `GET /api/export`. Retain only progress/audit metadata and no central archive body. |
| CHANGE | Store future restore intent separately from authority. Only trusted password login admits the current account/restoration task, whose running grant enables fixed domain recovery ports. |
| REMOVE | Export start/history/content/retry HTTP endpoints and download artifacts attached to old receipts. Remove blanket disabling of future processing/Memory/Actions/MCP settings and mandatory per-domain reapproval after restored password relogin. |
| EXCEPTION | Explicit capture deletion, retention and final Imports deletion journal same-vault capture IDs. Source removal does not acquire a new journal policy. File forgetting retains its separate blocked/generation/allow-again contract. |
| EXCEPTION | Paused/stopped/disabled policies and newer explicit user choices remain authoritative. Restore retires old credentials, grants, leases, target/device authority and plugin snapshots; old pending/unknown work and OAuth flows are never replayed. |
| UNKNOWN | Production-scale cost, physical devices, live providers and composed deployment behavior need their own evidence. Generated fixture results do not establish them. |

## Responsibilities and consequences

Domain adapters continue to own data projection, merge, deletion and capability
checks. `PrivateSql` records owner-qualified reads; direct SQL adapters explicitly
record their portable projection. The host checks witnesses, current authority,
configuration and registry identity at final publication. An unrelated account's
write or task progress outside the portable projection is not a conflict.

A direct export owns bytes only for its request. Clients verify the complete
response before publishing a file and retire a late response after account
switch. A destructive canonical transaction fences subsequent stream chunks;
snapshot deadlines remain effective even if maintenance has not run. A user-held
offline archive is outside server erasure. No export count, latest-copy or TTL
policy is introduced. Import retains its existing receipt/control journey.

Host maintenance binds one canonical account/epoch at a time. Physical GC keeps
current pins and unresolved activity, including processing with an unknown
external result. Only actual file revisions are excluded from ordinary capture
retention; a generic item's declared `kind: file` is insufficient. The shared
ledger counts logical payloads and resident originals/staging; indexes, WAL and
encryption overhead keep their existing separate boundary. Staging promotion
and same-owner hash deduplication do not reserve the same bytes twice. Physical
snapshot eviction releases capacity while keeping unavailable original metadata.

Stopped restore creates no live authority or runtime. It records a restoration
identity and policy intent per account, advances account/domain epochs, and
retires old execution. A successful password login admits one durable future
coordinator. Plugins undergo actual current configure/check/enable; connector
timers honor current auto-sync policy and provider cursors; Actions and Ask use
fresh generations and skip the backup frontier. This coordinator cannot issue
an old native effect, retry an old unknown request or grant device/target rights.
The [current design](design/multiuser-lifecycle.md) and
[validation ledger](validation/parity-lifecycle.md) record implementation and
journey coverage separately from this decision.
