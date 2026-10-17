# M05 execution validation

This record covers generated fixtures and isolated epoch-5 instances only. No real
archive, credentials, model/provider, external effect, deployment or migration was
used. The implementation and contract are in
[the M05 design](../design/multiuser-execution.md).

## Prerequisites and composition

Remote `ls-remote` verified M00 `5031b754915d3fbba0dbe0c050b6d103a02966ef`,
M01 `443726d2a95ef55db9466d06aa44ea1061ca56e4` and M02
`8ecccb8ecf0093cc655fadd8bbc5e1637220f9fd`, including PR heads 126/127/128.
The integration branch remained `6272a9b51ec92cc4c32e2ff1a1eeb4fa38b142ed`.
M05's independent worktree combines the published prerequisites locally; no PR or
integration/main branch was merged or advanced.

An isolated archive of prerequisite-only composition `3abd6735` ran:

```sh
node --import tsx --test apps/server/test/scope-*.test.ts \
  apps/server/test/multiuser-auth*.test.ts apps/server/test/private-data*.test.ts
```

Final result: **48 passed, zero failed/skipped**. Two old M01 assertions expecting
`GET /api/materials` to remain unavailable were changed to expect M02's restored
200 response. The first composition run retained one such process assertion and
failed 47/48; that failure was corrected and the whole 48-test composition reran.
M01's authenticated runtime, ConnectionError, M02's PrivateDataError, lifecycle
purpose checks, private-data health flag and pre-listen signal handlers are kept.
The production signal-order regression was not weakened.

## Independent review and focused journeys

Independent reviewers found and drove fixes for:

- P1: a retained task private-service context initially survived cancellation and
  another attempt. Contexts now bind the exact running lease fence, state and
  expiry, in addition to durable grant and account epoch. Dedicated real-service
  negative tests cover cancellation, new attempts, completion and late writes.
- P1: shared-model withdrawal initially fenced explicit commits but a retained
  private service could still write. A real production negative reproduced it.
  Task-context currentness now delegates to the engine's complete input/resource
  grant, including synchronous local abort and shutdown, and fails closed before
  binding or on recursive validation. Cached and newly obtained private services
  are both rejected after withdrawal.
- P1: actual M04 `withModel` sanitizes callback errors; directly passing a typed
  provider failure through it lost the engine classification and stopped a
  transient call after one attempt. M05 now carries genuine typed failures through
  a private callback outcome, rethrows only after M04 post-validation, and retains
  the complete execution grant check in `finally`. Ordinary errors and structural
  lookalikes still follow the redacted path. Dedicated production-composition
  negatives verify finite transient recovery, blocked/waiting handling, unknown
  effects and safe errors.
- P2: deletion initially retained private operation/fairness metadata. Cleanup now
  removes the corresponding user/operation records, retaining only the domain
  admission tombstone; unknown external outcomes retain reconciliation evidence.
- P2: portable restore now checks input omission, normalized handler input,
  dependency completeness and an iterative acyclic graph before publication.
- P2: retry confirmation originally erased the preceding unknown issuance. Each
  external call now retains a fixed issuance ID, immutable owner/epoch/key/time,
  separately attributed confirmation and scoped settlement. A later successful
  retry cannot conceal the earlier unresolved effect during deletion.
- P2: model callback errors now recheck the execution grant in `finally`, so
  shared withdrawal is classified as stale and cannot publish late usage/results.

Focused tests exercise real `buildApp`, real Accounts login and the registered
HTTP/task scheduler. They do not substitute the quarantined legacy composition:

