# Actions parity validation, 2026-10-18

Base: `2c78ca8d52a7d17fae20962cf68d09a717ffc73a`. Branch:
`codex/parity-actions-20261018`. Generated fixtures only; no personal captures,
live model, supplier account, real calendar or physical device was used.

The shared pure-contract commit is
`ece742f090a9d2502775184b0396e073050e4de9`. The module candidate and final
`check:affected` receipt are reported with the PR; the preliminary checks below
were run against this branch's working implementation, not the unchanged base.
The [ADR](../adr-actions-business-parity.md) records the supersession decision.

## Journey mapping

| Item | Production journey and durable regression |
| --- | --- |
| ACTION-A01 | Generated capture HTTP → bounded complete segment → memory-model unified semantic product (`kind=semantic`, `productsVersion=1`) → exact cue ranges → chat-model calendar relationship pass → OwnerQuestions → claim/receipt. Same capture IDs in A/B stay private. Empty cues checkpoint without calendar calls or even a configured chat model. Restart reuses success. Held producer/relationship responses cannot publish after source deletion. Stopping the discovery parent fences its in-flight producer, and one explicit retry resumes the same task. `multiuser-actions-semantic-parity.test.ts`. |
| ACTION-A01 input range | Long originals retain 12K/2K overlapping direct ranges; structured V2 pages retain direct extraction. Actual M03 file/M06 transcript fixture reaches its final Unicode range; existing multi-original formal Material input remains reachable. Trusted Coding session and derived Material closure trigger no automatic Actions model call; B's ordinary same-source-ID input still works. Explicit manual Todo references to the Coding original remain permitted. |
| ACTION-A02 | Actual HTTP/Harness batches cover duplicate before/after update, repeated updates and duplicates, dismissed decision preservation, exact new-proposal deduplication and distinct evidence preservation. Approved/executing/uncertain child operations pin the original. Restarted unknown native claim stays reconcile-only. `multiuser-actions-batch-parity.test.ts`. |
| ACTION-A03 | Successful job inputs/proofs/task IDs/attempts and per-user cursors remain identical through disable/re-enable, timezone change and restart. New disabled-period input is processed once. Failed/interrupted units retain their existing explicit retry; late old model output cannot publish. Unknown native issuance remains one issuance and cannot mutate again. `multiuser-actions-replay-parity.test.ts`. |
| ACTION-A04 | Source rename/no-op preserves pending review and approved delivery through restart. Unknown native result → restart → rename → claim remains `mutationAllowed:false`, and exact duplicate success ACK is idempotent. Source disable/re-enable, owner relation/context changes and delete/recreate still invalidate old authority; B is unchanged. `multiuser-actions-source-metadata.test.ts`. |
| ACTION-S1 | Manual Todo create/update references owned screen/file/reference/archive originals and Material-covered original IDs. Canonical Material IDs retain their normal current-revision validation. Idempotency, CAS, restart, duplicate-ID rejection, cross-user 404, source disable/delete, original deletion/supersession and privacy/account revocation remain enforced. `multiuser-todos-evidence-parity.test.ts`. |
| Execution/lifecycle consumers | Existing real startup/SIGKILL/native-ledger fixture retains a single issued write and performs marker/receipt recovery. Stopped backup checks include discovery cursors, semantic product/cache dependencies and complete Actions/Todo schemas. Domain/account deletion tests verify the added private tables are erased. |

## Actual commands and boundaries

Workspace: `/Users/utopiafar/.codex/worktrees/parity-actions/mote`.
Runtime: Node `v26.11.1`, ABI `147`.

