# Main / multi-user security and recovery regression — 2026-10-17

This is the independent Server, evidence-lifecycle and recovery lane for merging
multi-user integration into main. Its frozen source is
`6b4305bff5c7723562b88990395c6d87759cea95` (C3), tree
`4399f1ad15a5874f02bd8036de48220791171594`. It follows merge C
`cd13a3e0fe5afc3b42cab0912f7693c68b702a73`, whose parents are main
`2c2627621e2598332ae8169845bc7343be7ed63e` and integration
`b26e797b5427fd089fa4fc4fa8b0cc45909f24af`.

The C3 executions below used the isolated exact-C3 worktree. Later G and L
follow-ups have their own source attribution. Generated inputs and
loopback external transports exercise production scoped composition; the old
global composition remains an explicitly imported algorithm fixture. Fresh shared,
Agent, diagnostics, Server and Web builds exited 0. Frozen tracked inputs remained
unchanged throughout this lane. Read-only comparison confirms that candidate F
`b60ce1054ef74641ade0ee4e891ef40ee61e55f6` has identical Server, shared, Agent,
diagnostics, release/recovery scripts and package/lock inputs. F's separate
Desktop production delta and client fixture updates were not executed as C3.
The full affected-component gate, browser and native acceptance have separate
receipts; this report does not claim their result.

This is a historical, source-bound receipt. Under the owner's subsequent MVP
decision, K `53446e69c00ab5a64707fdd9f28f65f4532e7ce2`, tree
`07f25cd1650e1e77fe4dff7bdd7216e95587932d`, removed the unsupported legacy Ask
history backfill, its startup owner enumeration and the public legacy test
aliases. C3's and L's startup-backfill executions below remain evidence of those
earlier snapshots; they are not a supported upgrade contract for K or later
sources. Current retained-history receipts remain owner-bound, and missing
receipts fail closed across startup, reads and artifact access instead of being
reconstructed. The final joint candidate, complete local-Codex acceptance,
affected-component gate, merge and new release are still pending; see the
[main integration report](main-multiuser-integration-2026-10-17.md).

## Independent boundary review

The review applies [the integration ADR](../adr-multiuser-main-integration.md),
[history retention](../adr-evidence-history-retention.md),
[cache and Memory retention](../adr-cache-memory-retention.md), and
[scoped ownership](../adr-multiuser-scope.md).

| Disposition | Retained or changed boundary |
| --- | --- |
| KEEP | Owner/deployment namespaces, encrypted provider credentials, M05 grants, account generations and strict current original/tool/citation validation. Content remains untrusted, read-only evidence. |
| CHANGE | Main's retained historical dialogue now executes through scoped production M08. Owner-bound host receipts carry recursive original, Material, source and inherited-dialogue roots; ordinary revisions retain old answers and citations with stale notices, clear summaries and advance snapshot revisions. |
| REMOVE | Cache identity as the sole historical privacy dependency, implicit prose deletion on ordinary revision, importing archived execution authority, and recursively duplicating complete identical evidence proofs. History invalidation uses persisted SQL rather than connection-local callbacks. |
| EXCEPTION | Explicit deletion, expiry, tombstones and explicit Material retirement retract dependent private prose and model checkpoints atomically. Temporary projection hiding and disposable M07 cache removal retain historical prose. Metadata-only measurement keeps its existing redaction contract without granting content reads. |
| UNKNOWN | Previously erased history cannot be reconstructed. A legacy Gmail head with neither retained raw bytes nor a stored raw fingerprint cannot prove equality; the first new observation conservatively becomes a revision. Real-provider behavior and live-model quality require separate validation. |

Lark transport-counter changes preserve the prior full document revision. Gmail
normalization ignores only top-level transport `historyId` and JSON object-key
order; raw MIME, attachments, unknown fields and A→B→A content changes remain
revisions. Legacy hashless-head migration is owner-bound and uses retained raw
originals only. No global production-app fallback was reintroduced.