| Journey | Evidence |
| --- | --- |
| Per-user task/API/Operations/detail/changes ownership; forged identity and cross-user dependency/control | `multiuser-execution.test.ts` |
| Large A backlog of distinct operations, B ready work, within-user operation fairness | Real host handler start order; B starts within the first few claims |
| Web logout vs disable/reset; cancellation and retained service handles | Real checkpoints, progress and `private-data` commits |
| Multi-connection pool capacity, private/shared resource keys and independent resources | Two production hosts on one isolated SQLite database |
| Durable checkpoint/owner recovery | Actual OS process killed with SIGKILL; replacement host uses the original checkpoint and grant |
| Finite safe failure retry; unknown external outcomes and owner-only confirmation | Structured synthetic failures and persistent external issuance journal |
| Export/delete/restore, malformed or cross-user graph and unknown reconciliation | `multiuser-execution-lifecycle.test.ts`; B rows remain identical |
| Genuine model lease binding, fixed user snapshots, withdrawal, retained wrapper and missing restart snapshot | `multiuser-execution-model.test.ts`; actual M04 `Configurations`, durable encrypted snapshots and production HTTP routes |
| Genuine typed model failures, finite retry/wait budget, unknown external guard and redacted untrusted errors | `multiuser-execution-model-failures.test.ts` with actual M04 |
| Changed handler feature fails closed; same-feature registration preserves the original model lease | `multiuser-execution-handler-binding.test.ts` |
| WeakMap context provenance, copied/foreign contexts and task admin denial | `multiuser-task-context.test.ts` |
| Persistent fairness, operation ancestry, cursor independence, incompatible schema rejection and commit fences | `multiuser-execution-core.test.ts` |

An exploratory affected run exposed a legacy recovery fixture assuming one
`processing.tick()` also awaited a pipeline already claimed by a completion wake.
The single assertion now uses its existing real-engine `finishPipeline` helper;
all success, immutable identity and no-replay assertions remain. The isolated six
recovery-client tests passed before this correction as well; no test is skipped.
Earlier affected candidates were deliberately stopped before completion because
required review fixes or the actual M04 combination invalidated their code snapshots. They are
incomplete runs, not passing frozen-code evidence.

The first full production/lifecycle/context group passed **19/19**; the model group
passed **5/5**. Core and extended engine/Operations regression groups passed
**28/28** and **32/32** during implementation. The added issuance-journal group
passed **2/2**, and its independent reviewer also reran the six recovery-client
regressions (**8/8** combined), with zero skips. Exact frozen-code checks and remote
PR/CI verification are appended below after completion.

## Real M04 combination and remaining limits

The parent subsequently authorized combining the released M04 implementation.
Remote verification matched PR #129 and branch head
`bc5323e1b5ee337c20dee58d4a8e9c25bc2adbbf`, whose application implementation is
`e76f1fe6`. The M05 branch applies its published commits as `c4e4e8bc`, `d56c7b0b`,
`463d5299` and `aaf481af`, preserving M01/M02 permissions, error handling and
pre-listen signal registration. No integration branch or PR merge occurred.

The earlier M04 interface-only mocks and missing-snapshot restriction describe
an intermediate implementation; they are superseded by actual M04 composition.
Final model tests use real `Configurations`, encrypted durable snapshots,
`restoreLease`, account/resource generations and actual usage persistence.
Provider callbacks remain synthetic and local. The host restores original
configuration/selection/price, never a fresh current lease; failed recovery stays
blocked and preserves the processing-failure budget. Exact combined-code results
are recorded below after final verification.

Portable export covers task metadata/dependencies and handler-declared
credential-free input. It excludes active authorization, checkpoints, progress,
results, failure receipts, model snapshots and detailed external journals.
Portable history restore revokes all grants and blocks unfinished work; it does
not promise automatic task resume. Whole-instance SQLite recovery retains the
full original task/checkpoint state; M04 owns its encrypted snapshot files/key,
and M16 owns the complete backup/recovery orchestration and coverage reporting.

Unimplemented business handlers remain closed. Physical devices, native renderer,
Android emulator, real providers/external reconciliation and deployment were not
run; generated fixtures do not prove those journeys. Repository workflow settings
are not changed by this module.

The first post-failure-fix combined architecture run passed 165/166 but rejected
the newly direct import of `execution-failures.ts`. This existing helper contains
only WeakMap host failure-context projection and typed retry classification; it
opens no private store and installs no legacy runtime. Its exact file was reviewed
and added to the production import declaration. The boundary checker and its
negative tests remain enabled; no directory or wildcard exception was added.

## Final frozen-code acceptance

Final implementation/boundary SHA:
`8c587aa5003d7f2b2c4baa53a19fbfc8c1abf32c`.
The later acceptance-record commit changes documentation only.

