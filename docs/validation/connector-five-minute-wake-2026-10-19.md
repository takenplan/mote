# Connector five-minute wake assertion classification

The required gate for `fddccce1589be28ea949cc376144ecb309c9974e`
(`81ead226-5bb1-4344-89de-218ab6fd4b85`) failed one of 3162 Server
entries: 3159 passed, one failed and two skipped. The failing assertion compared
the future recording timer with the clock **after** waiting for manual sync
completion, requiring between 298000 and 300000 milliseconds to remain. The
original gate logged only the false Boolean; it did not retain the timer or
coordinator clock values. Its exact interleaving remains unobserved.

## Traced responsibility and controlled result

Saving an enabled selection admits its initial sync. Before acquiring provider
content, that sync schedules one successor at
`Date.now() + min(configuredInterval, 300000)`. A concurrent manual sync retains
that future timer. Recording child tasks run independently; the parent can wait
for their completion without charging those waits to its call budget. The test
helper advances mocked Date to each local coordinator `availableAt` while it
waits for that ACK. No contract limits the number of those acknowledgements to
two. Timer admission prevents provider calls before the saved `due` time.

One unchanged focused execution passed. A separate controlled diagnostic held
the generated first discovery while the actual existing coordinator wait helper
advanced Date. It reproduced the original assertion failure with these values:

| Observation | Milliseconds |
| --- | ---: |
| Save/scheduling clock | 1792281600000 |
| Persisted next timer `due` | 1792281900000 |
| Clock after coordinator ACKs | 1792281603001 |
| Remaining time | 296999 |

The timer was exactly five minutes after scheduling throughout. The old
assertion nevertheless failed because more than two seconds of generated time
had passed. This confirms an invalid assertion under a legitimate held-provider
ordering; it is not evidence that the old complete gate's unrecorded interleaving
had these same values, or a diagnosis based on machine load.

## Test-only repair and boundaries

| Disposition | Contract |
| --- | --- |
| KEEP | Original five-minute ceiling, a longer configured interval, automatic selection, manual sync, one future timer, real provider discovery at wake, and the original final discovery assertion. |
| CHANGE | Assert the exact saved deadline from the scheduling clock, then hold acquisition past the former two-second assumption. Check no provider call at `due - 1`, actual discovery at `due`, and the successor at `due + 300000`. |
| REMOVE | Comparing a deadline established before acquisition with an arbitrarily later ACK clock as if at most two seconds could have elapsed. |
| EXCEPTION | Only the failed test body and this file's local clock-driving helper change. Other case bodies, cross-file fixtures, production/runtime code, scheduling policies, wire/storage and user defaults remain byte-identical. |
| UNKNOWN | Reuse of the original 3159 passing entries and eight completed gate steps is a Control/PM decision. The original complete gate remains FAILED; this does not claim a new complete Server or fourteen-step PASS. |

The first whole-file rerun also retained a separate failure at the assertion
that the recovered recording page already had succeeded transcription. Its
timer/page/ACK interleaving was not recorded, so that occurrence is not labeled
as a production defect or attributed to load. It exposed the same helper's
ability to advance Date repeatedly while actual child work was outstanding,
potentially admitting later polling rounds before the awaited parent returned.
The helper now reads only that request's actual scan task states and advances
only a future local ACK after its children are terminal. It does not mature a
provider retry, wait for unrelated requests, or use an old failure receipt while
a task is running. The recovered-page assertion remains unchanged. The held-read
case explicitly verifies that the helper leaves Date unchanged during child I/O.

The whole original polling file must run with the normal Server test settings.
Its cases preserve terminal provider failure followed by future polling,
restart, background discovery switches, owner isolation, scope confirmation and
late non-abort-compliant selection cancellation. Strong recording consumers
separately cover admitted retries with discovery off or held/failed, sibling
backup latency, cancellation, cursor accounting and actual process death. Node
test files retain their normal process isolation. The only shared helper change
is inside this polling test file; no production or cross-file fixture changes.

The external candidate manifest binds exact commands, full source delta,
unchanged production and other test-file hashes, this diagnostic's source/log,
the failed required-gate receipt and the new committed-input dry-run. Full gate,
native builds/UI, live vendors/models and personal-data work are not performed
in this classification slot.

## Actual focused results and reuse review

| Exact input | Result |
| --- | --- |
| Unchanged fdd test, original single case | 1/1 passed once; this did not establish stability. |
| Temporary controlled diagnostic, unchanged fdd production | Original assertion failed with the measured values above; source and log retained. |
| Absolute-deadline body with old local helper, first whole-file rerun | 8 passed, 1 failed at the separate recovered-transcription assertion; retained without relabeling. |
| Final test body and clock helper, normal Server flags on the whole polling file | 9/9 passed, no skips. |
| Recording phase, backup and real process-death consumer files | 15/15 passed, no skips. |

Reuse review inputs are: zero production/tool/configuration delta from fdd; only
this test file and this classification document change; all eight other case
bodies are byte-identical; other test files, imported fixtures and normal process
settings are unchanged. The normal selector still determines the new candidate's
required checks from its actual Git range. It does not omit the five previously
unrun Web/shared/release/central-runner/JVM steps. Control/PM must decide whether
the retained old results satisfy any portion of that obligation or whether to
run the complete gate again; neither this record nor its dry-run certifies it.
