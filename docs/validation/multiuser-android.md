# M15 Android capability and acceptance ledger

Implementation starting parent: `98d76945e091d7234217ebcf532ebeff3350937c` (M11 final including M01/M03).
Independent workspace: task-19/mote; feature `codex/mote-multiuser-m15-android`.
Current M12 stable10748005/runtime dcad6088 is consumed after the parent's explicit handoff restoration, including the earlier4a/5172 lifecycle changes. The earlier pending-handoff statements below are historical. M13/M14 WIP is not accepted dependency evidence.

Current acceptance boundary: fixed0c59dcd99bb73281ad34c0f5292d5a68d081c609
(runtime a73ae69f2d7a511692429c11313c07dcbdee6588) passes the complete Android
JVM357/357 across75XML with0failures/errors/skips and debug/fixture app/test APKs,
35s EXIT0. The initial40s full command's one old Imports acknowledgement fixture
failure is retained; test-only0c59 corrects its obsolete response shape, preserving
all original lost-ACK/same-body/one-part assertions. Earlier353/353 remains exact
historical evidence rather than the latest gate.

The real QR post-restart ACK410 P2 is now samecase GREEN2.117s; a revoked device
credential remains pending/no-upload2.019s. Normal real duplicate ACK2.166s,
five-field self rejection and explicit device reauthorization0.408s, held A JSON
result retirement/new B selection0.993s, original issuer QR1.376s and original
M04 operator-setting explanation0.851s also pass as separate single native cases.
Agent canonical expansion passes0.980s at the same APK. These are not a final
M15 module or full affected pass. Public Files control/complete export and original
model copy/probe/directory/Agent preview-events contracts still need final scope
closure; see the [finite final matrix](multiuser-android-final-matrix.md).

No M15 push/Draft PR/final affected has happened. M15's parent-allocated Android
phase is explicitly RELEASED; no long affected began. Physical-device, public
HTTPS and live-provider checks remain separate. Existing-local-Codex connectivity
used only an authored generated prompt and exact gpt-6.1-sol, not model quality or
provider-wide acceptance. No test count closes missing original capabilities.

| Decision | Existing capability and real chain | Required account adaptation / evidence |
| --- | --- | --- |
| KEEP | Accessibility/UI-page/MediaProjection screenshots → CapturePipeline/staging → DurableQueue → UploadWorker | Preserve privacy masks, OCR gate, image dedupe, metadata, timestamps and original bytes. Freeze collector configuration/owner before asynchronous capture; pause on account switch. |
| KEEP | Notifications/device events/audio → MediaCollectionService → queue | Preserve per-app rules, intervals, permissions and metadata. Never carry A observations to B. |
| KEEP | QuickNotes/NoteDraftStore → queue → UploadWorker | Draft and prepared immutable ID belong to account; safe retry after death, separate B draft. |
| KEEP | SourceScanWorker/SourceProviders → LocalSourceStore; FileSources → FileArchiveQueue byte-preserving spool → SourceUploadWorker/FileUpload | Preserve calendar and selected files/folders, original/snapshot/reference, one-time/continuous scans, original bytes, late ACK and retry. Owner-specific cursor, configuration, registration and spool. |
| KEEP | SyncSchedule/Heartbeat/Recovery/WorkManager | Preserve manual/timer/batch/network/charging conditions, cancellation/backoff, reconciliation and retention. Worker intent carries original owner; old worker cannot adopt B. |
| KEEP | QueueStorage/QueueLocationStore, local browse, dedupe, export/import and diagnostics | Existing queue engine and encryption remain; account namespace precedes directory selection. Cross-owner archive restore must reject; retain A files. |
| KEEP | CentralContent/CentralScreens/CentralClient native navigation, Ask, Library, configuration, plugins, administration, file/note drafts, media | One account shared with collection, immutable client/generation fences, scoped cache/drafts; username/password and browser handoff use M01. Per-domain wire adaptation and remaining shared contract gaps are recorded separately; M12 public contract is now available. |
| CHANGE | URL dataOrigin / token-hash source target; owner token login / invite | Stable normalized origin + server-verified deploymentId/userId; credential rotation retains owner; different deployment at same URL is different owner. Wire 2, Ingress 3. |
| CHANGE | Local storage format 3 without stable account binding | Format 4 rejects old marker/config before writes; no auto-migration, deletion or inferred owner. Anonymous local collection remains explicitly local until user confirms binding. |
| REMOVE | Treating HTTP success or legacy v2 receipt as sufficient ACK; same URL as owner | New account-bound complete M03 receipt must match owner/source/batch/capture set. |
| EXCEPTION | Shared device settings, update artifacts, bundled OCR models and encryption key | Non-private installation resources remain shared; content/cursors/drafts are account-scoped. |
| UNKNOWN | Real phone/vendor background behavior, system calendar permissions/native writes, live providers/model quality | No real private data or real provider account was exercised; one existing-local-Codex connectivity case used only a generated prompt. System-permission, real-device and model-quality evidence remain separate. |

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

Actual Android worker/death checkpoint (runtime `179f9a4b06d8eae41cd203540c689c49cf2315ab`, instrumentation adds only the explicit existing-store ready wait):
- 6s fresh instrumentation incremental build EXIT0 `/tmp/m15-worker-build3.log`; prior app APK from successful `/tmp/m15-worker-build2.log`.
- `emulator @mote_ui_focus_5330_api37 -no-window -no-audio -no-snapshot -read-only -datadir /tmp/m15-emulator-data -port 5562 -dns-server 127.0.0.1`; SDK existing system image, new temporary writable images. Only new `dev.mote.collector.m15fixture` and its own test package installed. No physical device or existing app state accessed.
- Real production backend listener `apps/android/test-fixtures/multiuser-backend.ts` on temporary 127.0.0.1 random port, genuine Accounts/SQLite/single executor/M03, generated account credentials, no configured external providers/models. adb reverse exposes only this loopback port to the emulator.
- phase1 `offlineAThenBPreparesDurableProcessDeathCheckpoint`: 1/1 JUnit, verified command EXIT0, `/tmp/m15-worker-phase1-ready.log/.exit`. Actual QuickNotes→existing queue→WorkManager UploadWorker; old A WorkRequest rejected under B, explicit B upload confirmed by real scoped HTTP, A originals retained. Rejected old A queue handle remains rejected.
- `adb -s emulator-5562 shell run-as dev.mote.collector.m15fixture kill -9 4770`; observed no remaining fixture PID before restart. This is an actual SIGKILL, not a seeded journal or graceful stop.
- phase2 `restartAfterActualProcessDeathRestoresOnlyBThenExplicitAResumesOriginalBytes`: 1/1 JUnit, verified command EXIT0, `/tmp/m15-worker-phase2-sigkill.log/.exit`. Saved B owner restored; B cannot read A capture; explicit A reauth finds original directory/draft/capture ID/body and real Worker uploads it only for A.
- Earlier setup-only `busy` failure `/tmp/m15-worker-phase1-rerun.log` came from running before Application QueueStorage recovery finished; the fixture now waits for that real readiness condition, no fixed sleep or runtime weakening.
These two tests prove the named lifecycle sequence; they do not yet cover held ACK/network recovery/permission revocation or all capture producers, nor final dependency composition/required affected.

Public consumer seam RED: test commit `e9f0b0b6`, production parent `179f9a4b`; `node --import tsx --test apps/server/test/multiuser-android-transport.test.ts` 0/2 pass EXIT1 `/tmp/m15-device-seams-red.log`: compressed ingestion and device heartbeat return `503 scope_unavailable`. No server fix existed at RED time.

Minimal M03 preservation fix (additive routes, same authenticated UserIngress/SQLite/transaction): heartbeat and ID-only reconcile stay bound to original account/device/source; device metadata registration preserves earlier heartbeat fields. Existing Ingress3 captures accept original gzip JSONL with bounded legacy count/bytes and explicit batch ID. Wire2/Ingress3 and complete receipt remain mandatory; unbound legacy APIs are not reopened. Pure `capture-limits.ts` is explicitly allowed by the import checker (constants only, no Store import).
Same two RED tests after implementation: 2/2 EXIT0 `/tmp/m15-device-seams-green2.log`; first development attempt was an incorrect import of old pure constants from shared, failed at module load `/tmp/m15-device-seams-green.log`, not business evidence. Expanded same cases plus public real-consumer test 3/3 EXIT0 `/tmp/m15-device-seams-final-focused.log`. Scope inventory/import check EXIT0. Full M03 regressions, Android compressed/heartbeat/reconcile actual worker consumption and final required checks are still pending.

Composed M14's independent server seam `fdc50cdcfa71c6fc0d7e3f3e1185f03466fae64b` (parent M11 final98d) as `69f1fa5c`: source metadata PATCH, exact current file predecessor, source description CAS and legitimate compacted state prefix extension. Single conflict resolved by retaining both source methods and M15's heartbeat-preserving registration. No Desktop runtime pulled in. Real common contract cases run below independently in this workspace.

Independent review of exact179f9a4b by M14: `/tmp/mote-m14-review-m15-179f9a4b.md`, static read-only, no independent test claim. No confirmed P0/P1 in that scope; confirmed P2 plain anonymous editable draft with empty queue was excluded from hasPendingData, so even explicit adoption left it outside selected account. Added actual RuntimeSettings/Settings checkbox-unselected/selected regression; no automatic claim of anonymous data is allowed.