| Check | Final evidence |
| --- | --- |
| Actual M00/M01/M02/M04/M05 composition | **166/166 passed**, zero failures/skips; `scope-*`, all `multiuser-*`, and `private-data*` tests. |
| Independent final M05 review | **57/57 passed**, zero failures/skips, at the exact frozen SHA; no remaining P0/P1/P2. |
| Independent boundary negatives | **4/4 passed**, including undeclared imports/surfaces and the legacy-composition prohibition. |
| Second reviewer | Independently selected **15/15** high-risk negatives at runtime-identical `b089f536`, including hydration cancellation/disable, missing key, epoch reset, feature binding, failure classification and unknown outcomes. |
| Emitted production entry | Auth and configuration process tests **2/2**, using `apps/server/dist/index.js`. |
| Emitted production task | One host handler executed once, persisted checkpoint/progress/result, committed through private-data, rejected B, scoped Operations and retained success over restart. |
| Emitted model restart | Two distinct Node processes imported compiled `app.js`; same original snapshot/settings/document/price restored, one owner-attributed usage receipt at cost `0.00024`, no extra snapshot, B/forged/retired leases rejected. No transport was created; unexpected fetch count zero. |
| Production builds | Server and Web builds passed; existing Vite chunk-size advisory remains. |
| Required affected check | **exit 0**: full `check:local` and Android `:app:testDebugUnitTest`; Android XML: **329/329**, zero failures/errors/skips, all 25 Gradle tasks executed. |
| Full consumer totals | Desktop **456**, Server **2099 passed / 1 existing skip**, Web **469**, Agent **316 passed / 1 existing skip**, Diagnostics **5**, Shared **190**, root scripts **81**, CLI **4**; central-runner smoke passed. |

The two existing opt-in/platform skips are the macOS sandbox fixture and the
installed Codex/local-Responses fixture. This module adds no skips. Existing
Android Kotlin compiler warnings and the Web bundle advisory do not fail the
checks; no application or workflow setting was changed to suppress them.

Commands for the focused composition and emitted entry checks:

```sh
node --import tsx --test apps/server/test/scope-*.test.ts \
  apps/server/test/multiuser-*.test.ts apps/server/test/private-data*.test.ts
MOTE_AUTH_PROCESS_ENTRY="$PWD/apps/server/dist/index.js" \
MOTE_CONFIGURATION_PROCESS_ENTRY="$PWD/apps/server/dist/index.js" \
  node --import tsx --test apps/server/test/multiuser-auth-process.test.ts \
  apps/server/test/multiuser-configuration-process.test.ts
```

The final affected check used the integration remote-tracking ref at
`6272a9b51ec92cc4c32e2ff1a1eeb4fa38b142ed`, with explicit installed JDK 21 and
Android SDK paths:

```sh
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
ANDROID_HOME=<redacted-personal-path> \
PATH="/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home/bin:$PATH" \
  npm run check:affected -- --base origin/codex/mote-multiuser-integration
```

The initial M04 prerequisite composition was **108/109** because its process
fixture still expected M02's `/api/materials` route to return 503. That assertion
now expects the actual admitted 200 response; the final 166-test composition
includes the corrected real process journey and zero skips.

Earlier `70bf4288` and `b089f536` complete-check candidates were stopped when a
subsequent review or boundary declaration made them obsolete; neither is counted
as a final full-check pass. The confirmed legacy fixture race and undeclared
helper failure above are preserved as failed intermediate evidence.

Draft PR [#130](https://github.com/utopiafar/mote/pull/130) is open with
`isDraft:true`, head `codex/mote-multiuser-m05-execution` and base
`codex/mote-multiuser-integration`. Its code freeze is the exact SHA above;
subsequent changes to this record are documentation only. Remote verification
kept integration at `6272a9b51ec92cc4c32e2ff1a1eeb4fa38b142ed`. No prerequisite PR,
integration or main merge was performed.

GitHub **Checks** and **Component checks** remain `disabled_manually`; their
settings were read without mutation. An empty remote check rollup is reported as
not run, never as a CI pass. The final PR metadata and remote module SHA are
verified again after the documentation-only publication update.

Local supporting evidence: `/tmp/mote-m05-8c587aa5-affected.log` and its exit-0
receipt, `/tmp/mote-m05-final-composition.log`,
`/tmp/mote-m05-review-8c587aa5.log`, emitted auth/config/task logs, and
`/tmp/mote-m05-compiled-model-1D6K75/compiled-production-model-restore.log` (including
compiled-file SHA256 and both process IDs). These logs contain generated data only.
