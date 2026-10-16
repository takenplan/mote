# M16 lifecycle acceptance ledger (in progress)

Baseline: M14 clean composition `9bc65b53d5823443ad1ecffb49d2c6eecc687927`.
Independent clone: `task-20/mote`; branch `codex/mote-multiuser-m16-lifecycle`.
No original user data, deployment, integration/main or disabled CI was changed.
The execution host reports `guangmodeMac-Studio`; other module workspaces are
locally visible. The requested parent thread was unavailable to the app messaging
tool (`thread not found`); no report is claimed delivered by that attempt.

## Initial evidence

At production parent `9bc65b53`, RED commit
`e30e7b71d9606a9e3fea526cd49677ddfe661c46` records the missing personal export
and account deletion entry points. `/tmp/m16-lifecycle-red.log/.exit`: 0/2,
exit 1; actual routes returned 503. Subsequent implementation is not called
complete or independently accepted on the strength of this checkpoint.

The first implementation run passed deletion and failed export with
`archive_changed`: actual M06/M07 producers were still changing the archive.
The first fixture stabilization attempt incorrectly waited for every waiting
task, including `memory_window_pending`; that attempt failed after 65 seconds.
The corrected fixture waits for actual producers to settle while retaining the
legitimate scheduled intake task. This is a fixture correction, not a product
RED/GREEN claim. `/tmp/m16-lifecycle-green3.log/.exit`: 2/2, exit 0.
Server typecheck passed in `/tmp/m16-typecheck2.log/.exit` after fixing initial
TypeScript assertion-target annotations. The all-workspace/heavy gates remain
pending while M14 holds its coordinated required-check window.

## First public server contract

All routes require Wire 2 and the existing originating-session/CSRF checks.
Limited collection devices and MCP credentials do not obtain these capabilities.
The account API instance and operation UUID must be retained by consumers.

| Endpoint | Request / response |
| --- | --- |
| `POST /api/portable/exports` | `{operationId: UUID}`; idempotently creates own receipt. An ID owned by someone else is 404. |
| `GET /api/portable/exports/:id` | Own receipt only, including for an administrator. |
| `GET /api/portable/exports/:id/content` | Completed immutable JSON bytes. MIME `application/json; charset=utf-8`; attachment `mote-portable-<id>.json`; quoted SHA256 ETag; `Accept-Ranges: bytes`. |
| `POST /api/portable/exports/:id/retry` | `{}`; failed export only. Re-exports current data with the same identity, and may change bytes/hash. Old content is never a partial download. |
| `POST /api/portable/exports/:id/cancel` | `{}`; idempotent, also retires a completed download and its stored content. |
| `DELETE /api/admin/accounts/:id` | `{operationId: UUID}`; explicit administrator deletion approval, immediate account epoch revocation, metadata-only durable receipt. Last enabled administrator cannot be deleted. |
| `GET /api/admin/account-deletions/:id` | Administrator-only receipt, with no domain contents. |
| `POST /api/admin/account-deletions/:id/retry` | `{}`; continue the same approved operation; do not replay successful erasures or unknown external actions. |

Receipt common fields: `id`, `kind: export|delete`, `userId`, `deploymentId`,
`state`, ISO `createdAt/updatedAt`, `domains: {domain,state}[]`, optional fixed
`error` code. Export state is `working|completed|cancelled|failed`. Delete can
also be `pending|result_unknown|blocked`. Export receipts include
`format: mote-portable`, `version: 3`, and coverage with the exact domain IDs,
`credentials:false`, `activeAuthorization:false`, `instanceBackup:false`.
Completed export receipts additionally carry exact `bytes`, lowercase `sha256`,
`filename` and `contentType`. Each exported domain also declares its own payload
coverage/exclusions. Delete receipts carry `logicalAccessRevoked:true`; only
`completed` represents all recorded adapters returning physical completion.

No invented download expiry is introduced: content survives restart until cancel
or account deletion. Current authorization is checked on every read; a changed
account epoch is 409, and disabled/revoked credentials are 401. Other owners are
404. Missing/not-completed/corrupt content is unavailable, never an empty success.
Single bounded/suffix/open ranges are supported; malformed/unsatisfiable ranges
return 416 and `Content-Range: bytes */<size>`. A mismatched `If-Range` returns the
entire current immutable object, following HTTP range semantics.

Export uses the existing 64 MiB default/instance `maxExportBytes`, not a new user
quota. Failure is explicit (`archive_too_large`, `archive_changed`,
`domain_export_failed`, `domain_unavailable`, `interrupted`). A concurrent SQLite
write conservatively invalidates a mixed snapshot, including another user's
write; the caller can retry. There is no automatic unsafe retry or silent partial
coverage. A crashed working export needs a fresh owner-authorized retry; a crashed
deletion keeps its approved per-domain journal and needs administrator retry.

Personal portable import, whole-instance backup/restore, administration audit,
race/large-page/fault matrices, emitted-process checks, independent review,
required affected, M12/final native dependency composition and Draft PR are still
pending. This is an interface checkpoint, not M16 acceptance.
