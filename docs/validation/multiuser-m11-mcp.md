# M11 protocol/source phase validation

This record covers the protocol/source phase, not complete M11 acceptance.
The initial baseline is PR133 `470516b7ed4ab7ee8b0fba344883c6b42bb7ce56`.
Accepted PR134 `7572b573b03437ff743652c13181b9fdcf251fda` is now composed on
this feature. Final accepted M07/M08 real query tools remain required.
No mock Memory, Ask, connector or processing service proves them.

## Current accepted-M10 protocol/source freeze

Authoritative runtime/test commit:
`4175d4e9b9231d0741b14af4b4b8ebc6f099ded5`.
It contains the accepted M10/M06 stack and the per-connection handle retirement
repair. Subsequent documentation-only commits do not change tested inputs.

| Exact final-code gate | Actual result |
| --- | --- |
| `node --import tsx --test --test-concurrency=2 --test-timeout=120000 apps/server/test/scope*.test.ts apps/server/test/multiuser*.test.ts` | **305/305**,0fail/cancel/skip,exit 0,138659ms; `/tmp/m11-4175-combined.log/.exit`. Includes all 23 current M11 tests (22 domain cases and one actual production index process). |
| `npm run build -w @mote/server` | exit 0; `/tmp/m11-4175-server-build.log/.exit`. |
| `npm run build -w @mote/web` | exit 0; `/tmp/m11-4175-web-build.log/.exit`, existing bundle-size warning. |
| `MOTE_MCP_PROCESS_ENTRY="$PWD/apps/server/dist/index.js" MOTE_CONNECTORS_PROCESS_ENTRY="$PWD/apps/server/dist/app.js" node --import tsx --test --test-concurrency=1 apps/server/test/multiuser-mcp-process.test.ts apps/server/test/multiuser-connectors-process.test.ts` | Fresh emitted actual M11 index/SDK/SIGKILL and M10 HTTP two-process smokes **2/2**,exit 0; `/tmp/m11-4175-compiled-smoke.log/.exit`. |
| `node scripts/check-scope-contracts.mjs` and `git diff --check` | both exit 0; `/tmp/m11-4175-scope.log/.exit`, `/tmp/m11-4175-diff.log/.exit`. |
| Independent M07 review of exact 417 | **4/4**,0fail/cancel/skip,exit 0; `/tmp/mote-m07-review-m11-protocol.md`, `/tmp/m07-independent-m11-4175.log/.exit`. No actionable P1/P2 in the reviewed protocol/source scope. |
| `npm run check:affected -- --base origin/codex/mote-multiuser-integration` | **exit 0** on the actual full retry; `/tmp/m11-4175-affected-retry.log/.exit`. Desktop 456/456; Server 2261 passed and one existing opt-in skip; Web 469/469; Agent 317 passed and one existing opt-in skip; Diagnostics 5/5; Shared 190/190; root 81/81; client 4/4; central runner passed. Android **329/329**, 70 suites, no failures/errors/skips, 25 tasks actually executed, 38s; `/tmp/m11-4175-android-junit.json`. |

The first actual full affected run exited 1: the checkout had used offline
`npm ci --ignore-scripts`, leaving Electron's binary absent. Its desktop hidden
window fixture could not start (455 passed, one failed). Server 2261 passed with one existing opt-in
skip, Web 469 passed, Agent 317 passed with one existing opt-in skip, Shared 190 passed with no
failures, but the complete command failed and Android was not reached. Logs
`/tmp/m11-4175-affected.log/.exit` preserve that failure. No production source or
check was changed/skipped. The existing local cached Electron 41.10.7 zip was
verified against the installed package's checksum
`7497a1f398c7bcac208fce96c73d297b1d63924624361a1a21930cd666cc4bbc` and extracted
only into this checkout's ignored node_modules. The actual hidden Electron
fixture then passed **2/2**,exit 0 (`/tmp/m11-electron-cache-repair.log/.exit`),
reporting zero shown windows/focuses. The exact required command was rerun on
unchanged clean 417, using existing JDK21/Android SDK, in its sole heavy slot.

M07's exact `a6bc94c43e34ce91439cfeff6ad669264610d1d1` bindRead contract has
also been independently reviewed, without composing an unaccepted module into
this runtime. Original transitive-source migration probe passed 1/1,exit 0.
A new genuine provider-backed page/delete probe initially exposed a P1 at
c0aedbbf: an earlier deleted Memory was returned after a later provider await.
At exact a6, the same semantic probe passes 1/1,exit 0,leaked=false/outcome=blocked;
only its temporary cleanup guard changed. Three further default-policy/history
export/concurrent-export regressions pass 3/3,exit 0. Full review and evidence:
`/tmp/mote-m11-review-m07.md`, `/tmp/m11-review-m07-migration.log/.exit`,
`/tmp/m11-review-m07-page-delete.log/.exit` (preserved failure),
`/tmp/m11-review-m07-page-delete-fixed.log/.exit`,
`/tmp/m11-review-m07-a6-delta.log/.exit`.
These are scoped interface/delta reviews, not final M07 or M11 module acceptance.

