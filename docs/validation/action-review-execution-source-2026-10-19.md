# Fixed Actions review execution status: source candidate

Status: source preparation only; all runtime checks below are **UNRUN**.
Base: `2689e88d7ac2a58257903021d4224cd13bcd3c81`.

The observed original review still showed “等待客户端写入” after the actual native
operation had succeeded. The existing natural native worker, local event, server ACK
and restart evidence remain valid for that earlier candidate; they do not validate
this UI patch. This preparation does not repeat model or OS calendar work.

## Responsibility and supersession check

| Disposition | Contract |
| --- | --- |
| KEEP | OwnerQuestions approval/CAS, immutable reviewed payload/version/fingerprint, exact operation approval hash, account/device/target/source fences, paginated Actions history, native delivery and issuance. |
| CHANGE | The existing authenticated review-details GET adds a separate current `execution:{operationId,status}` only for a valid closed approved review. Web renders this current fact and observes pending execution through the existing visible-page resource poller. |
| REMOVE | The unconditional assumption that every closed approved review is still waiting for the client. |
| EXCEPTION | Immediately after the reply, the fixed snapshot can remain visible while current execution is being read. It does not infer a native success or manufacture an execution grant. |
| UNKNOWN | Type/build compatibility, executed fixture results and integrated-candidate UI behavior remain unverified in this source-only window. |

The closest UI pattern is the existing Actions card: identical executing, uncertain
and successful-operation messages, the same fixed review content and existing
refresh/error controls. Existing English and Android catalogs contain every reused
message. No new product limit, permission step, navigation, table, route, model tool,
or native mutation behavior is introduced. No compatibility path is added.

## Durable regression sources

- `apps/web/test/action-review-execution.test.ts`: succeeded reload, version-one
  snapshot, no writes or history scanning, approved/executing/uncertain/succeeded
  observation and terminal poll cleanup, rejected detail read, same-ID Api replacement,
  accepted-state reset, retained old button and late old execution response.
- `apps/web/test/multiuser-actions.test.ts`: existing original Actions → fixed review →
  OwnerQuestions entry → approval journey now consumes a generated successful receipt
  through the real product HTTP entry points and checks the displayed success plus
  unchanged reviewed payload. Its model transport is a fixture, not a live model.
- `apps/server/test/multiuser-actions-fences.test.ts`: current execution advances through
  approved/executing/uncertain/succeeded with the identical snapshot; cross-user reads
  remain absent and changed target binding rejects the old review.

## Coordinator validation plan and resource request

All installs, builds, typechecks, tests, live APIs/models, live databases and native
UI checks are UNRUN in this window. Only source inspection and `git diff --check`
were performed. This candidate is not delivered to a target branch or release.

Request: one coordinator-assigned headless Node/build slot after the running File
whole check releases its peak; do not start another full check beside it. Prepare
workspace dependencies/build prerequisites in that slot. Focused regression inputs:

```sh
node --import tsx --test --test-concurrency=1 apps/web/test/action-review-execution.test.ts apps/web/test/multiuser-actions.test.ts apps/web/test/multiuser-action-review-target.test.ts apps/server/test/multiuser-actions-fences.test.ts
```

For the frozen integration candidate, the driver must generate and review the actual
`npm run check:affected -- --base <integration-base> --head <frozen-head> --dry-run`
plan, then run the corresponding complete affected check. Expected direct components
are Server and Web with dependency builds, i18n/scope/release contracts, their consumer
suites and central runner as selected by the repository planner. This is an estimate,
not an executed plan or pass receipt. Do not reuse the base candidate's results.

After fixture validation, use a coordinator-approved headless original review entry
with generated data and a recorded successful execution response to verify the UI.
No real screenshot collection, model rerun, OS mutation or physical-device check is
needed to reproduce this display defect. Any separately requested native or live-model
check must keep its own candidate identity and result.
