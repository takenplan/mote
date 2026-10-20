# PR 168 / 189 / 191 integration

Plan P9 was independently **APPROVED** before runtime integration by
`/root/plan_review` (Sol High). The reviewed plan SHA-256 was
`94f76dae6656df999f5ea078ae1c19dd5fcb1ff77fd547dc0be55f25d8b91346`.
Exact inputs:

- Current local PR 189 candidate: `9c3179b1cbdd3df3a523ff406501467607e3b781`.
- Refreshed main: `cc5d30f8e84bff9276b4487ffd7254c594b154df`.
- PR 168: `6b557ca317bcec7095b2a2a73d1e5f874000c36c`.
- PR 191: `4df7f94642235bf627b3cc1db8a5ccb62f1107a6`.

The owner explicitly requested integration, autonomous conflict resolution and
direct merge into main after successful verification. Root is the only source,
shared-file, conflict-resolution and complete-check owner; inventory/reviewer
agents remain read-only. Merge the exact main and both PR heads into the current
branch, preserving ancestry so all three PR heads reach main together. Do not
publish or merge until the final combined candidate passes required checks.

## Complete journey and supersession

- **KEEP:** current authenticated ingress, durable ACKs, account/authorization
  fences, query and background-processing lifecycles; current shared execution
  envelopes and inline protocol-range validation. Retain main's validated-input
  and import-progress fixes and their regressions, plus PR 189's unchanged 397
  split registrations, six-worker default, native execution/failure/cleanup and
  advisory budgets. The P8 readiness correction retains its approved scope.
- **KEEP:** Desktop's active source selection → preview → confirm/cancel flow,
  trusted/account-generation IPC wrappers, raw logs and typed permission
  settings; Web's RecordTimeline, CaptureSessions, work-state badges, collection
  navigation and current account flows. Removed exports/channels have no tracked
  callers outside their own definitions/bridges.
- **CHANGE:** add the three PR 168 fixture commands to the existing manual
  workflow without changing their entry/assertions; preserve all current
  automatic component checks. Correct `protocol/README.md`'s already obsolete
  wire/health/handshake/storage prose using the current contract and production
  source, without changing executable protocol or capability definitions.
- **REMOVE:** only the exact PR diffs' proven-unused Server wrapper, Web exports,
  three Desktop IPC paths, standalone range schema and historical one-shot
  scripts. Both cleanup PRs delete the same wrapper; keep one deletion. No live
  test or product entry point is removed.
- **EXCEPTION:** PR 191 intentionally supersedes PR 168's KEEP of the root
  historical Wire-1 `scripts/test-profiles.mjs`. The actual scoped Central and
  Desktop `test:profiles` entries remain. Current tests do not prove every old
  composed watcher/upgrade/two-profile journey equivalent; retiring this dormant
  historical fixture is not a claim of restored legacy compatibility. Retain
  historical path/hash records as historical evidence.
- **UNKNOWN:** repository searches cannot establish untracked external callers
  of unused internal exports. Do not broaden removals or change policy to resolve
  an unexpected live consumer. Escalate a new semantic boundary to delta review.

Resolve mechanical conflicts by retaining current main behavior and the exact
approved removals. No limits, timeouts, assertions, success criteria, auth
contracts, product defaults or real-entry coverage may be relaxed. Clean only
the deleted wrapper's generated `apps/server/dist/execution.*` artifacts before
building; do not change the production build lifecycle.

## Validation and resources

Stop the superseded P8 candidate's check before changing source; preserve its
interruption receipt and separately audited cleanup, without claiming PASS or
reusing cleanup-unconfirmed evidence. After changes converge, root freezes the
combined candidate and runs `npm run check:affected -- --base <main above>` with
the existing full consumer selection, including Android JVM tests. The local
Homebrew JDK 21 and Android SDK/platform 36 exist; pass their real paths in the
check environment, without changing global user settings or starting an emulator.

Focused checks exercise retained Desktop source-confirm/cancel, logs and
permission contracts and Web collection/navigation behavior using generated
fixtures. Execute the newly wired material-load-arrivals/recovery tests and
Python `test_audio_control.py` explicitly; the former uses the retained legacy
fixture plus loopback HTTP, not the current multiuser production composition.
Keep focused evidence distinct from the frozen complete-check receipt. Review
documentation formatting and links. No personal content, real models, device
permission prompts, foreground UI or deployment/release is required.

Before merging, confirm the remote main and PR heads still match the tested
candidate's inputs. Push the combined branch, update PR 189's description to the
final integrated scope, merge with history preserved, then verify all three
heads are ancestors of remote main and inspect all three PR states. Report exact
verification and any unperformed checks; do not infer delivery from local Git.

All three merges completed cleanly; the duplicate Server-wrapper deletion was
applied once. Integration merge head before documentation edits:
`3dfdcf94` (main, then PR 168, then PR 191). The three exact generated wrapper
outputs were removed from this checkout before rebuilding. No source conflict
required semantic resolution.

A generated Node-only regression uses the existing emitted-main/preload harness
to verify selection alone collects nothing, cancellation invalidates the native
selection, confirmation is one-use, raw logs remain readable, and typed permission
settings reach a stubbed native boundary. It starts no Electron window, real
capture or system permission UI. Existing test deadlines remain unchanged.

## P9-D1: consume the updated main

Before this branch consumed the updated main, `/root/plan_review` (Sol High)
explicitly **APPROVED** P9-D1. Reviewed section SHA-256:
`f975722b39664df014434fa93c69ae1f6aede41fdfa7555f5017041030c56498`.
Local checkpoint is `eaa54db0`; GitHub and fetch confirm main is now
`301b5941e2d451e46710befb23a5398a089b24e7`, the merged PR 192 head
`f2f08b44f1eed5ccf77532f8e7452ba0ab9190dd` over the original `cc5d30f8`.
Only four files changed: scoped Memory input validation/result issuance and two
generated regression files. No cleanup-PR head or owned integration scope changed.

**KEEP:** all P9 removals, retained journeys, settings, assertions and deadlines;
upstream's synchronous within-check de-duplication while current authority,
versions, dependencies and selected evidence are still re-read; upstream query
issuance/unknown-outcome and exact-result recovery under the existing task
contract. **CHANGE:** consume that already-merged main as the integration input
and final gate base. **REMOVE:** no additional code or coverage. **EXCEPTION:**
the upstream owner reports focused-only validation and an explicit human process
exception, with no new preimplementation TPR APPROVE; our delta approval covers
integration/coverage before this branch consumes it, not retrospective approval
of PR 192 implementation. **UNKNOWN:** no live-model/device evidence is supplied;
do not infer it from generated recovery tests.

Root remains sole merge/check owner. Review the precise new source delta and
its existing generated regressions before merging main without modification.
Then run both updated reader-batch/issued-query files from the actual native
entry, retain the two real extraction/deletion journeys at their split locations,
and freeze once all focused checks converge. The full affected-consumer gate
includes all four new files and their consumers, so the upstream's reported
23-test/2-journey/typecheck PASS is context, not a reused gate receipt. Recheck
remote inputs and ancestry before authorized main delivery as in P9.
