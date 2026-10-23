# Execution observability validation

Date: 2026-10-23. Status: **implementation-complete** for the bounded metadata
change. Local Dev upgrade and live observation remain pending. This is not a
lease-expiry fix or a merge-ready claim.

Seven renewable-lease recoveries observed during local monitoring lack sufficient
causal evidence. Their root cause remains **unknown**. This scope adds bounded
metadata for future investigations; it does not claim to repair lease expiry.
The [task recovery decision](../adr-task-recovery-and-execution-budgets.md) keeps
renewable ownership, charged attempts, external outcomes and exact physical
cleanup separate. Existing
[diagnostics privacy rules](../memory-validation-diagnostics.md#correlation-and-privacy)
and [profile policy](../adr-profile-release-policy.md) remain in force.

## Observation contract

| Fixed event | Observation boundary |
| --- | --- |
| `task.loop_timing` | Existing host timer gap, callback lateness, wall/monotonic divergence and synchronous tick invocation. It does not time the full lifetime of promises started by a tick. |
| `task.lease_timing` | Renewal callback timing and locally known prior lease remaining/overdue values or bounded summaries. Local timing is not a fresh database read. |
| `task.lease_renewal` | Outcome and synchronous duration of the original renewal CAS, including a miss or exception; original abort/error behavior remains. |
| `task.lease_recovered` | A successful original expired-fence recovery CAS, without inferring remote completion or physical cleanup. |
| `memory.reader_timing` | Scoped query reader backend callbacks and separately named preparation, catalog snapshot and assertion spans; it excludes unmeasured bridge serialization/network lifetime. |

Only actual controlled task identities may populate `taskKey`, which accepts
exactly 64 lowercase hexadecimal characters. `attemptId` uses the unchanged UUID
validator; other existing identifier validators are not widened. Shape validation
alone does not authorize arbitrary producer input. Closed operation labels are
written through the existing `name` field, with fixed phase/state/reason labels.
No general operation-label field or free-form producer text is introduced.

Payloads contain fixed metadata and finite numeric measurements only. They omit
source/OCR/audio/image content, Memory statements, prompts, tool arguments/results,
SQL or bindings, arbitrary exception text/stacks, credentials, account identifiers
and grant/fence values. Observational clock reads, wrappers and logger calls must
not throw into business paths, change returned values/errors or alter callback,
CAS, transaction or authority ordering.

Each logger admits at most 40 routine/timing entries and 20 failure/recovery
entries in a declared 60-second monotonic window, plus at most one fixed
suppression/window summary: at most 61 new events. The separate failure allowance
cannot be consumed by routine reads. Producer payloads are bounded to 1 KiB before
the ordinary envelope; existing stricter logger/event/file limits still apply.
Fast reader work uses fixed buckets rather than per-task history. Thresholds
control logging volume only, not execution or admission.

Existing enabled, selected-level, silent and closed behavior governs admission.
No Agent trace opt-in is required for these content-free ordinary events, and
this change does not enable trace or override preferences. Off/re-enable resets
owned timing baselines; host close clears owned state using existing timers and
logger close/flush. No new timer, live handle, database read/write, subprocess,
network operation, model call or writer is added by instrumentation. Lease and
budget arithmetic, retry limits, scheduling, permissions and physical cleanup
remain unchanged. Retained logs are not deleted by disabling observations.

Suppressed counts, dropped writes, crash/hang before a completion span and flush
loss leave incomplete evidence. Missing observations mean **unknown**, not
non-execution, successful cleanup or absence of a stall. Wall/monotonic divergence
is not a sleep detector; nearby reader/timer/renewal events establish correlation,
not a cause or permission to replay a task.

## Required verification

| Coverage | Status |
| --- | --- |
| Controlled observational clocks, forward/backward divergence, quotas and explicit suppression; enabled/level/silent/re-enable/close and logger failure isolation. | PASS in the focused selection below |
| One real SQLite renewal using the original timer/CAS; controlled miss, exception and exact recovery preserve states, attempts and original errors. | PASS in the focused selection below |
| Strict generated task/attempt identifiers, unchanged existing validators and sentinel exclusion from event payloads. | PASS in the focused selection below |
| Generated scoped Memory entry through ordinary authenticated APIs and a loopback provider; reader/preparation/assertion timing, a bounded isolated stall, unchanged output/usage and revoked-read non-publication. | PASS in the focused selection below |
| Driver-backed focused selection and Server build/typecheck at the frozen candidate, with confirmed fixture cleanup. | PASS: 40/40, no skips; Server build passed for the frozen source |
| Normal local Dev upgrade, exact release/process readback and bounded formal diagnostics/task checks with existing preferences and trace off. | Pending |
| Naturally occurring live renewal/failure evidence and any causal finding. No deliberate blocking, new paid query or historical retry on the real deployment. | Pending |

The integration owner must distinguish newly executed evidence, eligible reused
receipts and unperformed cases under
[focused validation guidance](../development.md#focused-validation). A generated
stall proves observation/noninterference only, not the cause of the seven past
failures. If no natural live failure appears within the bounded observation,
leave that coverage pending. Fixture checks do not establish live-model quality,
physical-device behavior, full-suite success or merge readiness.

## Executed focused evidence

The three selected files were `execution-observability.test.ts`,
`multiuser-memory-observability.test.ts` and the unchanged `diagnostics.test.ts`.
Driver receipt `2026-10-23T06-22-19-316Z-923b96f1-ae4c-48ec-aaa8-25c907dd07f5`
records 40 passed cases, zero failures/skips and 10.454 seconds of test execution
(11.263 seconds for the focused task). No case or file exceeded its budget.
This is newly executed evidence, not reused results from the two failed fixture
runs. The Server build also passed for the exact frozen runtime source.

Fixture corrections preserve the original assertions, timeouts and product entry
points. They retain the engine's existing permanent `processor_failed` outcome
for the injected renewal exception and capture the actual recovery state before
the existing admission guard. The image cancellation scenario selects the exact
ID and original hash from the real request's `authorizedImages`; an OCR text
segment is not an image grant. It still exercises the authenticated admission,
real read capability, foreign-owner rejection, cancellation, revoked-read cleanup,
unchanged single model usage and zero publication. No internal evidence priming
or additional model call supplies the tested state.
