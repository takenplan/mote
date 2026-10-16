# M15 Android capability and acceptance ledger

Production parent: `98d76945e091d7234217ebcf532ebeff3350937c` (M11 final including M01/M03).
Independent workspace: task-19/mote; feature `codex/mote-multiuser-m15-android`.
No M12 handoff is consumed. M13/M14 work in progress is not accepted dependency evidence.

| Decision | Existing capability and real chain | Required account adaptation / evidence |
| --- | --- | --- |
| KEEP | Accessibility/UI-page/MediaProjection screenshots → CapturePipeline/staging → DurableQueue → UploadWorker | Preserve privacy masks, OCR gate, image dedupe, metadata, timestamps and original bytes. Freeze collector configuration/owner before asynchronous capture; pause on account switch. |
| KEEP | Notifications/device events/audio → MediaCollectionService → queue | Preserve per-app rules, intervals, permissions and metadata. Never carry A observations to B. |
| KEEP | QuickNotes/NoteDraftStore → queue → UploadWorker | Draft and prepared immutable ID belong to account; safe retry after death, separate B draft. |
| KEEP | SourceScanWorker/SourceProviders → LocalSourceStore; FileSources → FileArchiveQueue encrypted spool → SourceUploadWorker/FileUpload | Preserve calendar and selected files/folders, original/snapshot/reference, one-time/continuous scans, original bytes, late ACK and retry. Owner-specific cursor, configuration, registration and spool. |
| KEEP | SyncSchedule/Heartbeat/Recovery/WorkManager | Preserve manual/timer/batch/network/charging conditions, cancellation/backoff, reconciliation and retention. Worker intent carries original owner; old worker cannot adopt B. |
| KEEP | QueueStorage/QueueLocationStore, local browse, dedupe, export/import and diagnostics | Existing queue engine and encryption remain; account namespace precedes directory selection. Cross-owner archive restore must reject; retain A files. |
| KEEP | CentralContent/CentralScreens/CentralClient native navigation, Ask, Library, configuration, plugins, administration, file/note drafts, media | One account shared with collection, immutable client/generation fences, scoped cache/drafts; username/password and browser handoff use M01. Per-domain wire adaptation recorded separately; M12 remains pending. |
| CHANGE | URL dataOrigin / token-hash source target; owner token login / invite | Stable normalized origin + server-verified deploymentId/userId; credential rotation retains owner; different deployment at same URL is different owner. Wire 2, Ingress 3. |
| CHANGE | Local storage format 3 without stable account binding | Format 4 rejects old marker/config before writes; no auto-migration, deletion or inferred owner. Anonymous local collection remains explicitly local until user confirms binding. |
| REMOVE | Treating HTTP success or legacy v2 receipt as sufficient ACK; same URL as owner | New account-bound complete M03 receipt must match owner/source/batch/capture set. |
| EXCEPTION | Shared device settings, update artifacts, bundled OCR models and encryption key | Non-private installation resources remain shared; content/cursors/drafts are account-scoped. |
| UNKNOWN | Real phone/vendor background behavior, live providers/models; M12-dependent action contract | Not exercised with real data; report independently. |

## Evidence

Initial RED tests and subsequent actual worker/backend acceptance are recorded with exact SHA, command, exit and logs as they run. Dependency M11's Android329 is not M15 acceptance.

Initial boundary: production parent `98d76945`; RED test commit `2f1e91f`.
`gradlew -p apps/android --no-daemon --offline :app:testDebugUnitTest --tests dev.mote.collector.MultiuserBoundaryTest`:
first environment-only EXIT1 (wrapper cache lock denied, `/tmp/m15-initial-red.log`);
standard-review authorized exact rerun 2 tests/2 assertion failures EXIT1 (`/tmp/m15-initial-red-authorized.log`).
Same exact tests after minimal Wire2/local4 change: 2/2 EXIT0, `/tmp/m15-initial-green.log`.
This is boundary evidence, not actual upload/worker/whole-module acceptance.

Public metadata migration: source consumer RED `5d99dcb0` reports `{min:1,max:1}` against required `{min:2,max:2}`, EXIT1 `/tmp/m15-public-wire-red.log`. Final test imports emitted public module like existing shared tests (assertions unchanged). Fresh shared tsc EXIT0; public metadata+compatibility fixtures 17/17 EXIT0 `/tmp/m15-public-wire-green.log`. Real production M01 login/self→M03 capture HTTP via `app.inject` 1/1 EXIT0 `/tmp/m15-public-wire-real.log`: rejects Wire1 login/Ingress2 write, current shared headers succeed and receipt matches actual deployment/user/source/batch/captures. This in-process HTTP test is not Android or listener evidence. No scoped server auth/ingress implementation changed; only legacy fixture metadata follows shared default range2.

Expanded implementation checkpoint `f19fd9e5` was implementation-first beyond the initial boundary RED/GREEN; no retroactive TDD claim. New actual M01/M03 Kotlin tests first ran 3/4 EXIT1 `/tmp/m15-real-ingress-first.log`: file test's `prepare` returned null because a continuous source had not satisfied its unchanged original 60-second stability rule. Corrected fixture explicitly selects one-time capture; assertions and original spool algorithm retained. On the subsequent fresh APK/narrow-test build, 4/4 pass EXIT0 `/tmp/m15-worker-build.log` (28s; debug JVM plus m15fixture APK and instrumentation compile).

First actual WorkManager instrumentation `/tmp/m15-worker-phase1.log`: adb command EXIT0 but JUnit 1 failure, NOT a pass. It deliberately held A's production queue handle across B; its assertion tried reading that retired handle and the existing storage guard rejected it (`outside authorized space`). New fixture asserts this rejection and separately inspects only its synthetic A file directory to verify retained bytes; no product authorization is weakened. It had not reached B upload or the crash checkpoint, so those are still unverified.
