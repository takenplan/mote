# Ask producer lifecycle and processing transaction regression

The complete required gate on `e427eccd` failed three Server cases. Its original
receipt and log remain failed; focused validation cannot replace that gate.

## Classification

- `multiuser-ask-retrieval.test.ts` observed one current semantic vector per
  owner, then assumed that every producer had completed. The original failure
  was five embedding requests versus four. An unchanged-source diagnostic bound
  the extra request to B's still-running canonical metadata embedding task.
  After restart the same task, input receipt, grant and fixed model completed;
  succeeded producers were unchanged. This is an incorrect test precondition,
  not evidence of completed-vector backfill or a different model selection.
- Both `multiuser-processing.test.ts` failures use `publishedIntakeTasks`. It
  expected five tasks before Ask indexing was attached to the real M03 intake
  and M06 publication hooks. Both additional `ask.index-admit` tasks are durable
  controls, including when optional embedding is unconfigured. Their exact
  capture/publication events, owners, grants and absent model authority are now
  checked rather than filtered out of the task set.

## Durable state transitions

The capture test holds B's generated metadata embedding response while its text
vector is already queryable. It restarts this unfinished task and verifies the
same identity, immutable input/model receipt, owner grant and authorization epoch.
Only that exact interrupted input is reissued. It then waits for every admitted
organizer/index producer and all current canonical vectors before a second
restart. Completed tasks, events, grants, vectors and provider call count remain
unchanged. Original A/B retrieval and actual Ask citation assertions remain.

The processing helper's two consumers cover automatic file intake and a caught
nested admission failure. The latter retains the valid seven-task publication
while all invalid child task/grant/resource/progress/fairness/sequence effects
roll back. An uncaught hook failure also proves that the Ask Material event
rolls back with its publication, while the committed capture intake survives.

KEEP: production startup/intake, automatic processing, exact current Materials,
retention, owner grants, immutable model leases, finite recovery and no historical
paid backfill. CHANGE: fixture readiness and assertions for the actual event/task
graph. REMOVE: first-vector readiness as proof that all producers completed and
the obsolete five-task expectation. EXCEPTION: generated response barriers and
read-only fixture diagnostics. UNKNOWN: a new full gate, independent review,
combined candidate, native applications, devices and live models remain separate.

No production code, defaults, permissions, schemas or migration paths change.
