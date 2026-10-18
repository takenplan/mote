# Scoped execution parity (2026-10-18)

This change restores the scheduling and Operations contracts from single-owner
baseline `2c262762` on the current scoped production composition (`2c78ca8d`).
It does not migrate a vault, replay retained personal data, deploy, or grant
execution authority to restored metadata.

| Disposition | Contract |
| --- | --- |
| KEEP | One ExecutionEngine, durable per-account then operation/stage fairness, leases, input grants, shared physical resources, cancellation and synchronous commit fences. |
| KEEP | Separate interactive/background reservations, live instance settings, the existing background maximum of 32, and the existing physical harness gates. |
| CHANGE | Production binds `ask.models` to host-derived lanes (`ask.chat`/`ask.compact` interactive; Insight background), and `memory.models` to `memoryConcurrency`. Saving settings wakes queued work; lowering a limit does not preempt running work. |
| CHANGE | Operation IDs retain their business prefix and an account-bound opaque SHA-256 body. `workflow:actions:` retains its marker. Family is presentation metadata and never determines permission or execution kind. |
| CHANGE | Trusted domain admissions link canonical business parents in the same transaction, including idempotent task reuse. Explicit business-ID and owned-task parent APIs support late children. Parent generation slots retire obsolete membership while retaining history; old descendants cannot reactivate it. Recursive membership propagation is enabled by the projection installer. |
| REMOVE | A common fixed-two Ask reservation, effective fixed-two Memory admission, and generic `task:` replacement of business prefixes. Work SQL is not a substitute for Operation hierarchy. |
| EXCEPTION | Parent attribution affects progress, not cancellation policy. Domain cancellation continues to cancel the appropriate tasks; no new cascading-cancel policy is introduced. |
| EXCEPTION | Provider cancellation is cooperative; unknown external issuance remains durable and blocks blind replay. Account revoke/delete still invalidates publication. |
| UNKNOWN | Physical devices, real providers/models, multi-process aggregate physical harness limits, and deployment behavior require separate evidence. |

Production Ask coordinate/fragments attribute to `query:<runId>` or
`insight:<runId>`. Import preparation/commit attribute to `import:<jobId>`;
imported captures and their file processing, nested image/extraction and derivative
steps join the corresponding business chain. IDs remain private to one user,
including same business IDs in two accounts. Business parents can be installed
before a child exists, and a completed checkpoint can join another parent without
executing again. HTTP task submission cannot supply parent options.

Memory owns its extract → exact validation/correction → independent review → save
sequence and its single per-user publisher. Its companion parity change limits
the publication resource to actual publishing, restores canonical job attribution,
and validates configured parallel batches plus saving under continuous backlog.
Actions owns its original `workflow:actions:` business prefix. These companion
changes are integration dependencies, not proof from a standalone engine snapshot.

## Durable generated regressions

- `apps/server/test/multiuser-execution-parity.test.ts`: production startup and
  authenticated HTTP kind filters/change cursors; same-ID account isolation;
  existing/late three-level and shared children; cancellation/late progress fences;
  restart; atomic parent admission/reuse; foreign-parent rollback; current/history
  parent generations and maximum admitted identity length.
- `apps/server/test/multiuser-execution-business-parents.test.ts`: real text import,
  cancelled ZIP preview → new preview → confirmation, and same-configuration file
  retry with the exact owner-bound receipt consumed by Android. The image recipe
  fixture also checks canonical image/file progress and restart.
- `apps/server/test/multiuser-execution-lanes.test.ts`: generated loopback model
  transport holds two background Insights while chats complete; two accounts,
  actual interactive capacity 2 → 4 → 1, queued cancellation and zero attempts,
  and settings retained on restart. Memory snapshot assertions establish the
  configured scheduler boundary, not model pipeline parallelism.
- `apps/web/test/multiuser-operation-feed.test.ts`: production HTTP changes drive
  the actual Web resource invalidation consumer, without a reset or manual refresh.
- Existing execution/user-resource, recovery, external-journal and independent
  harness fixtures retain their own purpose. Assertions that expected a task to
  claim a slot merely to wait inside an Ask/Memory gate now observe its durable
  queue instead.

All fixtures use disposable generated accounts, content and provider responses.
Commands, candidate SHA, exit status and evidence are recorded in the module PR
and shared integration ledger after execution. No physical-device or live-model
result is inferred from these tests.

The necessary Android `sendFileRetry` consumer validates the same `file-retry:`
family and owner hash as the producer. Its previous hard-coded generic `task:`
prefix is superseded together with the server change. Android compilation/unit
checks and native UI/device checks remain separately reported. No translation
keys or user-facing configuration limits are added.
