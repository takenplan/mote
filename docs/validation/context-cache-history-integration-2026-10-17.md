# Context-cache and historical-answer integration regression

Date: 2026-10-17. Reviewed integration base: `c15bc24e905056f3c278aad967398fbd272837fd`.
Scope: main-targeted PRs #143 and #145–#148. This does not port these changes to
multiuser production or validate the independent integration branch.

## Confirmed failure and correction

A generated original and a derived context artifact were read through the real
HTTP query entry point. Replaying the exact artifact correctly preserved the
conversation. Replacing its interpretation retained the old answer but left
`evidenceStale` absent, so the history view could present it without the required
historical-answer notice. The new assertion failed on the combined PR heads.

The initial integration fix invoked the existing conversation invalidation
lifecycle from a SQLite `BEFORE DELETE` trigger while the artifact lineage still
existed. That callback implementation was subsequently replaced by a persistent
SQL lifecycle after the full backup consumer gate exposed its connection-local
dependency; see the [offline-writer regression](context-history-sqlite-portability-2026-10-17.md).
The final behavior marks dependent answers historical, withdraws summaries and
expires frozen conversation snapshots. It covers replacement, explicit cache
eviction and recursive parent invalidation. Exact immutable replay performs no
delete and therefore does not falsely invalidate dialogue. Original deletion
retains its separate destructive cascade.

## Performed validation

All inputs and provider/model responses were generated. No personal vault,
screenshot, real provider account, live model or physical device was used.

- Independent pre-fix connector/history/cache regression: 57 tests passed across
  eight files, including Lark owner-HTTP/Memory intake and Google/Gmail restart.
- New loopback HTTP/SQLite journeys: six tests passed. Replacement, eviction and
  parent cascades cover exact replay, preserved prose, stale status, summary
  withdrawal, provider-admission snapshot rejection, restart/follow-up and later
  original deletion. Two timing cases reject late model results and summaries.
- Startup recreates the lifecycle trigger in an existing database. Injecting a
  conversation-update failure rolls back the artifact removal, turn and revision
  together; removing the fault permits a successful retry.
- Server TypeScript typecheck passed. The final affected-component gate is run
  separately on the root integration branch; its actual results are recorded in
  the [final joint receipt](main-pr-integration-regression-2026-10-17.md).

Focused rerun from the repository root:

```sh
node --import tsx --test --test-concurrency=2 --test-timeout=120000 \
  apps/server/test/evidence-cache-history-integration.test.ts \
  apps/server/test/context-artifact-memory-retention.test.ts \
  apps/server/test/conversation-history-retention.test.ts \
  apps/server/test/conversation-history-boundaries.test.ts \
  apps/server/test/conversation-lineage.test.ts \
  apps/server/test/evidence-archive-generation.test.ts
```

These fixtures establish host lifecycle and permission transitions. They do not
establish live-model semantic quality, real-account revocation, device behavior
or deployed-release delivery.
