# Default bounded task retries — 2026-10-21

## Behavior and decision

The owner selected two automatic retries after the initial execution, including
eligible read-query unknown outcomes. Current M05 families default to three
charged logical attempts. Explicit narrower operation limits remain. See the
[accepted recovery decision](../adr-task-recovery-and-execution-budgets.md).

A retry resumes the failed stage under current authority. Successful drafts,
accepted file chunks and published siblings remain reusable under their original
input checks. Capacity waiting cannot erase earlier work from the same attempt.
Unknown read replay requires exact full physical cleanup; remote outcomes and
fees remain unknown. Effects retain their same-operation reconciliation rules.
Owner retry rounds are distinct from automatic parent/ACK continuation. A
recording owner command freezes and resets its exact children once atomically.
New charged model attempts may derive only the current service tier while
retaining original settings, history, authority and checkpoint dependencies.

## Focused evidence

All content is generated. Commands ran headlessly. No paid live model or physical
device check was performed.

| Journey or state | Evidence |
| --- | --- |
| Finite default, mixed/concurrent waits, interruption, suspended final attempt, stale recovery scan across SQLite connections and read-only historical projection | `execution-default-retries.test.ts`: nine cases passed. Renewed and replacement sessions remain open; historical counters are not rewritten. |
| Formal M04/M05 same-task unknown read, Fast to ordinary immutable retry lineage, restart, live generated child cleanup barrier, revoked connection, one-shot owner group, atomic rollback and historical replacement guards | `multiuser-default-retries.test.ts`: nine cases passed at the named focused revisions. Exact raw unknowns, policy events and owner acknowledgments remain distinct. |
| Nested physical owner/task/snapshot/mode/attempt, second issuance and exclusive-resource cleanup | `task-physical-calls.test.ts`: two cases passed. |
| Real file API partial summary, retained first Fast chunk, failed-page ordinary retry, later same-original turns and explicit false-confirm replacement | `multiuser-configuration-codex-consumers.test.ts`: the generated Codex runtime case passed without re-extraction, replaying the first chunk or manufacturing historical owner acknowledgments. |
| Actual summary first-page versus later-page 429 waiting and restart | `multiuser-processing-default-retry-checkpoints.test.ts`: two cases passed. A wholly unexecuted wait remains free; prior accepted work retains the same charged session. |
| Scoped Memory extraction/review issuance recovery, successful raw checkpoint reuse and finite repair | `scoped-memory-issued-query.test.ts`: six original revised cases passed; an additional corrupted persisted-draft control passed with zero new reviewer queries. |
| Strict image reviewer rejection and new query generations | `multiuser-memory.test.ts`, `scoped review restores bounded post-review repair`: eight cases passed. The outer-recovery case retains one extraction and three independent reviewer outputs; persistent rejection stops at three attempts and six review queries. Cancellation, input/epoch changes and unknowns keep their own boundaries. |
| Real recording retry after default exhaustion, restart and explicit owner recovery | `multiuser-connectors-05.test.ts` focused case passed; successful phase checkpoints remain. |
| Backup admission and lifecycle | Existing backup/lifecycle cases passed. Twenty current-schema table/column damage controls reject before restore writes. Two additional formal account-deletion cases retain pre-issuance and unsettled physical barriers; late cleanup cannot publish or invent settlement. |
| Existing consumers | Model snapshot encryption/authority, execution reads and operations: 21 passed. Connectors/OAuth, media health, usage and retry-hook rollback: 23 passed at their named focused revisions. |
| Existing Web navigation and controls | Original operation/file/image/workflow cases passed. Added count, suspended last-attempt, historical overage and policy-authorized read-dialog controls passed. |
| Legacy owner boundaries and lifecycle timing | 41 focused cases passed at the first legacy followup revision across existing image, perception, file, workflow, Memory, index and recording consumers. Explicit owner commands reset only their selected failed work; readiness and automatic parent wakes retain the budget. A new crash-gap regression consumes an engine failure once, preserves the original 120-second backoff across restart and keeps capacity waiting free. |
| Integration corrections | 145 focused cases in 13 Server test files passed after correcting premature dynamic timeout evaluation, phased import owner origin and independent lifecycle clock translation. Original three-record and 400-member ZIP recovery, partial checkpoints, late fences, completed siblings, current backup below-cap recovery and final-cap no-send controls remain. A generated 600-second provider deadline survives a crash with different engine and lifecycle clocks. |
| Real process recovery and cleanup admission | 23 additional focused cases passed. The two-account source Ask entry retains SIGKILL as a no-replay negative with original active physical facts; a separate formal SIGTERM/cleanup/restart case preserves original completion, five usage receipts, frozen model/lease, citations and isolation. Actions rejects Retry while the original callback remains active, then succeeds through its existing owner entry after exact cleanup. Matching compiled Ask entry also passed both cases. After independent review requested direct history assertions, six compiled-Ask/Actions cases passed with unchanged exact retry-round, policy-replay and owner-confirmation journals in the rejection paths. |
| Static contracts | Server and Web type checking, bilingual message synchronization and current scope inventory passed at the named focused revisions. |

