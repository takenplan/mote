# Ask parity restoration validation

The comparison baseline is `2c2627621e2598332ae8169845bc7343be7ed63e`;
the implementation starts at `2c78ca8d52a7d17fae20962cf68d09a717ffc73a`.
The module PR and check-driver receipt identify the final frozen candidate.
The implementation and supersession contract are in
[scoped Ask](../design/multiuser-ask.md#retrieval-and-directory-parity).

| Audit item | Durable generated regression |
| --- | --- |
| ASK-A01 | `multiuser-ask-source-directory.test.ts`: actual Harness source, device and context-directory reads held before final model output; name/enable/delete/declaration changes fence publication; sync heartbeat completes; equal source IDs remain isolated. |
| ASK-A02 | `multiuser-ask-retrieval.test.ts`: HTTP intake and real automatic Material producers, M05 embedding tasks, loopback embedding transport, nonliteral recall and relevance order, real Ask fresh citations, explicit degradation including empty results, restart without paid backfill, revoked and cancelled late vectors. |
| ASK-A03 | `multiuser-ask-source-directory.test.ts`: a query matching only the owner's description discovers the source, matching preview, exact declared description and context catalog; another account's description is absent. |
| ASK-A04 | `multiuser-ask-failures.test.ts`: coordinator failure persistence without GET side effects, question/scope/safe message, restart/reopen, same-run retry and history pagination, equal IDs, portable data-only restore and invalid import rejection; cancelled/revoked/Agent-timeout late failures cannot publish. |
| FILE-PERCEPTION Ask consumer | `multiuser-ask-image-permission.test.ts`: generated original PNG uploads, default off, independent A/B enablement, current permission after actual pixel preparation, text/caption availability; existing explicit dialogue attachment Harness journey stays enabled by its separate grant. |
| ASK-A05 | `multiuser-context-pagination.test.ts` and the explicit public Context cases in `multiuser-mcp-query.test.ts`: real HTTP/MCP browse collections and readable navigation, stable search, ranked retrieval/no cursor, response capacity/truncation, bounded browse scan, durable query/user/scope-bound cursors, restart and uncapped internal timeline. |

`indexer.test.ts` and `indexer-execution.test.ts` retain the shared embedding
transport and rank-fusion regressions. These algorithm checks supplement the
production startup/intake journeys; they do not substitute for them. Existing
scoped Ask consumers cover compaction, delegation, transitive source filtering,
measured Activity, formal originals and independently pinned source descriptions.

The standalone Android backend fixture is
`apps/android/test-fixtures/multiuser-ask-backend.ts`. It creates only generated
accounts and loopback model responses, offers prompt-free hold/failure controls,
and cleans its temporary data on termination. Android owns actual Activity
consumption and reports its candidate and native evidence separately. A fixture
launch alone does not prove the native journey.

Local validation uses Node 26.11.1, ABI 147 and isolated worktree dependencies.
Both Server and Mem0 resolve a working native SQLite. The environment preflight
uses `JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home`
and `ANDROID_HOME=/Users/utopiafar/Library/Android/sdk` for selected Android
checks. Full `check:affected` requires the integration driver's resource window;
its dry-run selects all TypeScript consumers and Android because the optional
embedding feature is a shared configuration contract.

Generated fixtures do not establish live model or embedding semantic quality,
real provider behavior, physical-device behavior or deployment success. Those
checks are unperformed here. No personal screenshots or private accounts are
used. Current pending prerequisites and final check results belong in the module
PR receipt; an unrun check is not a pass.
