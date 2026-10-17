# Main + multiuser client integration — 2026-10-17

Status: the executed generated-data client matrix completed. The original Android matrix passed 80/80; primary history coverage has seven GREEN executions and two expected helper RED controls; the additional Light→Dark account variant passed. Physical/OEM and live checks remain unrun. [Machine receipt](main-multiuser-client-integration-2026-10-17.json).

Main base: `2c2627621e2598332ae8169845bc7343be7ed63e`; integration base: `b26e797b5427fd089fa4fc4fa8b0cc45909f24af`.
C: `cd13a3e0fe5afc3b42cab0912f7693c68b702a73`; C2: `669f210baae0b464f8719f204b4c3f16ec7cb3ec`; C3: `6b4305bff5c7723562b88990395c6d87759cea95`; F: `b60ce1054ef74641ade0ee4e891ef40ee61e55f6`; G: `2333ed61677e15957d6fd97c0cdd760bfbf47dcc`; I (two test files only): `3058b9018708103805f01a1787e4ae475a375d2c`.
The parent-owned affected-component checks and their actual outcomes are recorded separately in the [integration report](main-multiuser-integration-2026-10-17.md) and [security report](main-multiuser-security-regression-2026-10-17.md). This receipt records the client executions below, rather than asserting the broad gate was repeated on every intermediate snapshot.

## Behavior retained and repaired

The merge retains profile-local Electron appearance, Android application/platform appearance and the existing historical-version notices alongside wire-2 account identity, document generations and private queue/draft directories. Android English assets contain the union of 8,554 existing entries. Existing keys and paragraph styles are reused; no product policy, layout, navigation or authorization change is introduced by the client notice repairs.

Android’s two original ASK and Activity-result readers already use a shared presentation helper. Wire-2 explicit deletion legitimately omits `result`, so `evidenceDeleted` must be considered first. Current/stale answers retain their original prose/citations; deletion displays the existing cleared-history notice and no prose/citations. The old result-first helper was retained as a separately built RED APK, with all other production payload entries unchanged.

A separate consumer audit found the reachable Electron saved-history reader ignored both status flags. The real emitted main/preload/renderer reproduced both omissions: stale prose/citations lacked the historical notice, and deleted-without-result lacked its cleared-history notice. `AskConversation` now includes the two optional flags; the existing presentation module renders one original article/paragraph pattern for current, stale, deleted and ordinary failed turns. Deletion takes precedence and removes citation navigation. Bilingual DOM tests exercise the production renderer; the actual hidden Electron journey independently verifies all three real service states.

## Source attribution

| Execution | Actual input source | Result |
| --- | --- | --- |
| Original 77 non-live Android methods + 3 original variants | C2 server snapshot, production APK inputs identical to C2; original selected instrumentation class/dependencies unchanged | 80/80 PASS, driver natural exit 0 |
| Android ASK history, Chinese/Dark | F-equivalent C3 server + frozen fixture header repair; rebuilt history test APK | 1 expected helper RED + 1 GREEN |
| Android Work/history, English/Light and process remainder | Pure G server/fixture; unchanged production APK and C2 history test APK | 1 expected helper RED + 5 GREEN, driver results retained |
| Original held-account case + additional actual Light→Dark variant | I server production identical to G; only fixture cancellation accounting and history instrumentation changed, fresh test APK | 2 GREEN, drivers natural exit 0; actual held request cancellation recorded |
| Android appearance | Prepared production/test APKs, selected production/test inputs identical to C2/C3 | 4 methods + 1 platform method + 5 fresh-process methods PASS, driver natural exit 0 |
| Official Electron UI entry before history fix | C and C2 separately, actual `npm run test:ui -w @mote/desktop` | Both natural exit 0; each actual account/theme flow + 6 cold pairs + 6 process restarts |
| Official Electron UI entry with history fix | C3 server + frozen three-file Desktop production delta and durable runner | Actual current/stale/deleted, original account/theme/calendar/Ask/SIGKILL flow + 6 cold pairs + 6 process restarts PASS, natural exit 0 |
| Focused Electron DOM tests | The actual shared turn renderer, Chinese/English current/stale/deleted/old-error cases | 5/5 PASS |
| Final affected-component gate | Parent-owned final candidate | See sibling integration/security receipts for actual outcome and counts; no broad gate is claimed here |

The earlier pre-C 80/80 replay remains supplementary and bound to its original snapshot. It is not being relabeled as a C2 or C3 backend execution. The final C2 replay created 79 independent generated backend processes (10 non-live fixture scripts, 17 actual flag configurations). Every backend naturally exited 0. The genuine process-death pair used the same backend/app data, confirmed the owned PID, sent `run-as kill -9`, verified PID absence, and resumed the original durable bytes under the original account. No live Codex method was executed.

