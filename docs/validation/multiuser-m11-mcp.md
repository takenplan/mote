# M11 protocol/source phase validation

This record covers the protocol/source phase, not complete M11 acceptance.
The baseline is PR133 `470516b7ed4ab7ee8b0fba344883c6b42bb7ce56`.
Final accepted M07/M08 real query tools and accepted M10 combination remain
required. No mock Memory, Ask, connector or processing service proves them.

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
receipt. Full M11 additionally requires actual accepted M07/M08/M10 production
composition, the entire legacy read/tool/resource/prompt exposure audit, expanded
Memory/Ask disclosure/model-input/revocation tests, final actual combined suite,
fresh Server/Web builds, emitted-code smoke and
`npm run check:affected -- --base origin/codex/mote-multiuser-integration`.
M10 owns the sole full-affected/Android slot; M11 has not run either concurrently.
No Draft PR or complete M11 acceptance is claimed by this phase record.

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
