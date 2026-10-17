# Personal Memory and Insight observations

The original advanced Memory settings keep their existing lifecycle values and
recipe/version controls. Expanding that section also shows existing per-account
extraction/consolidation windows and explicit Insight/working-memory policies.
This is a read projection of M07 receipts, M08 policies and M05 task facts. It
does not create a global lifecycle, a new extension runtime, a scheduler, model
work, a grant, or synthetic pending/success counters.

`GET /api/memory/observations?limit=20&cursor=...` returns
`{scope:'account',items,nextCursor}`. The signed opaque cursor binds deployment,
account and limit. Owner filtering and chronological/keyset ordering precede
LIMIT. Each row contains its UUID, `kind:extraction|consolidation`, persisted
window state, revoked flag, creation/due times, actual pending count, optional
Memory job ID and optional task observation. Extraction count/due use the saved
receipt's policy and group; consolidation uses the existing current, published,
unintegrated episode selection. A completed window has no remaining selected
work. These counts are not whole-archive completeness or model progress.

Existing `GET /api/ask-automations` and `GET /:id` add `observation`. An available
observation has the policy's frozen due time, current matching pending events
and exact task. Explicit source withdrawal returns
`{available:false,reason:'ask_automation_source_changed',task}` without a false
zero count. Policy metadata remains readable. GET does not admit work, move an
event cursor, reopen a source, or perform provider/model I/O.

Task observations expose only exact ID/kind, state, attempts, next check time,
reason, unresolved external-call count, confirmation requirement and allowed
retry/cancel actions. They omit input/body, content, credentials, model settings
and checkpoints. The existing owned task endpoints retain authorization and
unknown-outcome confirmation. The browser validates each task's handler family
against the displayed window/policy before exposing controls.

Insight/working policy pause, resume, stop and retry keep their existing routes.
They optionally accept `{expectedGeneration:UUID}`. The original page always
sends that generation; the service compares it inside the existing transaction
before changing policy or task state. A retained button for a stopped and
re-admitted same-ID policy therefore returns409 and cannot control its successor.
Legacy empty-body callers remain supported. An unknown external outcome is not
silently confirmed through a policy control.

The view mounts only when the original Memory settings are expanded, polls
while mounted, and uses the fixed credential-bound Api, abort/current checks and
strict receipts. Closing, unmounting and account replacement retire callbacks
and controls. Generic retry stays on the original task and original saved
window; it does not reinterpret the current configuration as new authority.

This restores registered-window/policy observations. It does not claim a global
extension inventory, externally hosted provider health, a default policy that
was never explicitly admitted, or whole Memory acceptance.