Independent generated regressions exposed and fixed explicit-retirement erasure,
inherited-only followup dependencies, retained compactor checkpoints, incomplete
personal-archive ancestry and unread legacy-history upgrade ordering. Later narrow
regressions cover M07 cache withdrawal, exact proof deduplication, current CLI
health before account creation, and private research-workspace erasure. Archive
restore requires a complete ordered prefix and canonical owned retained parents;
it restores data without tasks, model calls or archived authority. Full exact JSON
proof deduplication preserves differing hashes, read kinds, receipts, source
incarnations and Material revisions. Final review found no remaining blocker in
these Server/provider boundaries in the reviewed C3 snapshot. This is not
approval of a later integration or release candidate.

## Fresh C3 execution

| Lane | Actual result |
| --- | --- |
| Historical dialogue, upgrade, SQLite and archive tests | 15/15; exit 0; no failures, skips or cancellations; 412.766s |
| Fourteen security/lifecycle/recovery test files | 109/109 across 14 files; exit 0; no failures, skips or cancellations; 528.034s |
| Fresh compiled real HTTP issuance/restart/late ACK | 3/3; exit 0; no skips/cancellations; 8.113s |
| Actual compiled attachment → text processing → personal export | 1/1; exit 0; no skips/cancellations; 4.948s |
| Actual native dev/test profile CLI | 1/1; exit 0; no skips/cancellations; 9.703s |
| Actual Docker instance restore | Exit 0; 12.860s |
| Actual Docker file-generation restore | 1/1; exit 0; no skips/cancellations; 11.070s |
| Actual Docker processing-policy restore | 1/1; exit 0; no skips/cancellations; 14.571s |
| Actual offline Hindsight/PostgreSQL restore | Exit 0; 71.259s |

The two history files are
[`multiuser-history-independent-review.test.ts`](../../apps/server/test/multiuser-history-independent-review.test.ts)
and [`multiuser-history-retention.test.ts`](../../apps/server/test/multiuser-history-retention.test.ts).
They ran with concurrency 1 and the unchanged 120000ms test budget. They cover
ordinary correction across temporary projection withdrawal, retirement followed
by republication, inherited-only disclosure, real compaction, stale/erased Ask
archive roundtrips, forged/foreign/omitted-parent atomic rejection, startup
backfill, cache summary/CAS invalidation, redacted measurement, 12 real followups
with distinct revisions, and a real private workspace tool call before deletion.
The independent stopped-host SQLite writer requires no JavaScript registration;
failure injection proves cleanup rolls back with the delete transaction. Committed
erasure survives restart and exact public-ID recreation while B remains usable.

The fourteen-file group uses the production HTTP, SQLite, worker and SDK paths,
with generated external I/O and unchanged assertions/waits. From `apps/server`:

```sh
node --import tsx --test --test-concurrency=1 --test-timeout=120000 \
  test/multiuser-auth-process.test.ts \
  test/multiuser-ask-read-races.test.ts \
  test/multiuser-container-backup.test.ts \
  test/multiuser-instance-backup.test.ts \
  test/multiuser-keep-independent-http.test.ts \
  test/multiuser-external-journal.test.ts \
  test/multiuser-ask-processing-authorization-seam.test.ts \
  test/multiuser-policy-personal-archive.test.ts \
  test/multiuser-keep-cache-independent-http.test.ts \
  test/multiuser-crossuser-e2e.test.ts \
  test/multiuser-recovery-policy-lifecycle.test.ts \
  test/multiuser-recovery-http-seams.test.ts \
  test/multiuser-portable-import.test.ts \
  test/multiuser-recovery-portable-file.test.ts
```