Remaining: accepted actual M07/M08 composition, all 21 legacy MCP tools' real
query/disclosure/activity behavior, final expanded SDK matrix, final independent
whole-module review and final-code full gates. See the
[detailed query composition plan](../design/multiuser-mcp-query.md). No own
feature push/Draft PR is claimed before the requested module gates.
Remote integration remains `6272a9b51ec92cc4c32e2ff1a1eeb4fa38b142ed`,
PR133 `470516b7ed4ab7ee8b0fba344883c6b42bb7ce56`, PR134
`7572b573b03437ff743652c13181b9fdcf251fda`; own remote branch remains absent.
Checks and Component checks remain `disabled_manually`; CI is unrun. Existing
release workflows were only read and left unchanged. No protected branch,
sibling source/existing DB, live credentials/data/provider/model or deployment
was changed.

## Executable journey matrix

| Risk | Real exercised boundary |
| --- | --- |
| A/B same IDs | Same source, external item/revision, connection, resource and tool IDs through actual HTTP and SDK; SQLite/content/results only owned. |
| Restricted credential escalation | MCP rejected from ordinary source/configuration/auth/admin routes; write sessions have no read resources/tools; source creation and out-of-scope writes refused. |
| Host-field spoofing | Forged tool userId refused; outbound remote tool arguments cannot change the actual host identity or local destination owner. |
| Browser/account switch | B Web cookie alongside A MCP bearer stays A; Web logout leaves independent MCP owner unchanged; explicit MCP revocation and account disable/re-enable reject old sessions. |
| Paging/restart | A cursor cannot be used by B or another source; own cursor resumes after restart; remote pagination traverses pages and rejects repeated cursor. |
| Crash/reconnect | Actual production index listener and SDK; SIGKILL, persistent credentials/data, old session404, new initialization fixed owner, persisted revocation, orderly final exit. |
| Late I/O | Barriers for revoke/disable/source delete/same-ID recreate/toggle/config refresh/cancel/domain delete; zero A intake/manifests; B still imports. |
| Privacy deletion | Held remote re-read cannot resurrect an explicitly deleted capture; exact pre-I/O selected heads are checked before transaction. |
| Resource snapshot | Same-account retry/restart deduplicates; shorter resource retracts its own tail; B keeps both parts. |
| Provider failure/retry | Real SDK failure/unsafe tool/repeated cursor yields fixed codes; no provider/key text; no partial intake; explicit next successful retry works. |
| Configuration/handles | Actual M04 CAS and sensitivity/export; A/B same connection IDs use distinct credentials and SDK sessions; local-network boundary remains administrator-owned. |
| Domain lifecycle | Actual session close and credential revocation at delete; metadata-only restore cannot revive old token; B session remains usable. |
| Real adjacent production | M03 archive intake via MCP tool automatically enters actual M05/M06 processing; SDK reads each owner's actual published Material. |
| Material dependency pagination | Mixed-source Materials are removed in SQL before ordering/limit/cursor publication; narrower same-user source scopes reject a broader Material cursor. |
| HTTP disconnect | Actual outbound import HTTP client abort reaches SDK cancellation; held result leaves no capture. |

## Historical development receipts

Initial 634 protocol/source freeze passed 64/64 adjacent auth/ingress/MCP/scope
and actual index tests,exit 0 (`/tmp/m11-frozen-adjacent.log/.exit`), plus fresh
Server/Web builds and emitted process 1/1,all 0. Accepted-M10 merge56 passed 304/304
and emitted 2/2,all 0. These precede the per-connection repair and are historical;
current 417 combination of 305/305 and full affected above supersede them.

Initial test clients omitted Ingress3 and requested Fastify listeningOrigin before
binding; they failed and were corrected without relaxing production checks.
One adjacent run had 63 passes and one scope-inventory failure after adding reply to
registerUserRoute; the exact mixed-ownership declaration was corrected, not
skipped. The first affected dry run lacked the freshly cloned base ref; fetching
its exact remote-tracking ref corrected that. Dry runs were never counted as
actual checks. Per-connection configuration self-audit then replaced whole-user
handle invalidation, with a durable two-held-connection regression before 417.

## Independent peer review performed by M11

M10 exact 41d2775307db5afecbb5b40b81b5fd8c8a0b9b9b real M06 composition:
7/7 actual joint/upgrade/reference tests, 6/6 secrets/admission regressions,exit 0.
Final delta 2ae03155ef766655f4996977e4eedcc0a2177e9d subjectless Gmail:
real HTTP two-process smoke 1/1,exit 0. No confirmed remaining P0/P1/P2 in reviewed
scope. Full report `/tmp/mote-m11-review-m10.md`; no sibling source/existing DB
writes. This is M10 review evidence, not an independent review of M11 itself.
