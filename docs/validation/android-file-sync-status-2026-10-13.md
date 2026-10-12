# Android file synchronization status

## Journey and boundaries

The reported journey was an Android folder with 212 discovered files. Individual queued rows read “Listed locally · Preparing to save” while other files were already being received. The detail page did not refresh while open. Read-only diagnosis of the connected 0.0.86-dev physical device observed receipts increasing from 93 to 103 and a preceding HTTP 503. This diagnosis is not validation of the new build; no personal file bodies or screenshots were collected.

| Decision | Scope |
| --- | --- |
| KEEP | Source authorization, initial all/new-only selection, the 60-second folder stability gate, immutable pending bytes, upload budgets, WorkManager scheduling/retry and sending conditions. |
| CHANGE | Project current-version folder counts and per-file transport stages in existing home/source/detail/queue surfaces; refresh the foreground detail lifecycle. |
| REMOVE | The ambiguous per-file “Preparing to save” label that also described queued files. |
| EXCEPTION | Reference/deletion revisions bypass byte stability; explicit one-time single-file imports remain immediate. Baseline files are shown separately. |
| UNKNOWN | OEM background scheduling and live Central processing timing are not proven by generated status fixtures. |

Receipt progress is not processing/indexing completion. Inventory totals remain qualified until traversal completes. Persisted per-file failures are observational and never change dispatch/backoff. Live preparing/uploading observations are process-local; they cannot survive as a false running state after restart. The progress projection retains only compact transport facts and updates changed entries; polling does not reread every persisted file journal.

## Regression scenarios

| Level | Scenario |
| --- | --- |
| JVM | Stability expires without another scan; changed metadata restarts waiting; preparing bytes does not itself mean uploading. |
| JVM | Live attempt ownership; queued bytes after attempt exit; HTTP 503 failure retained across queue recreation; exact ACK clears failure. |
| JVM | Old receipts and late failures do not describe a newer candidate; new-only baseline exclusion; all/exclusion/removal updates aggregate counts. |
| JVM | Prepare failure cooldown, reference and one-time exceptions, non-retryable ingress rejection. |
| Android instrumentation | Actual generated provider scan, open native detail, elapsed stability, saved original preview, inventory growth, real loopback HTTP upload and HTTP 503/retry/ACK; no manual refresh. |
| Android instrumentation | Status-only refresh preserves scrolling; pause/resume and Activity recreation show the current receipt. |
| Android instrumentation | Partial traversal of 212 generated files, qualified totals and complete progress automatically shown in source management and home. |

Instrumentation uses `dev.mote.collector.filefixture` on an emulator with capture disabled. Its tiny loopback server validates the generated original bytes and supplies the protocol receipt; it does not prove production Central ingestion or actual WorkManager wake-up ordering. Stability time is advanced only in generated fixture journals, so test runtime is not a measurement of the real 60-second wait.

## Executed checks

- `npm run check:affected` passed for the implementation and shared catalogs: `check:local` (all TypeScript consumers, translation parity and release-tool tests) plus Android JVM checks. After the instrumentation-only follow-up, `npm run check:affected -- --base HEAD` selected Android and release-tool checks and passed; the already-verified shared implementation was unchanged.
- Android debug JVM: **309 tests, 0 failures, 0 errors, 0 skipped**. Debug lint and Development APK build passed. The FileFixture APK and its Android test APK built successfully using JDK 17.
- API 37 arm64 emulator, isolated `dev.mote.collector.filefixture`: **2 instrumentation tests passed, 0 skipped**, final run **56.237 seconds**. Exact loopback bytes/ACK, HTTP 503 retry, automatic status transitions, viewport preservation, Activity lifecycle and the 212-file inventory assertions all ran.
- Generated native view renders for folder management, home and an uploading detail were reviewed. `FLAG_SECURE` remains enabled; these renders are in-process drawings of generated fixture views, not personal screenshots.

The initial viewport assertion raced the asynchronous saved-preview layout in one repeated run. The fixture now waits for the original preview to be laid out and verifies the initial scroll position before starting the HTTP attempt; the unchanged scroll-preservation assertion then passes across status updates.

Physical-device installation/new-build validation, personal-data capture, live-model checks, production Central end-to-end ingestion and OEM WorkManager wake-up checks were not performed. The direct production scanner/transport fixture is not a system picker or background scheduling acceptance test.