| Journey | Executed seam |
| --- | --- |
| E1 identity | Bootstrap/login/restart/revocation, equal A/B IDs, late responses/exports and same-URL deployment replacement |
| E2 intake | Lost ACK, retired grants, held late output and owner retry after real process death |
| E3 originals → Material → Memory → Ask | Real M03–M08/MCP chain, across-await deletion/recreation/source fences, B-positive controls |
| E4 settings | Runtime limits through generated transport, cross-domain CAS, demotion, immutable plans and current controls |
| E5 Memory/history/KEEP | Rebuild/read/export, rollback versus committed cache invalidation, retained history and fresh authorization |
| E6 files | Exact declared attachment bytes, safe TAR members, incarnation/ticket/delete-intent retirement and joined export |
| E7 external effects | Exact issuance identity, confirmation and retry through restart; unresolved calls remain distinct |
| E8 recovery | Native/Docker restore, portable merge, corrupt/foreign atomic rejection and no revived execution grants |

The compiled HTTP driver repeats the original three recovery HTTP test bodies,
assertions and waits; its only adaptation selects the fresh compiled fixture host.
The CLI uses the actual `npm run test:profiles` entry: four cold starts, independent
dev/test profiles, zero-account public Wire-2/epoch-5 readiness, stop/restart,
occupied-port refusal and refusal to kill an unrelated owned sentinel PID. The old
Wire-1 profile script remains explicitly named separately and was not counted.

The opt-in drivers are [instance recovery](../../scripts/validation/container-recovery.ts),
[file generation](../../scripts/validation/recovery-file-generation-container.ts),
[processing policy](../../scripts/validation/recovery-policy-container.ts), and
[Hindsight recovery](../../scripts/validation/hindsight-recovery.ts). They run
serially with existing local images and no pull. Instance and policy recovery
perform real production startup/restart,
exact original-byte checks, old-token rejection and fresh owner controls.
File recovery preserves nonzero incarnation counters and rejects stale tickets
and destructive intents. Hindsight uses its installed offline API and actual
migrated PostgreSQL schema, generated canonical rows and managed-runtime reopening.
Its two canonical reads prove recovery rather than semantic retention quality;
automatic model workers stay disabled and unresolved external facts stay unknown.

## Source consumption and cleanup

The runtime image was
`sha256:35501aaf44c0b204a336a173f16daeb2e6e4f538e0917607d12c301fe99732e5`.
All 1,812 consumed runtime files match the fresh host artifacts, digest
`2ff7747915b15316f84dd63be7987c036d3dd7ae3540ffa8fe9b5130d1b0162d`.
The dependency-base lockfile matches C3, digest
`6cb27ab7fc9ec5ce28da66b6c31051cd23f7c2b3269eda217b4d39a55e0bdae9`.
Host Node26/ABI147 and image Node24/ABI137 independently construct, write, read
and close the actual root/Mem0 SQLite dependency and verify workspace package
module identity. The frozen-input digest is
`db8c703c8dd8e8189c3502e373a570ade8fcd499581641d855b9e113ea589d0c`
over 2,941 tracked files; the unified receipt additionally binds C3/tree.

| Retained local evidence | SHA256 |
| --- | --- |
| History 15 log | `5568a1b39d833a0c109516cc16395cc6f5dc5ebfd291723fdb86b19d68fe008d` |
| Security 14-file log | `9108ca283fd5d4ca5e0ba7ddaf6e05fa62320820241b492f1bac7b25c1a0c604` |
| Compiled HTTP log | `c8eaf7aedcdb459a8b1e1688ff6ccb006a414502cba6c3c773cb3126086fca6e` |
| Compiled attachment/export log | `b8e60476c941bfec55a9d3e0f7f9196defbbecf048def1ca2e5a21e42c739fab` |
| Current profile CLI log | `49f8ddaede4b472dbe341ebc890b2c899d153ac7163d11535bd4a949bd0bf0c5` |
| Four Docker-driver natural-exit receipt | `49e221fe34b94e020a86baa6b08f505ce44ed4dcf146a8ef6d956b636035fb10` |
| Frozen tracked-input/source receipt | `861299e622ff02d16faa7396784088fcd9687b876cea51bf9eaee18c9c1a9017` |

