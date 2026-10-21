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
| Legacy owner boundaries and lifecycle timing | 37 focused cases passed across existing image, perception, file, workflow, Memory, index and recording consumers. Explicit owner commands reset only their selected failed work; readiness and automatic parent wakes retain the budget. A new crash-gap regression consumes an engine failure once, preserves the original 120-second backoff across restart and keeps capacity waiting free. |
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
validation criteria. The final frozen candidate still requires the full `check:affected` plan, assembled
consumers, Android compilation/unit checks and applicable remote PR rules. This
record is not a claim of merge readiness, deployment, paid live-model validation,
physical-device validation or full-corpus semantic quality. Current runtime
configuration was separately read back in ordinary mode; source deployment is a
separate receipt.
