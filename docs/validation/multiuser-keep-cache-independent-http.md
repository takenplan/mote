# Independent acceptance of the KEEP cache and pending-intent increment

No production RED was reproduced in this bounded increment. The five new cache
cases and one new renderer case pass on runtime
`e663d48d351cdc9c4c21b9039f2023ef5295021a`, following durable tests
`0604951c71ec3d027123a0ed0f7d9caafb68e37b`. Review covers only the delta from
`aad77a8cf401eb4e9066e4640fd60b2d3e988d57` and its relevant existing fences.
No implementation repair was requested or made by this reviewer.

The earlier [aad acceptance](multiuser-keep-independent-http.md) remains evidence
for that earlier source. Its eight test cases were actually rerun on e663 and
receive a separate result below; they were not relabelled. This is still finite
KEEP evidence, not final C/eight-journey acceptance or a full affected gate.

## Risks inspected and tests performed

| Source and risk | Real-path evidence on e663 |
| --- | --- |
| `scope/private-data-sql.ts:31`: a cached proof must notice same-connection changes, including rolled-back writes, and committed changes from other connections | Real product SQLite connection and a second SQLite connection: read-only calls retain the token; own UPDATE changes it; own rollback does not reset it; uncommitted external writes and external rollback do not change visible state/token; external COMMIT changes it and removes the withdrawn original from a fresh HTTP archive. |
| `scope/file-export.ts:39` through `:42`: invalidation must recheck the immutable set without falsely retiring an unchanged authorized archive | A real HTTP export is held after selection. A same-connection source UPDATE followed by ROLLBACK changes the token but restores the same authoritative set. The resumed archive completes and contains the exact expected bytes. |
| `scope/file-export.ts:40`: external commits changing the current head must invalidate selection | A second connection commits a head switch while HTTP output is held. The old archive cannot finish. Fresh current export selects the newly current exact bytes; retained history contains both versions with correct current flags. |
| `scope/file-export.ts:40` and existing `ingress-schema.ts:48`: identical IDs/bytes after source retirement must not regain the old incarnation | Real source DELETE over HTTP, followed by real context-bound source/original publication using the same source, external ID, revision and bytes. The capture ID is identical, the durable original generation increases, the held old stream fails, and fresh A and B exports succeed. |
| `scope/file-export.ts:42` and `file-export-tar.ts:28`: authorization must run even if the SQL token is unchanged | The real HTTP gzip stream emits its first block. Closing the actual disposable Accounts verifier changes no SQLite token. The stream then fails and emits no second block. No verifier or authorization method is mocked. |
| `IndexMaintenance.tsx:17`: clearing a valid pending intent must not submit/cancel or resurrect it on remount | Real renderer plus real HTTP server: start with an actually accepted operation and its valid local intent, clear it, preserve B's owner-qualified local key, observe zero mutation requests, and confirm the accepted job was not cancelled. Remount has no pending intent. The next explicit rebuild sends one new UUID and no cancel request. |

The five new HTTP cases are in
[`multiuser-keep-cache-independent-http.test.ts`](../../apps/server/test/multiuser-keep-cache-independent-http.test.ts).
The focused renderer case is in
[`multiuser-keep-pending-independent.test.ts`](../../apps/web/test/multiuser-keep-pending-independent.test.ts).

State setup uses real host-issued contexts and M03 publication; these tests do
not claim that seeding uses the upload UI. Every export/control observation uses
real loopback HTTP. The SQL tests deliberately access only their disposable
fixture's actual connection, and the second connection opens only that generated
database. The output barrier sits at HTTP I/O; TAR, gzip, cached selection,
incarnation counters and authorization execute unchanged.

Static review found that authorization precedes the token fast path, local
`total_changes()` is read as BigInt, and a changed token triggers both full-set
proof comparison and a second token read before the new token is accepted.
Original/attachment generation checks remain part of that proof. No transaction
or staged private content is introduced across an await by this increment.

## Exact results and environment

| Retained task-17 log | Result |
| --- | --- |
| `keep-cache-e663-http-first.log` | New cache HTTP **5/5, EXIT0, 6250.565875 ms**, zero skips/cancellations. Test source was unchanged after this run. |
| `keep-cache-e663-pending-ui-visual.log` | New renderer **1/1, EXIT0, 1372.946125 ms**. |
| `keep-independent-http-e663-reuse.log` | Earlier eight independent cases, actually rerun on e663: **8/8, EXIT0, 19501.980875 ms**, zero skips/cancellations. This includes midstream account disable and actual Memory/Ask four-gate behavior. |
| `keep-cache-e663-owner-delta.log` | Only the two new owner export cases: **2/2, EXIT0, 3576.765417 ms**; measured generation reads **32 at 8 files, 64 at 16 files**; external-connection source withdrawal fails closed. |
| `keep-cache-e663-types-first.log` | Strict server test/import-chain TypeScript **EXIT0**. |
| `keep-cache-e663-ui-types.log` | Strict UI test/import-chain TypeScript with Web's Bundler resolution **EXIT0**; local ambient `/tmp/mote-keep-independent-jsdom.d.ts` supplies the missing jsdom class type. No dependency or source declaration was modified. |
| `keep-cache-e663-preflight.log` | Node26.11.1 / ABI147; root and mem0 real SQLite create/write/read/close; all four workspace module realpaths belong to task-17. |

The first renderer attempt used JSDOM's default hidden-document state, which
correctly paused production polling and left a cached waiting receipt. The
fixture now uses `pretendToBeVisual:true` without creating any native window;
the corrected case passes. Its original failure is retained in
`keep-cache-e663-pending-ui.log` and is not reported as product RED. The initial
UI compiler attempt used NodeNext rather than the Web's Bundler resolution and
lacked the existing jsdom types; that failure is also retained separately.

All accounts, sources, bytes and model replies are hand-authored synthetic A/B
fixtures. Work ran in the independent task-17 checkout with its own databases,
random ports and processes. The owner's checkout was unchanged and undeclared
WIP was not inspected. No Central private data/derivative was copied, and no real
permissions, credentials or configuration was changed. No full
old gate, merge, deployment or CI operation was performed. There is no remaining
execution blocker for this increment.

Local delivery SHAs and log hashes are recorded in
`/tmp/mote-keep-cache-independent-acceptance.md`. Final C can combine the original
test/report commit `496cae8d4056156cdd5fa18dad5ae5df27640a71` with this new
test/report-only commit after exact e663. Typed image products/PR151, portable3,
final platform journeys, real model semantics and native/physical-device checks
remain outside this bounded follow-up.