Only this lane's owned containers, volumes, runtime image, dependency tag, CLI
processes and temporary HTTP staging were removed. All nine pre-existing volumes
retain identical inspect metadata; all three pre-existing containers and the
pre-existing dependency base image remain. After both targeted groups completed,
no owned fixture process remained. Source and local evidence remain
available for review; raw receipts, credentials and private temporary paths are
not committed.

Independent read-only review of F's three Desktop production files found no
blocker. Deleted turns render the existing localized notice before an early
return, so neither old answer/citations nor the citation handoff hint can render.
Stale turns retain the original prose and citation actions with the existing
notice. DOM text and the established Markdown renderer remain inert, and account
transport fences are unchanged. Its added DOM cases cover both locales and deleted
turns with or without a misleading result; the native runner compares actual
current/stale/deleted server DTOs and renderer state. This is code review, not an
additional native test execution by this lane.

C/C2 preparation and the earlier PR159 a5/734 receipts retain their own source
attribution. The C2 history-only run naturally passed 14/14 before C3; its queued
security run was explicitly interrupted and is not a passing C3 result. The prior
mixed-source full gates are not promoted by this report. Confirmed REDs remain
preserved, including workspace erasure, cache summary/CAS and current CLI health;
all corresponding durable tests above were rerun on C3.

## G supplement: keep the saved-history route in Work

Later actual native Work acceptance exposed a production integration regression:
a current archived answer opened correctly, but an ordinary Material revision
removed the parent Work's saved-result link while the authorized conversation
still retained its original answer and citations with `evidenceStale`. Both old
and new native presentation variants reproduced it. This was a Server projection
regression rather than navigation or a presentation-helper failure.

Main's existing Activity contract derives this top-level conversation link from
a non-erased saved turn. The scoped Activity projection instead depended on the
strict current execution result. The fix is isolated commit
`2333ed61677e15957d6fd97c0cdd760bfbf47dcc`, based on F. It changes only
`scope/ask.ts`, `scope/activity.ts` and the new
`multiuser-work-history-retention.test.ts`.

The dedicated host method returns only conversation, turn and run identities for
an exact same-owner canonical published chat turn. It checks conversation scope
and incarnation, retained run/turn roots, current exposure and deletion status.
Activity uses it only when the existing current-result path has no result.
Current, compact, insight and branch-artifact paths retain their prior behavior.
Historical answer text and citation locators do not become Work evidence or
current model/tool input. Strict Ask execution, operational artifact, original
and citation reads remain unchanged.

The durable regression uses actual loopback HTTP with equal A/B conversation,
turn and run IDs, and a turn ID different from its run ID. It exercises current
Work → ordinary revision → restart → source pause/resume → account disable,
re-enable and fresh login → explicit original deletion → restart, with B-positive
controls throughout. Stale Ask execution, HTTP artifact and model artifact reads
remain rejected, and navigation/permission transitions issue no model replay.

| Isolated F/G check | Actual result | Log SHA256 |
| --- | --- | --- |
| F production RED | 0/1; natural exit 1; saved Work link expected 1, actual 0 after ordinary revision; 9.411s | `6b0abe1de21d0f7129ca7dd8f3d9a4fe65f41d236e17efa18297830733a847bd` |
| G focused HTTP GREEN | 1/1; natural exit 0; no skips/cancellations; 11.162s | `47eda5f3cfc2919c625ba5da16c410beab4a8ef0c85d2bc6f9d89dca3c27fea6` |
| G Server typecheck | Natural exit 0 | `d92fa527b2cf6e7a734a389df70ded049e13fde5d094ded997bb6d7bd18c61e9` |

