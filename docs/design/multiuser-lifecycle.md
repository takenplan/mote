# M16 lifecycle and archive boundaries

This work starts at the clean M14 composition `9bc65b53d5823443ad1ecffb49d2c6eecc687927`.
All runtime validation uses generated accounts and disposable directories. The
M12 handoff is not authorized; its interface and final composition are pending.

| Disposition | Original capability | M16 responsibility |
| --- | --- | --- |
| KEEP | Domain export/delete/restore adapters, account epochs, task fences, external journals, fixed plugin releases and existing original layout | Invoke registered adapters through purpose-bound lifecycle grants. Retain unknown external outcomes. |
| KEEP | `npm run backup`, stopped-vault verification, SQLite backup including WAL, checksums, private modes and empty-target staged restore | Extend the existing entry and profile tooling to epoch 5; preserve deployment/account identities and canonical data. |
| CHANGE | Owner JSON v2 and metadata/data export buttons | Portable 3 explicitly identifies the current account, deployment, registered domains and exclusions; no reusable credential is portable. |
| CHANGE | Account disable and domain-local deletion | Durable account deletion revokes before cleanup. Metadata receipts distinguish logical revocation, pending reconciliation and completed physical cleanup. |
| CHANGE | Restore of historical work | Preserve intent, completed work and unknown-result journals. Restore cannot renew old login/task/plugin/external execution authority. |
| REMOVE | Owner/global export/import, owner-private statistics and online whole-instance overwrite in the new production host | No legacy fallback or administrator impersonation. |
| EXCEPTION | Stopped operator instance backup | Contains private account/configuration storage and key material required for consistency; it is not a personal export and has no ordinary-user HTTP download. |
| UNKNOWN | M12 domain contract and final M15/M13/M14 combination | Must be independently composed and validated before M16 completion; no handoff bypass. |
| UNKNOWN | Existing scoped ContentStorage encryption/decrypt, storage/index diagnostics and deployment update controls | Audit the old entry and preserve the intended management boundary; do not fabricate zero state or silently remove capabilities. |

The registry is the extension boundary, not a central list of business branches.
Every registered private domain must provide all three lifecycle hooks. A saved
operation records its exact domain set; a missing hook blocks that operation.
New domains are included by registration, including plugin-owned domain data.
Deletion ordering must retain provider/configuration dependencies until their
dependent erasures are settled. External `pending`/`result_unknown` never means
erased. Disabling an account does not itself promise deletion.

Personal import is a canonical-data merge/dedup capability, distinct from whole
instance recovery. The old v2 shape cannot be silently accepted as portable 3.
Validation of all sections and cross-domain parents must precede publication or
use a recoverable staging/transaction boundary; partial restoration must remain
inaccessible. No personal point-in-time restore feature is added.