The independent implementation review found two defects before delivery: stale
lease recovery could close a newer attempt session, and a false-confirm file
replacement could manufacture historical owner acknowledgments. Both were fixed
and independently approved with exact source pins. Original failed receipts are
retained privately; later results do not rewrite them.

## Delivery stage and remaining gates

The implementation and named generated integration journeys are complete.
The first full driver stopped at Java preflight; all other steps were unrun.
The installed JDK 21 was then located without installing software or changing
validation criteria. A later driver correctly invalidated Desktop inputs changed
by its own build fixture; Desktop was prepared before the next run. That run
found Server integration failures and was interrupted by its owner. Its original
cleanup-unconfirmed receipt remains ineligible for reuse; independent checks
proved its process group dead before archiving only its coordination lock.
Focused corrections do not turn that interrupted suite into a pass. At that
stage, the frozen candidate still required the full `check:affected` plan, assembled
consumers, Android compilation/unit checks and applicable remote PR rules. This
earlier record did not claim merge readiness, deployment, paid live-model validation,
physical-device validation or full-corpus semantic quality. Current runtime
configuration was separately read back in ordinary mode; source deployment is a
separate receipt. The supersession scan also removes three obsolete wider
four-attempt registrations from legacy Memory/delegation; the same selected
three-attempt cap and owner/internal origin apply.

## SDK restart fixture correction

The `6c1e68ad` candidate passed 3,924 Server cases, with nine existing skips
and one failure: the MCP process journey counted 17 provider requests after
restart against a baseline of 16. A generated diagnostic showed that the
unrelated `same-source` Memory batch was still retrying when that baseline was
recorded. Its fixture had supplied a quote absent from the private-marker input.
This was not evidence that the completed `memory-source` work replayed.

Commit `33df59d9` corrects that generated response and uses the formal tasks and
materials APIs to wait for both sources, successful intake and batch tasks, and
physical cleanup before freezing the global count and after restart. Pagination
is checked explicitly. Original Memory IDs, global no-replay, account isolation,
SDK/listener, SIGKILL, stale-session, revocation and SIGTERM assertions remain.
No product code, input scale, assertion or existing deadline was relaxed.

The independent Sol High reviewer approved plan
`PR209-mcp-state-control-v1` before implementation, bound to base `482148ba`
and head `6c1e68ad`, then confirmed that the final diff matched it. The existing
bounded-retry design approval remains applicable.

Generated focused checks passed: source MCP process, kind and Coding journeys
(three cases, 7.2 seconds), plus the compiled production listener journey
(one case, 5.8 seconds). The full `33df59d9` run also passed the SDK journey.
It passed 3,924 Server cases with nine existing skips, but stopped on the
separate generated-log race below; that failed receipt is retained.
GitHub `Checks` and `Component checks` were verified as `disabled_manually`,
and main has no required status checks or PR reviews. No remote CI success,
deployment, historical paid recovery or physical-device check is claimed.