C2→C3 changes only the server SQL erasure of the model-authored delegation workspace and its durable regression; all Android/desktop production inputs were identical at that boundary. The later Desktop notice repair is separately built/tested above. The consumed C3-plus-fixture/Desktop bytes match committed F for all Android/Desktop/server/shared/agent/diagnostics and root package inputs. G changes only the saved-history Work navigation metadata and its HTTP regression; Android/Desktop/shared/agent inputs remain identical to F. The G host’s 1,074-file runtime manifest (`4489ef1257962a9e8edf316fcf873a6d5abbc91be194e34de9b5f920445f6cdb`) was checked after its original executions, before I, with zero changed inputs. I changes exactly the fixture and one instrumentation source; its runtime manifest is `8389a91e7732447b6122dfe16a398ebb28db5f7fa2307644ea46b44987bc4344` (1,074 files; compact JSON sorted-key hash). Original 80-method backend consumption remains C2.

## Real native history journey

The generated host uses the production wire-2 application, actual accounts and HTTP query workers, and the actual Harness with material_catalog/material_read, driven by a generated loopback model provider. A has 21 turns; B is a positive control under the same logical conversation/source/material IDs. Ordinary material revision and explicit source deletion use production APIs; no history flag or SQL history row is seeded. A loopback transport gate can hold an actual Activity-result read before it reaches the host, then release the real deleted DTO. This tests the existing reader while deletion legitimately withdraws the work result artifact. Revision-bound cursors are not replayed after a change.

Final history matrix:

- Original result-first Android helper: ASK and Activity both expected to fail only at the missing deleted-without-result notice, after current/stale/paging/recreation succeeded.
- Merged helper: original ASK and Activity, each Chinese/Dark and English/Light, current→ordinary stale→older page→recreation→explicit deletion. Deleted history has no stale notice, old prose, excerpts or original-evidence actions; Activity withdraws the deleted result link.
- An actual held A history request across production account replacement, B theme selection and Activity recreation: B’s own conversation remains visible, with no A content/notices. The final runs record actual cancellation, not delivery of a retired A response body.
- Two genuinely different processes retain A’s stale conversation/pagination, then explicit deletion clears it. Same host/app data retained; owned process death is verified.

Two original F WORK runs (both old-helper and fixed-helper APKs) exposed a separate production server seam before reaching deletion: the completed Work item lost “查看成果” after an ordinary revision. Both were genuine failures, not expected helper REDs. Read-only HTTP evidence retained 21 stale answers with results while Work was completed with zero artifacts. G restores only the owner-bound, exact canonical published-turn saved-conversation navigation metadata, matching the established history contract; operational result/artifact/model/branch authorization remains strict. The durable real-socket HTTP case reproduced RED before G and GREEN after G. Fresh G hosts then exercised the original Work navigation and assertions unchanged.

The primary nine accepted executions comprise the F ASK helper RED/GREEN, six G history/process executions, and the I account replay; the separate I Light→Dark variant is additional. The original Dark→Dark account run verifies selection and preservation, not a theme transition. The additional run asserts the actual initial requested Light preference/resources and verifies B’s Dark resources after account replacement/recreation. Neither account run invents a new login path: the history boundary uses the production account replacement transaction, while the original 77-method matrix covers the actual login/logout UI.

The two initial G account runs (Dark→Dark and Light→Dark) reached B’s own conversation but failed waiting for `heldReadCompleted`. Both proxies logged `Error: aborted`, with `readHeld=false/completed=0`: production `RuntimeSettings.replaceAccount` calls `HttpJson.cancelActive`, which correctly disconnects the old connection. The proxy waited before consuming its incoming request, then threw on that already-aborted request; it counted only normal response completion. I records real `req.aborted`/unfinished response-close or response-finish events, mutually exclusively and under an epoch retired before reset. The same 20-second settlement bound and full B/no-A/no-notice/theme assertions remain; the two actual replays use a freshly built instrumentation APK. These two earlier attempts remain fixture failures, not client PASS or production failures.

The history process pair retained the same host/app data: phase one recorded PID 25873/start identity; after that instrumentation retired, an actual MainActivity startup PID 27621 was positively identified and killed with `run-as kill -9`. `/proc` and package PID absence were confirmed; phase two PID 27686 read persisted original-owner stale history and older pages, then deleted the evidence. This is a process-death/restart check, not merely Activity recreation.

## Builds and artifacts

Development APK/instrumentation/lint and multiuser fixture APK/instrumentation/lint builds naturally exited 0. Both lint reports have 0 errors and 269 warnings. Production/source equality permits reusing the APKs while retaining the actual artifact hashes below. The selected original 77-method class and dependencies are unchanged; the unused history class inside the older multiuser test APK is not claimed to have been rebuilt. The history control-only timeout was rebuilt in the development instrumentation APK. I’s final instrumentation assembly naturally exited 0 (49 tasks: 4 executed, 45 up-to-date); the final fixture’s strict standalone NodeNext type check also naturally exited 0 with an empty log.

