# Conversation history retention validation

The 2026-10-17 evidence below records the then-current deletion policy. The
2026-10-29 owner decision supersedes its ordinary-deletion clearing assertions;
the new current checks and limits are recorded at the end of this document.

2026-10-17; base `6272a9b51ec92cc4c32e2ff1a1eeb4fa38b142ed` (main).
The history implementation was handed off as `358f8597` and independently
reviewed in a separate clean checkout before additional acceptance tests.
See the [decision and supersession boundaries](adr-evidence-history-retention.md).

## Reproduction and acceptance

The generated pagination journey was run against an archived checkout of the
unmodified base with the new test copied in. It failed at the post-import history
assertion: `evidenceDeleted` was `true`, where preservation requires it to be
absent. A source-revision HTTP journey independently reproduced the same failure.
Both use real production stores and services with temporary SQLite databases;
the query provider is generated and no private vault is read.

Run the focused production journeys from the repository root:

```sh
npm run build:libs
node --import tsx --test apps/server/test/conversation-history-retention.test.ts apps/server/test/conversation-history-boundaries.test.ts
```

| Journey | Required outcome |
| --- | --- |
| Ordinary source revision | Preserve the exact answer, citations, run identity and original version dependencies; mark stale. |
| Cache disappears, restart, referential follow-up | Keep prior proposals available as historical dialogue; no old-original read grant. |
| Two follow-up generations after a Material revision | Preserve historical references and inherit privacy dependencies across generations. |
| Later capture deletion, source tombstone, Material retirement or forget | Clear every affected answer generation and summary; reject a frozen revoked snapshot before provider admission. |
| Late compaction during revision/deletion | Reject the late summary; retain stale dialogue for revision and erase it for deletion. |
| New restricted result dependency during historical continuation | Reject publication; the historical exemption never covers new restricted dependencies. |
| DingTalk raw pagination count changes 4 → 2, transcript identical | Preserve history and original locators even if the upstream file identity changes. |
| Existing current/unrelated evidence and conversations | Preserve current behavior and independent history; covered by conversation/lineage suites. |
| Source declaration changes | Mark stale, preserve historical prose, drop expired declaration authority and fence late results. |
| Web history and Agent envelope | Render stale answer/citation plus notice; delete removes both; host permission receipts never reach model text. |
| Legacy receipt migration bookkeeping fails | Roll back both turn metadata and quota bytes, then retry successfully without partial migration. |

The mandatory consumer gate is:

```sh
npm run check:affected -- --base 6272a9b51ec92cc4c32e2ff1a1eeb4fa38b142ed
```

Its selected consumers are Central and Web (including Shared and Agent). Local
HTTP/socket fixtures require an environment allowing loopback listening; the
restricted sandbox returns `listen EPERM` and cannot establish a gate pass.

## Review and limits

Independent review followed ordinary and destructive invalidation call sites,
historical root receipts and backfill, result dependency filtering, Material
authorization, snapshot fences, compaction, and model-envelope serialization.
The review found that backfill and quota bookkeeping were separate writes. A
SQLite failure trigger reproduced partial migration; a savepoint fixed it and the
regression verifies rollback plus a successful retry. No blocking code defect
remained after that fix; the added tests target the
permission and lifecycle boundaries not exercised by the initial handoff.

No live model, physical device, real account revocation, deployed service or user
vault was exercised. Generated tests establish host state/authority transitions,
not a model's semantic ability to distinguish old discussion from current facts.
Already overwritten historical answers cannot be restored. This PR does not
stabilize all upstream version noise, alter Memory/cache invalidation, introduce
semantic-equivalence classification, or implement the separate multi-user work.


## Joint consumer regression — 2026-10-17

The [main integration receipt](validation/main-pr-integration-regression-2026-10-17.md)
records the complete affected gate and the portable SQLite lifecycle regression.
The [Android follow-up](validation/android-history-notice-2026-10-17.md) covers
both actual history readers, current/stale/deleted states, 21-turn paging,
Activity recreation and a new process with retained application data. Generated
agent adapters establish lifecycle/UI behavior, not live-model answer quality.

## Ordinary deletion extension — 2026-10-29

