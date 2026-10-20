# Performance round 1 integration validation

Status: **blocked by the original Recording first-media-held scenario; unified acceptance is incomplete**. The integration PR remains draft and unmerged. Module-focused PASS results are not final delivery or driver reuse.

See [the approved integration scope](../design/performance-round1-integration-plan.md) for frozen module identities, ownership, main/PR194 boundaries and the new real HTTP witness.

## Module handoff evidence

| Module | Newly executed module evidence | Limits |
| --- | --- | --- |
| A | 59/59 focused tests and Server build | Generated 10k original-query comparison took about 121 seconds; documented budget exception |
| B | Generated extracted-selector/native SQLite observations; documentation checks | Design only; not actual ExecutionEngine or optimized implementation validation |
| C | Generated HTTP upload/export and SQLite investigation; documentation checks | Design only; no product export optimization or production WAL change |
| D | 85/85 focused tests, Web build and hidden current-login browser | Generated HTTP renderer fixture does not prove Server authentication |
| E | 229 focused tests, 2 account/ACK consumers, native/Desktop build and generated Electron smoke | Module smoke creates no window; production main startup/permissions are separate |
| F | 38/38 focused JVM tests after existing fixture prerequisites | No emulator, physical device, APK or live-model claim |

The independent handoff audit checked final HEAD/tree/commit/file identities, module scope, applicable approvals, remote draft PR heads and original cleanup receipts. All six inputs matched. These results remain **MODULE EVIDENCE**, not final driver `REUSED` tasks.

## Controller evidence

The controller independently installed dependencies and built shared prerequisites through the resource gate. The composed source candidate includes all frozen module patches, latest main, and the approved HTTP witness.

Newly executed at source candidate `f266d6acc65ea3e8d89f54729f82b91f11831c2f`: the complete latest `multiuser-memory-integration-domains.test.ts` suite passed **11/11**, with no skips/cancellations, in 54.154 seconds. This includes actual loopback HTTP Operations witnesses in both failed/paused continuation cases, plus due, retry, local cancel, global stop and restart states. Gate token `883adca5-5ee5-42a9-8eb5-b046ff2fc782` was released after confirmed cleanup. This is focused controller evidence, not a full-driver task reuse receipt.

Independent static composition review at the same SHA confirmed all 12 cherry-pick patches match their originals, all 49 module file blobs are preserved, and PR194 product code/documentation is unchanged. Removing the added witness leaves its original test byte-for-byte intact. The reviewer ran no tests.

## Unified checks and failure diagnosis

Two complete `npm run check:affected -- --base bcff7bab6109a7c99acde3decb5712a072e1b045 --head HEAD` attempts at `e0d9be2c9f92342e84a4172b159647f5bdf5d321` failed in Server with the same original three scenarios: **3,701 passed, two failed, one timed out/cancelled, nine skipped**. Both used the original default six Server file workers and completed cleanup. The driver run IDs are `da99d75d-d6de-41a4-827e-f09029674744` and `ede60a71-80cb-4670-b8f4-9c4513d1788f`.

The preceding eleven selected tasks passed in those attempts. The later Web/shared tests, release integration, central runner and Android unit task were **UNRUN**. These attempts are failed acceptance evidence; no task reuse is claimed.

Unmodified focused diagnostic runs passed the three scenarios serially and the related seventeen cases at both six and four workers. Those passes neither establish the full-suite cause nor justify changing the default concurrency. An independently approved bounded observer subsequently reproduced the three failures in a default-six Server run at `700b944439bfa5ad6d1e6e08ad7d3bb206b66c68` (1,401.010 seconds, confirmed cleanup). Original assertions, input scale, entry points, deadlines and physical resource lifetimes were preserved.

Independent diagnosis confirmed these immediate mechanisms:

