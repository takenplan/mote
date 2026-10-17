# Conversation history retention validation

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
No blocking code defect remained in that review; the added tests target the
permission and lifecycle boundaries not exercised by the initial handoff.

No live model, physical device, real account revocation, deployed service or user
vault was exercised. Generated tests establish host state/authority transitions,
not a model's semantic ability to distinguish old discussion from current facts.
Already overwritten historical answers cannot be restored. This PR does not
stabilize all upstream version noise, alter Memory/cache invalidation, introduce
semantic-equivalence classification, or implement the separate multi-user work.
