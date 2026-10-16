# M11 protocol/source phase validation

This record covers the protocol/source phase, not complete M11 acceptance.
The initial baseline is PR133 `470516b7ed4ab7ee8b0fba344883c6b42bb7ce56`.
Accepted PR134 `7572b573b03437ff743652c13181b9fdcf251fda` is now composed on
this feature. Final accepted M07/M08 real query tools remain required.
No mock Memory, Ask, connector or processing service proves them.

## Executed development evidence

| Command/evidence | Actual result |
| --- | --- |
| `npm ci --offline --ignore-scripts` | exit0; dependencies from existing local cache, no installation outside this checkout. |
| `npm run build:libs` | exit0, `/tmp/m11-build-libs.log/.exit`. |
| `npm run typecheck -w @mote/server` | exit0 after source epoch/identity implementation, `/tmp/m11-phase-typecheck.log/.exit`; final exact phase checks below supersede development receipts. |
| `node --import tsx --test --test-concurrency=1 apps/server/test/multiuser-mcp.test.ts apps/server/test/multiuser-auth.test.ts` | 29/29,0fail/cancel/skip,exit0; `/tmp/m11-expanded-first.log/.exit`; earlier phase before final domain/Material cases. |
| `node --import tsx --test --test-concurrency=1 apps/server/test/multiuser-mcp.test.ts apps/server/test/multiuser-mcp-process.test.ts` | 20/20,0fail/cancel/skip,exit0; `/tmp/m11-source-process-first.log/.exit`,20137ms. Actual index listener, SIGKILL/restart, real SDK and actual M06 source→Material. |

Initial typecheck caught optional session narrowing and unknown configuration
types; repaired without assertions that weaken identity. Initial test clients
omitted Ingress3 and queried Fastify listeningOrigin before binding; those
invocations failed and are not acceptance. No production protocol check was
relaxed. Expanded source revision/head and lifecycle fences were added before
their new regressions passed. Loopback tests require sandbox-authorized listener
access, use synthetic credentials and temporary isolated SQLite/files only.

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

Additional narrow defense runs:5/5 exit0
`/tmp/m11-defense-delta.log/.exit`; real HTTP cancel/dependency cases3/3 exit0
`/tmp/m11-http-cancel-delta.log/.exit`; exact source-scope Material pagination
regression1/1 exit0 `/tmp/m11-material-scope-cursor.log/.exit`.
The first64-case adjacent combination had63 passes and one architecture-inventory
failure after adding the reply handle to `registerUserRoute`; the exact existing
surface declaration was updated while preserving M01 mixed ownership/status.
That failed invocation is not counted as passed. The Material page query was
also tightened to apply the complete allowed source set before LIMIT and bind
that set in its signed cursor, eliminating post-page filtering.

## Gates still required

The phase needs an independent code review and a committed precise final-code
receipt. Full M11 additionally requires actual accepted M07/M08 production
composition, the entire legacy read/tool/resource/prompt exposure audit, expanded
Memory/Ask disclosure/model-input/revocation tests, final actual combined suite,
fresh Server/Web builds, emitted-code smoke and
`npm run check:affected -- --base origin/codex/mote-multiuser-integration`.
M10 owns the sole full-affected/Android slot; M11 has not run either concurrently.
No Draft PR or complete M11 acceptance is claimed by this phase record.

## Accepted M10 composition and connection-instance repair

Own clean feature merge `56bcb1cf6e46304254318fed659efe861113c6ae` includes
accepted PR134 full `7572b573b03437ff743652c13181b9fdcf251fda`, verified with
`git ls-remote` and fetched by exact PR ref. It preserves both domain registrars,
the M06/M10 source formats/processor registry, M05 savepoint/onAdmitted seams,
and closes MCP before execution before connector/processing/plugin workers.
No remote or local integration/main branch was moved.

Exact56 all-scope/multiuser combination passed304/304,0fail/cancel/skip,exit0,
144506ms (`/tmp/m11-56bcb1-combined.log/.exit`). Fresh Server/Web/scope/diff
all0; fresh emitted M11 index+SDK/SIGKILL and M10 HTTP two-process smoke2/2
exit0 (`/tmp/m11-56bcb1-compiled-smoke.log/.exit`). These completed before the
following connection-instance repair and remain historical evidence only.

