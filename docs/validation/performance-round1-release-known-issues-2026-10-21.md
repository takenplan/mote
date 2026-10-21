# Performance round 1: release decision and open issues, 2026-10-21

## Owner decision

The owner requested: “不要再反复迭代了，快速收口现在的问题，直接发新版本就行了。把现在这些问题都记一下，放在文档里 然后把这几个子对话都停掉”. Further investigations, implementation iterations and module checks have stopped. Existing evidence and unfinished branches are preserved.

This is an explicit, one-release exception: publish the already frozen product source, without rerunning the failed complete regression gates. It does **not** mark failed tests as passing, change their assertions or timeouts, or establish their root causes. Normal release workflows and future validation requirements remain unchanged. Build failures, signing failures, package identity mismatches and file-integrity failures remain publication blockers.

## Frozen release source

- Source: `561f0627acbe36b4f13656e1501471c22685c1a0`, tree `82415395bd9e87fa5e40646ea92eee950514043f`.
- Includes merged [performance #201](https://github.com/utopiafar/mote/pull/201), [documentation #202](https://github.com/utopiafar/mote/pull/202), [Memory fix #203](https://github.com/utopiafar/mote/pull/203) and [versions #204](https://github.com/utopiafar/mote/pull/204).
- Existing immutable tags: `central-v0.0.91`, `desktop-v0.0.89`, `android-v0.0.90` (Android versionCode 101). The first release workflows created no public packages. These tags are retained at their original source, not moved or reused for different code.
- No unfinished Desktop diagnostic/reordering change, Android workflow correction, Engine proposal or second-round implementation is included.
- The one-time manual packaging workflow checks out this exact commit. Its own coordination commit is separate from the package source commit. Package metadata must report the actual source commit above.

## Verification actually performed

The same source tree passed the controller's local 23-task affected plan on candidate `603c3e22666341ef1257337afc098c0089d0f2b1`, run `9b6a9c14-58be-4dd2-822d-aea2ceb4759c`: 23 newly executed tasks, zero reused receipts, stable inputs and confirmed cleanup. Server: 590 files, default concurrency 6, 3830 passed, zero failed/cancelled, nine pre-existing Source Pack/sandbox skips. Desktop: 645 passed. Android: 414 Debug JVM tests passed, all 25 Gradle tasks executed. Hidden current-login Web and Electron module entries and three Prod metadata checks also passed.

This local result does not supersede the subsequent failed Release CI results below. The one-time packaging workflow intentionally does not rerun full Central/Desktop checks or Android Release JVM tests. It retains compilation, Central source-archive verification, Mac codesign/bundle/architecture verification and packaged metadata smoke, Android persistent signing/package/version/certificate/16 KiB alignment verification, and publication hash checks. Actual package results must be reported after execution.

## Open issues

| ID | Confirmed evidence | Unknown / follow-up |
| --- | --- | --- |
| RELEASE-R1-01 | [Central CI 39535006191](https://github.com/utopiafar/mote/actions/runs/39535006191) was cancelled at its 30-minute job limit; publish was skipped. | Complete Linux validation did not finish. The job envelope and individual test failures are separate issues. Revisit the CI budget after measuring complete execution. |
| RELEASE-R1-02 | That Central run reported five Memory failures: thousand-original delegation (121.057 s), large reviewed needs-context feedback (10.517 s), thousand-original HTTP background import (308.780 s), 400-day shared executor (120.453 s), and three-job context-grant/lease preparation (77.010 s). | Cancellation prevented the final detailed failure report. Exact assertions, inner waits and lease outcomes remain unresolved. The 10.517 s feedback failure occurred below its 30 s case limit and must not be classified as a pure total timeout. Preserve full scale, grants, independent review, real coordinators and complete coverage in later diagnosis. |
| RELEASE-R1-03 | [Desktop CI 39535006239](https://github.com/utopiafar/mote/actions/runs/39535006239) failed hidden Electron native-wheel `scrollY > 0` after the original 150 ms wait; earlier keyboard/click/modal assertions passed. Local bounded diagnostics observed three trusted native wheel/scroll sequences with zero show/focus, and both whole files passed 40/40. | CI window cycle, event delivery and readiness remain unknown. Local passes are not a fix. No DOM substitution, focus activation or relaxed wheel assertion was shipped. |
| RELEASE-R1-04 | The same Desktop CI exceeded the original 60 s large-OCR browsing case. Generated input is 61 captures × 99,990 OCR characters; 30 previews/160-character preview bounds, full detail and account isolation remain required. Local diagnostic runs completed around 44 s; about 42–43 s was spent awaiting empty local queue initialization after ingress. Ingress was about 458 ms; browsing about 26 ms and detail about 10 ms. | The slow await spans multiple directory/journal/binding operations; a specific SQL/fsync/OS cause is unproven. Fixture preparation order differs from real Desktop startup. A proposed reorder was not included. Record this cost for later work; do not delay this release for deeper profiling. |
| RELEASE-R1-05 | [Android CI 39535005873](https://github.com/utopiafar/mote/actions/runs/39535005873) compiled and ran 414 Release JVM tests, with 12 failures at the real Kotlin→Node backend fixture startup. The cold release job omitted npm dependencies and shared/agent dist preparation. | Original Node stderr was not expanded in the CI summary, so the exact first exception is unknown. A bounded prerequisite correction was independently approved but is not part of the frozen release. Android component-check CI has an analogous static prerequisite risk; it was not separately executed or fixed here. |
| PERF-R1-01/02/03 | Earlier startup, physical OCR-state and held-first-audio performance budgets remain open, including OCR totals 128.083 s and 121.434 s above the old 120 s budget in the successful local run. | See [the original deferred-budget record](performance-round1-deferred-2026-10-21.md). Approved functional waiting exceptions did not establish the original latency targets or erase old failures. No further Engine/startup optimization is included. |

The feedback organizer/revision interaction is an investigation candidate, not an established cause. Likewise, an empty-queue phase observation does not prove a specific filesystem mechanism. Preserve original failed logs and receipts when these items are resumed.

## Performance evidence and limits

Historical generated/local measurements on the implemented paths include: 10k-current-head first-page lookup 11844.91→33.44 ms; 100 Operations dependency reads 100→1 SQL; ten composer inputs with 100 loaded answers 1000→0 additional historical Markdown parses; isolated 12k Desktop cursor sweep 1023.58→37.77 ms. Current validation projection reduced native gets 2800→2400 while keeping attachment reads unchanged; wall/CPU timing improvement was inconclusive. These are isolated fixture observations, not production P95/QPS, browser INP, whole-app speedup or device/power evidence.

Physical devices, emulator capture/permissions, live-model quality, real personal capture, installation/upgrade on a daily profile and production deployment remain unperformed. macOS uses the established ad hoc identity unless actual packaging reports otherwise; no Developer ID/notarization claim is made. Publishing packages does not install clients or deploy Central.

## Follow-up and coordination

All six module chats and the independent Server diagnosis chat were told to stop. Active subtasks were interrupted; owners may only finish safe cleanup and save their current state. No follow-up timer is used. Resume individual issues only on a new owner request, with a named source owner and targeted verification; do not restart the previous audit loop automatically.

Future work should first recover precise failing assertions for RELEASE-R1-02, reproduce the hidden-wheel failure on its CI host, and prepare the Android fixture prerequisites. Pure performance profiling can follow separately. The present release accepts the documented verification gaps at the owner's explicit direction.
