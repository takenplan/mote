# Scoped original content storage

This adapts the existing current-format [content storage](../content-storage.md)
under the multi-user privacy and M04 configuration contracts. It does not mount
legacy Store or expose private content to instance administration.

| Existing capability | Scope and retained behavior |
| --- | --- |
| Future image/original encryption | Personal `storage.contentEncryptionEnabled`, default false, in the same M04 YAML and whole-document revision/CAS. ConfigService prepares a managed key, synchronously publishes policy and rolls it back with other domains. The fixed private YAML field bootstraps synchronous M03 intake before the first M04 entry opens after restart. A published runtime value wins during configuration awaits. |
| Mixed current objects | M03's original `.plain`/`.aes` layout, AES-256-GCM and bounded asset worker are reused. Every owner uses its existing deployment/account-hashed original directory and its own managed key/fingerprint. There is no caller key, owner or path selector. Turning off future encryption does not rewrite old bytes. Device-only ingress still reads only its existing authorized sources; devices cannot read or change private storage settings. |
| Existing decryption command | A no-model `storage.decrypt` task in the existing M05 engine, exact explicit operation ID, owner resource serialization, real progress, cancellation and bounded per-part checkpoints. Successful files remain converted after cancellation. Corrupt/conflicting representations remain intact and count as failures. A new explicit command can retry them; no unknown external call or new provider/model request is involved. |
| Physical I/O and lifecycle | Decryption waits while M03 reports an outstanding owner activity, and checks its real M05 grant/account before every conversion. It does not cancel or pretend an old worker has stopped. A pending conversion checkpoint distinguishes an already durable plaintext replacement from a new skip after interruption. Keys are retained until account erasure, rather than deleted while a late worker could still reference them. Existing ingress/configuration/execution lifecycle domains own physical erasure and receipts. |
| Personal portable export/import | M03 exports actual original plaintext only within its existing authorized account archive. Managed keys and fingerprints are not portable payload. Import preserves current personal settings and writes bytes using the current owner's policy; it never restores an old execution grant. |
| Stopped instance backup | The existing epoch-5 backup naturally includes the fixed private key files. Original completeness validates plaintext checksums after authenticated decryption, including key fingerprint and conflicting mixed copies, before publishing a restore target. Old plaintext backups remain valid. No new backup engine or online instance restore is added. |
| Physical space view | The original statistics algorithm counts actual owner-managed files once, by type and UTC modification day: originals, parts, work files, personal configuration and fixed owner plugin/connector directories. Shared SQLite/index files, shared model weights, other accounts and external provider volumes are explicitly excluded. Shared database bytes are not apportioned to users or reported as a fictional zero. No filenames, credentials or another account's data appear in this report. |

## HTTP

All paths use the real M01 user context, Wire2, Web binding/CSRF and final awaited
response fence. Administrator credentials select only that administrator's own
personal storage. Device and MCP credentials do not gain private HTTP access.

- `GET /api/content-storage`: `{scope:'account',enabled,revision,coverage,job}`.
  Coverage declares originals/uploadParts true and credentials/privateDatabase
  false. Job has `state:idle|running|completed|cancelled|blocked|failed`, real
  `total,processed,converted,skipped,failed`, monotonic owner `sequence`, and for
  non-idle jobs exact `id` plus original `operationId`.
- `PUT /api/content-storage`: `{enabled:boolean,revision:number}`. Uses the same
  M04 `storage` domain as `PUT /api/configuration/storage`. Stale revisions and a
  policy switch during unfinished decryption fail without publishing a new policy.
- `POST /api/content-storage/decrypt`: `{operationId:UUID}`; returns202 and the
  exact job. Same operation/body is idempotent. Another operation cannot silently
  replace the current unfinished conversion. Legacy empty-body global admission
  is superseded only on the scoped production route.
- `POST /api/content-storage/decrypt/cancel`: `{taskId:<exact M05 id>}`. Cancels
  that owned task only. It cannot cancel B or a different handler kind.
- `GET /api/storage-statistics`: existing physical report fields plus explicit
  `scope:'account'`, coverage and exclusions. Bucket byte/file sums equal the
  report totals. It is not a whole-instance capacity/index report.

The original ContentStorage and StorageStatistics pages remain the controls.
The Web client keeps only the account/deployment-bound decryption operation ID
until a matching real receipt; exact body retry and GET/remount recover a lost
ACK. Connection remount, abort/generation checks and job sequence protect old A
callbacks and older receipts. Keys and original content never enter browser
intent storage. Shared runtime capacity, index rebuild/status, separate legacy
metadata/attachment export modes and other outstanding KEEP items are not
represented as restored by these routes.