The focused run and cleanup completed in the isolated G worktree. No root source
or running full-F gate input was changed. The G consumer gate and remaining native
journeys have separate receipts; C3's 15/109 and Docker evidence above retain their
original source attribution and are not claimed as new G executions.

## L supplement: enforce the existing schema/private-SQL boundary

On 2026-10-18, the complete F Server run exposed two real architecture-check
failures: history table/trigger installation remained in the runtime history
class, and startup owner enumeration used the raw connection from AskHost.
The inventory also omitted the five history tables and explicit Material
retirement table. These checks remained enabled and their failures were retained.

Commit `81146d55b93944d6e5443ac44f5a7ca06b05c4c1`, based on H
`5dd501af05664f678cf92e2255ea9bd4717199c6`, corrects four files only.
The complete installer moves into the existing `ask-schema.ts` boundary, and
startup owner enumeration becomes a schema metadata helper. AskHost retains the
same per-owner PrivateSql backfill transactions; ConversationHistory retains
owner-bound PrivateSql operations only. The installer SQL text and order,
`installAsk` call location, surrounding savepoint, owner SELECT and permissions
are unchanged. Exact text reconstruction and a separate AST comparison confirmed
the move. The inventory adds only the six actual table surfaces; no checker,
exception list, deadline or unrelated declaration was relaxed.

| Isolated L check | Actual result | Log SHA256 |
| --- | --- | --- |
| Private-data, SQL preparation/reopen and architecture checks | 22/22; natural exit 0; no skips/cancellations; 6.705s | `d3d5efc198923b631817326e5a643bcd3c9155f57e3d9a5dd3853dd0a6eca7a2` |
| Server typecheck | Natural exit 0 | `d92fa527b2cf6e7a734a389df70ded049e13fde5d094ded997bb6d7bd18c61e9` |
| Existing history 15 plus Work HTTP regression | 16/16; natural exit 0; no skips/cancellations; 208.371s | `a7a3479e0e1066935bb3d1f0659350ae7408d5471392d0d2570b9225f001c915` |

The 16-case run retains the original 120000ms test budget and concurrency 1.
It includes actual startup upgrade, independent offline SQLite rollback and
committed deletion, exact-ID recreation, archive recovery, all privacy fences,
12 real followups and the Work history route. Its test processes exited and
fixture cleanup completed. This supplements the earlier source-specific C3/G
receipts; it does not relabel C3's Docker executions or claim the subsequent
complete integration gate. The owner of that gate records its final source and
natural exit separately.

## MVP supersession and later focused evidence

K removes the startup migration described in the earlier C3 and L sections; it
does not remove current owner-bound history installation, recursive original
receipts or SQL privacy invalidation. The missing-receipt case now requires
unavailability across restart and reads, including operational artifact access.
Retained answers with genuine receipts still distinguish ordinary revision from
explicit privacy erasure. Archived data does not restore execution authority.

The later P source `fba648f15f30890a7610d27946ba4fc24c5d8ea5`, tree
`78ab498bca3d00f90de37cd907ed5aac52c9281b`, retained those boundaries while
adding local development-profile first-run `admin` / `admin` initialization.
Its 18-file targeted run passed 221 of 222 cases, including the selected
isolation/history/missing-receipt cases and the original failed-child retry.
Its sole development-launcher fixture failure remains a failed run; it is not
complete P validation. The main report records that log's hash and the later
fixture follow-up separately.

The [retry performance report](main-multiuser-retry-performance-2026-10-18.md)
records K's isolated passing retry case and the two J diagnostic outcomes.
It distinguishes compiled-query reuse from cached authorization results and
attributes the timing change to K's combined repairs. None of these generated
provider runs is a live local-Codex or final joint-release receipt. The original
C3 security, container and backfill results above retain their exact sources.

This lane made zero live-model calls and used no real personal accounts, personal
screenshots, physical devices or foreground UI. Browser/native interaction and
the full affected-component gate are separate evidence. No skipped check in
those lanes is claimed as performed here.
