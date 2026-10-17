# Scoped original context-step presentation

The original advanced Processing / Extensions controls stay in their existing
navigation and layout. Their production task source changes from the retired
global `context-dag` reader to the real owned M05/M06 steps. This does not install
the legacy workflow manager, a new task kind, scheduler, store or processor.
Custom context recipes and unregistered legacy plugins are not synthesized.

`GET /api/tasks/steps` accepts only `{state?,limit?,cursor?}`. State is the existing
seven M05 states, limit defaults10 and is bounded1..100, and cursor is an opaque
string. It reads existing `processing.*` task metadata; state and immutable owner
are applied before LIMIT. The durable private cursor binds deployment, account,
collection, complete state filter and page size. A changed query, foreign account
or modified cursor is400. Ordinary task and operation endpoints are unchanged.

The response contains `{scope:'account',engine:'scoped-task',limit,nextCursor,jobs}`.
Each job has its real `id`, `kind` as title, `pool` as lane, state, attempts,
availableAt, bounded reason code, exact dependency IDs, committed output artifact
locators, unresolved physical-call count, `confirmUnknownRequired` and candidate
retry/cancel actions. Output IDs attest the committed task receipt, not a new
capability to read deleted/current artifact bodies. Such reads keep their own
M03/M06 authorization. No task input, original content, model snapshot, credential,
instance queue capacity or invented output count is returned.

M05 task identity and handler registration determine which retry requests may be
offered in an eligible state. Its existing retry transaction remains decisive:
preparation may repair a blocked prerequisite, then rechecks all domain/grant
conditions. Execution-time `validate` is not called as a speculative retry gate.
A failed prerequisite may still make a request409; the UI displays that failure
and never claims a successful retry. Cancel uses the existing M05 endpoint and
retains completed outputs. Unknown physical facts are not reported as completed
by cancellation. The current task's issued/unknown state requires explicit user
confirmation before `{confirmUnknown:true}`; historical unresolved facts alone do
not add another execution authority or imply an automatic replay.

The original Web component captures its Api/account tree and signal before any
control. Account change retires rows, cursor, confirmation and old callbacks;
a late read or detached action cannot publish/send under the new account. The
original processor registry pane separately reads real registered processor
versions and stage metadata from existing GETprocessing. It does not pretend
that an unregistered legacy context processor has been migrated.