| Command | Actual result and evidence |
| --- | --- |
| `npm ci --ignore-scripts --no-audit --no-fund` | Exit 0; isolated workspace dependencies, unchanged lockfile. This alone did not prepare native dependencies. |
| `npm run build:libs` | Exit 0. |
| `npm rebuild better-sqlite3` | Exit 0, `/tmp/mote-actions-native-prepare.log`. Server and Mem0 resolvers both opened and closed a real in-memory native SQLite database afterward. |
| `node node_modules/electron/install.js` | Exit 0, `/tmp/mote-actions-electron-prepare.log`; local Electron executable exists. No UI was opened. |
| `node --import tsx --test --test-concurrency=2 apps/server/test/semantic-products.test.ts apps/server/test/conversation-understanding.test.ts` | 19/19, exit 0; `/tmp/mote-actions-shared-contract.log`. Qualifies the shared-contract seam above, not the entire module. |
| `node --import tsx --test --test-concurrency=2 --test-timeout=120000 apps/server/test/multiuser-actions*.test.ts apps/server/test/multiuser-todos-evidence-parity.test.ts apps/server/test/semantic-products.test.ts apps/server/test/evidence-archive-generation.test.ts apps/server/test/multiuser-backup-actions.test.ts` | 106/106, exit 0; `/tmp/mote-actions-focused-final.log`. This run preceded the final explicit semantic product header; that final producer/header delta is covered by the focused A01 rerun and final affected gate. |
| `node --import tsx --test --test-concurrency=1 --test-timeout=120000 apps/server/test/multiuser-actions-semantic-parity.test.ts` | Final versioned-product rerun: 7/7, exit 0; `/tmp/mote-actions-a01-versioned.log`. |
| `node --import tsx --test --test-concurrency=2 --test-timeout=120000 apps/server/test/multiuser-actions-semantic-parity.test.ts apps/server/test/multiuser-actions-replay-parity.test.ts apps/server/test/multiuser-backup-actions.test.ts` | 29/29, exit 0; `/tmp/mote-actions-last-lifecycle-final.log`. Covers the final versioned producer, parent cancellation/retry ordering, indexed group lookup and existing stopped recovery. The subsequent three new backup-table negative cases are verified with the emitted backup rerun below. |
| `npm run build -w @mote/server` | Exit 0; `/tmp/mote-actions-server-build.log`. |
| `MOTE_ACTIONS_PROCESS_ENTRY=/Users/utopiafar/.codex/worktrees/parity-actions/mote/apps/server/dist/index.js node --import tsx --test --test-concurrency=1 --test-timeout=120000 apps/server/test/multiuser-actions-process.test.ts` | 1/1, exit 0; `/tmp/mote-actions-emitted-process.log`. Actual emitted startup, SIGKILL and native-ledger/ACK recovery with generated transport. |
| `MOTE_M16_COMPILED_HOST=1 node --import tsx --test --test-concurrency=1 --test-timeout=120000 apps/server/test/multiuser-backup-actions.test.ts` | 20/20, exit 0; `/tmp/mote-actions-emitted-backup.log`. Includes all three added private table preservation and missing-table rejections, and emitted host restart. |
| `npm run typecheck -w @mote/server` | Exit 0 after the runtime changes. |
| `node scripts/check-scope-contracts.mjs` | Exit 0; new scoped tables/tasks and exact shared pure imports are inventoried. |
| `npm run check:affected -- --base 2c78ca8d52a7d17fae20962cf68d09a717ffc73a --dry-run` | Exit 0; `/tmp/mote-actions-check-plan.json`. Necessary stopped-backup schema changes conservatively select all TypeScript consumers and Android unit tests. A dry run is not a gate pass. The final frozen-SHA gate must complete before opening the module PR. |

The initial broad Actions run had one failing multi-original formal Material
journey (70/71); restoring that direct Material branch made its focused rerun
pass and it passed in the subsequent 106-test run. New fixture setup errors for
an unsupported configuration GET and a noncanonical derived Material ID were
corrected before the seven-case semantic rerun. These failures are not counted
as passes.

The existing process fixture defaults to the TypeScript entry. A separate
emitted build must explicitly set
`MOTE_ACTIONS_PROCESS_ENTRY=$PWD/apps/server/dist/index.js` when running
`multiuser-actions-process.test.ts`; source-entry results do not prove emitted
startup. The final candidate report distinguishes these runs.

Real-model semantic quality, real native calendar permissions/providers,
physical clients, deployment and main-branch integration are unverified here.
The pre-existing raw-capture rowid deletion/reuse edge remains a separately
reported follow-up; no new historical repair or replay job was introduced.