- With separate listeners, B's understanding task had valid running authority and issued its first Messages/read_image request, but did not reach the second model request/held state within the original twelve-second wait. A requested tool call does not prove tool completion.
- With the reused listener, the original 120-second cancellation occurred while the raise-to-eight settings request was still pending. Lower-to-three and raise-to-eight took about 14.6 and 14.8 seconds; busy-listener nineteen/all-twenty states were not reached before cancellation. This does not establish a listener deadlock.
- In Recording, the injected runner had finished for r2 while subsequent media processing/publication still held the sole media unit; r1 had not reached its runner. The runner marker does not establish completion of the media adapter or physical resource release.

An independently approved three-case CPU sample identified repeated live authorization as a product-path hotspot. Inclusive stack fractions overlap and are not additive. The sample passed at file concurrency one; it does not allocate the complete failing window or prove that round 1 introduced a regression.

## Bounded TaskExecution remediation

Commit `35ee36ad24212637ade523c77bfb73346e5a4aa7` adds fresh narrow reads in `TaskExecution.valid` and `modelCurrent`. A shared identity assertion retains the original checks and order. Generic full-row consumers, account closure, grant/epoch/revocation, model and lease/fence checks remain intact. No authority result is cached. This separately reviewed single-file remediation does not release the original round-two scheduling/proof plan.

Newly executed in an isolated installation:

- Baseline and candidate each passed the same repaired dedicated safety fixture **5/5** and the nine necessary consumer files **68/68**, with no skipped/cancelled cases and confirmed cleanup.
- Independent implementation review found and resolved a new-test false positive and setup-failure cleanup gap. The final safety fixture was run on both original and candidate source; old mismatched benchmark evidence was superseded.
- Paired measurements used actual public account/task admission, held handlers and live authority validation: two generated owners, three rounds, six samples per input size, 200 calls per sample. Instrumented measurements were separated from the primary uninstrumented timings.

| Generated input | Original median per 200 calls | Candidate median | Observed reduction |
| --- | ---: | ---: | ---: |
| 1 KiB | 10.81 ms | 9.44 ms | 12.6% |
| 32 KiB | 16.05 ms | 12.28 ms | 23.5% |
| 256 KiB | 54.03 ms | 29.95 ms | 44.6% |

Both phases retained 2,800 total SQLite get calls, including 600 task-row reads, per 200 validations. Only returned task columns changed. Serialized result-byte counters are not heap allocation or physical I/O measurements. Original-before-candidate order, host load and GC limit these local results; they are not production P95 or whole-service gains.

The unchanged original three scenarios then produced **two PASS and one FAIL**, with no skipped/cancelled cases, in 170.82 seconds. Both OCR/listener scenarios reached their required states. Recording again failed `First audio must be physically held`. The owner stopped before the default-six cohort and did not repeat until PASS. All owned processes and leases were cleaned.

The new Recording evidence still leaves the post-runner and next-task preflight costs unresolved. A roughly four-second interval between the injected r2 runner marker and durable completion is derived from different clocks; it is not a precise allocation to file I/O, authorization, archive publication or task settlement. The six-second wait's nominal deadline was about 9,159 ms from scenario start; the approximately 9,624 ms failure/cleanup observation is not that deadline. A dedicated diagnostic chat is investigating the actual stages with the original assertion and deadline retained.

## Remaining acceptance

1. Resolve the Recording cause and independently review any necessary bounded product correction; perform its focused state/consumer checks.
2. Run the required original default-six seventeen-case cohort with actual high-risk states after implementation converges.
3. Freeze the integration candidate and let the controller alone run complete affected checks. No blind retry or driver reuse is authorized by the focused results above.
4. After a genuinely passed/cleaned driver receipt, run the integrated hidden Web current-login browser and Desktop module Electron entry checks. Desktop native/build evidence remains original module evidence; full production profile/UI startup and foreground permissions are separate unperformed checks.
5. Update the PR with exact new receipts, measured gains and remaining risks. Do not merge or publish.

No complete check has been represented as passed.

Physical devices, live models, production deployments, foreground permissions and real personal capture have not been exercised. No real personal screenshots were used.
