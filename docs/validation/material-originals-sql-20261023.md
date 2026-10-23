# Material originals SQL validation

Date: 2026-10-23. Status: integration-verified for the named SQL/readback journey.
Active lease-under-load regression remains unverified. The owner requested diagnosis,
repair and regression in the existing local Dev Central, without another full
test suite. No automated suites or new generated regression fixtures were run.

## Confirmed defect and correction

A live CPU profile captured repeated synchronous Memory evidence validation in
Promise continuations. Material originals expansion selected owner-wide input
and capture scans before joining the recursive tree. The existing composite
primary keys cover owner, Material ID and revision, but those complete lookup
keys were not being used. Repeated evidence blocks amplified this avoidable work.

The correction constrains four joins to start from `tree` or `lineage` and use
those complete primary-key lookups. It preserves every owner/revision predicate,
transitive lineage root, UNION/DISTINCT, source-enabled check, image-anchor/hash
relation and original visibility check. It adds no index, schema change, row
cache or authorization cache. Each `material()` invocation still makes its three
reads, with fresh authorization at every PrivateSql call.

The [recovery ADR](../adr-task-recovery-and-execution-budgets.md) and
[continuous batch ADR](../adr-memory-continuous-batch.md) remain unchanged.
Lease duration, renewal, cancellation, exact publication fences, charged attempts,
physical cleanup proofs, model snapshots and historical recovery are unchanged.

## Actual-input diagnosis

An isolated SQLite online-backup copy contained 532 Material versions and 14
image anchors. Original and proposed SQL returned byte-identical originals JSON
for all 532 versions and all 14 image anchors. Full-version query time changed
from 844.34 ms to 38.17 ms. The actual 178-evidence task referenced three distinct
Materials; its 178 originals queries changed from 260.04 ms to 3.66 ms. Query plans
used all three composite-key columns after the correction.

On the same private copy, the actual schema-parsed task entered the production
`MemoryHost.assertJob` method. The returned value hash was unchanged; elapsed time
changed from 3433.44 ms to 1928.07 ms. Both paths performed exactly 8773 get, 1294
all, 11 run and 1255 Material calls. These are one-run local measurements,
not a scale guarantee. The copies were removed. Their fixed owner binding was
for timing/equality diagnosis and does not establish live authorization coverage.

Durable regression scenario: a real multi-block task with many evidence IDs
sharing a few immutable Materials must retain complete account-bound lineage,
source visibility and image proof while using exact composite-key recursive
lookups. Repeating a whole fixture suite is not the acceptance path for this
local repair. Deployment must use the built independent release and ordinary
profile upgrade; local formal reads and natural task/renewal events provide the
runtime regression evidence.

## Runtime boundary

The old runtime had delayed renewal callbacks, expired-fence recoveries and
intermittent health-request timeouts. The measured SQL amplification is confirmed.
It does not independently prove the complete cause of every historical 30-second
callback gap. The repaired commit `c2d5129c4297ad9dff4ae002f82dabfae2afcd5d` was built in an
independent release and selected by the ordinary profile upgrade at 07:27:16 UTC.
The formal observer completed in 29.60 seconds: all reads completed, login/logout
succeeded, 896 published Memories were read, and all three media roles were ready.
A new worker recognized one generated PNG in 44 ms with its own exact successful
execution fact. ASR readiness was checked; audio accuracy was not exercised.

The four historical ASR/pipeline tasks and all retry rounds were unchanged; no
new round, retry, import or model configuration change was made. The observed
14 failed Memory batches had already exhausted their three-attempt rounds; six
older tasks still waited for physical-cleanup proof. There were no running tasks.
No new expiry was observed in the initial two-minute window, but idle time or
absence of new tasks cannot establish successful renewal under active processing.
This repair confirms and removes one substantial SQL amplification cause; the
complete origin of every historical 30-second gap is not claimed resolved.