Self-audit identified whole-user configuration fingerprint invalidation would
unnecessarily cancel unchanged same-user sibling connections. The repair captures
and validates each exact connection fingerprint and retires only removed/changed
handles. Domain generation still fences account-wide deletion. Two held real SDK
connections now demonstrate refreshing first rejects only its late result while
second commits both resources. A/B, single-connection refresh and this new case
3/3 passed,exit0 (`/tmp/m11-connection-isolation-fix.log/.exit`), typecheck0
(`/tmp/m11-connection-isolation-typecheck.log/.exit`). Final new-code full
combination/build/smoke receipts follow;304 is not claimed as repaired acceptance.

## Frozen protocol/source receipts

Exact runtime/test/design freeze:
`63427a7798680bc60bf12cb135527bd27dd2648f`, clean independent checkout
`task-13/mote`, feature `codex/mote-multiuser-m11-mcp`.
Subsequent evidence-only Markdown does not change runtime/test inputs.

| Exact frozen command | Result and evidence |
| --- | --- |
| `node --import tsx --test --test-concurrency=1 apps/server/test/multiuser-auth.test.ts apps/server/test/multiuser-ingress.test.ts apps/server/test/multiuser-mcp.test.ts apps/server/test/multiuser-mcp-process.test.ts apps/server/test/scope*.test.ts` | **64/64**,0fail/cancel/skip,exit0,28757ms; `/tmp/m11-frozen-adjacent.log/.exit`. Includes all22 M11 cases (21 domain scenarios plus actual production process). This is the actual M01/M02/M03/M06 source composition, not the still-missing full M07/M08/M10 combination. |
| `npm run typecheck -w @mote/server` | exit0, `/tmp/m11-frozen-typecheck.log/.exit`. |
| `npm run build -w @mote/server` | exit0, `/tmp/m11-frozen-server-build.log/.exit`. |
| `npm run build -w @mote/web` | exit0, `/tmp/m11-frozen-web-build.log/.exit`; existing bundle-size warning. |
| `MOTE_MCP_PROCESS_ENTRY="$PWD/apps/server/dist/index.js" node --import tsx --test --test-concurrency=1 apps/server/test/multiuser-mcp-process.test.ts` | Fresh emitted production index/real SDK/SIGKILL smoke **1/1**,0fail/cancel/skip,exit0,1349ms; `/tmp/m11-frozen-compiled-smoke.log/.exit`. |
| `node --import tsx --test --test-concurrency=1 --test-name-pattern='remote fetch denies\|malformed remote HTTP status' apps/server/test/connectors.test.ts` | Existing reused transport compatibility **2/2**,0fail/cancel/skip,exit0; `/tmp/m11-frozen-network-compat.log/.exit`. |
| `node scripts/check-scope-contracts.mjs` | exit0, `/tmp/m11-frozen-scope.log/.exit`; exact existing http surface preserved as M01 mixed. |
| `git diff --check` | exit0, `/tmp/m11-frozen-diff.log/.exit`. |
| `npm run check:affected -- --base origin/codex/mote-multiuser-integration --dry-run` | exit0, `/tmp/m11-phase-affected-dry2.log/.exit`; selects check:local and Android. **Dry run only**, not executed checks. First dry run failed because this fresh clone lacked the remote-tracking base; fetching exact remote refs fixed that, without moving any protected branch. |

Final read-only remote check: integration
`6272a9b51ec92cc4c32e2ff1a1eeb4fa38b142ed`, PR133
`470516b7ed4ab7ee8b0fba344883c6b42bb7ce56`; own remote branch absent, no PR
created/pushed. Workflow API confirms Checks/Component checks
`disabled_manually`, existing three release workflows active/untouched. No CI
was run, enabled or claimed passed. M11 has not run full affected or Android;
the peer's heavy slot and final actual downstream module dependencies are
respected. Independent M11 review remains pending parent scheduling.

CI Checks/Component checks remain disabled and have not run. No workflow setting
was changed. Real accounts/data/credentials, external services/models, physical
devices, deployment and M16 complete export/delete/restore are unrun. No main or
integration change, PR merge, sibling worktree change or new execution chat.

## Independent peer review performed by M11

M10 exact41d2775307db5afecbb5b40b81b5fd8c8a0b9b9b real M06 composition:
7/7 actual joint/upgrade/reference tests,6/6 secrets/admission regressions,exit0.
Final delta2ae03155ef766655f4996977e4eedcc0a2177e9d subjectless Gmail:
real HTTP two-process smoke1/1,exit0. No confirmed remaining P0/P1/P2 in reviewed
scope. Full report `/tmp/mote-m11-review-m10.md`; no sibling source/existing DB
writes. This is M10 review evidence, not an independent review of M11 itself.
