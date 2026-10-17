# Context history lifecycle across offline SQLite writers

Date: 2026-10-17. Main integration baseline: `b7b73d3d`.

The first context-cache/history integration fix used a persistent trigger which
called a connection-local JavaScript function. The full consumer gate reproduced
one failure: the real backup snapshot's `file_jobs` update compiled the nested
artifact-deletion trigger and failed with `no such function:
mote_context_history_invalidate`. The isolated MVP backup regression also failed.
The failed full run remains evidence: Server 1,959 passed, one failed and one
skipped; no skipped test or timing budget was converted into a pass.

The replacement persists the complete lifecycle as ordinary SQLite SQL. Archive,
conversation, working-summary, delegated-product and query-run schema owners
refresh it after installing their tables. The generated trigger references only
installed tables. Trigger replacement uses a savepoint, including inside an
existing caller transaction. Ordinary cache invalidation still preserves answer
text and privacy lineage, expires conversation revisions and summaries, and
withdraws the same operational products. Exact replay and destructive original
deletion keep their separate existing behavior.

The product writer audit covered `scripts/backup.ts` snapshot writes,
`scripts/update-private.mjs` native and Docker connection restoration, and the
normal EvidenceStore connection. Vector/profile/archive readers are read-only;
Memory provider SQLite files have separate schemas. No offline writer drops a
trigger, registers a no-op function or suppresses the failure.

Generated regressions exercise the real backup command and native profile
restore with nonempty context artifacts, saved conversation and summary. The
restored host continues the historical discussion. A separate raw
`DatabaseSync` connection then rejects an injected expiry failure atomically,
retaining both artifacts, all turns, revision and summary; a subsequent raw
parent eviction removes descendants, marks all influenced answers historical
and clears the summary. Restart/follow-up and later original deletion verify
that all answer generations still erase. Startup also replaces the obsolete
callback trigger. Standalone and nested trigger-replacement failures retain the
previous working SQL lifecycle and caller transaction boundary.

Performed validation: the five-file focused group passed 28 tests with no
failures, skips or cancellations; server TypeScript typechecking passed. The
root integration lane runs the required full affected-component gate separately
after this fix. Focused command:

```sh
node --import tsx --test --test-concurrency=2 --test-timeout=120000 \
  apps/server/test/evidence-cache-history-integration.test.ts \
  apps/server/test/mvp-baseline.test.ts \
  apps/server/test/conversation-lineage.test.ts \
  apps/server/test/context-artifact-memory-retention.test.ts \
  apps/server/test/combined-backup-recovery.test.ts
```

All inputs and model responses were generated. These checks establish host and
SQLite lifecycle behavior, without a live model, real account, personal vault
or physical-device claim. See the [cache lifecycle decision](../adr-cache-memory-retention.md)
and [original joint regression](context-cache-history-integration-2026-10-17.md).