| Artifact actually installed | SHA-256 |
| --- | --- |
| Android development GREEN | `8b77cc3d98ab6500e16778606caf7313f102d83983100c6ae8d278e3129aff43` |
| Android development RED (only result-first helper differs) | `2e5629f7ccaca487bfbe2de8b80bb8815d0f7fc99fa0d4840d88e33d7b0ef196` |
| Development history instrumentation before I | `665c647b3fb6eb90c9df031a1a352b51232163749a988a641aec0c2b9b3b79f0` |
| Development history instrumentation I | `74cb98d4073673923897c5862ffa26be2ea5212ded62301694b4b7b006b1d67c` |
| Original development appearance instrumentation | `49c327f9035dc0c9ff237f5bdc94f78e2dbfdebdd2694748a4034513d4fe9b55` |
| Multiuser fixture APK | `cec46a169c9e1248bec0eb6c19b1d5fce6ff882d9e1574f942a0bc3b5fa925ec` |
| Multiuser instrumentation | `af03d5124e2a3df0195ba99e8e4b87618dc8c7669641e2e8fd1e162a370524b2` |

The development GREEN artifact’s ZIP payload entries match the initial successful build; a later packaging pass changed compression only. RED vs GREEN differs only in the helper’s code payload. The instrumented history control can wait at most 22 × 30 seconds for 22 generated real query runs; this is separate from all product timeouts and the unchanged 30-second guard for each real query run. Final 21+1 initialization naturally completed with 66 generated provider requests and bounded proof counts.

## Negative and setup evidence retained

C’s 21-turn generated setup uncovered a real proof-growth regression before native UI execution: inherited pins/materials grew 1, 1, 2, 4, 8…, consumed a core and exceeded the unchanged per-run guard. A low-concurrency reproduction retained a private coherent SQLite backup and CPU sample. Exact full-JSON proof deduplication in C2 preserves distinct revisions/proofs, with a parent-owned 12-turn actual-Harness regression and these final 21-turn journeys. The generated database/credentials remain outside Git.

One C2 native attempt reached ordinary stale/paging/recreation but fixture deletion returned 503 before the actual domain handler: a bodyless DELETE incorrectly advertised JSON. Current Fastify reproduced `FST_ERR_CTP_EMPTY_JSON_BODY` with handler-reached=0; omitting that header reached the handler and returned 200. That header repair was the sole overlay for the F-equivalent C3 history runs; I’s later cancellation accounting is separately attributed above. This attempt is neither product RED nor PASS. An old C3 preparation was deliberately stopped during replacement and its concurrent reset saw EOF; that controlled harness interruption is also retained, not counted as a product failure or pass.

Other setup-only corrections: explicit JDK21 for AVD creation; the instrumentation build’s required testBuildType property; nested dependency links; canonical temporary-path dependency links; copied Swift module caches containing another checkout’s absolute path; and a fresh-process PID driver sampling after instrumentation had already retired its process. Each accepted run used corrected setup and naturally completed. The serial-to-parallel pre-C transition and unsuccessful setup receipts remain separate. Early fixture cleanup is registered before initial reset; positively identified old failed-fixture directories were removed after process/open-file checks.

## Scope and cleanup

All emulators ran with no window/audio/snapshots, using generated data only. Appearance methods draw only the generated app’s own views; no real personal screenshots were collected. The hidden Electron flow uses actual main/preload/renderer, real production HTTP service behavior and generated external calendar/browser adapters. Browser handoff URLs and owner-bound context reads were verified; this is not a claim of a live external browser/physical-calendar run.

The old wire-1/storage-v3 generic UI scripts remain explicitly legacy and fail early on current storage v4, before profile/window creation. Both guards were executed. Current `test:ui` executes its actual wire-2 account/theme/history and full appearance journeys; historical generic dialog/upload/app-discovery/privacy-editor details not present in those current journeys are not claimed as newly executed.

C2’s 79 backend processes and 139 distinct ports are stopped, reverse mappings are empty, and its owned 5590 AVD exited naturally with its private resource directory removed. The two earlier F hosts, two G hosts and two I hosts shut down through their own cleanup handlers (all report code 0/directory removed); every PID and published port is absent. The two history AVD names/PIDs were positively identified, both launchers naturally exited 0, their private AVD/resource directories were removed, and all owned reverse mappings were removed first. The shared ADB server and user-owned resources are left intact. Physical/OEM devices, real capture/permission behavior and live models remain unrun.

Historical reports remain bound to their original sources: [main Android wire-1 notice](android-history-notice-2026-10-17.md), [PR159 original Android acceptance](multiuser-pr159-android-regression-2026-10-17.md), [appearance matrix](cross-platform-appearance.md). Current integration responsibilities are in the [integration ADR](../adr-multiuser-main-integration.md).

This batch began on 2026-10-17 UTC and finished on 2026-10-17 16:05:36 UTC (Asia/Shanghai local date 2026-10-18).
