# Android queue and lifecycle parity, 2026-10-18

> 2026-10-20 delivery follow-up: this record keeps its original candidate, commands, results and UNRUN scope. Related source is now in main through the integration and later fixes; Draft/pending/under-validation statements below describe their recorded stage. Current module heads, named per-item evidence and remaining qualification are reconciled in [Project progress](../project-progress.md). This note neither changes an old FAIL into PASS nor treats functional gates as complete native/model/deployment acceptance.

Starting candidate: `2c78ca8d52a7d17fae20962cf68d09a717ffc73a`.
Single-user comparison: `2c2627621e2598332ae8169845bc7343be7ed63e`.
Module branch: `codex/parity-android-20261018`.

This is an implementation and validation ledger, not a release or integration
completion claim. Final required checks and precise frozen candidates are recorded
below when run. All accounts, notes, rules, files and calendar entries are generated.
No personal screen, physical device, live model or supplier account is used.

## Acceptance map

| Item | Production behavior | Regression entry points |
| --- | --- | --- |
| AND-01 | Persist an explicit account calendar connection; restore periodic work after settings application, relogin and startup; B cannot adopt A's connection | `CalendarRecoveryLifecycleInstrumentedTest` connect → `RuntimeSettings.apply/replaceAccount` → real periodic WorkManager → CalendarProvider; separate actual process-stop pair |
| AND-02 | Preserve packed capture transport; split explicit conflict/deletion/size refusals; durably settle each verified ACK immediately and isolate only the refused record | `Ingress3OutcomesTest`, real HTTP `MultiuserIngressTest`, real `UploadWorker` packed/individual mixed queues |
| AND-03 | Narrow transport adapter preserves paused/permanent/network outcomes and error codes; later automatic jobs respect durable permanent rejection; explicit retry remains available | Generated `SourceScanWorker`/`SourceUploadWorker`, paused source, dropped ACK + forgotten original, listener outage/manual/automatic outcomes |
| AND-04 | Recovery UI and Worker use the same account report; retire old controls, results and WorkRequests | Real recovery Activity check/replay/stop/recreation and A/B switch |
| AND-D01 | Owner-authorized account preferences and preview; defaults with stopped collection when no personal snapshot; preserve unassigned historical globals | `AccountCapturePreferencesInstrumentedTest`: defaults, A/B/A, token/URL change, stale callbacks, actual process-stop pair |
| D2 consumer | Retain immutable file spool across ordinary transport expiry; retry begin/part/commit without manual GC or source recreation | Half-upload, lost commit ACK and expiry between accepted begin/part and the next request; requires the separately frozen Desktop producer |
| Ask consumer | Original native input/history/failure retry and A/B late-result retirement against a generated HTTP model | `NativeAskParityInstrumentedTest`; requires separately frozen Ask producer and `multiuser-ask-backend.ts` |

`upload_expired` HTTP 409 is a retryable transport outcome. Other 409, 410 and 426
preserve permanent rejection semantics; 507 retains the queue and remains retryable.
A source paused between registration and singleton capture POST is rechecked through
the narrow registration port before any conflict marker is written. Device
credentials never use the broad private `/api/sources` list to detect a pause.

The [preference ADR](../adr-android-account-capture-preferences.md) records the
owner's D01 decision, field boundaries and first-snapshot behavior. OS/SAF grants
remain device state; sources and pending bytes remain account state.

## Supersession check

KEEP the existing queue, source/file journals, original immutable IDs, capture
stages, consent, manual/automatic policy, 15-minute calendar period and connected
network constraint, native calendar journal/unknown-result protection, recovery
controls and current wire/storage. CHANGE only the missing lifecycle restoration,
typed transport outcomes, account report consumer and authorized personal
preferences. REMOVE the global recovery report consumer, generic-offline handling
of permanent refusal, and global privacy inheritance. EXCEPTION login and required
owner fences, Dev private-file credential policy and existing OS permissions.
UNKNOWN physical/OEM behavior, real provider quality and unperformed integration
combinations remain separate.

## Preliminary R001 execution (before D01 and later race refinements)

Environment: Node `v26.11.1`, ABI `147`; JDK 21; Android SDK with API37.0 generated
AVD `mote_parity_android_20261018_api37`, `emulator-5580`. The documented API35 AVD
was absent, so it was not claimed as tested. AVD startup used `-no-window -no-audio
-read-only -no-snapshot-save`. No host app was activated. Generated calendar grants
were confined to `dev.mote.collector.m15fixture`.

- `npm ci --no-audit --no-fund`: EXIT0, isolated worktree dependencies and unchanged
  lockfile. Server and Mem0 resolved the same working in-memory better-sqlite3.
- Shared/Agent build prerequisites: EXIT0.
- Focused Gradle `:app:testDebugUnitTest --tests dev.mote.collector.Ingress3OutcomesTest
  --tests dev.mote.collector.MultiuserIngressTest` plus multiuserFixture APK/testAPK
  assembly: 22/22 tests, EXIT0. `/tmp/mote-parity-android-build-focused-4.log`.
- Real packed/individual mixed capture conflict Worker: 1/1, EXIT0.
  `/tmp/mote-parity-android-native-conflict.log`.
- Real calendar connect/settings/logout/relogin/A-B-A/periodic delivery: 1/1, EXIT0.
  `/tmp/mote-parity-android-native-calendar.log`.
- Real recovery page check/replay/stop/recreate/account retirement: 1/1, EXIT0.
  `/tmp/mote-parity-android-native-recovery.log`.
- Source pause/network attempt: fixture setup failed before the intended business
  assertions because the generated source lacked a persistable SAF grant.
  `/tmp/mote-parity-android-native-pause-network.log`. This is not a product PASS.
- Earlier failures retained separately: Kotlin snapshot inference compile failure;
  WIP fixture owner initialization failure; generated queue event omitted required
  privacy metadata. Subsequent focused execution above corrected those setup/code
  errors, without skipping tests.

R001 APK SHA-256: `7c12cb71968c323c12087281dc50f5b8f19e028a50c3707b96b1f0abf09358c8`; testAPK SHA-256: `24f24650f42c4413fcee02bba7783b3dd48ebcd013f81fbd99bfd9b67268c63a`.

R001 used an editing-stage input, not the final candidate. Later D01, durable retry
and pause-race changes require new checks. Its results must not be relabeled as
final-SHA acceptance. Both generated servers, reverse mappings and the emulator
were stopped at slot release. Fixture scripts and private JSON stay outside source
control.

## Remaining validation

The frozen module still requires `npm run check:affected` and the focused native
journeys on its exact candidate. D2 and Ask are separate explicit composites, not
part of the Android PR's server changes. Actual process-stop pairs, the repaired
SAF fixture and new D01 tests have not yet run. Physical devices, real collection,
live models, public network/TLS, OEM power policies and supplier accounts remain
UNRUN. No deployment, main merge, real-data replay or release is authorized here.
