# Performance round 1 integration

This integration preserves product semantics and complete user journeys. It combines four bounded implementations and two design-only packages. It does not release round 2, merge a module PR, or deploy a service.

## Inputs and approval

The module baseline is `af11ab7c3e9fb5f38deaea4e4bae11462a7306b4`. The integration starts from main `bcff7bab6109a7c99acde3decb5712a072e1b045`, including [PR194](https://github.com/utopiafar/mote/pull/194). All six module worktrees were clean at handoff; their draft PR heads matched their receipts.

| Module | Frozen original head | Draft PR | Round 1 scope |
| --- | --- | --- | --- |
| A | `4fe34b6d3eaeac5c5bcce34378268b723312a095` | [197](https://github.com/utopiafar/mote/pull/197) | Current-head reverse index; bounded Operations dependency SQL batching |
| B | `dcc8ddd18129f7fe4a9ed6514f07ed938560626f` | [195](https://github.com/utopiafar/mote/pull/195) | Scheduling design and generated baseline; proof/organizer investigation only |
| C | `0a7021d9e7d2857d24764927dab314df3f04964e` | [200](https://github.com/utopiafar/mote/pull/200) | Export and WAL investigation/design only |
| D | `6637661ddfeb052eb4864486094428c3bfc5f8cd` | [196](https://github.com/utopiafar/mote/pull/196) | Composer draft subscription; reuse validated slice checksum; current-login browser fixture |
| E | `79328626eb9042582b7eab5c76f00e71a449abdc` | [198](https://github.com/utopiafar/mote/pull/198) | Directory cursor; built-in file checkpoint clone removal; packed first-read and disabled-diagnostic work |
| F | `e33f2d95b35c33eee2a2b4fcb2b7d852d15d85cb` | [199](https://github.com/utopiafar/mote/pull/199) | Non-packed upload materializes only the first sent record |

The controller submitted `controller-round1-integration-v1` before integration or test implementation. Its SHA-256 is `b962d1c8c91bd8ff3e366728aeda86af808a5ecd26e7cc25d286efcbf305c531`. Independent reviewer `/root/orchestration_review`, Sol High, explicitly **APPROVE**d composition, the PR194 preservation boundaries, and the additional HTTP witness below. Approval binds the controller's original HEAD, the main SHA above, and the exact six head/tree/commit sequences. The external campaign records retain the full plan, review and original-to-integrated commit mapping.

All registered module commits were cherry-picked in A/B/C/D/E/F order with provenance. There were no conflicts. Module implementation approvals remain bounded to their original plans; this approval does not replace them or authorize future implementations.

## Journey and supersession check

Inputs continue through capture/import, durable original storage, scoped querying, actual execution projections, Ask and attachment upload, Desktop scan/checkpoint/upload, and Android transport/ACK handling.

| Classification | Boundary |
| --- | --- |
| KEEP | Current wire/storage versions, exact ownership and authorization, originals, totals/order/cursors, SHA/ACK validation, FULL/fsync and durable event ordering, failure recovery, timing and complete journeys |
| KEEP | PR194: independent remaining Memory windows have no fabricated dependency on the earlier batch; failed/paused/local-cancel siblings do not block their original due/threshold admission |
| KEEP | Global stop, revoked authority and changed inputs remain fenced; restart does not replay completed batches or automatically reopen historical `dependency_failed` work |
| CHANGE | Compose the four approved implementations; add a read-only HTTP consumer witness to existing failed/paused continuation scenarios |
| REMOVE | No product behavior, required assertion, input scale, timeout, success criterion or normal journey entry |
| EXCEPTION | Validation uses generated data, isolated profiles and loopback ports; background UI uses existing hidden fixture controls |
| UNKNOWN | Physical-device performance, live-model quality/latency, foreground OS permissions and deployment behavior remain separate, unperformed checks |

B's future scheduling implementation must be rebound to its actual integration base/head by its original reviewer and include PR194's independent continuation, full-pool/resource-wait, cancel and restart combinations. B's generated selection/native SQLite observations are not real-engine acceptance. C's export direction preserves 64 KiB windows and fresh whole-part verification per window; its plan does not approve a stream cache or production WAL enablement.

## Additional integration witness

The controller owns the addition in `apps/server/test/multiuser-memory-integration-domains.test.ts`; shared fixtures and product code are unchanged. The existing failed/paused scenarios first create a genuine independent continuation with zero durable dependencies. The added helper waits for its actual future-due waiting state using the existing 15-second `until` control, then listens on loopback port 0 using the same scoped app.

Real `GET /api/operations/:id` requests assert the exact operation and sole continuation task, empty dependencies, complete first page, empty tail at the actual `execution_steps.user_position`, unchanged summary, and another account's 404. Original subsequent due-time, progress, retry and restart assertions remain. Existing app close/restart and fixture teardown close the listener; response bodies are consumed.

## Validation and resources

Module checks are module evidence. They are not driver-proven `REUSED` tasks. The controller uses its own dependency installation and artifacts, isolated temporary/profile directories and Gradle home, Java 21, and at most two Gradle workers. All installation, builds and checks pass through the campaign resource gate. One heavy lease excludes every module light/heavy task. The repository's cross-worktree check-driver lock remains in force.

Before the complete driver, run the latest full Memory integration-domain suite and confirm the new HTTP witness and high-risk states actually pass. Freeze the candidate, inspect the selected plan, then execute `npm run check:affected -- --base bcff7bab6109a7c99acde3decb5712a072e1b045 --head HEAD` once. Record original task receipts, input stability and cleanup. Subsequent changes invalidate only proven affected tasks; no unrelated module worktree result is relabeled as reused.

Run the current-entry hidden Web browser and Desktop smoke against integrated artifacts. Inspect relevant Desktop real-startup/UI/profile coverage and execute required entries through the same resource gate. Android JVM compilation/tests are distinct from APK, emulator, physical-device and OS lifecycle validation. No existing emulator or device is used.

Final results are recorded in [the integration validation record](../validation/performance-round1-integration-2026-10-20.md). The integrated PR remains pending acceptance until required checks pass. Only that PR is the combined delivery candidate; module PRs remain draft, and no merge or release is performed.
