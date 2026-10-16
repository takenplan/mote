# M07 Memory validation checkpoint

This is a partial-core checkpoint. M07 is not accepted and has no Draft PR yet.
The prerequisite is PR #132 exact
`cdc5c34c36fc5743049007ee2c76d705fde3dd7f`; the protected integration base is
`6272a9b51ec92cc4c32e2ff1a1eeb4fa38b142ed`.

## Reproducible test mapping

All new cases are in `apps/server/test/multiuser-memory.test.ts`. They use the
actual production builder, M01 accounts, M03 intake/Material publication, M02
ownership, M04 snapshots, M05 tasks, real Agent runtime and HTTP model transport.
Only the external model service is a scripted loopback fixture. No real account,
credential, personal content or external provider operation is used.

| Acceptance / transition | Exact test prefix | Evidence / current limit |
| --- | --- | --- |
| A/B same Material ID and entity name; independent review; model context isolation; attribution | `real production Memory extraction/review/publication` | Checks actual model requests and cross-user/admin reads. |
| Trusted identity and same-user source grants | `trusted Memory inputs` | Forged context and owner selectors denied; fixed source list enforced. Cross-host context case still to add. |
| Stop while a real model request is held | `stop fences late model results` | Controlled barrier; terminal stale result; B succeeds. |
| Repeated/concurrent admission | `same operation ID is idempotent` | One job and one extraction/review pair. Changed concurrent input conflict still to add. |
| Pause/drain | `pause drains admitted extraction` | Admitted work completes without generation change. |
| Cancellation | `job cancellation during an actual model request` | Cross-user cancellation denied; terminal cancellation and scrubbed output. |
| Source/original retirement | `retiring source originals` | Barrier after model admission; terminal stale result. |
| Account disable | `administrator account disable` | Real M01 transition; A cannot read; B completes. |
| Paging/search/cursor boundaries | `Memory pages and cursor signatures` | User and complete filter binding; same-name records page separately. |
| Memory deletion against an in-flight job | `deleting a Memory removes owner search` | Removes own candidate; invalidates original job generation. |
| Missing model/secret isolation | `manual Memory admission requires` | No fallback to another account or feature; safe response. |
| Revision/command idempotency | `Memory control commands preserve` | Same command ID independent across users; changed command conflicts. |
| App restart | `restart preserves Memory owner` | Completed output persists and is not replayed; not yet a two-process crash check. |
| Semantic deletion policy | `a new extraction of the same original` | Calls the shared semantic deletion reviewer and does not regenerate the conclusion. |
| Domain export/delete | `Memory lifecycle export and deletion` | Own plaintext only, no model secret; held work fenced; B unchanged. |
| Portable builtin restore | `portable Memory restore validates` | Exact owner/Material parent, stale activation, idempotence, atomic malformed-input refusal. |

Shared review/deletion contracts also run through `memory-review.test.ts` and
`memory-deletions.test.ts` (the latter currently contributes no standalone Node
test cases). Existing single-owner fixtures are algorithm regression evidence,
not multi-user production acceptance.

## Receipts to date

- First production core: 4/4 passed, exit 0,
  `/tmp/m07-first-network.log`.
- Expanded core before lifecycle/semantic-deletion additions: 13/13 passed in
  the shared 25-case run, exit 0, `/tmp/m07-core-freeze-tests.log`.
- Latest core run: **28/28 passed**, no failures/skips/cancellations, exit 0,
  `/tmp/m07-core-iteration.log`; 16 new production cases plus 12 shared review
  regressions. Command:
  `node --import tsx --test --test-concurrency=1 --test-timeout=60000 apps/server/test/multiuser-memory.test.ts apps/server/test/memory-review.test.ts apps/server/test/memory-deletions.test.ts`.
- Server typecheck: exit 0, `/tmp/m07-core-typecheck.log` (rerun on the final
  checkpoint commit before handing off; no runtime pass inferred from it).
- `node scripts/check-scope-contracts.mjs`: exit 0 after explicit M07 surface
  inventory and pure-contract import registration. `git diff --check`: exit 0.

The first sandboxed loopback run failed all four cases with `listen EPERM`.
The same fixture command ran successfully with local listener permission; that
failed attempt is not a product pass. The first expanded run had one fixture
using a nonexistent disable URL; it was corrected to the real M01 PATCH route
and rerun. One read-only exec transport disconnected transiently; immediate
`pwd` and subsequent commands worked without changing network or service state.

## Required and still unrun

Native Mem0/Hindsight A/B repository, retrieval and model contexts; unsupported
modes; external failures with no SQL fallback; provider migration/CAS/reader
snapshots; per-source recipe/version/window selection; integration; partial
Material readiness; full range/owner-question workflows; external unknown-result
reconciliation and erasure; genuine M06 upload-to-Memory automation; two-process
checkpoint recovery; independent module review; final combined suite; fresh
compiled smoke; final `npm run check:affected -- --base origin/codex/mote-multiuser-integration`.

No CI workflow was enabled. CI is **unrun**, not passed. No PR/main/integration
merge, deployment, live model check, real-user-data operation or main-worktree
edit occurred. The final handoff must report full local/remote/head/base SHAs,
test counts and exit receipts; these partial receipts cannot replace that gate.

## Subsequent implementation freeze (final acceptance pending)

The feature now composes accepted M06 PR #133 head
470516b7ed4ab7ee8b0fba344883c6b42bb7ce56. Production upload/processing intake,
policy windows, long-range batches, automatic integration, actual Mem0/Hindsight,
visual originals, owner correction, provider migration/history and purpose-limited
lifecycle cleanup are implemented. This section supersedes the initial checkpoint's
remaining-work list; the initial commands remain historical evidence only.

Independent M08 review of exact c678d24ab672d11f7262ae12b5a1f510f6f685c6 found a
P1 transitive-source migration disclosure. The fix checks every current/historical
version with assertSources before target provision/verify/write and across awaits.
The unchanged probe scenario now reports binding blocked and leaked=false.

Latest targeted checks: host-bound source/cursor/evidence scope, actual image
pipeline and independent migration regression: 3/3 pass, exit0, matching Node
24.21.0 runtime; /tmp/m07-read-contract-first.log/.exit. Server typecheck exit0
/tmp/m07-read-contract-final-types.log/.exit. Scope inventory/import/SQL checks
exit0. These do not substitute for final combined or affected checks.

Two actual source-host processes verified retained successful extraction and
original M04 authority after SIGKILL/restart: 1/1 pass exit0,
/tmp/m07-process-second.log/.exit. Interrupted independent review retries are
expected; successful retained extraction is not repeated. A fresh compiled-process
run remains required after the final build.

Unresolved acceptance gates: final independent delta review; final focused and
actual composed suites; fresh compiled production smoke; final check:affected;
final remote head/base verification and Draft PR. CI workflows stay disabled and
unrun. No live-model, real-account/provider, device or deployment checks were run.