## Generated Codex log framing

The full-run error was `Unexpected end of JSON input` in `native.calls()` while
the generated Codex process was appending a JSONL prompt. The test had parsed
an unfinished trailing record. Commit `4410fc6b` shares one reader between the
parent fixture and generated process: only newline-complete records are parsed,
and malformed complete records still throw. A deterministic regression covers
partial, completed-but-unframed, completed-and-framed, corrupt and empty records.
All three original consumer journeys and their assertions and deadlines remain.

The independent Sol High reviewer conditionally approved
`PR209-generated-log-framing-v1` against base `482148ba` / head `33df59d9`,
then checked the matching failure stack and implementation. The complete
consumer file passed all four cases in 11.3 seconds. The affected run for
`4410fc6b` passed Server (3,926 passed, nine existing skips) and Shared, then
stopped at the Web snapshot-synchronization failure below. Original receipts
remain distinct from later driver-verified reuse.

## Workflow control snapshot synchronization

The Web context-step journey waited for a retried task to fail in the backend,
but its one post-retry read could still show the earlier waiting/running state.
The panel intentionally refreshes through its existing control. Commit
`51e5c702` clicks that real Refresh button and uses the existing DOM wait to find
the same task ID, failure reason and cancel control before continuing. Original
retry, cancellation confirmation, artifact retention, unknown-outcome and
late-owner assertions and all waiting limits remain unchanged.

The independent Sol High reviewer approved `PR209-web-step-refresh-v1` against
base `482148ba` / head `4410fc6b` before implementation and then verified the
diff. The focused original journey passed in 2.2 seconds. The next driver passed
all 645 Web cases and all TypeScript integration tasks, then stopped because
Gradle lacked its local SDK path. The installed SDK was configured in ignored
`apps/android/local.properties`; no tracked source or inherited environment was
changed for that repair.

## Final candidate — merge-ready

The final driver passed all 23 selected tasks at `51e5c702`, with confirmed
cleanup and stable inputs: eight tasks newly executed and 15 explicitly
`REUSED` from matching original passed receipts. The final receipt is
`2026-10-21T16-17-20-387Z-dc1f3c3d-e2da-4117-9f81-60cadd3563c4.json`.
Earlier failed and unrun tasks remain recorded separately.

- Server: 3,926 passed, nine existing skips, no failures, originally executed
  at `4410fc6b` and accepted by the driver as `REUSED` for this candidate.
- Web: 645 passed, no failures or skips, originally executed at `51e5c702`
  and accepted by the final driver as `REUSED`.
- Android: 414 unit tests passed with no failures, errors or skips; compilation
  and tests executed in the final driver using installed JDK 21 and SDK.
- Shared, Agent, Desktop, diagnostics, type checks, translation/scope contracts,
  release, root security/media, backup/update, CLI and central-runner obligations
  passed or were explicitly accepted as `REUSED` in that receipt.

The previously approved extra accounting assertions also passed the existing
generated two-wait/two-restart summary journey at `51e5c702`: the first accepted
usage fragment remained byte-identical, four distinct raw receipts retained two
consumed and two certified-not-started fragments, public usage contained only
the consumed fragments, and the other account had no usage. Exactly one case
ran, inputs stayed stable and fixture cleanup was confirmed. Its first scratch
launch stopped before the case because `.ts` outside the repository inferred
CommonJS; rerunning the same assertions as `.mts` restored the original ESM
entry semantics. Both launch receipts are retained, and neither changes the
source full-gate result.

The final documentation commit only updates this record; runtime inputs remain
those accepted at `51e5c702`. Checks were headless and used generated inputs and
local model fixtures. GitHub checking workflows remain manually disabled, so no
remote CI success is claimed. Deployment, historical paid-task recovery,
physical-device checks and paid live-model checks were not performed.