The later narrow JVM attempt `/tmp/m15-cache-red-build.log` failed before the newly added disable check reached backend: JDK HttpURLConnection rejects PATCH (Android's implementation supports it). Replaced only the JVM external HTTP adapter with JDK HttpClient; production transport, assertions and real server are unchanged. Not counted as product RED. APK/testAPK assembly in that combined command did not complete after failed JVM task; earlier emitted APK evidence remains separate.

Actual emulator RED before fixes (test-only commits f58b24d2/e5d47a9d): `/tmp/m15-anonymous-red.log/.exit` and `/tmp/m15-inventory-red.log/.exit`, each JUnit 1 failure / verified EXIT1. Plain editable anonymous draft allowed unchecked login; local inventory after A→B retained A records=1. Fix includes editable text/mood in explicit binding confirmation, tags and invalidates snapshots by stable owner, reads/publishes under existing ConnectionGuard and fences notification/Activity consumers. Same actual entry regressions each 1/1 EXIT0: `/tmp/m15-anonymous-green.log/.exit`, `/tmp/m15-inventory-green.log/.exit`.

Narrow current build `/tmp/m15-cache-draft-green-build2.log/.exit`: 5 JVM tests (real composed M01/M03 Kotlin + initial boundary) and fixture APK/testAPK assembly EXIT0, 9 seconds. First attempt `/tmp/m15-cache-draft-green-build.log/.exit` failed fixture compile because Android bootclasspath lacks JDK java.net.http; test-only local socket adapter now supports PATCH without changing product transport. Test fault-hook initially registered after Fastify injection and failed fixture startup; moved before first request. Neither setup failure is a product regression or passing evidence.

Actual Worker against fresh composed backend plus test-only onSend hold/network listener control: `/tmp/m15-ack-network.log/.exit`, 1/1 EXIT0. Server commits A capture but holds real receipt; actual RuntimeSettings account switch drains/cancels Worker, late ACK cannot clear A queue or enter B; explicit B note uploads; explicit A restoration retries original capture; actual loopback listener closure produces worker error with retained queue and listener recovery allows explicit retry. Current production packed gzip uploads and new heartbeat/reconcile routes are composed; this test demonstrates actual gzip worker sending, not helper-only success. New source/head/context server tests composed independently 4/4 EXIT0 `/tmp/m15-m14-composed-seams.log/.exit`. Required full affected and remaining native capability/UI acceptance are still open.

Native notes RED `e4ed5566`: `/tmp/m15-native-notes-red.log/.exit`, actual Kotlin CentralNotes→old /api/notes returns CentralFailure, 1 assertion failure EXIT1. Preserve native encrypted outbox IDs/text/mood/attachments and original hash/chunk/retry flow; use real M03 captures and uploads, complete Ingress3 owner receipt before durable ACK. `/tmp/m15-full-android-first.log/.exit`: 335 tests, 332 pass/3 obsolete fixture expectations fail (unbound login, legacy attachment receipt, format3 marker). Actual native note and >4MiB chunked attachment M01/M03 case passes; no test skipped. Updated those fixtures to verified binding/owner receipt3/format4, retaining lost-ACK exact manifest and durable-part skip assertions. `/tmp/m15-full-android-second.log/.exit`: all335/335 and fixture APK/testAPK build EXIT0 (29s). Later native selector and instrumentation compilation `/tmp/m15-native-ui-build.log/.exit`: narrow13/13 plus APK/testAPK EXIT0 (14s); these counts are independent, not cumulative extra tests.

Heartbeat canonical metadata issue raised by M14: RED `1c78fa0a`, `/tmp/m15-heartbeat-shape-red.log/.exit` register→heartbeat→devices returns id undefined. Minimal server-only `4e39417096175dd9f7aa47a8d2b6244bff1c877d` keeps prior metadata and id=deviceId/name=deviceName. Same actual transport2/2 EXIT0 `/tmp/m15-heartbeat-shape-green.log/.exit`.

Consumed M13 independent public projection c6b092eda5404dde2f99ea601e2f3ef13c55d386 as687224f7 (parentM14fdc/M11final). Own actual public+collector+projection tests5/5 EXIT0 `/tmp/m15-native-projection-composed.log/.exit`. This does not claim M13 final parity. Shared page projections/mappings are M13-owned; snapshot recovery/Activity contract is M14-owned. Android keeps original consumers and reports missing contracts; no parallel facade or silent removal.

Original per-request model selection gap: initial Ask fixture accidentally copied redacted settings and failed config setup; `/tmp/m15-request-model-red.log` and green-first are not Ask RED/GREEN evidence (M04 model-ID assertion was valid). Corrected actual fixture atdf31f88d re-ran against committed unchanged production: `/tmp/m15-request-model-valid-red.log/.exit`0/2 EXIT1 (M08 actual request rejects explicit fields; M04 ignores model ID). Same tests after minimal M04 leaseReference/M08 input seam:2/2 EXIT0 `/tmp/m15-request-model-green2.log/.exit`. Personal request changes only model ID on its owned complete connection; shared resource remains fixed; no default configuration mutation; actual loopback provider observes exact model/owner; snapshot restore/fork and credential revocation remain checked. Public freeze db88c017f513f299802e0acd7641f2b41e2653fb parentc6, no native dependency. M14 bounded read-only review `/tmp/mote-m14-review-m15-db88.md`: no confirmed P0/P1/P2 in5-file scope, no independent test claim. Full server regressions and final affected remain pending.

Current native Android runtime checkpoint6072b13a: real native ActivityScenario username/password A login→native note editor/save→actual M03→B account switch/empty private view,1/1 EXIT0 `/tmp/m15-actual-native-ui.log/.exit`. Generated bitmap CapturePipeline held while RuntimeSettings drains account→B empty queue→explicit B generated frame→actual packed Worker/M03,1/1 EXIT0 `/tmp/m15-capture-drain-green.log/.exit`; no platform screenshot, OCR/model I/O or permission grant. First screenshot fixture used invalid OCR mode off and failed validation before capture (`/tmp/m15-capture-drain.log`); corrected fixture uses existing disabled upload gate, no runtime weakening. Current packed Worker phase1 EXIT0 `/tmp/m15-current-phase1.log/.exit`; test runner had already exited its process before planned kill, so launched only generated fixture MainActivity then actual SIGKILL PID6267, observed absent (`/tmp/m15-current-sigkill.log`). Actual restart phase2 EXIT0 `/tmp/m15-current-phase2.log/.exit`, preserved B and explicitly restored original A bytes. Current held real ACK/network recovery1/1 EXIT0 `/tmp/m15-current-ack-network.log/.exit`. These runs retain earlier179 evidence independently, do not infer OS permission-revocation coverage.

Additional same migration omission REDdcbda207: anonymous encrypted file-task draft and configured-but-not-scanned source, each empty queue, unchecked login was accepted. Actual Settings/RuntimeSettings RED1/1 assertion failure each `/tmp/m15-file-draft-red.log/.exit`, `/tmp/m15-source-config-red.log/.exit`. Minimal hasPendingData accounts for exact file-task draft files and existing source configurations, retains the same explicit local binding rule. Same tests each1/1 EXIT0 `/tmp/m15-file-draft-green.log/.exit`, `/tmp/m15-source-config-green.log/.exit`; selected binding aliases original directory and preserves encrypted bytes/URI metadata. No automatic data adoption.

Current actual SourceUploadWorker/SourceScanWorker test1/1 EXIT0 `/tmp/m15-source-worker-first.log/.exit`: synthetic A original spool→switch B same source/external/capture IDs→old A intent rejected→B WorkManager uploads original and exact B source description CAS→explicit A restoration uploads retained original and exact A context. Genuine absent URI access is rejected by actual scanner with permission status and no queued mutation. One-time captured byte-preserving spool uses existing importCaptured permission semantics; it is not a claim of granting then revoking an Android system permission. Build18s EXIT0 with6/6 current narrow JVM and fixture APKs `/tmp/m15-source-worker-build.log/.exit`.

Required affected preflight only: initial dry-run failed because independent clone lacked origin integration tracking ref, no checks ran. Read-only git fetch established exact6272a9b51ec92cc4c32e2ff1a1eeb4fa38b142ed. Correct dry-run `/tmp/m15-affected-plan.json` EXIT0 plans check:local plus Android unit suite; this is NOT required-command acceptance. No integration/main writes, push, PR, or CI changes yet.

M14 bounded179→6c102 review `/tmp/mote-m14-review-m15-6c102.md` found P2: original.ref checked only shape; native attachment/image could accept a substituted descriptor. File journal real M03 mutation valid RED in79e5c83a (`/tmp/m15-descriptor-query-red.log/.exit`); screenshot first used note source and failed positive schema setup, not product RED. Correct screencapture fixture eac9d979 yielded actual successful M03 receipt then assertion RED `/tmp/m15-image-descriptor-valid-red.log/.exit`. Minimal parser derives exact original ref from user/source/capture/hash/MIME/retention, checks bytes+MIME+retention, and binds image bytes to snapshot descriptor. Existing multipart lost-ACK test retains exact manifest/part retry assertions with a correct v3 descriptor. Actual file/image corruption regressions pass `/tmp/m15-descriptor-query-green.log/.exit`; narrow15 tests (6real Kotlin/M03+9native contracts) plus fixture APK/testAPK EXIT0 (17s).

Native query citation old capture-browser route also valid RED309f0f4d, `/tmp/m15-descriptor-query-red.log`: unavailable old request before public context read. Actual CentralEvidenceReference consumer now uses existing M08 /context/read, preserves query scope through next-offset/evidence links and cannot choose raw capture/material fast paths. Same native HTTP test proves an enabled source positive, source-disabled404 even while direct owner raw history remains200, and foreign user404. Raw note detail uses M02 /captures/:id; image/album/OCR equivalent shared projection remains explicitly open.

M04/M08 whole-file regression80/80 EXIT0,305.76s `/tmp/m15-request-model-regressions.log/.exit` (actual Harness, Memory, child tasks, revoke/cancel/restart, original snapshots). Earlier status message guessed top-level57; final Node aggregate includes nested cases80 and is authoritative. Server typecheck first EXIT2 missing copied nested mem0ai; verified12 existing registry packages against exact package-lock versions, independently copied from prior dependency workspace, relative symlinks stay inside own clone. Same typecheck EXIT0 `/tmp/m15-server-typecheck-repaired.log/.exit`, no dependency version/source change. Workspace runtime dependency locator is unavailable to this cloud-backed task, not a business-test failure.

Snapshot consumer follow-up consumes M14 public d383 as7205cabf and image-understanding fix63d as92549d36. Bounded static delta review `/tmp/mote-m15-review-m14-63d.md` closes the prior premature OCR release P2; independent M15 execution is still pending. M14 independently closed receipt descriptor review P2 for44507f34 in `/tmp/mote-m14-review-m15-6c102.md`; this does not substitute for native execution.

New actual generated DocumentsProvider→FileArchiveQueue→SourceUploadWorker snapshot test6798 initially failed before the intended recovery assertion. Repeated fixed source ID after fixture pm-clear collided with the previous generated backend device; isolated source IDs at13bbdd95 correct that fixture interference. The isolated actual provider run then exposes a separate genuine runtime RED `/tmp/m15-provider-receipt-red.log/.exit`: real backend stored correct bytes and descriptor, while Android computed a different capture ID and refused durable ACK. Android platform org.json escapes `/`; server JSON.stringify does not. Earlier JVM JSON fixtures did not exercise that platform difference. Keep this distinct from the not-yet-reached recovery RED and from the failed setup logs.

Platform wire-identity fix7e4df734 uses JSON.stringify-compatible string-array encoding only for public receipt identities (including MIME and real content:// external IDs); legacy local signatures/opaque batch generation are unchanged. Real provider first upload now succeeds. An over-eager diagnostic fetched A originals while B was selected and correctly got404 (`/tmp/m15-snapshot-valid-red.log`); removed that diagnostic without changing runtime. Intended actual recovery RED finally reaches line123 at7e4df734: `/tmp/m15-snapshot-valid-red2.log/.exit`, expected0 remaining candidates but actual1 after explicit A Worker. Prior steps prove actual provider original upload, expiry-triggered blocked M06 job, B old-worker no-op and foreign original404.

Same real recovery scenario after the minimal consumer adapter: `/tmp/m15-snapshot-worker-green.log/.exit`1/1 EXIT0 (1.176s). Genuine generated DocumentsProvider bytes → prior immutable snapshot upload → deadline expiry → actual M06 blocked task → B cannot read A original/old A WorkRequest no-op → explicit A Worker fetches recovery list, persists recoveryId alongside old capture/revision/hash, reuses original byte-preserving spool/parts/commit and exact receipt → M06 automatically succeeds, recovery list empty, source history remains one version, original phone file unchanged. No fake model/provider, OS grant, new runtime, changed 24h window or ordinary retry renewal. Existing file queue restarted JVM characterization now checks the recoveryId persists. Current narrow24/24 (18 file-journal +6actual Kotlin/M03) plus fixture APK/testAPK build EXIT0 `/tmp/m15-snapshot-green-build.log/.exit`20s. Empty recovery pages with nextCursor are continued via an account/source-owned durable cursor, not treated as completion. Final full Android/required affected and broader shared-page contracts remain pending.

Native plugin inventory valid RED8e16d8da `/tmp/m15-plugin-inventory-valid-red.log/.exit`1/1 EXIT1: actual M09 /plugins has no legacy host installation aggregate. First combined attempt failed instrumentation compile due test-only draft.save typo (correct update API), not a product RED. Native UI now maps M13 public65a directly: owned raw instances/declarations, distinct admin package revision, explicit source/capability/history grants, preserved masked same-instance refs/CAS and actual check/lifecycle bodies. Memory tab uses actual M07 desired/generation/binding/pendingExternal/preparation receipts, no fabricated old plans or stage counters. Actual generated package sameID A/B, masked edit, stale CAS409, check/enable/disable, owner-only prepare discovery/cancel all pass; narrow15/15 EXIT0 `/tmp/m15-plugin-commands-build2.log/.exit`. The first expanded fixture used non-UUID install operation ID and failed startup400 before consumer assertions (`...build.log`), corrected only fixture to randomUUID. APK/testAPK compilation also EXIT0. i18n8327 EXIT0 `/tmp/m15-plugin-i18n-fixed.log`, prior i18n syntax typo retained separately.

New actual token rotation instrumentation `/tmp/m15-token-worker-green.log/.exit`1/1 EXIT0: same account with freshly issued token keeps directory, original capture ID/bytes and editable draft; old stamped intent sends nothing, new Worker uploads original only for A/B404. No change to identity fields.

Native confirmation dialog test first failed with revision1→2, but this was M04/M07 lazy default initialization, not evidence of the dialog command. `/tmp/m15-memory-dialog-red.log` and initial green attempt are fixture/setup evidence only. Warm both accounts via actual configuration API, then run ORIGINAL unfixed confirmation code: `/tmp/m15-memory-dialog-valid-red.log/.exit`1/1 EXIT1, B revision2→3 at the old A-modal confirm assertion. New positive B modal and A unchanged assertions are in the same test but not reached at RED. This is a separate production boundary issue; fix/acceptance follows.

Valid warmed-defaults modal RED atb7738648 is closed by fixing CentralScreens.confirm to its creation-time CentralClient/page revision; detached native buttons receive the same fence. Same unchanged actual Android test `/tmp/m15-memory-dialog-final-green.log/.exit`1/1 EXIT0: old A modal after B switch changes neither account, then a newly opened B modal executes exactly once and A remains unchanged. Fresh generated backend restored equal preconditions after RED; no fixtures weakened. Fixture APK/testAPK EXIT0 `/tmp/m15-dialog-final-green-build.log/.exit`9s. Earlier first green attempt still measured lazy default initialization and is not passing evidence. This closes the specified modal seam, not all native central pages or full final acceptance.

Current Android full suite at1941065e:339/339, no failures/errors/skips, full fixture APK/testAPK assembly EXIT0 `/tmp/m15-current-full-android.log/.exit`36s. Counts read from all JUnit XML, not inferred. Obsolete unused legacy plugin wire helpers/MemoryBindingView fake projection were removed and the seven original command tests migrated to actual scoped command semantics without dropping scenarios (install retry, explicit grants/CAS, enable vs bind, prepare vs activate, requested vs observed, field validation, old-owner transport retirement).

Actual native generated-package editor `/tmp/m15-plugin-editor-ui-compiled.log/.exit`1/1 EXIT0: Activity fields and buttons choose explicit own source/processor grant/history=false, create, edit the same instance while hidden credential remains blank and preserved, then B UI/API contains no A instance. Earlier premature emulator invocation occurred while testAPK assembly was still running and selected zero tests; `/tmp/m15-plugin-editor-ui.log/.exit` is correctly EXIT1/setup-only, not acceptance. M13 exactb773..ac0 bounded readonly review `/tmp/mote-m13-review-m15-ac0.md` reports no confirmed P0/P1/P2; no independent execution claimed. Later194 removes only unused old wire helpers and updates their tests, adds actual UI test; no change to reviewed live command behavior. Final consumer combination/required affected remains open.

Independent source recheck at194: native note/UI and generated screenshot drain each1/1 EXIT0 `/tmp/m15-194-regression-{notes,capture}.log/.exit`; source test stalled during INITIAL RuntimeSettings.loginA and reported account reconfiguration150s timeout (`...source.log/.exit`), before source upload. No late-ACK case ran in that batch. One own-process watchdog retry then passes1/1 `/tmp/m15-source-watchdog-rerun.log/.exit`; no watchdog stack file was generated, so the initial timeout is not conclusively attributed to a captured stack. debuggerd under own fixture UID returned root-required; no root/security expansion attempted. Follow-up diagnostics use only Thread.getAllStackTraces in the synthetic process.

A real reachable storage lock inversion was then isolated: Settings.save holds Settings.class while checking pending queue; queue location validation under DurableQueue.exclusive called accountDirectory/choices→Settings.read. Actual queue while credential-settings monitor held deterministic REDb8d1e257 `/tmp/m15-queue-lock-valid-red.log/.exit`1/1 EXIT1. Minimal fix reads only atomic stable accountBinding/localOwnerKey metadata for directory/preference/location checks, never token/decryption/configuration monitor; full credential self/epoch/current-owner checks remain. Same actual queue regression `/tmp/m15-queue-lock-green.log/.exit`1/1 EXIT0. Old owner handles must still reject under B and are rechecked below. This fixes the demonstrated inversion; earlier one-off timeout remains separately recorded, without pretending a missing stack was captured.

Real same-origin replacement deployment checkb6706083: old generated backend is terminated, fresh M01/SQLite binds the SAME loopback URL/port with new deployment, old bound Ingress3Client sends only GET self and rejects before any private POST; new owner explicitly uploads successfully.1/1 EXIT0 plus diagnostic testAPK assembly `/tmp/m15-redeployment-and-diagnostic-build.log/.exit`9s. No fake self/deployment response, real account or external I/O.

Post-storage-fix acceptance at5a0dd911e8897722b33c047cb537fb058695da55: full Android340/340,0fail/0errors/0skip, fixture APK/testAPK EXIT0 `/tmp/m15-storage-full-android.log/.exit`33s. Actual phase1 old A retained queue handle still rejects under B and explicit B upload succeeds1/1 `/tmp/m15-storage-phase1.log/.exit`; launch only own generated MainActivity, actual SIGKILL PID12631, observe fixture PID absent (`/tmp/m15-storage-sigkill.log`); restart without clearing data phase2 B restored→explicit A original queue/draft/bytes upload1/1 `/tmp/m15-storage-phase2.log/.exit`. Actual source lifecycle sameID A/B three fresh runs each1/1 EXIT0 `/tmp/m15-storage-source{1,2,3}.log/.exit`; actual provider snapshot expiry/recovery1/1 `/tmp/m15-storage-snapshot.log/.exit`; held real ACK/network closure+restoration1/1 `/tmp/m15-storage-ack.log/.exit`. The earlier isolated150s startup failure remains recorded; these successes do not invent its absent stack. M14 bounded5a read-only review `/tmp/mote-m14-review-m15-5a0d.md`: no new confirmed P0/P1/P2, no independent execution.

Checkpoint only, NOT M15 completion: no final combined check:affected, production APK final build, remote head or Draft PR. Shared original Library/Ask/config/plugin/Memory page mappings and remaining native readers must consume final M13 seams; Activity/source reader final contract comes from M14; export/backup/delete from M16. M12 authorization remains pending and untouched. Positive notification-listener/accessibility/system media/calendar permission grant→revoke and physical-device background checks have NOT run; no OS permission was silently enabled. Existing generated bitmap/native notes/provider/source worker checks do not stand in for those platform grants. Current LocalContentCipher preserves the original plain content bytes; only credentials and native private ledgers use SecretBox. Do not describe the local file spool as newly encrypted.

## Resumed M13/M14/M16 composition and personal export consumer

Own feature merged M14 PR139 exact `7e080c728a6eea91876d32263ef28e45b8676b9b` and M16 server public `75fef1f801f026f11dbce064887d87f27f06af8e`. Dependency gates are not M15 acceptance. The M16 ancestry includes the stopped-backup RED; its subsequent frozen backup implementation will be composed before required checks. M14 remains inactive and was not awakened. No M12 content was read or forwarded.

| Disposition | Original Android surface | Actual consumption / remaining boundary |
| --- | --- | --- |
| KEEP | Native Vault navigation, file chooser, account switch and retry after ambiguous network result | Same native page and document-result callback; admission ID is saved in the original account preferences before sending. Lost responses reuse that ID. A server-confirmed retired authorization clears only the local pending ID; a new user action must start another export. |
| CHANGE | Global metadata/data bundle exports | M16 portable3 owner task, exact account/deployment receipt and declared domains/exclusions, list/status/retry/cancel/content. This is the M16 replacement policy, not a second native backend or an administrator private archive. |
| CHANGE | Streaming a generic bundle straight into the selected document | For portable3, verify the current completed receipt, HTTP status/content length/MIME/ETag and exact byte count/SHA in an account-local temporary file before publishing bytes. Delete staging on every outcome. Retire detached buttons and picker results on account/generation change. |
| UNKNOWN | Personal import; stopped operator instance backup; remaining storage/index/encryption management | Still M16-owned and OPEN. Existing import navigation remains; no fake successful import/backup task or new mobile whole-instance download. |

RED `75142c07`: the actual existing global Vault export target returned HTTP503 through CentralClient, one executed Kotlin case, `/tmp/m15-portable-red.log/.exit` EXIT1 (not a compile or empty-test failure). New M16 admission and real owner list/content/cancel path plus staged HTTP corruption cases: 3/3 EXIT0, `/tmp/m15-portable-green.log/.exit`, 12s. The download case exercises correct bytes, incorrect hash/MIME/ETag/length and session retirement; rejected output remains empty and all staging is removed. These JVM tests do not yet prove the Android UI/document callback. No final required/build/combined acceptance is claimed.

M16 bounded review exact cd9: `/tmp/mote-m16-review-m15-cd9.md` confirmed P2: request72 opened the selected document with `wt` before `CentralPortable.save` finished checking the current artifact. A failed hash/receipt could therefore truncate an existing document despite zero output writes. Output-factory correction is being prepared; this issue remains OPEN until the generated existing-document scenario actually reaches the assertion and passes afterward.

Native fixture attempts are retained, not counted as valid product RED: `/tmp/m15-portable-native` was stopped after a test-start wait; `/tmp/m15-portable-document-red` own Java thread file `/tmp/m15-portable-document-own-threads.log` confirms Instrumentation.startActivitySync waiting with main idle because a premature blocking document monitor matched Activity startup. The next `/tmp/m15-portable-document-valid-red` launched the actual Vault, admitted a completed M16 export, and reached download, but the monitor lacked MIME/category matching and Android opened DocumentsUI; it timed out before output/sentinel assertions. The unused picker was dismissed without choosing a file or granting permissions. The monitor now matches ACTION_CREATE_DOCUMENT, CATEGORY_OPENABLE and application/json and is installed only after Vault startup. `/tmp/m15-portable-pre-factory-app.sha256` preserves the exact compiled old app for the pending valid P2 RED. The new test APK must be rebuilt after the agreed M16 required window releases; neither failed fixture attempt proves the P2 runtime path. Existing `/tmp/m15-portable-green` JVM3/3 remains valid at its earlier implementation; factory changes are not yet rerun. i18n8379 and scope checks EXIT0 at this checkpoint.

### Real retained central drafts and document sentinel closure

New native retained-draft case on the preserved old app (`/tmp/m15-pre-factory-app.apk`, SHA256 `b8b1e1ffb64aa9389832ca961c54ce5c49c638646d07eb5045ce21c2b07b6090`) gave valid P1 RED: `/tmp/m15-central-owner-valid-red.log/.exit` EXIT1, one executed case0.673s, B actually displayed A's unsaved private central draft. Same-origin `applyAccess` had cleared views but retained the constructor-bound CentralScreens directory and its note/Ask/import/attachment/Insight stores. This was missed by the earlier synced-note/empty-B positive; that older positive is not evidence for retained native drafts.

The unchanged case then passed1/1 EXIT0 `/tmp/m15-central-owner-final-green.log/.exit`,0.925s: B starts with an empty draft, explicitly writes B, A restores its original draft, and B restores its own. Session changes rebuild the page/store object; its client accessor also rejects an owner mismatch. The first GREEN attempt `/tmp/m15-central-owner-first-green` failed because the new guard could fire during an immediate navigation before the periodic account poll. Navigation now clears the retired object and resolves current access before rendering. This was an implementation lifecycle failure, not weakened fixture input. Activity work-state restoration and document picker intents now also retain the stable account key, in addition to origin/generation, and audio cache bytes use the captured account directory.

M16 P2 finally reached the real native request72 callback: `/tmp/m15-portable-sentinel-final-red.log/.exit` EXIT1, one executed case1.013s, prefilled generated sentinel became empty after server cancellation. The same case with the output factory passed1/1 EXIT0 `/tmp/m15-portable-sentinel-final-green.log/.exit`,1.13s, including good exact export bytes, cancelled export retaining the existing selected document, and detached A download ignored after B. The selected output stream is now opened only after receipt/current-authority and full staged HTTP integrity checks. `/tmp/m15-portable-sentinel-actual-red` and `-valid-red2` failed before the sentinel assertion: after returning from the first document result, same-generation `applyAccess` replaced the immutable client without rebuilding its button closures. Reopening the detail separated this resume-action issue from the independent truncation regression. Same-generation access now preserves the existing client; a dedicated pause/resume/save regression is being verified separately.

Current narrow JVM portable3/3 plus isolated app/test APK build EXIT0 `/tmp/m15-central-owner-portable-green-build.log/.exit`,12s. After the navigation repair, fixture app/test APKs EXIT0 `/tmp/m15-central-owner-final-green-build.log/.exit`,10s. These are current local bounded checks; final composed required/build/full-Android/worker/native gates and independent review of this delta remain pending. No OS permission was granted and no real account/file/model/provider data was accessed.

Dedicated same-owner pause/resume/save check also reached genuine runtime RED on the preserved old APK: `/tmp/m15-native-resume-valid-red.log/.exit` EXIT1, one case0.698s, no generated note published after CREATED→RESUMED. The unchanged case on the repaired app passed1/1 EXIT0 `/tmp/m15-native-resume-final-green.log/.exit`,0.807s. Same-generation access preserves the immutable client used by the existing actions. Subsequent fixture runs use a per-invocation UUID in the note body to avoid accepting a prior generated note. M16 bounded read-only cd9..e35 review `/tmp/mote-m16-review-m15-e35.md` found no additional confirmed P0/P1/P2 and statically closed the prior selected-document truncation P2; it did not execute tests or prove transactional behavior for arbitrary SAF writes.

Actual published Memory fixture uses the real M01/M03/M07 host, generated A/B Materials and loopback fake provider. First native attempt `/tmp/m15-memory-evidence-valid-red.log/.exit` executed one case and failed waiting for the list's detail button (45.665s). It did not reach the intended evidence assertion: the production list still required removed `evidenceCount`, while actual M07 page items return `evidenceIds` and no count field. The same synthetic backend response was read independently to confirm the shape. This is an earlier consumer migration omission; the minimal list fix derives its exact evidence count from that returned array. No evidence/correction GREEN is claimed yet.

### Scoped Memory native consumer increment (GREEN pending)

Consumed only M13 backend508/05c/3df/58, own505/d24/617/326; actual own composed `multiuser-web-memory.test.ts`3/3 EXIT0 `/tmp/m15-m13-memory-composed.log/.exit`,9.39s. This is public-seam evidence, not Android UI acceptance. KEEP native Memory navigation/detail/evidence/editor/settings and persisted task controls. CHANGE count to actual evidenceIds, canonical M07 evidence to existing M08 context reader, correction to operationId+correction and actual M07 task result, Memory configuration to M04 owner revision/value CAS. No backend facade, provider-count guess, global-default write or M12 consumption. Remaining manual selection/recipes/audit and unrelated original central pages remain separately open.

Actual list-fixed fixture app/test APK `/tmp/m15-memory-list-stage-build2.log/.exit` EXIT0,8s. Its first build failed only in the new settings test local function missing a brace/type (`...stage-build.log`), before native execution. Valid target REDs on that app: canonical evidence assertion `/tmp/m15-memory-evidence-target-red.log/.exit`1case EXIT1,0.619s; native correction saved no new Memory `/tmp/m15-memory-correction-valid-red.log/.exit`1case EXIT1,10.66s; native settings missing actual domain form `/tmp/m15-memory-settings-valid-red.log/.exit`1case EXIT1,0.591s. Separate actual compiled presentation JVM6cases3pass3fail `/tmp/m15-memory-progress-valid-red.log/.exit` confirms old code displays committed/stale/paused incorrectly; unchanged earlier legacy characterization scenarios remain.

Prepared minimal runtime corrections reuse original account-local encrypted CentralStateFile and serial draft writer for correction admission IDs, retaining the same UUID/body on uncertain retry and exposing retained pending admission under its original account. Receipt ACK opens existing /memory/jobs and only succeeded publish/correct task Memory IDs become view actions; committed historical completion survives current=false. Exact reader authority is carried through nested evidence links. Memory settings submit the original view's revision and fixed preserveRedactedSecrets to /configuration/memory, never a selected foreign account. i18n8381 EXIT0 `/tmp/m15-memory-i18n2.log/.exit`. No new GREEN/build claim until the next coordinated Gradle slot.

### Native Memory/settings and generic selected-document closure

Memory progress unchanged6/6 JVM passed; fixture app/test APK `/tmp/m15-memory-consumer-green-build2.log/.exit` EXIT0,16s. The first command's testAPK failed only at a new generic-sentinel test lambda variable (`...green-build.log`, product/JVM had compiled and6/6 passed); corrected fixture does not change assertions. Actual same evidence test `/tmp/m15-memory-evidence-final-green.log/.exit`1/1 EXIT0,0.857s; same Memory domain form/CAS/B-isolation `/tmp/m15-memory-settings-final-green.log/.exit`1/1 EXIT0,0.860s.

Correction's first GREEN attempt `/tmp/m15-memory-correction-final-green.log` failed fixture exact-string equality, not publication: real M07 job was committed/current=false with a succeeded correct task and a new published Memory, whose canonical statement includes its appended evidence citation. Fixed the fixture to use a per-invocation UUID and read the actual saved statement for UI equality. Re-ran the preserved old flat-body app with the corrected test: `/tmp/m15-memory-correction-canonical-valid-red.log/.exit`1case EXIT1,10.685s. Same corrected case on the repaired app `/tmp/m15-memory-correction-canonical-final-green.log/.exit`1/1 EXIT0,1.062s, including actual job refresh and opening its succeeded result body; B remains separate.

Three further original-entry actual REDs on the prior app: `/tmp/m15-memory-recipes-valid-red.log`1case EXIT1,0.714s (M07 catalog choices absent); `/tmp/m15-models-settings-valid-red.log`1case EXIT1,0.590s (owned M04 model editor absent); `/tmp/m15-generic-document-valid-red.log`1case EXIT1,0.513s (unavailable generic support download truncated its generated selected existing document). The generic route failure is independent of portable3 receipt integrity and introduces no invented SHA contract.

Minimal native adaptations retain the Memory recipe checkboxes using existing /memory/recipes and M04 memory revision/value CAS; general recipe selection changes only its corresponding field, with separate capture/document settings retained. The models entry uses the existing native structured/advanced JSON form for M04 profiles and selections with fixed preserveRedactedSecrets, preserving masked same-profile settings. Original credential-copy, connection probe and model-directory endpoints still have no shared multiuser contract and are visibly described as unavailable; no fake probe/copy success or shared credential disclosure. Generic selected-document download now reuses the same existing staging/output-factory sequence and current-account fences before opening `wt`; portable3 still requires its complete receipt/header/size/hash contract.

Fresh narrow7/7 JVM (progress6 + portable HTTP corruption1) plus fixture app/test APK EXIT0 `/tmp/m15-settings-stage-green-build.log/.exit`,15s. Same three native cases respectively passed1/1 EXIT0: `/tmp/m15-memory-recipes-final-green.log`0.774s, `/tmp/m15-models-settings-final-green.log`0.742s, `/tmp/m15-generic-document-final-green.log`0.632s. i18n8382 EXIT0 `/tmp/m15-settings-stage-i18n.log/.exit`. M13 bounded exact667 Memory review `/tmp/mote-m13-review-m15-memory-667.md` has no new confirmed issue but no execution claim; later model/recipe/generic deltas still require bounded review and final whole-module gates.

Parent explicitly resumed M14 as the fourth execution conversation; no fifth task is created. Personal portable import policy is now authorized as same-deployment/same-account merge/dedup only, with cross-deployment/account rejection; implementation remains M16-owned and native consumption awaits its freeze. M13 owns unfinished shared raw capture/session/image/OCR projection. M12 remains pending and untouched. No M15 remote push/PR or final required command is claimed at this checkpoint.


### Composed Android runtime e6 / backend 8c92 acceptance

Merged exact M16 `4731dabfaaf02d06a5a98d730525c4a3329679cb` as `8c92abd70ef7e12795a002d33387f3be849c7f1a`. This closes the inherited backup RED ancestry and includes the reviewed management retirement, backup owner-path/snapshot/pin/negative-byte corrections. No Android runtime difference from e6; M16 import remains WIP and is not consumed. M15 independently reviewed the one-line negative-byte correction in `/tmp/mote-m15-review-m16-9797.md`; this is static evidence, not an independently executed M16 test.

At exact8c92, real Gradle `:app:testDebugUnitTest :app:assembleDebug` EXIT0 in38s, `/tmp/m15-e6-full-android.log/.exit`:73 XML suites,346/346 tests,0 failures/errors/skips; production debug APK emitted. The APK/testAPK runtime remains e6. Adjacent actual native regressions on e6 pass independently: portable selected-document integrity1/1 `/tmp/m15-e6-portable-regression`, account draft retirement1/1 `/tmp/m15-e6-draft-regression`, same-owner resume/save1/1 `/tmp/m15-e6-resume-regression` (each `.log/.exit`, verified EXIT0). Earlier scoped settings/Memory/generic stage six actual native GREEN cases remain separately recorded above.

Started a fresh backend from8c92 using the existing actual `multiuser-backend.ts` Accounts/SQLite/single-executor/M03/M06 fixture, temporary loopback/generated A/B, no external services. Current isolated emulator `emulator-5562`:

- generated capture/drain/B explicit capture1/1 EXIT0 `/tmp/m15-composed-capture.log/.exit`;
- actual username/password native note/account switch1/1 EXIT0 `/tmp/m15-composed-login.log/.exit`;
- late real ACK plus listener closure/recovery1/1 EXIT0 `/tmp/m15-composed-ack-network.log/.exit`;
- same-owner token rotation/retained original intent1/1 EXIT0 `/tmp/m15-composed-token.log/.exit`;
- actual DocumentsProvider snapshot expiry/recovery/existing Worker1/1 EXIT0 `/tmp/m15-composed-snapshot.log/.exit`;
- actual Source Workers, equal IDs, byte spool/context, absent URI permission1/1 EXIT0 `/tmp/m15-composed-source.log/.exit`;
- actual queue/settings-monitor regression1/1 EXIT0 `/tmp/m15-composed-lock.log/.exit`;
- phase1 A offline/B explicit upload1/1 EXIT0 `/tmp/m15-composed-death-phase1.log/.exit`; launched only the fixture MainActivity, SIGKILL same-UID PID13624 and observed absent (`/tmp/m15-composed-sigkill.log`), then phase2 without clearing data1/1 EXIT0 `/tmp/m15-composed-death-phase2.log/.exit`. Original A directory/draft/ID/bytes survived, B remained separate, fresh explicit A alone resumed its original queue. The first immediate post-launch PID lookup found no process yet and stopped before kill; that setup race is not a failed recovery test.

No system notification/accessibility/media/calendar grants, physical-device or live-provider acceptance is inferred. This is still a checkpoint: manual native Memory start remains obsolete and now has a dedicated pending RED; M13 raw-archive projection and M16 personal import freezes are awaited. Final own required affected/remote head/Draft PR remain open.

### Manual Memory admission and complete selected-document HTTP responses

New native manual extraction regression a409/79b: the original “开始提取” action still posted legacy `/api/memory-jobs`. The first new test launch used the stale test APK and returned `OK (0 tests)`; the strict runner rejected it, and it is not valid RED. A missing `mote.testBuildType=multiuserFixture` property initially failed Gradle task discovery; then the combined JVM RED stopped testAPK packaging. Preserved setup logs are `/tmp/m15-manual-http-red-build.log` and `...red-build2.log`. With the property and `--continue`, testAPK packaging genuinely completed while expected JVM failures remained failures (`/tmp/m15-manual-http-valid-red-build.log/.exit`, EXIT1).

Unchanged old runtime with the real newly packaged case reaches its intended assertion: `/tmp/m15-memory-manual-valid-red2.log/.exit`,1/1 EXIT1, missing canonical Material selection. Minimal295c preserves native Memory→extract→task navigation, replaces global start with explicit paged canonical Material/revision selection, existing recipe/model inventory and fixed M07 preflight. The original account-local encrypted CentralStateFile stores a UUID plus exact pinned request before admission. Same request retry keeps ID/body; a different unconfirmed request cannot replace it silently. Clearing only the local pending intent is an explicit confirmed action and does not claim to cancel already admitted server work.

The actual existing M07 fixture now has only an external HTTP fault boundary: requests still enter the real Fastify/Accounts/SQLite/executor; one real successful admission response becomes503, and generated request bodies are recorded only for their original credential. No fake admission/provider/receipt is added. The same original native test passes1/1 EXIT0,1.293s `/tmp/m15-memory-manual-first-green.log/.exit`: select exact Material/revision→real admission→lost ACK→Activity recreation→same UUID/body retry→persisted real task. B job list and A configuration are unchanged; B cannot read A job. This is not full final affected or raw/archive/import acceptance.

M16's independent e6 review `/tmp/mote-m16-review-m15-e6.md` identified a further generic download candidate:206 or200 with declared bytes missing at EOF could publish an incomplete response. Durable tests926/8fb actually reproduce both: selected existing sentinel becomes generated response body, not merely a missing exception. Minimal8e464 requires whole GET status200 and, when declared, exact nonnegative Content-Length before the existing stage can reach its output factory. Generic metadata has no invented SHA contract; portable3 keeps its strict original receipt/header/length/SHA checks. Unchanged three JVM cases now3/3 EXIT0, and fixture app/testAPK build EXIT0 in14s `/tmp/m15-manual-http-green-build.log/.exit`. Independent delta review and final combined gates remain pending.

Composed exact M16 public personal import89dd asf485; no merge conflicts and no M12 consumption. Its native picker/receipt consumer remains pending; the existing arbitrary-file import/review path is separately OPEN and is not declared equivalent to portable archive merge.

### Personal portable import native consumer c81

M16 original-instance/original-account import policy is consumed through its frozen89dd public routes, with later startup-notification fix1fd composed asb188 (its durable REDdd284 is6f272 locally). First import testAPK build failed in test-only callback spelling (`/tmp/m15-portable-import-red-test-build.log/.exit`); an attempted oldAPK run had0tests and was rejected. The initial status message incorrectly said testAPK0; immediately corrected to all peers. Only corrected testAPK build2 EXIT0 and `/tmp/m15-portable-import-valid-red2.log/.exit`1/1 EXIT1 are valid RED evidence: no native personal import action.

Minimal nativec81 keeps arbitrary-file import distinct. Adds an explicit personal archive action in the original Import page, the same document picker with frozen origin/owner/generation (request74), and reuses CentralImports' encrypted bounded parts in a separate account-owned portable directory. Admission retains the original request UUID and JSON across uncertain response/restart; terminal completed ACK alone clears its local stage. Current receipt/list/cancel preserve M16 kind/import, owner/deployment, semantic progress, coverage partitions and per-domain state. Imports expose no download artifact. Failed historical work can select the same archive with its original UUID; cancellation cannot pretend to roll back a completed canonical merge.

Fresh c81 narrow build `/tmp/m15-portable-import-green-build.log/.exit`: import identity/receipt2cases + whole download3cases all5/5 EXIT0, fixture app/testAPK EXIT0 in13s. The raw malformed-identity cases verify no private archive POST; receipt variations reject wrong owner/operation/kind/overlapping coverage/authority/artifact/incomplete domains. Actual same native RED case now1/1 EXIT0,1.216s `/tmp/m15-portable-import-first-green.log/.exit`: genuine M16 export and strict verified file→generated DocumentsProvider→native picker→same-account import completed; default configuration and original note unchanged, completed cancel409, B late picker ignored and foreign receipt404. No real documents or new system permission accessed.

Independent read-only reviews: M13 manual8c92..295c `/tmp/mote-m13-review-m15-memory-295c.md`, M14 manual295c/whole-response8e464 `/tmp/mote-m14-review-m15-295-8e.md`, M16 c81 import `/tmp/mote-m16-review-m15-c81.md`, M16 whole-response8e464 appended `/tmp/mote-m16-review-m15-e6.md`; no new confirmed P0/P1/P2 in those exact bounded scopes. They did not rerun native/JVM tests or cover whole M15.

No own final required check, push or Draft PR yet. Generic arbitrary-file import/preview, remaining M13 shared raw/file/config/connector mappings and M12 pending authorization are not hidden by this portable-import increment. Positive OS permission grant/revoke and physical-device/live-provider checks remain explicitly unrun as above.


### Raw archive / device perception at exact2ff3122881696b478c40d453bc7ce27cb4e9d4fa

Consumed M13 server0172 and tiny729, plus M16 backup63 and its durable REDb24. M15 independently reproduced identical-image recreation during thumbnail decoding: unchanged reference/hash/bytes with a new original receipt incorrectly returned200, `/tmp/m15-raw-identical-incarnation-red.log/.exit` EXIT1. The identical test after729 passes1/1 EXIT0 `/tmp/m15-raw-identical-incarnation-green.log/.exit`. Bounded host-only originalReadReceipt review is recorded in `/tmp/mote-m15-review-m13-raw-0172.md`; backup schema/counter bounded review in `/tmp/mote-m15-review-m16-backup-63.md` is static only.

The existing PerceptionSync consumer used a private capture-browser endpoint, which correctly returned403 for a real device-bound credential. Generated M03 PNG→real M06 OCR→actual device invitation→future cursor→native cache test is valid RED1/1 EXIT1 `/tmp/m15-raw-device-valid-red.log/.exit`. Minimal2ff uses the narrow existing ingress devices/:id/updates reader, preserves the server error code and repairs only409 invalid_cursor after re-verifying the current identity. Cache and cursor commits share the existing selected-account/token guard. Same native case GREEN1/1 EXIT0 in0.599s `/tmp/m15-raw-device-first-green.log/.exit`; old A handle under B is rejected, A cache survives return. This does not invent local OCR completion writes or device private API access.

The exact testAPK build was initially denied by automatic review before execution because the resource window appeared occupied by M14. Fresh trusted M14/M16 evidence established that the proposed M14 command had never started, was cancelled, had no log and was released. The identical known-unexecuted command was submitted once for normal review and approved,9s EXIT0. Separate GREEN app/testAPK build10s EXIT0. Exact status: resolved; no bypass or delegated execution. `/tmp/m15-raw-device-window-review.md` preserves this history.

Decision record: problem=device credential needs its own derived OCR updates; decision=consume M13 narrow ingress projection and preserve existing local cache; reason=M01 restricts device authority; impact=no broadened read permissions and cursor reset only after exact fresh identity; validation=real backend/native RED→GREEN above. Shared raw pending/failed progress and historical-source navigation remain OPEN; generic arbitrary-file import/review remains distinct. No own final required affected, final full Android, push or Draft PR yet.


### Decision provenance and current authorization

The M15 account/storage/transport decisions implement [ADR multiuser scope — Clients, storage/recovery and supersession](../adr-multiuser-scope.md), [module plan M15 and client recovery matrix](../design/multiuser-modules.md), and [public contracts KEEP/CHANGE/REMOVE](../design/multiuser-public-contracts.md). Existing queue/source discovery/retry and content reading behavior remains governed by [action-first clients — source lifecycle/content/privacy](../adr-client-action-first.md), with current navigation superseded by [presentation packs](../adr-ui-presentation-packs.md). Manual Memory selection follows [selected outputs ADR](../adr-manual-memory-selected-outputs.md); native reuse of M04/M07 avoids a second configuration/admission engine. Cursor/page/part bounds are transport invariants, not new user quotas, per [Central request admission](../adr-central-request-admission.md).

Current user-input/approval status: none pending for M15. The resolved testAPK resource-window denial above is retained as evidence. M12 is a separate still-pending handoff authorization and is neither consumed nor forwarded. No system permission expansion, real-account access, merge, deployment or disabled CI activation is requested. Major tradeoffs conflicting with those ADRs go to the parent with recommendation/impact/reversibility; ordinary engineering fixes inside the accepted account-isolation scope proceed with durable actual regressions.


### Native visible archive retirement

Durable ac16 regression uses the actual original CaptureRecordsActivity: upload A note via existing Worker/M03, render central rows, pause the Activity, sign in B and resume. Before any touch/refresh it still showed A's private text: `/tmp/m15-archive-resume-valid-red.log/.exit`,1/1 EXIT1,0.901s. TestAPK genuinely built8s EXIT0; no missing-test or fixture failure is counted as RED.

The minimal fix gives rendered state a stable owner. Resume and the existing LocalState observer synchronously retire rows, open reader, bitmap cache, album/cursors and pending callbacks before loading B. Saved reader/album state carries its owner; mismatched restoration does not reopen A's reader. Existing local queue handles are captured for delayed thumbnail/read/cache work, preserving their account guard. Detached row/album actions and async publication check original generation/current owner. A's disk records and queues are retained. The original touch guard adopts the new displayed owner only after this retirement. Fresh fixture app/testAPK EXIT0,21s `/tmp/m15-archive-resume-green-build.log/.exit`; identical original native test1/1 EXIT0,0.911s `/tmp/m15-archive-resume-first-green.log/.exit`.

Decision ledger: problem=already-rendered A content survives return under B; decision=retire private view state before resume and reject old publication, retaining original disk content; reason=[multiuser ADR Clients/privacy](../adr-multiuser-scope.md) and [M15 acceptance](../design/multiuser-modules.md) already require one current account/private archive; impact=old reader/album closes on owner change while same-owner navigation/storage remains; validation=actual original UI RED→GREEN above. No new product navigation, runtime, permission, data deletion or quota policy. Broader reader/rotation/recreation regressions and independent bounded review remain to be completed before whole-module acceptance.

M13 and M16 independently reviewed exact2ff Kotlin reader delta, `/tmp/mote-m13-review-m15-2ff.md` and `/tmp/mote-m16-review-m15-2ff.md`, no new confirmed P0/P1/P2 in that bounded static scope. They did not run native/JVM or review this later visible-archive fix. M14 is now saved/ended at the parent's instruction; no further messages wake it.


### Next fixed-candidate boundaries (tests pending execution)

Current composed Desktop stable is exact79ea50df (runtime ceae named-source reader), Web portable consumer23b/ee4/e674/5df. Merge conflicts were documentation-only append unions; no peer workspace was changed. This composition is not yet an M15 required gate pass.

After M16 started its fixed589d candidate gate, M13 bounded10a review `/tmp/mote-m13-review-m15-10a.md` identified a queued request candidate: executor-time Settings/client resolution could acquire B before resume retires the A page. Separate durable testb97 holds the real executor before resolution and observes generated backend per-actor private HTTP reads. Another b97 JVM regression requires refusal of a self-consistent but incomplete five-domain import receipt. These are UNCOMPILED/UNRUN candidates, not claimed actual failures or covered by M16's fixed gate. No build is started while M16 owns the heavy window.

The parent has now explicitly resumed M12 instead of paused M14; M12 reports the original cross-thread handoff succeeded under new evidence. M15 consumes only its current stable public contract35d661b, never re-executes the former denied action. The older statement that M12 authorization is pending is historical and superseded for current work. Android CalendarActions/Worker/UI remain KEEP capabilities under the multiuser ADR and action-first privacy/lifecycle rules; Long paging/current-at-operation credential resolution and ignored fact/publication receipt need their own actual M12/native acceptance. A no-calendar-permission native retained-client regression is prepared; no real calendar access is requested. M15 bounded static M12 delivery review `/tmp/mote-m15-review-m12-delivery-35.md` found no new confirmed issue in claim/issuance/ledger/receipt publication fences and does not cover the old native transport factory or whole M12.


### Delayed private reads, complete import closure and native raw OCR

Separate actual REDs on the preserved10a fixture APK `/tmp/m15-pre-queued-app.apk` (SHA file `/tmp/m15-pre-queued-app.sha256`):

- b97 queued archive admission: real executor blocked before config/client resolution, Activity paused, B signs in, release executor, actual generated host records **one B private GET**. `/tmp/m15-queued-archive-valid-red.log/.exit`,1/1 EXIT1,45.875s at intended assertion, not a deadline exception.
- b067 retained CalendarActions client: actual M12 A list succeeds, B sign-in, retained A client incorrectly reads under B. `/tmp/m15-actions-owner-valid-red.log/.exit`,1/1 EXIT1,0.146s; no calendar permission requested or local calendar touched.
- fc641 original native central raw reader: actual M03 PNG→real M06 completed OCR and list→open original; reader fetched immutable empty intake instead of available derived OCR. `/tmp/m15-raw-reader-valid-red.log/.exit`,1/1 EXIT1,1.091s.
- b97/d54/462 import receipt: delete four core domains and matching rows while leaving self-consistent declared coverage; client accepted it. Four JVM cases3pass/1fail, `/tmp/m15-delayed-import-valid-red-build.log/.exit` EXIT1,14s. `--continue` genuinely packaged the testAPK despite the expected failure. The positive fixture now contains the real five-domain core, and a separate explicit todos extension remains accepted; no fixed domain count is introduced.

Minimal four-file runtime correction: CaptureRecords load/detail admission checks original owner/generation under existing ConnectionGuard before resolving immutable client/queue handles; no replacement-account I/O from an old paused operation. CalendarActions retains its construction-time stable owner and its device request path reuses the existing fresh-self transport. CentralLibrary raw original detail reads M13 capture-browser projection; deletion still targets canonical M02 captures, no intake rewrite or context/raw fallback. CentralPortable requires the existing canonical five-domain subset in addition to complete declared closure, accepting explicit additional domains.

Fresh narrow import4/4 plus fixture app/testAPK EXIT0,12s `/tmp/m15-delayed-import-green-build.log/.exit`. Identical original native cases pass independently1/1 EXIT0: `/tmp/m15-queued-archive-first-green`45.813s, `/tmp/m15-actions-owner-first-green`0.137s, `/tmp/m15-raw-reader-first-green`1.096s (each `.log/.exit`). These are not full Android/required affected or physical-calendar acceptance. M12 opaque pagination, visible/modal retirement and native delivery/recovery still require original consumer journeys.

Decision ledger: these fixes implement stable private-account scope from [multiuser ADR Clients/Privacy](../adr-multiuser-scope.md) and [M15](../design/multiuser-modules.md); immutable intake vs actual processing output follows [action-first content/progress](../adr-client-action-first.md). Existing service/queue/worker/transport is reused; no new runtime, data migration, permission, hidden approval or arbitrary quota. Impact is refusal of stale private work/incomplete ACK and correct derived reading; original disk data remains. Independent exact-delta review and final current-composition gates remain pending.

Current M12 contract35d was composed only after parent explicitly restored that task and confirmed the former handoff succeeded. App registration/close keeps actions/todos together with existing lifecycle/Activity/static assets. Scope inventory retains newer M16 metadata classifications and adds only M12 declared surfaces; scope check EXIT0. Known later M12 lifecycle fixes5172/4a await composition; current35 is not claimed deletion/import acceptance. M16 fixed589 required run was separate: its fifth run EXIT1 at root CLI duplicate-self expectation, so Android was not run there. Own required dry-run only (`/tmp/m15-current-required-plan.log`) selects check:local plus Android JVM; no own actual final required pass is claimed.

### Current M12 composition and Actions native setup

M12 parent-authorized lifecycle freeze4a0e82db/runtime5172 is now composed; its former pending handoff statements above are historical. Its Actions/Todo backup173 contract is consumed through M16 durable RED2aff and fix9fa (local fba64/41d56). CLI duplicate-self RED8fd/fix7fb is also composed; the shared per-request identity guard remains. M13 and M16 bounded exact881 runtime reviews report no new confirmed finding (`/tmp/mote-m13-review-m15-8812.md`, `/tmp/mote-m16-review-m15-881.md`), static only. Own bounded M12 delivery35 and M16 backup9fa reviews do not substitute for their runtime tests.

Durable75b native Actions tests use the existing CalendarActionsActivity and actual M12 model producer, without calendar permissions or calendar I/O. Their first backend setup attempt did not reach the Activity: the genuine single executor completed16 of21 independent jobs within90s, with4 pending and1 running. `/tmp/m15-actions-backend-first-setup-timeout.log` is retained as fixture setup failure, not product RED. This fixture-only budget changes to180s based on observed ~5.5s/job; no production deadline, discovery cadence or processing algorithm changes. Actual paging/modal/retirement results will be recorded after the generated producer finishes.

Decision ledger: problem=old Android Actions consumes numeric cursors and retains account-local view state; intended CHANGE=consume M12 opaque cursors and retire the original private page/modal/work when its owner changes. KEEP=existing page/navigation, explicit existing-calendar permission flow, attempting journal, marker reconciliation and one-shot native mutation. Reason=[M12 public delivery/pagination contract](../design/multiuser-actions.md), [multiuser ADR Clients/privacy](../adr-multiuser-scope.md), and [existing calendar lifecycle](../calendar-actions.md). No new execution engine, permission, runtime, semantic heuristic or native calendar write is introduced by the two view tests. UI changes and delivery/receipt acceptance are still pending; no whole-module completion or final own required pass is claimed.

The revised real producer completed21 A proposals and1 B proposal. Both original UI cases now have valid pre-fix failures on preserved881 fixture APK: `/tmp/m15-actions-paging-valid-red.log/.exit`1/1 EXIT1,0.762s (earlier page still20 instead of1), and `/tmp/m15-actions-resume-valid-red.log/.exit`1/1 EXIT1,0.887s (B resumes A's already-rendered proposals before any touch). No calendar permission is requested. M16's fixed6f5 combined gate is independent and does not cover this new UI fix.

The minimal UI delta keeps a construction-time CalendarActions client, binds page work/results/buttons to that page owner, checks queued work under the existing ConnectionGuard, and retires the original list/status/poll/dialogs before recreating under another owner. Evidence/edit/date/time dialogs and detached callbacks share that retirement. The existing UI/navigation and calendar execution remain; opaque cursor strings are encoded and returned unchanged. This delta is intentionally UNCOMPILED/UNRUN until M16 releases the heavy window, then the identical native cases must pass. No runtime fix is claimed delivered from static review alone.

Fresh9e runtime +242 control-test build `/tmp/m15-actions-ui-green-build.log/.exit` genuinely EXIT0,12s. Identical paging and visible-resume native cases now1/1 EXIT0 each: `/tmp/m15-actions-paging-first-green`0.926s and `/tmp/m15-actions-resume-first-green`0.982s. Additional existing evidence dialog/same-owner Activity recreation/switch control passes1/1 EXIT0,1.492s `/tmp/m15-actions-modal-first-green` (all `.log/.exit`). M13 independently bounded exact9e two-file delta, `/tmp/mote-m13-review-m15-9e824.md`, no new confirmed finding; no independent test rerun or whole native delivery claim.

The separate generated calendar I/O test uses ContentResolver.wrap of an unregistered ContentProvider, never the system resolver, and asserts the isolated app lacks both calendar permissions. Its first attempt reached one native insert followed by an uncertain receipt, then failed because the test queried an unregistered GET /actions/:id (503). `/tmp/m15-actions-native-io-first.log/.exit` is retained as fixture/API mismatch, not product RED or full acceptance. The test now reads the formal Actions list and checks account isolation there; pending compilation and rerun after the currently held M16 window. Adapter reconstruction from files is explicitly different from real OS SIGKILL.

### Desktop restart recovery,16:04UTC

The actual executable environment returned after the parent reported the desktop restart. Workspace was clean exact2f892217; prior M15 backend PIDs70108/62614 no longer existed, the old PTY returned executor-key-changed/transport-disconnected, and emulator5562 was absent. No healthy process was killed and no completed test was rerun. Existing build/native success and fixture failure logs remain intact. The adb read started its normal daemon but did not boot an emulator or grant permissions. M16 owns resumed107 required; M15 remains released and will restore only the confirmed-stopped fixtures/emulator in its next coordinated window.

Current test-only follow-ups64b/ffe/2f892/4b323/f129 are UNCOMPILED/UNRUN: formal overview statistics/devices, private Notes resume before a blocked account resolver, Actions settings revision envelope, and old CalendarActionWorker permission-check/account-admission race. These are candidates, not confirmed new failures. Calendar control509 corrects only its unregistered single-item reader, preserving the already-observed actual uncertain stage. Independent native journeys get two distinct generated B proposals; the earlier three successful UI cases used the original21A/1B producer and are not relabeled as reruns on the later fixture.

The explicitly frozen M12/M16 literal10748005 was merged as04b929d6. Conflict resolution retained the M15-only native tests/ledger and incoming M16 evidence append; no Android source/test byte changed relative to95475. `dcad6088` is an ancestor, and all Android main source is byte-identical to tested9e. New test-only candidates still need a testAPK; the future synthetic backend must start from the new combined server source. No old server process or native acceptance is relabeled as running107.

### Native Central lifecycle, overview and calendar permission admission

Current M12/M16 dependencies are literal10748005. The first new Actions fixture still attempted21 independent publications and timed out during setup; `/tmp/m15-actions-107-sequential-setup-timeout.log` preserves it. A subsequent fixture incorrectly returned21 proposals in one extraction, exceeding the existing M12 maximum8: `/tmp/m15-actions-batched-backend.log`. Neither reached native assertions or is a product RED. Fixtureffaaf7c9 now publishes three genuine originals of8/8/5 exact appointment quotes for A and one of2 for B; actual M03/M08/M12 produces all23, without proposal SQL, changed production limits or third-party I/O.

Four valid original native failures on preserved9e APK, each1/1 EXIT1:

- `/tmp/m15-native-notes-resume-valid-red.log/.exit`,0.818s: real executor barrier before account resolution, paused A draft remains visible immediately after B resumes.
- `/tmp/m15-native-overview-valid-red.log/.exit`,0.483s: original native overview still reads legacy global status/devices/operations instead of available owner statistics/canonical device metadata.
- `/tmp/m15-old-calendar-worker-valid-red.log/.exit`,0.289s: permission-check barrier after old A Worker admission, switch to explicitly enabled B, old worker actually inserts B's approved generated event once instead of zero.
- `/tmp/m15-native-actions-settings-valid-red.log/.exit`,0.733s: original form strips M12 revision/authorizationRevision envelope; save leaves the real setting unchanged.

Minimal220c runtime reuses existing components: CentralContent synchronously retires old private view state before queued resolution on resume; overview consumes M13 statistics/devices and actual owned model inventory, with existing Activity entry for task detail; Actions form retains original API and both M12 revisions; CalendarActionWorker captures its original config/client together under ConnectionGuard and retains that client across native permission checks. No durable content is deleted, no new runtime/permission/semantic dispatch is introduced. Storage/service/global status counters lacking an owner contract are not replaced with zeros.

Build first invocation omitted existing `-Pmote.testBuildType=multiuserFixture`, failed before compilation with task-not-found3s EXIT1 `/tmp/m15-four-native-green-build.log/.exit`. Corrected existing configuration genuinely app/testAPK builds13s EXIT0 `/tmp/m15-four-native-green-build-corrected.log/.exit`. This is not yet native GREEN or whole-module acceptance.

The separate calendar reconciliation control reached actual uncertain and B success but then cast the existing Unit-returning `execute()` API to JSONObject. `/tmp/m15-calendar-reconciliation-control.log/.exit` is a fixture type mismatch, not a new product failure. Test16f4 now checks the real M12 published action state instead. All native I/O uses ContentResolver.wrap of an unregistered generated Provider, with actual app system-calendar permissions denied. It is not physical-calendar or process-death evidence.

Decision record: these changes implement [multiuser scope Clients/privacy](../adr-multiuser-scope.md), [original action-first collection/lifecycle](../adr-client-action-first.md) and [M12 scoped review/delivery](../design/multiuser-actions.md). The existing visible page, model selector, account drafts, explicit approved delivery, uncertain journal and marker recovery remain KEEP. Only protocol consumption and original-owner admission change. Shared generic Imports/Files/media/review/export remains KEEP and is now assigned to the joint validation thread for one shared backend seam; Android will consume that exact freeze rather than introducing a second ImportManager/projection.

Identical four native GREENs on220c each1/1 EXIT0: `/tmp/m15-native-notes-resume-first-green`0.950s, `/tmp/m15-native-overview-first-green`0.575s, `/tmp/m15-old-calendar-worker-first-green`0.322s, `/tmp/m15-native-actions-settings-first-green`0.889s (each `.log/.exit`). Old A worker writes zero; explicit B worker with its own current intent succeeds once. Notes return to A retains the original draft. Corrected calendar control1/1 EXIT0,0.596s `/tmp/m15-calendar-reconciliation-corrected-control.log/.exit`: actual M12 uncertain publication, denied synthetic permission makes no native call, retained A handle rejects under B, B's separate approved write succeeds, reconstructed A client/provider reconciles the original operation marker and externalId101 without duplicate insertion. No physical calendar or OS process-death claim.

Current220c complete Android JVM and production debug APK: `JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home ANDROID_HOME=/Users/utopiafar/Library/Android/sdk apps/android/gradlew -p apps/android --no-daemon --offline :app:testDebugUnitTest :app:assembleDebug`, EXIT0,41s44tasks10executed, `/tmp/m15-220c-full-android.log/.exit`. Fresh XML totals74suites352tests0failures/errors/skips. This is an actual own run, independent from M16's107 gate; final own affected and remaining scoped consumers still pending. Later394/a253 MCP additions are test-only UNCOMPILED/UNRUN and do not change this production result.

### Current native MCP and recent-work delta (waiting for a build window)

M13 independent bounded220c review `/tmp/mote-m13-review-m15-220c.md` found a P2 old-capability regression: M05 already exposes the owner-scoped recent operation list, so replacing five cards with only an Activity link was unnecessary. Actual generated M12 producer yields five M05 operations. Durable d60 original Activity characterization fails5!=0,1/1 EXIT1,0.545s `/tmp/m15-overview-recent-preview-valid-red.log/.exit`; minimaldf917 restores the exact recent list/admin.items/detail entry and retains Activity navigation. GREEN and bounded closure remain pending.

Original native MCP page also has valid RED1/1 EXIT1,0.599s `/tmp/m15-native-mcp-valid-red.log/.exit`: real M01/M04 saved same-connection exists, but the original page has no owned connection selection and still sends raw endpoint/token for discovery. Synthetic fixture394/a253 uses the actual MCP SDK, M01/M03/M04/M11 and same A/B IDs; no third-party MCP/model is used. Minimal2cd/e6/374 consumer keeps the original resource selection/read-only tool approval, explicitly prepares a saved M04 connection and M03 source/device, then sends only connectionId/sourceId and selected resources/tool input. Original API, page owner and local rendered-selection versions fence retired controls. Preparation preserves masked existing tokens with M04 CAS; new saved configuration never inherits a different account's identity. The added native preparation/retired-save control is UNCOMPILED/UNRUN. M14 owns its fixed454 required window; M15 starts no Gradle/build/fullsuite until explicit RELEASE. Lightweight i18n and scope checks both EXIT0; these are not runtime GREEN.

Decision provenance is [M11 public MCP](../design/multiuser-mcp.md) and [M04 configuration](../design/multiuser-configuration.md), using the existing native form/navigation rather than a Web fallback or a second outbound engine. Endpoint credentials are saved only on explicit Save and apply, mirroring the shared Web consumer. Discovery/import never carries them. Generic Google/Gmail/Lark/recording connection consumers are separate remaining work; this MCP delta does not claim them complete.

Additional shared pairing boundary: scoped M01 does not register the old `/api/connections/invitations` or `/redeem` routes used by the original QR/JSON invitation reader. Its supported native flow is PKCE `/login/requests`→fixed-device browser approval→`/poll`→`/ack`; device grants remain ingress/self/logout only. Existing direct username login and actual device-bound Ingress tests do not prove an equivalent QR generation/scanning journey. M13 independently confirmed no frozen canonical QR replacement. This remains an explicit KEEP/CHANGE gap for joint/parent ADR alignment; no legacy owner alias or expanded device private permission is introduced by Android.

The same recent-work characterization is now GREEN1/1 EXIT0,0.610s `/tmp/m15-overview-recent-preview-first-green.log/.exit`, including real M05 detail navigation; no empty-list fixture substituted. Original MCP SDK consumer is GREEN1/1 EXIT0,1.386s `/tmp/m15-native-mcp-first-green.log/.exit`: actual A resource import, exact duplicate receipt0new/1existing, unchecked tool approval makes no import, explicit read-only tool admission publishes its own second item, immediate B retirement and detached A import leave B empty. Additional explicit M04 preparation control1/1 EXIT0,1.063s `/tmp/m15-native-mcp-preparation-control.log/.exit`: source/device+connection save, existing masked token retained and real SDK rediscovery still authorized, B same-ID configuration untouched by old A Save. Fixture app/testAPK14s EXIT0 `/tmp/m15-mcp-overview-green-build.log/.exit`. Runtime freeze7eca52d9783f875aa38860ae1ca0a78c467cbd52 (including2cd/e6 anddf917); later9aae is only additional UNRUN consumer tests/Google I/O fixture. Bounded closure review and final affected remain pending.

### 107f native owned settings/readers checkpoint

Runtime `107f0038fc67d5236db99a09616fbd4e3b5ca411` changes only the existing
CentralAdmin consumers of processing settings, devices and statistics, plus eight
synchronized labels. The original processing form now reads/writes the M04
`processing` domain with its captured revision; the native device list consumes
M03 canonical ingress metadata and statistics consume M02 own counts. No processor,
speaker algorithm or configuration default was replaced.

The three original native journeys that failed against the saved 220c APK now pass
individually on 107f: processing settings 1/1 (0.785s), same-ID device inventory 1/1
(0.545s), own statistics 1/1 (0.538s). Logs are
`/tmp/m15-native-{processing-settings,device-inventory,statistics}-first-green.log`
with separate `.exit` files, all 0. Fixture app and test APK compiled in 10s, EXIT0
(`/tmp/m15-processing-device-statistics-green-build.log`). An initial sandbox adb
listener EPERM occurred before tests; the existing emulator and backend were found
healthy and the same commands passed standard review. It is an environment failure,
not a product RED. This checkpoint does not supersede the full 352-test evidence on
220c or claim whole-module acceptance.

M13 bounded review of exact 7eca found no new confirmed P0/P1/P2 and statically
closed the prior Overview recent-five P2; the actual characterization RED/GREEN
remains M15 evidence. Report: `/tmp/mote-m13-review-m15-mcp-7eca.md`.


### Native owned connections and original recording checkpoint (652475c9)

The original Google/Gmail connection configuration characterization9aae failed
against220c: empty A had no new-connection control while B retained a same-ID
connection. Runtime3a2bd36b restores native saved-connection create/edit, M04 full
domain CAS and masked-secret preservation, explicit M09 enable/pause/stop, and
fixed-connection status/OAuth. Its same ActivityScenario passes1/1,1.548s, EXIT0:
`/tmp/m15-native-connectors-first-green.log/.exit`. Saving creates a disabled
instance; A edit, enable and pause do not change B; detached A Save after switch
cannot alter B. This is configuration/lifecycle acceptance, not sync/calendar,
Lark/recording or complete provider parity.

Joint frozen Filesa10effd109e64651e5cafe801b686238271964bf was merged as12cd554f,
including M14 finalcd46. Only two bilingual catalog conflicts needed a same-value
union (zero differing values); scope and i18n passed. No peer directory was edited.
The production M03/M04/M05/M06 fixture processes actual generated WAV bytes with
only the ASR I/O substituted. Durableab561/8bf original native tests exercise the
existing Files page, not a new mock view.

The original recording view failed1/1,0.755s because SPEAKER_0 was absent
(`/tmp/m15-native-files-speaker-valid-red.log/.exit`). Runtime958d/027a restores
anonymous label, timing/uncertainty, exact owner speaker confirmation and existing
artifact/chunk/text correction. Complete speaker pages are read for explicit name
confirmation so later-page names are not silently dropped. The identical native
journey passes1/1,1.317s EXIT0 (`/tmp/m15-native-files-speaker-first-green.log/.exit`):
confirmation retains raw transcript; correction creates a new artifact while the
old raw artifact stays readable; names survive correction; detached A Save does
not change equal-ID B.

Original-save characterization initially checked a picker monitor before the
ActivityResult download completed. Those first byte mismatches are retained as
inconclusive fixture timing, not accepted RED/GREEN evidence. Testee4 waits for
actual native download terminal status;302 records that status. The corrected
case exposed actual HTTP426 on652's parent: binary CentralClient requests omitted
Ingress3 while JSON requests already included it
(`/tmp/m15-native-files-original-diagnostic.log/.exit`,1/1 EXIT1,0.797s).
Direct actual fixture ticket read returned200/audio-wav/48bytes/matching SHA.
652475c9 adds the existing Ingress3 header only to binary ingress paths. The same
native document-result case now passes1/1,0.940s EXIT0
(`/tmp/m15-native-files-original-ingress-first-green.log/.exit`). It writes exactly
the generated48-byte WAV after owner-bound ticket, length/MIME/SHA validation and
staging. M03 original readers do not supply portable ETags, so only this explicit
original descriptor branch omits ETag; portable exports still require it.

Fixture app/testAPK plus actual CentralPortableDownloadTest completed15s EXIT0
(`/tmp/m15-native-files-ingress-green-build.log/.exit`), XML4tests/0fail/0error/0skip.
This includes the real socket Ingress3-header/no-ETag original positive and
wrong-hash sentinel case, and the existing portable integrity/whole-response cases.
Earlier fixture builds12s,13s,9s and10s and their failures are retained separately.
An emulator disappeared before the first Files execution; exact ps/adb confirmed
it absent, the same read-only/headless AVD restarted in10.7s, and the healthy Files
backend was not restarted. That event is an environment interruption, not product
RED or permission-revocation evidence.

Decisions implement the original recording and speaker-range ADRs through the
frozen Joint M06 seam; no FileStore, processor, model, scheduler, permission or
account store was added. Existing encrypted queues, scoped API and staging are
reused. Shared cancel/retry/delete/review/acoustic and generic Imports are not
silently replaced by raw intake or a successful export. Full current gates and
whole-module closure remain pending.

### Additional exact-text regression, GREEN pending resource window

While Container owns the required-check window, a single existing compiled native
journey was repeated against a new generated ASR fixture that literally begins
its transcript with `[SPEAKER_0] `. This is evidence text, not a presentation prefix.
The native correction still removed it and actual M06 refused the mismatched
originalText. Durable fixture7c4c87bb and
`/tmp/m15-native-files-literal-prefix-valid-red.log/.exit` record1/1 EXIT1,0.987s.
The minimal one-line fix retains exact `ocrText` when constructing correction
input. No inference, text rewriting or backend change is added. Its current code
is intentionally not a tested freeze until Container explicitly releases and the
same native case becomes GREEN. The prior652 narrow positive checkpoint does
not cover this newly confirmed input variation.

The literal-prefix native correction case is now GREEN1/1,1.567s EXIT0
(`/tmp/m15-native-files-literal-prefix-first-green.log/.exit`) on the unchanged
exact text assertion. Fixture app/testAPK compiled8s EXIT0
(`/tmp/m15-native-files-literal-green-build.log/.exit`) after the Container and
Joint windows explicitly released. This closes that input variation; it does not
close the separate Joint export publication-point candidate.

Original Google Calendar native controls have a valid RED on current real OAuth
preconditions: missing `读取日历列表`,1/1 EXIT1,0.883s
(`/tmp/m15-native-google-calendar-valid-red.log/.exit`). Runtime
bde55de1bae491fea966b0693c210d732ba5befa consumes owned M10 operations and M05 task
IDs, persists pending path/body/operation ID in the existing account-encrypted
CentralStateFile, and stops task polling on terminal state/page retirement.
The same original native case is GREEN1/1,2.696s EXIT0
(`/tmp/m15-native-google-calendar-first-green.log/.exit`): generated actual OAuth,
calendar list, explicit same-calendar selection, actual sync/M03 private event,
A/B same connection/calendar/event IDs and detached A Sync after B switch. Fixture
app/testAPK compiled9s EXIT0 (`/tmp/m15-native-google-calendar-green-build.log/.exit`),
i18n/scope0. No live Google, calendar access or browser was used. The subsequent
8f617 test-only lost-ACK/recreation/switch scenario and retained-route validation
need their own execution; this normal positive does not prove those cases.


### Current native checkpoint:353 JVM tests and retained M10 admission

Current production main48a797854e96eedf57c4edbd451fa2e5c5132a73 (
normal Google flow is bde55de1bae491fea966b0693c210d732ba5befa) was actually rebuilt
and tested with `:app:testDebugUnitTest :app:assembleDebug
:app:assembleMultiuserFixtureAndroidTest`. Log
`/tmp/m15-native-composed-48a-full-android.log/.exit`:41s EXIT0,92tasks with14
executed. Fresh XML74suites/353tests/0failures/0errors/0skips. This is M15's own
new run, not peer352 evidence, and it is not the final required affected command.

The first Gmail lost-ACK native case traversed durable pending intent, Activity
recreation, B isolation and A exact retry, then its last assertion incorrectly
used the retired original A client after switching back. It is retained EXIT1 in
`/tmp/m15-native-gmail-lostack-first.log/.exit`; no production fence was relaxed.
Test-only00200153 uses the fresh selected A client and explicitly asserts the
original client rejects. Same original scenario on a new generated real M10 host
passes1/1,2.079s EXIT0 (`/tmp/m15-native-gmail-lostack-corrected.log/.exit`): dropped
actual200 command responses, stable operationId/body/taskId, original account's
encrypted intent after recreation, no pending A command or mutation in same-ID B,
and original A retry without a second admission or duplicate SourceItem. This is
Activity recreation, not a new claim of SIGKILL coverage for this command journal.

M13 authored bounded readonly reports are available locally for exact107f,3a2,
652 andbde, each with no new confirmed P0/P1/P2 in its recorded scope:
`/tmp/mote-m13-review-m15-admin-107f.md`,
`/tmp/mote-m13-review-m15-connectors-3a2.md`,
`/tmp/mote-m13-review-m15-files-652.md`,
`/tmp/mote-m13-review-m15-google-bde.md`. They are static evidence only and do not
claim independent execution, later48 guard/lost-ACK coverage or whole acceptance.
Their message delivery was not retried or forwarded; local reports were read as
artifacts. M13 is now paused and is not being woken for additional review.

### Live-model and private-data regression constraint

The owner's later Sentinel_90402956f4b881918763a8a61d350969 instruction applies to
real-model regression: use the existing logged-in local Codex entry and verify
exact `gpt-6.1-sol`; never silently substitute a model/provider or create provider
credentials. Deterministic generated I/O remains the authority for isolation,
retry and ordering assertions. No actual local central private data has been
read in these M15 tests. Every stored record, original byte, fixture account and
prompt is authored/generated. Raw private content and all its derivatives must
stay outside Git, PR bodies, shared logs and attachments; staged/new files are
reviewed before commits rather than relying only on ignore rules.

Local `codex-cli0.162.1` model/list was actually read using the existing Mote
catalog adapter, EXIT0: exact `gpt-6.1-sol`/GPT-6.1-Sol is listed, with low as the
default effort. Metadata stays in `/tmp/m15-local-codex-models.json`; no thread or
inference was started by that lookup. Opt-in6809824b prepares a generated-only
M01/M04/M08 host plus an original Native Ask test. It uses a fixed shared Codex
profile, existing local authentication, no API key/HTTP endpoint, and disables
automatic processing/Memory jobs. The real native inference test is still
UNCOMPILED/UNRUN pending the current Container Docker build's explicit RELEASE.
No live output or private-data fixture is included in Git.


The existing Mote CodexSession provider handshake also completed EXIT0
(`/tmp/m15-local-codex-preflight.log/.exit`): account/read succeeded and the
read-only ephemeral thread resolved both model fields to exact `gpt-6.1-sol`.
It submitted no inference turn, used no tools and created no execution dialog or
provider credential. The declared fast tier was advertised by the local catalog;
no silent model/tier fallback is implemented. This is interface preflight, not
real-model answer validation. The prepared synthetic host is ready; Native Ask
execution still waits for its test APK compilation after the resource window.

Historical QR question (superseded by the parent's later scheduling instruction): the owner was asked whether
to reuse M01 device PKCE/browser approval after scanning server metadata, or to
retain a one-step exchange by adding a new account-bound invitation contract.
The parent has since clarified that ordinary decisions are already authorized for
the parent to resolve and that a finite public pairing task will be assigned when
the fourth slot releases. Android does not wait for the earlier question or
implement a competing QR backend. The existing QR capability remains open until
that actual common contract and its consumer acceptance are delivered.

### Original Lark entry characterization prepared (4b16dc20)

The native page still calls the retired singleton `/api/connectors/lark` facade.
The prepared durable native journey selects a real saved `same-lark` connection,
checks the actual CLI probe task, observes held authorization progress, saves an
explicit document range, previews metadata, confirms archival, and retires a
detached A sync button after switching to B with the same connection ID. The
fixture uses the actual M01/M04/M09/M10/M05/M03 host; only external CLI responses
are generated. No CLI installation, real provider credentials or personal data
are involved. The test remains UNCOMPILED/UNRUN, so no RED or GREEN is claimed.

Fixture startup first failed before business assertions because a control route
was registered after Fastify readiness. The corrected fixture uses a separate
loopback-only control listener and reached ready successfully; its startup is
not native acceptance. Production Android is unchanged from tested48a79785.

KEEP: the existing document/activity discovery and exclusions, explicit preview
and archive, calendars, per-document retry, source pause/context, cancellation,
and retained archive on disconnect. CHANGE: the selected owned M10 connection,
M05 task ID/progress and the existing encrypted same-operation command journal.
UNKNOWN: ordinary CLI installation has no allowed scoped operation; it must not
be replaced by a shell command or silently equated to bundled plugin install.
Recording-provider controls, shared arbitrary-file Imports, remaining Files
controls/review/acoustic, and the original Agent View contract remain separate
open capability rows. The prepared Lark test does not close any of them.

The test APK was subsequently compiled successfully in7s,49tasks6executed
(`/tmp/m15-native-lark-codex-testapk-build.log/.exit`). With the preserved tested
48a APK, the same durable Lark method executed1/1 and failed at the missing
saved-connection selector in0.485s (`/tmp/m15-native-lark-owned-entry-valid-red.log/.exit`).
The normal public MainActivity → Add content → Lark path also showed the missing
record notice, while the generated A inventory actually contained `same-lark`
and the retired singleton GET returned404. Direct shell startup of the private,
non-exported CentralActivity was rejected by Android; no manifest, permission or
system setting was changed. That rejected startup is not a product RED.
The new Lark production code remains uncommitted/unaccepted pending its APK and
the unchanged native scenario's GREEN; this paragraph supersedes UNRUN above.

### Actual opted-in local Codex Native Ask (tested Android48a)

The original native Ask page sent the authored generated connectivity question
through real M01/M04/M08 and the existing logged-in local Codex. The exact selected
model was `gpt-6.1-sol`; the actual run completed, displayed a nonempty answer in
the native page and returned404 to B. The single instrumentation test passed in
11.281s, EXIT0 (`/tmp/m15-native-local-codex-first.log/.exit`). This supersedes the
prepared-only model paragraph above. No semantic answer score is asserted and no
mock isolation/retry assertion was replaced. All records and the prompt were
generated, the temporary host had no private central content, and no answer,
auth material or model output was added to Git. This is one actual local-model
connectivity regression, not real-account, provider-wide or model-quality acceptance.

### First native Lark GREEN (49347f92)

The first candidate app/test assembly completed EXIT0 in7s,67tasks9executed
(`/tmp/m15-native-lark-first-green-build.log/.exit`). The expanded original native
journey reached a real archived original, then failed at the absent source-context
control in2.236s (`/tmp/m15-native-lark-first-green.log/.exit`1). The server was
still returning the private adapter-local document source ID. Exact M13
0a3f268d was consumed as3808d399; only the existing scoped connector status/task
projection changes, mapping owner+instance+local ID through connector_sources.
The documentation conflict kept current composed records plus that exact source
projection evidence, rather than importing unrelated paused Web work.

With a fresh generated backend and the identical already-compiled Android APK/test,
the same method passed1/1 in3.112s, EXIT0
(`/tmp/m15-native-lark-source-green.log/.exit`). It exercised the saved owned
connection, actual CLI check and held authorization URL, explicit scope/preview
and archive, exact public source-context CAS, and a detached old A sync button
under same-ID B. The original document source and original bytes remain M03-owned;
the client introduces no collector, scheduler, CLI installer or Web fallback.
Only external CLI responses are generated. i18n8455 EXIT0. Full Android/required
and independent review of this new consumer remain pending. The test-onlya924
extension for calendars, failure retry, source pause/resume and cancellation has
not been compiled/run and is not included in this GREEN claim.

### Native browser Central-login contract repair in progress

Static consumer/protocol mapping found a different existing-flow mismatch:
CentralContent's browser login and ClientLoginApproval promise all Central
functions, while the default M01 request produces a device-bound credential that
UnifiedCentralSession intentionally refuses as a private Central client. Device
isolation remains correct. New explicit-purpose server characterization eebdbe64
failed400 at the absent purpose field (`/tmp/m15-native-browser-central-contract-red.log/.exit`).
The minimal producer now preserves default device grants and issues an existing
personal client only for an immutable `purpose:central` request approved by a
current full account session. New contract test1/1 GREEN, old PKCE account-binding
neighbor GREEN, and the independent unfiltered legacy handoff file4/4 GREEN
(`/tmp/m15-native-browser-central-contract-green`, `/tmp/m15-browser-auth-adjacent`,
`/tmp/m15-browser-legacy-handoffs`, each `.log/.exit`). Device private GET and
device approval remain403; central grant private GET200/admin403, wrong verifier,
cross-account reapproval, one-use ACK, revocation and B positive are retained.

The original browser approval component also had two actual renderer failures:
it promised all Central functions for a device request, and a replacement request
could retain the previous device's enabled approval button before its own details
resolved. Test-only41f25299 retains valid RED2/2 in
`/tmp/m15-browser-approval-valid-red2.log/.exit`; unchanged assertions pass2/2 in
`/tmp/m15-browser-approval-first-green.log/.exit`. The first attempt from repository
root failed before business assertions because TSX used the wrong workspace JSX
configuration (`React is not defined`); it is fixture execution setup, not a valid
product RED. The real Web-workspace command is recorded in the valid logs.

Native original browser entry test1ca774b7 is UNCOMPILED/UNRUN. It will intercept
only the generated loopback browser Intent, use real approval/poll/ACK, and check
the actual native device inventory under A with same-ID B. The native one-line
purpose consumer, producer and Web repair are not claimed final until that
unchanged native case and current types/build/review run. i18n8456 EXIT0. This
restores the existing full-client browser login promise under the accepted M01
boundary; it does not choose the pending QR pairing product flow or expose private
APIs to device-bound credentials.

Additional actual retirement case23e19b95 holds the successful real approval
response, unmounts the original component, then releases it: the existing grant
fact is retained, but old code called the retired UI's navigation callback1≠0
(`/tmp/m15-browser-retired-approval-red.log/.exit`1). A synchronous component
retirement fence fixes only that publication boundary; all three original
browser approval renderer cases now pass3/3, no skip
(`/tmp/m15-browser-approval-final-narrow.log/.exit`0). Native entry/types/build and
independent review are still pending, so this is not a final shared freeze.

### Recording checkpoint reader: narrow producer acceptance

Original native recording controls still refer to the retired global registry,
steps and item routes. Test8f8090b1 first ran actual M01/M04/M09/M10/M05/M03 for
same-ID A/B, retaining successful transcripts while generated audio failed. The
absent scoped checkpoint route failed503≠200 at the real HTTP read
(`/tmp/m15-recording-reader-valid-red.log/.exit`1), not during fixture setup.
The new existing-ledger reader passes the unchanged case1/1,no skip in2.895s
(`/tmp/m15-recording-reader-green2.log/.exit`0), including actual audio recovery,
unchanged transcript capture, owner/query/selection-bound pagination, no external
I/O during reads, and disabled-A/B-positive controls. Scope inventory0.

This producer adds no schema/state/runtime and reuses the existing host-provided
PrivateCursor key. Current-selection archive/checkpoint flags are distinct from
M06 indexed/Memory outcomes and from historical archive browsing outside that
selection. Native recording consumers, full history, types, independent review
and final gates are still pending; this is not a complete recording freeze.

Original failed-step retry needs to continue under the admitted central task,
including after UI closure. Test84dba2a7 retains real400
`connector_operation_invalid` for explicit `{resume:true}` after the real
transcript-success/audio-failure setup
(`/tmp/m15-recording-resume-valid-red.log/.exit`1). The existing M05 operation now
continues the existing pending-stage loop, skipping normal scan/discovery. The
same case passes1/1 in2.225s, EXIT0
(`/tmp/m15-recording-resume-first-green.log/.exit`): completed transcript capture
and transcript/search call counts do not change, audio saves successfully,
default empty retry still resets without provider I/O, and the earlier owner/
cursor/range/revocation controls remain. No native or broad-gate acceptance is
inferred from this additional producer test.

### Native browser purpose and recording entry: actual RED checkpoint

Test-only `512883a0` was compiled with offline fixture AndroidTest assembly:
`/tmp/m15-browser-recording-testapk-build.log/.exit`, EXIT0, 6 seconds,
49 tasks with 6 executed. The earlier existing-APK inventory action was rejected
before CreateProcess because the recorded Container heavy window was active;
no workaround was attempted. Container then explicitly released after its
actual successful required gate. The same original action was reviewed once
under that new resource fact and executed successfully: native inventory 1/1,
0.5 seconds, `/tmp/m15-recording-original-device-precondition.log/.exit`.
Only `emulator-5562` and the generated M15 fixture package were used.

With the preserved pre-browser production fixture APK, the exact new browser
journey reached real M01 approval/poll/ACK but returned a device grant and a null
native private client: valid RED 1/1, 0.964 seconds, EXIT1,
`/tmp/m15-browser-original-native-valid-red.log/.exit`. The generated browser URL
was intercepted by instrumentation; no real browser account was used. This is
independent native evidence for the already narrow-green server/Web purpose
repair, not yet native GREEN.

The original native recording navigation reached its existing settings card
but could not render “connect authorized account” because it still read the
retired global connector status. Valid RED 1/1, 0.721 seconds, EXIT1,
`/tmp/m15-recording-native-valid-red.log/.exit`. The new regression retains
connection, explicit range, vendor text, audio-failure status, failed-stage
background retry without repeated text, and detached old-A command rejection
after B resumes. Its native production adapter is currently uncompiled WIP.
The current-selection checkpoint reader does not replace archive history:
the native archive list must use current canonical Files by exact mapped source,
and all playback uses authenticated original tickets and exact descriptor checks.
Full latest Android, native GREEN, server/Web types, review and affected gates
remain pending. Earlier 353/353 at runtime48a is retained only at that SHA.

### Connection recovery and composed generic Imports tests (pending execution)

After the host transport disconnected, no product test was relabeled as failed
or successful. Parent21:20 UTC confirmed Bogon authorized/attached/connected and
resumed this original workspace. Read-only Git and logs verified9bbb plus the
untouched native Imports test and generated fixture. Both were audited and
saved as test-onlyc253a93a; additional pure-JVM malformed archive/admission
acknowledgement tests are test-only6f618976. They are not yet executed REDs.
The prior source merge only unified the fixture's optional source-pack/options
and before-ready callback; it calls that callback exactly once.

Standard approved read-only process/adb probes confirmed old fixture PIDs72188,
73265 and76510 were gone and no emulator was connected. Old PID97032 had been
reused by a system guardian, so no cleanup signal was sent. Only the idle Gradle
daemon was observed; parent-prioritized Theme's new explicit short Android
window remains separate from M15. M15 kept all heavy work released. A fresh
generated source-host for native Imports now listens on loopback only. No real
Central data, model output or credentials were read or copied into Git.

### Generic Imports actual native acceptance and acknowledgement repair

Test-only6f618976 records two valid JVM REDs: a changed retained original
descriptor and a wrong admission ID were both accepted and consumed local
parts/intent. Three tests total,1 pass/2 fail, EXIT1,
`/tmp/m15-imports-resumed-testapk-ack-red.log/.exit`; raw XML is retained at
`/tmp/m15-imports-ack-valid-red.xml`. Production54ad0039177f17355c157f529b5598b69901ffa5
reuses the existing encrypted parts/journal and fixed original client. It checks
local part lengths/digest, actual received/PUT part acknowledgements, exact
archived file ID/hash/length/path/MIME and the original admission ID/files before
clearing staging. A wrong or missing acknowledgement preserves the original
request and bytes. Same3/3/no skip GREEN; fixture app/test APK BUILD SUCCESSFUL
8 seconds/91 tasks11 executed, `/tmp/m15-imports-ack-first-green-build.log/.exit`.

Actual original native choose-file→private staging→preview→confirmation→saved
workflow is now1/1/no skip/EXIT0,13.234 seconds,
`/tmp/m15-native-imports-second.log/.exit`. The generated original exceeds4MiB,
produces exactly two uploaded parts, and a real accepted202 response is dropped.
Recreation retains encrypted pending bytes; B's equal-ID completed job and
view receive no A retry. Explicit A return retries identical original/file/request
IDs without repeating parts. No Capture is query-visible before confirmation.
The original confirmation dialog then publishes actual canonical receipts and
preserves the archived file's exact bytes/hash. M01/M03/M04/M05/M06 are real;
only model HTTP returns fixed generated answers. Memory processing is explicitly
disabled in this fixture, never counted as completed by import success.

First native attempt reached A's real private preview but its B inline comparison
failed503 because the test-only request observer assumed archivedFileIds on every
request. `/tmp/m15-native-imports-resumed-first.log/.exit` is retained as fixture
failure. Fixture-only909dd250 accepts inline comparison bodies; the identical
compiled app/test APK then passed. No production code changed to hide it. The
recovery environment had no existing emulator, so the original readonly5562 was
restarted after Theme's explicit release; boot completed10608ms. No system
permission expansion or physical-device access occurred. Independent54ad review
and complete latest affected/Android/consumer gates remain pending.

### Lark disconnect generation and authenticated native recording playback

A further original Lark lifecycle test330564/a5a62b adds the actual original
disconnect dialog, waits for its newly admitted successful M05 receipt, then
uses the existing Check Status control. Valid RED1/1,6.187 seconds, EXIT1 in
`/tmp/m15-native-lark-disconnect-valid-red.log/.exit`: no new task is admitted
(20 remains20; the API default page bound is50). The old native adapter still
required the generation that this same disconnect had retired. This is distinct
from the earlier expanded6.009s passing Lark checkpoint.

Production95c02560bdfeafc66c967cb4434e7c7ed29968cb retires the old page on
both acknowledged and uncertain disconnect outcomes. The original M05 task is
retained in the same encrypted journal at the known own-disconnect generation;
current inventory must still match exactly. No credential is replaced and no
new execution authority is inferred from a task. Pending bodies remain stable
for a user retry. Test-onlyc583 adds a loopback network proxy that only drops
the real successful HTTP ACK after actual M10 admission; it does not replace
a route, task or result with a fabricated success.

The same original journey plus actual ACK loss now passes1/1/no skip,6.174
seconds, `/tmp/m15-native-lark-disconnect-first-green.log/.exit`: preview/archive,
calendar choice, source pause/resume, document failure retry/cancel, exact
operation/task replay, next explicit status work, and B retirement remain real.
App/test APK compilation passed12 seconds,67 tasks9 executed in
`/tmp/m15-lark-disconnect-green-build.log/.exit`. Independent two-file95c
review is pending; this is not final Lark/Android/affected acceptance.

The recording journey also reaches the canonical Files source archive and exact
M03 authenticated play ticket, downloads verified original bytes, prepares the
real Android MediaPlayer for a generated five-second WAV, and exercises its
existing play/pause buttons. It then returns to a fresh recording page and
rejects the old A retry after B resumes.1/1/no skip/EXIT0,3.053 seconds,
`/tmp/m15-recording-native-play-first.log/.exit`. The normalized seek control is
enabled; assigning its progress in this fixture is not a physical seek gesture
claim. The emulator has no audio output and no real recording or runtime audio
permission is used. Complete physical-device/background/audio-quality checks
remain separate.

M13's bounded37c/e4f reader/resume reviews are now read from
`/tmp/mote-m13-review-m15-recordings-{37c8,e4f8}.md`: no new confirmed P0/P1/P2,
without reviewer execution or native/current build coverage. Separate native
recording and54ad acknowledgement reviews are still due.

### Original QR pairing and declared Agent catalog expansion

QR producer6a84ec6a477bb4698002234fd81bb669ce98cc06 is consumed as7a25f2ee.
It keeps the existing invitation creation consent, fixed deployment/account/device
purpose and original origin-confirmation journey. Android adds no browser approval
step and no device private-read permission. Tests d090/beccf3b6 first produce valid
RED: ConnectionAndOperations5 total2pass3fail, EXIT1, with the test APK assembled
successfully in the same11s73-task command (`/tmp/m15-qr-jvm-testapk-red.log/.exit`).
The real original ConnectionActivity then receives an actual v2 M01 invitation
but cannot open its normal confirmation dialog:1/1 EXIT1,0.462s,
`/tmp/m15-native-qr-valid-red.log/.exit`. Raw JVM XML is saved separately at
`/tmp/m15-qr-jvm-valid-red.xml`.

Production e8b9a54c retains the original encrypted recovery file. It writes the
immutable invitation, device metadata and random PKCE verifier before the first
claim; persists the M01 request and grant; verifies exact self account credential
ID, deployment/user/device and Wire2/Ingress3; saves only the verified stable
account with the actual grant expiry; then ACKs. A lost successful ACK uses the
cached grant and duplicate ACK rather than polling a consumed request. Settings
also checks the expected account before its final write. Invitation v1/owner or
wrong-purpose input is rejected before networking. Original-device selection,
local QR rendering and existing revoke control remain in the original Devices
page. The following806fb895 fences scan/document results by their original
configuration and keeps the original modal's expected configuration through
RuntimeSettings pause/drain/apply.

Same JVM5/5 passes, fixture app/test APK18s91tasks16executed EXIT0,
`/tmp/m15-qr-first-green-build.log/.exit`. The identical native pairing case passes
1/1,2.041s,`/tmp/m15-native-qr-first-green.log/.exit`: actual redeem200 reply loss,
recreation, same PKCE/claim ID recovery, actual ACK200 reply loss, cached-grant
recovery and successful duplicate ACK; no browser opens. Explicitly adopted local
note uploads through the actual worker to A, B returns404, and collection remains
stopped. Original native Devices→explicit original device→save→locally decode the
rendered QR also passes1/1,0.935s,`/tmp/m15-native-qr-issuer-first.log/.exit`;
the detached A issuer button after B resume creates no new invitation.

Expanded app/test APK passes12s67tasks9executed EXIT0,
`/tmp/m15-qr-expanded-build.log/.exit`. Its four-field self-corruption and same-device
reauthorization test executes all identity-rejection assertions and credential
rotation, then fails0.294s at its final draft assertion
(`/tmp/m15-native-qr-self-first.log/.exit`). The fixture had submitted that draft
with QuickNotes.save, whose normal success clears the submitted draft. Test-only
79ca608e instead asserts anonymous draft adoption before submitting a separate
note, then creates a fresh unsaved A draft before reauthorization. This corrected
test has not yet been compiled or rerun; no passing reauthorization claim is made.

Agent test d1a41a94 uses actual M01/M03/M06 generated canonical Materials and
first confirms its declared M08 material-read succeeds. Old native expansion
then incorrectly calls an unavailable old evidence endpoint:1/1 EXIT1,0.607s,
`/tmp/m15-native-agent-valid-red.log/.exit`. Minimal10442b46 consumes each row's
existing declared material_read or M08 context reader. Same original native
catalog→episodes→expand→A text/B denial→old A action retired under B passes1/1,
0.928s,`/tmp/m15-native-agent-first-green.log/.exit`. This does not replace the
still-unavailable shared Agent startup/events contracts with fabricated results.

All data and accounts are generated; corruption hooks change only declared self
fields, and network fault hooks remove real successful replies. They never mint
a token or fabricate an authority/receipt. Parent22:08 serial instruction takes
priority over stale resource files: M15 keeps all heavy work released while Joint's
already-running finite regression finishes, then QR owns its full gate. Further
M15 build/full Android/affected slots await the parent's fresh allocation. Current
native deltas have been requested for bounded independent review; no final M15
remote head or Draft PR exists yet.

### QR recovery after the transient handoff disappears — confirmed P2, GREEN pending

The QR review identified a candidate: after a lost successful ACK, server restart
or handoff expiry removes the transient M01 request even if the independent device
credential remains valid. This was reproduced through the same already compiled
native journey and a real source-host restart over the same SQLite and loopback
port. Test-only638d/e26 closes and reopens the production host; it does not forge
410 or a credential. `/tmp/m15-native-qr-restart-proof-red.log/.exit` is1/1 EXIT1,
2.109s: the original recovery remains pending. Safe observation metadata records
`restarted:true`, actual ACK statuses`[200,410]` and3 successful device self reads
(`/tmp/m15-native-qr-restart-proof-state.json`). An earlier2.121s identical failure
is preserved separately. This is now a confirmed recovery P2.

Minimal c0c7df37 handles only the explicit M01 `410 login_expired` response by
freshly verifying the same persisted credential's exact deployment/user,
account.credentialId, device and required capability/protocol. Only then can the
local recovery intent retire. It records `pairingAcknowledged:false`, rather than
claiming an ACK that was never received. Authentication/revocation, wrong subject,
wrong purpose/kind, malformed acknowledgement and network failures retain recovery.
No new credential, approval or read permission is introduced. Tests226/518 add
actual restart proof and a real post-restart credential revocation negative.
The exact declared M01 client kind is enforced by d3a; its corruption test is
separate from a retired owner grant.

These new runtime changes and corrected79ca/new picker12083 tests have NOT been
compiled or run GREEN. Parent22:08 keeps M15 heavy work released until the parent's
next explicit allocation after the QR producer's full gate. The last native-tested
806 checkpoint is therefore not final accepted: it contains this confirmed P2.
Pending future tests will not be reported as executed; the current source HEAD
must not be substituted for a tested frozen consumer.

### Parent-allocated current Android and QR closure phase

The fresh QR RELEASE22:34:59 and actual PGID8858 absence were verified before
M15's explicitly allocated phase. Current357-test/debug/fixture APK pass is
`/tmp/m15-qr-final-full-android2.log/.exit/.sha` with fresh counts
`/tmp/m15-qr-final-full-android2-counts.json`:75XML,357tests,0fail/error/skip.
First full log/XML at `/tmp/m15-qr-final-full-android.log/.exit` and
`/tmp/m15-qr-full-first-fixture-error.xml` remain EXIT1, not a passing gate.

Original held-picker candidate12083 is now actual RED0.874s at old806 APK:
A's own-cache FIFO holds an already admitted original JSON document read; after
B switches and the existing periodic refresh is deliberately delayed, the old A
capability reaches B's input. Minimal ced9 adds only an off-main settings recheck
after the read and a current stable-owner publication check. Same native
`/tmp/m15-native-qr-held-picker-first-green.log/.exit` passes0.993s, preserving
ordinary A selection and a new explicit B selection. No real file or camera is
used. QR kind corruption is valid RED0.248s at old806; strict declared client kind
and all exact self fields pass in the corrected reauthorization case0.408s.

M04's instance settings policy is established in the configuration design:
resource admin HTTP edits only models, while other instance settings remain the
operator's configuration contract. Old native controls still called unavailable
global APIs. Actual original entry RED0.530s→minimal a73 explanation sameGREEN
0.851s, `/tmp/m15-native-instance-policy-{red,first-green}.log/.exit`, proves
zero retired requests, unchanged account processing editor and admin diagnostic
positive200. No new singleton write API or fabricated count was introduced.

The current isolated APK separately passes these real generated single cases:

| Case | Seconds | Exit/log prefix under `/tmp` |
| --- | --- | --- |
| ACK lost then actual M01 restart; exact live credential recovery, no false ACK |2.117|0 `m15-native-qr-restart-first-green` |
| Real credential DELETE after restart; pending retained and no A/B upload |2.019|0 `m15-native-qr-revoked-first-green` |
| Exact five self fields; anonymous draft then unsaved A draft, explicit original device reauthorization |0.408|0 `m15-native-qr-self-first-green` |
| Held A JSON result after B; new B selection positive |0.993|0 `m15-native-qr-held-picker-first-green` |
| Existing instance settings show M04 operator policy without retired requests |0.851|0 `m15-native-instance-policy-first-green` |
| No-restart loss/retry still obtains the real duplicate ACK |2.166|0 `m15-native-qr-normal-final-green` |
| Original Devices generates locally decodable selected-device QR; old issuer retired under B |1.376|0 `m15-native-qr-issuer-final-green` |
| Original Agent catalog/episodes canonical reader and A/B retirement |0.980|0 `m15-native-agent-final-green` |

Every case also has an actual generated-backend cleanup exit0. Native tests run
serially as individual cases; no broad instrumented suite, real data, external
model or system permission grant is claimed. The old pre-fix APK/hash remain
preserved for the exact REDs. Parent22:43 environment callback was checked against
actual tool/log/PTy evidence: no connection error occurred here and no command
was repeated because of that callback. Read-only process verification reports
zero active Gradle wrapper/test workers. M15 explicitly RELEASED its heavy phase
before the subsequent single-native checks; the QR full gate is next via parent.

The original bounded reviewers' reports do not automatically cover these latest
small fixes. Independent closure requests remain pending. Joint's latest message
submission still returns an earlier-turn-not-confirmed error; M15 does not claim
a candidate freeze was received or proxy/retry that failed delivery. The current
capability matrix distinguishes original Android controls from Web-only widgets
and lists genuine remaining contracts. Final affected/push/Draft PR remain open.


## Allocated Files retry phase: real GREEN and separate DELETE refusal

Parent23:30 order was followed: Joint latest203997e5 types actually0 and fresh
RELEASE preceded M15 CLAIM. Fixed combination d524140f0e93844058cb82348274b76ed7e855a7
contains the declared public Files patch combination and Androiddc634 source.
Offline JDK21/installedSDK command `:app:testDebugUnitTest
:app:assembleMultiuserFixture :app:assembleMultiuserFixtureAndroidTest` actually
exited0 in40s,91tasks14executed. Fresh75XML suites357tests,0failures/errors/skips,
`/tmp/m15-files-short-green-build.log/.exit/.sha/-counts.json`. The test task
executed; this is not an oldXML/up-to-date-only claim. No final affected ran.

Original existingAPK Launcher→More→Content→Files retry was actualHTTP400
without operationId (`m15-native-file-retry-ui-red3`, retained). Minimal encrypted
same-operation fix now passes the actual sourcehost/native lostACK→recreation→
samebody/task→B oldcallback retirement **1/1 EXIT0,1.272s**,
`/tmp/m15-native-file-retry-first-green.log/.exit`, ownbackendcleanup0.

The second original stop/consent/freshretry/delete case reached its final delete
assertion but failed **1/1 EXIT1,1.9s**, expectedA404/actual200. Its predecessor
assertions passed; this is not whole stop/delete acceptance. Exact response probe
shows real cancel200 and DELETE503/error scope_unavailable. The next exact probe
retains the original Fastify `Unsupported Media Type` stack **before** the route
handler, so this is not a missing private route or permission expansion request.
`/tmp/m15-native-file-stop-delete-{first-green,response-probe,stack-probe}` logs
and exits are retained; each generatedbackend cleanup0. Native DELETE default
previously supplied null instead of the scoped JSONemptyobject. A minimal
CentralClient default `{}` and shared JVM regression are prepared after this real
RED, but remain UNCOMPILED/UNVERIFIED until a new allocated short slot. Explicit
account-delete operation fields remain supplied by the caller. No backend facade
or global HTTP engine was changed.

M15 explicitly RELEASED all heavy after the phase, before QR's next gate.
Subsequent checks are single existingAPK/fixture-only, no Gradle/build/fullsuite.
The already-visible invitation resume candidate first execution **0.495s EXIT1**
stopped at an invalid fixture precondition: the test searched the base64 URI for
its plaintext code. It did not reach B/resume and is NOT a confirmed production
RED. Test-only correction decodes through the real ConnectionInvitation parser;
no invitation runtime change or GREEN is claimed.


### Correct JSON DELETE and genuine unknown HTTP probes (not new APK GREEN)

One generated real M01/M03/M05/M06 HTTP sequence, after stop and explicit fresh
processing, sends DELETE JSONemptyobject:200, thenA404/B200/exactBchunks and
cleanup complete. `/tmp/m15-file-delete-json-http.log/.exit/-result.json`, EXIT0,
backendcleanup0. Its `unknown_explicitly_confirmed:false` is retained: that known
completion branch is not unknown-confirmation coverage.

A second generated ASR mode receives actual WAV bytes then drops its HTTP reply;
no SQLite or task state is seeded. The real host reportsunknown. The first probe
tried explicit fresh processing before the physical task settled and correctly
received409 file_processing_active; `/tmp/m15-file-unknown-http.log/.exit1` is an
ordering/guard observation, not a product RED. The corrected sequence waits for
actual public processing tasks to leavewaiting/running, then explicitconfirm
succeeds: JSONdelete200/A404/B200/exactBchunks, cleanup complete and
`unknown_explicitly_confirmed:true`, `/tmp/m15-file-unknown-http2.log/.exit/
-result.json` EXIT0/backendcleanup0. These sourcehost probes establish the request
shape and state ordering; they do not substitute for a rebuilt native app.

The native explicitunknown case is now saved but UNCOMPILED/UNRUN: original
unknown UI opens confirmation; cancel causes no admission; explicit confirmation
creates a fresh owned request after physical settlement, preserves old unresolved
facts, and old A confirmation cannot sendunderB. Existing stop/delete and
lostACK native methods remain separate. No unknown assertion was weakened into
known completion or a manually written task journal.


## Original personal MCP credentials: real create RED, thin consumer preparation

While QR held the full gate, a single existingAPK checked the original normal
Launcher→Sources→Personal connections→Create MCP→Save flow. Real M01 returned
400 invalid_request for keys serverUrl,label,access,
`/tmp/m15-native-mcp-create-red.log/.exit/-trace.json`, backendcleanup0. This
reached the actual strict route and is a production consumer RED, not an absent
backend or fixture permission problem. Original central-purpose browser login
setup remains a real1/1 positive and no external browser was opened.

Minimal preparation removes serverUrl only from MCP issuance (device invitations
retain it), keeps read/write choice and adds optional explicit sourceIds via the
existing advanced array editor. This consumes M01's established write-source
allowlist, rather than silently granting global writes or removing write mode.
The existing bilingual Source scope key is reused. Native regression prepared
for actual UI write grant over A/B same source ID/label, cancellation/revocation
and old A confirm retirement underB; default read creation retains the original
manual samecase. No new backend, credential recovery or runtime was added.
These source/tests remain UNCOMPILED/UNVERIFIED pending the next parent allocation.


### Final QR producer composition and pending native regressions

Merge3a475da1888d1a738432a205c52d02c590f8980b consumes delivered QR48547e8f
without merging Theme or changing the shared-runtime design. Conflict resolution
retains Joint originalGeneration/fileGeneration/diarizeFrom/reviews, per-file
settings and full immutable retry-input validation. Both UTF16 characterization
variants and both summary503/429 checkpoint variants remain. These composition
cases are not yet run. Pure i18n checker8468,13 TS syntax parses and diff checks
exit0; no tsc/application gate is implied.

The corrected invitation fixture39923874 parses the actual base64 URI for both
negative owner-retirement assertions, as well as the positive precondition. The
prior0.495s invalid positive precondition remains a fixture error. No production
resume fix or new compiled/native pass is claimed.

Current original Personal MCP400 RED is captured in
`/tmp/m15-native-mcp-create-red.log/.exit/-trace.json`, generated host cleanup0.
Preparedb603 fixes only the strict M01 body and explicit source allowlist form;
its instrumented creation/revoke/A-B case and0498 default DELETE body/unit test
await the next parent-allocated short build. Joint4be decision-CAS wire remains
a candidate awaiting its own type/review freeze; its new required body must be
consumed before claiming final native file deletion. M15 has released heavy
resources; it has no final affected result or Draft PR.


### Limited PREP8177 and independently confirmed source reset —16532eb0

Parent released bounded8177 for consumers, not final acceptance. Ownmerge
87d1834f resolves comments/history only, removes duplicate type import and retains
QR/Joint full input fields.8468i18n/22syntax parse/diff checks0. New noEmit and
Android builds remain pending.

The original2cc regression is migrated to actual DELETE{operationId,originalGeneration}
and returned decisionUUID, without weakening late409/upload410/B assertions.
It isGREEN. A new true source-delete/recreate sequence confirms the independent
old-first-send risk: capture original generation0 and stable operation before
admission, DELETE source, register same source, upload exact same bytes/revision
and captureUUID, get generation0 again, send frozen oldbody ->200 and A404;
B remains200 after this deletion. Expected409/A200. Both calls use real production
app routes; no seeded database or provider. Test-onlyb55 adds the case,165 adds
Bpost before the failing assertion. Final2tests1pass1fail0skip2.351s EXIT1 at
`/tmp/m15-forget-source-replacement-red2.log/.exit`; first3.486s log retained.
Joint source owner receives this issue; no duplicate Android backend is written.

During the allocated Desktop-only heavy phase, existingd524 fixture APK against
QR485-composed host passes real WorkManager lateACK/Bexplicit/network recovery
1/1 EXIT0,0.699s, `/tmp/m15-qr485-worker-late-ack.log/.exit`, backend0. A later
SourceWorker command's CreateProcess transport failure is preserved; recovery
read-only checks found zero matching process/evidence, then the same command's
only resubmission stopped before tests because emulator5562 was gone. Backend0,
zero instrumentation tests, environment failure, no SourceWorker product claim.
No emulator restart/build occurred while Desktop retained the heavy window.

Test-only23af adds same invitation begin lost-redeem/edited-name/same-owner-login
regression with full claim/challenge/name correlation; no new production change
and no compiled/native pass is claimed.


## Invitation capability retirement and current Files delete adapter

Fresh53d21cf9 offline JVM+fixture app/test APK build passed:75 XML,358/358,
0 failure/error/skip,88s. Original MCP create/revoke from native UI passed1/1
2.013s against real M01, including write-source allowlist, cancel, B same-label
and a detached A confirmation under B. Logs `/tmp/m15-mcp-delete-short-build.*`
and `/tmp/m15-native-mcp-create-first-green.*` retain their exact source.

The corrected original invitation test reached a valid production RED at53d:
A's visible confirmation remained after actual B login/resume,1/1 EXIT1,1.380s,
`/tmp/m15-native-invitation-visible-resume-valid-red.*`. Minimal production
fixd6da951d captures the page owner, synchronously retires visible text/dialog
and incoming URI before resolving another identity, and fences queued callbacks.
The original durable pairing/PKCE state remains. Its first whole JVM run had357
passes and one citation fixture race: canonical Material publication correctly
made the old raw query ref404. Test-onlyc47 waits for the actual Material and
uses its declared originalRefs, retaining explicit raw404/B404/source-pause404;
focused same test and fixture packaging passed. This is not a new full358 pass.

Two invitation GREEN attempts are retained as harness failures: a background
barrier assertion, then ActivityScenario's STARTED timeout. The pinned AndroidX
1.6.1 observer compares its original launch URI with Activity.intent.data and
ignored the correctly cleared capability. Test-only659a copies only that
observer's expected Intent; it asserts the real Activity URI is still present
before resume and is cleared by production afterward. No app mutation, timeout
extension or privacy assertion removal. Test APK packaging EXIT0,22s. Actual
native results at659a (productiond6da), all own backend cleanup0:

- visible A capability→B resume:1/1 EXIT0,2.132s,
  `/tmp/m15-native-invitation-visible-resume-green3.*`;
- original QR lost-redeem/ACK and queued bytes:1/1 EXIT0,3.098s,
  `/tmp/m15-d6da-normal-pairing-green.*`;
- same invitation retains verifier/claimed name/account directory through same
  owner login and lost replies:1/1 EXIT0,.218s,
  `/tmp/m15-d6da-same-invitation-green.*`;
- held A picker retires; explicit new B selection works:1/1 EXIT0,2.550s,
  `/tmp/m15-d6da-held-invitation-picker-green.*`.

Files delete is a separate confirmed consumer RED: exact saved53 app through
original detail/confirmation sends no stable op/generation and gets actual409,
1/1 EXIT1,1.639s `/tmp/m15-native-file-delete-cas-valid-red.*`. Productiona95f
adds a thin journal using the existing account-owned encrypted CentralStateFile:
captured descriptor+UUID operation+generation before DELETE; missing-detail
recovery on Files list; original request only; exact decision/source/external/
generation acknowledgement before clearing only that operation. Fixed old ACKs
refresh current data rather than remove a same-ID replacement locally. APK
build EXIT0,27s `/tmp/m15-file-delete-cas-green-build.*`; actual native GREEN is
still pending. Joint owns the separate source-delete/recreate reset165 RED;
no shared producer fix or whole Android/final affected result is claimed here.


### Current composed source recovery and Lark large-result consumption

Native sourcea95 with Joint2528/519 host: SourceUploadWorker/ScanWorker same-ID
A/B spool/context/permission refusal1/1 EXIT0,2.455s; expired snapshot through
actual generated DocumentsProvider and existing Worker1/1 EXIT0,4.058s; actual
late ACK/network closure/B explicit collection1/1 EXIT0,1.706s. Prefixes are
`/tmp/m15-a95-519-{source-worker,snapshot-worker,late-ack-network}-green.*`.
Actual phase1 original queue/offlineA→B1/1 EXIT0,1.197s, same-UID SIGKILL own
fixture PID7864 observed absent, phase2 without clear/reinstall restores B then
explicit A original directory/draft/bytes1/1 EXIT0,.426s. Logs
`/tmp/m15-a95-519-actual-process-death-*`, backend cleanup0. The full current JVM
at a95 passed358/358,75XML/no failure/error/skip,96s
`/tmp/m15-a95-current-jvm-full.log/.exit/-counts.json`; later Lark429 is a
separate delta, not silently covered by that full run.

Joint519 exact generation/schema/lifecycle delta was independently read in
`/tmp/mote-m15-review-joint-source-519.md`, no new confirmed issue in that scope.
Original M15 source-delete/recreate165 actualRED now passes2/2/no skip,4.381s,
`/tmp/m15-source-replacement-519-green.*`. Independent Desktop reviews exactd6da
and a95 found no new confirmed P0/P1/P2; those reviews did not run native tests.
Their saved reports are `/tmp/mote-desktop-review-m15-connection-owner-d6da.md`
and `/tmp/mote-desktop-review-m15-files-delete-a95f.md`.

The explicit pure-Server Lark335/d259 freeze was read without waking the paused
M13 thread. Composed as3f73/5fba; the only conflict retained both its owned-status
reader and this branch's newer recordings reader. Actual backend2/2/no skip0,
8.897s `/tmp/m15-lark-d259-public-composed.*`; composed Server noEmit0
`/tmp/m15-519-d259-server-types.*`. No UI producer WIP was merged.

Native218 test on the saved a95 app reached a valid new RED: real M05 calendar
receipt succeeded with exact inventory task/count20, original selector rendered0
instead of20,1/1 EXIT1,2.900s `/tmp/m15-lark-large-inventory-valid-red.*`. Before
that assertion, >32KiB UTF8 status, last full title, and no document body read all
passed. No task input was exposed: the pre-execution fixture review changed its
state wait to public task ID differences; the unexecuted input-based version was
not called a product RED. Test-only package build0.

Minimal429c20d6 changes only CentralLarkConnection: a large inventory is accepted
only when the receipt marker and owned status inventory both match the original
task ID; count and unique nonblank IDs are checked. Small inline calendars remain.
APK build0,10s `/tmp/m15-lark-inventory-green-build.*`; same native test1/1 GREEN,
3.227s `/tmp/m15-lark-large-inventory-first-green.*`, backend0. It verifies twenty
full labels, selecting the last calendar, B same-ID selection unchanged and old
A Save retired under B. Independent delta review and final affected still pending;
original model copy/probe/directory and Agent startup/history remain explicit OPEN.


Current429 Lark original full neighbor first failed at source-context editor
lookup before its original field assertion,1/1 EXIT1,3.850s,
`/tmp/m15-429-d259-lark-original-neighbor-green.*`. javap of the exact compiled
fixture identified that lambda; it was not the new big-calendar assertion.
Test-only8a5 retained actual generated UI label diagnostics; the same full
neighbor then passed1/1,11.051s,
`/tmp/m15-429-lark-source-editor-diagnostic.*`. Test-onlycf435 now waits for the
actual original source-context field instead of only observing `isWorking`
false; the existing45s budget and all save/field/archive/partial-failure/cancel/
small-calendar/lost-ACK/A-B assertions remain. Its test APK build0,16s; full
neighbor passed1/1,10.216s,
`/tmp/m15-429-lark-source-editor-state-green.*`, backend0. No production editor
or polling change was made and no confirmed privacy/runtime regression is
asserted from the first readiness failure. The first failure is retained.

Independent exact429 calendar-inventory review is
`/tmp/mote-desktop-review-m15-lark-inventory-429c.md`, no new confirmed P0/P1/P2
in13 lines; no reviewer execution. Actual big-inventory GREEN remains M15's
separate run. Latest sourcecf435 is test-only after production429.
