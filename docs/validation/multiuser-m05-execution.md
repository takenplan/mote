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
- P2: deletion initially retained private operation/fairness metadata. Cleanup now
  removes the corresponding user/operation records, retaining only the domain
  admission tombstone; unknown external outcomes retain reconciliation evidence.
- P2: portable restore now checks input omission, normalized handler input,
  dependency completeness and an iterative acyclic graph before publication.
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
| Genuine model lease binding, fixed user snapshots, withdrawal, retained wrapper and missing restart snapshot | `multiuser-execution-model.test.ts`; synthetic WeakMap host using M04 signatures |
| WeakMap context provenance, copied/foreign contexts and task admin denial | `multiuser-task-context.test.ts` |
| Persistent fairness, operation ancestry, cursor independence, incompatible schema rejection and commit fences | `multiuser-execution-core.test.ts` |

The first full production/lifecycle/context group passed **19/19**; the model group
passed **5/5**. Core and extended engine/Operations regression groups passed
**28/28** and **32/32** during implementation. Exact frozen-code checks and remote
PR/CI verification are appended below after completion.

## Explicit integration limits

M04 confirmed it has no durable model snapshot ID/recovery API in this iteration.
M05 pins genuine in-memory M04 leases and persists only credential-free receipt
metadata. Restart without that object produces `blocked/model_snapshot_unavailable`
and performs no new lease/model call; JSON receipts cannot regain authority.
The independent M04 branch is not imported here, so actual M04 combined runtime
verification remains a joint integration check. No real model call is claimed.

Portable export explicitly covers task metadata/dependencies and handler-declared
credential-free input. It excludes active authorization, checkpoints, progress,
results, failure receipts and model snapshots. Portable history restore revokes
all grants and blocks unfinished work; it does not promise automatic task resume.
Whole-instance SQLite recovery retains the full original task/checkpoint state.
M16 owns final backup/recovery orchestration and coverage reporting.

Unimplemented business handlers remain closed. Physical devices, native renderer,
Android emulator, real providers/external reconciliation and deployment were not
run; generated engine fixtures do not prove those journeys. Repository workflow
settings are not changed by this module.