The [updated ADR](adr-evidence-history-retention.md) records source turn 38 and the
separate execution approval. The module starts from `be3a86a8`; it does not redo
the existing ordinary-update implementation. Independent boundary review required
known ordinary-deletion proof, exact conversation/turn/run pins, current exposure
checks, unchanged privacy/expiry behavior and a real deny-all empty selected scope.

| Journey | Current required result and exercised boundary |
| --- | --- |
| Central capture/note/file-backed ordinary deletion | Original physically gone; submitted Q/A, citation identities/excerpts and run/usage metadata remain. File delete retries do not mint extra proof; later explicit file forget clears retained generations. |
| External record-store tombstone | Historical citation unavailable and fresh model original reads denied; the separate existing owner immutable archive route remains readable. |
| Archive-pipeline tombstone | Exact old Material anchors become unavailable; submitted dialogue survives rebuild and duplicate tombstone replay. Explicit source forget still clears it and pauses the source. |
| Formal organizer after ordinary deletion | Preserve only exact anchors already proven ordinarily deleted. Generic Material retirement/redaction without that proof retains the old clearing contract. |
| Partial / complete strict selection | Keep the original selected scope. Fresh reads use only remaining selected originals; with all originals gone, actual HTTP tool requests for evidence/search/materials fail before any reader call. Explicit scope clearing remains separate. |
| Missing, forgotten, revoked or mixed roots | Do not silently discard unknown/restricted roots or partially allow a mixed answer. Current source exposure revocation blocks model entry; privacy erasure clears subsequent inherited generations. |
| Deletion races / recovery | Reject frozen prepared history and late answers/compaction; deletion rollback leaves originals, turns and receipts unchanged; exact snapshot/run/dependency forgery fails; SQLite backup/reopen preserves valid proof without restoring originals. |
| Turn detail | Preserve tool counts, bound identity/range and validated image-view metadata; strip free-form queries/descriptions/payloads. Host receipts and their IDs do not enter model envelopes. |
| Web history citation | Production component preserves answer/citation and usable composer, checks reference availability, shows unavailable dialog, returns to the same history and honors later privacy erasure. |
| Android history citation | Real Fastify response is consumed by Kotlin `CentralClient`, `CentralConversationReference` and `CentralConversationPresentation`; ordinary deletion keeps Q/A/scope, denies reference opening, and collector credentials cannot read owner history. Both native history screens call this gate. |

Focused commands actually selected for this module (from their package directory
unless a root path is shown):

```sh
# apps/server
node --import tsx --test --test-concurrency=3 test/conversation-retirement-authority.test.ts test/conversation-history-retention.test.ts test/conversation-history-boundaries.test.ts test/conversation-lineage.test.ts test/evidence-deletion.test.ts test/conversations.test.ts
node --import tsx --test --test-concurrency=2 test/source-pipelines.test.ts test/evidence-exposure.test.ts
# Additional affected consumers: source-context-conversation, model-evidence-authority,
# sources, files and imports. No whole-repository or performance run was selected.

# packages/agent (after its build)
node --test test/context-evidence.test.mjs
node --test test/task-context.test.mjs

# apps/web
node --import tsx --test test/read-state-closure.test.ts

# Repository root; task-owned Gradle caches and generated temporary Central profile
node --import tsx apps/android/test-fixtures/central-kotlin-contract.ts
```

The first server group passes 33 cases and source-pipeline/exposure 29; the Agent HTTP bridge 14, envelope/selected
consumer 23, Web state suite 29, Android presentation JVM 3 and real
Fastify-to-Kotlin contract 6. Server/Web type checks, Agent build, six-locale
catalog check (8,841 messages) and diff whitespace checks pass. Generated local
HTTP tests initially hit the sandbox's loopback `EPERM`; the supported test
permission path was used to run them, with no alternate transport. The old
ordinary-delete-clears assertions were changed to the explicitly approved
preservation behavior while keeping privacy erasure and in-flight fences.

These are generated functional/contract results, **not visual parity**. No live
model, personal vault, physical Android device, Mac EventKit write or deployed
service is involved. Mac history UI integration and all final screenshot/viewport
comparison remain separate client acceptance work. Test-owned HTTP servers and
temporary profiles are closed/removed by their runners; no device installation
was needed for the history module.
