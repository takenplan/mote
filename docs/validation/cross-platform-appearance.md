# Cross-platform appearance validation

This record uses generated data only. No local central configuration, private database, captured screenshot or derived personal content is used. Theme behavior requires no model requests.

Base `6272a9b51ec92cc4c32e2ff1a1eeb4fa38b142ed`; independent branch `codex/mote-cross-platform-theme`. UI/native tested source `f69e261f5c2828ad51e7d3d19548b4e825c071fc`. Final affected source `7cd9bb1be47bc047a6367368d727edcded01d085` adds only the inherited test-clock correction described below; later changes are this validation record and generated PNGs only. [Decision](../adr-cross-platform-appearance.md).

## Finite acceptance matrix

For each actual UI (Web, Electron, Android), cover all six selection/OS pairs. Each pair checks first/cold frame, restart/refresh, live OS change, an open modal with an unsaved field, and native controls/chrome. Pairwise route coverage includes settings, navigation, reader/code, forms, menus/dialogs, errors/disabled/focus/selection and status/chart roles. There is no iOS or browser-extension UI to run.

| Selection | OS light | OS dark | OS live change | Back to Auto |
| --- | --- | --- | --- | --- |
| Light | Light | Light | Retains Light | Immediately adopts current OS |
| Dark | Dark | Dark | Retains Dark | Immediately adopts current OS |
| Auto | Light | Dark | Immediately adopts new OS | Already follows OS |

Additional failure/lifecycle cases: missing/corrupt/rejected Web storage; Web cross-tab preference; background return; native profile restart; Android uiMode with draft/focus/selection; open modal retained; generated tokens synchronized; ordinary text >=4.5:1 and required controls >=3:1; no page overflow on phone widths. No navigation/editor remount or model/capture request is expected from an appearance change.

## Executed

Final `npm run check:affected -- --base 6272a9b51ec92cc4c32e2ff1a1eeb4fa38b142ed` **exit 0** on `7cd9bb1be47bc047a6367368d727edcded01d085`. Includes bilingual checks (8326 messages), library builds, all workspace/script type checks and regression suites, then Android debug JVM. Desktop **456**, Web **474**, Shared **193**, Diagnostics **5**, root tools **81** and client **4** pass. Server **1925 pass / 0 fail / 1 opt-in skip**; Agent **316 pass / 0 fail / 1 opt-in skip**. The skips are the pre-existing opt-in macOS Python OS sandbox and installed-Codex synthetic Responses fixture, not theme cases. Android fresh XML: **71 suites / 331 tests / 0 failures / 0 errors / 0 skips**, required Gradle **21s exit 0**. Log, exit and exact source: `/tmp/mote-theme-check-affected.log`, `.exit`, `.sha`.

- TDD: three-state resolver test first failed due to missing implementation, then passed. Shared resolver/live-change tests and generated-token presentation contract tests pass.
- Web narrow tests: blocked/corrupt storage, six-state first-paint bootstrap, cross-tab/resume, stable actual textarea/selection/focus/hash/open modal, and React presentation/draft lifecycle pass.
- Palette checks: both built-in palettes pass semantic text/status/selection pairs at 4.5:1 and control outlines at 3:1.
- `check:i18n` passes with synchronized English/Android catalog. Web and Desktop type checks pass after building their required shared declarations.

- Android: installed JDK21/SDK37 emulator; debug JVM suite **331/331, zero skipped**; development app and instrumentation APKs compiled. Dedicated clean read-only no-window emulator `5584` (own data/cache, API37) ran `AppearanceInstrumentedTest`: **4/4 pass, 26.465s**. Includes all six selection/OS pairs cold Activity + explicit recreation/native status-bar flags, actual Settings single-choice, actual note/open dialog identity/text/selection/focus across live OS changes/Auto/background return, disabled input/cursor state, and an already-open native Spinner popup. 18 app-owned generated PNGs were pulled, then only this emulator was stopped. Existing `5562` was untouched.
- Android final development/test APK build and `lintDevelopment`: **23s, exit 0; lint 0 errors / 261 warnings**. A separate opt-in `AppearanceRestartInstrumentedTest` was driven through **five force-stop/new-process runs, 5/5 pass**: Auto→Light under OS light, persisted Light→Dark under OS dark, persisted Dark→Auto under OS light, then persisted Auto under OS dark and OS light. It observes the already initialized production Application before opening an Activity, verifies cold colors/native bars, and persists the next choice through the product API. Only the generated dev package on `5584` is force-stopped. Logs: `/tmp/mote-theme-android-final-ui.log`, `/tmp/mote-theme-process-restart.log`, `/tmp/mote-theme-android-final-build.log` (matching `.exit` files).
- Native tests distinguish package-local manual resources from the global OS, wait for the asynchronous Auto configuration callback and assert Activity identity separately from DecorView. Process restart coverage is supplied by the separate five-run driver, not inferred from Activity recreation.
- Production Web build passes. Desktop TypeScript, renderer bundle, both Swift helpers and icon packaging pass in the normal approved host environment. The initial restricted-sandbox `iconutil` invocation rejected its generated iconset; rerunning the same component build with normal approved host access passed.
- Real Electron emitted app: six preference/OS pairs with a generated OS input (mapped through the actual Electron nativeTheme), plus six independent process restarts: **12/12 pass** on the final source. Each Light/Dark/Auto choice is persisted through product IPC before its new-process read; Auto resolves a different OS input on restart. Confirms trusted synchronous preload, native color source, unchanged CSP, actual note draft/selection/focus/page and open Add dialog, atomic-save failure preserving the acknowledged state, refresh, process restart and computed increased-contrast roles on the actual body. No global macOS appearance setting was changed. Screenshots are generated fixture windows only.
- Joint existing task performed bounded read-only independent review, with no confirmed P0/P1/P2 finding. Source hashes and execution gaps were recorded in `/tmp/mote-joint-review-theme-appearance-current.md`. The review itself ran no tests or builds.

- Actual production Web UI matrix passes all six pairs in hidden Electron browser renderers: module fetch held before app execution under the real server CSP verifies canvas/background/meta color on first paint; unique cache-disabled URLs ensure a new cold request. Refresh, live media changes, cross-tab Settings changes, real controlled Login dialog and Notes draft identity/selection/focus/hash, phone widths without overflow, and emulated increased-contrast/reduced-transparency media all pass. Increased-contrast ink/muted/control/border roles are asserted from the actual root. `scripts/test-appearance-ui.cjs` uses its own loopback fixture server, not a local central instance. Initial failures were fixture session UUID, renderer initialization and cache assumptions; they did not alter product code.
- Screenshot inspection confirms the same navigation, hierarchy and spacing in both colors. Retained images: [Web Light](appearance/web-light.png), [Web Dark phone](appearance/web-dark-phone.png), [Desktop Light](appearance/desktop-light.png), [Desktop Dark](appearance/desktop-dark.png), [Android Light](appearance/android-light.png), [Android Dark](appearance/android-dark.png). Every image is a generated fixture window; no user content appears.

Final bounded source reviews cover the retained native editing-state/fixed-palette delta, opt-in process-restart guard, Desktop increased-contrast fix and final three-choice process-restart fixture, with no confirmed P0/P1/P2 (`/tmp/mote-joint-review-theme-appearance-final-delta.md`). Reviews ran no tests, builds or peer edits. The Desktop contrast regression first failed in the real renderer because body-local tokens overrode a root-only media rule; the minimal body selector fix and actual role assertions now pass. Its earlier `4b75940f` affected run was intentionally stopped (143) and retained as superseded; it is not claimed as an accepted gate. The inherited overlap-poll test also reproduced a fixed-date fixture failure: only `Date.now()` was pinned to 2026-10-15 while `new Date()` observations had advanced beyond its allowed future bound. Mocking Date consistently and advancing it by the original 20/40 minutes retains every assertion and passes the full file **17/17, zero skipped**. Production connector/SourceStore code is unchanged. The failed `f69e261f` gate was stopped and retained as `check-affected-clock-fixture`; the exact original narrow failure and corrected file logs are `/tmp/mote-theme-lark-clock-repro.log` and `/tmp/mote-theme-lark-clock-green.log`. Final `7cd9bb1b` affected checks pass as recorded above. Final Web/Electron logs are `/tmp/mote-theme-web-final-ui.log` and `/tmp/mote-theme-electron-final-matrix.log`, both exit 0.

Reproducible entry points (build first; native UI runs require normal host process access):

```sh
node scripts/generate-design-tokens.mjs --check
node --test packages/shared/test/appearance.test.mjs packages/shared/test/ui-presentation.test.mjs
node --import tsx --test apps/web/test/appearance.test.ts apps/web/test/presentation.test.ts
node apps/desktop/scripts/test-appearance.mjs
node_modules/.bin/electron scripts/test-appearance-ui.cjs
# Dedicated clean emulator only, with development/test APKs installed:
adb -s emulator-5584 shell am instrument -w -r -e appearanceFixture true \
  -e class dev.mote.collector.AppearanceInstrumentedTest \
  dev.mote.collector.dev.test/androidx.test.runner.AndroidJUnitRunner
# Fresh-process check: first force-stop the same dedicated generated dev package.
adb -s emulator-5584 shell am force-stop dev.mote.collector.dev
adb -s emulator-5584 shell cmd uimode night no
adb -s emulator-5584 shell am instrument -w -r -e appearanceFixture true \
  -e appearanceRestartExpected auto -e appearanceRestartSelect light \
  -e class dev.mote.collector.AppearanceRestartInstrumentedTest \
  dev.mote.collector.dev.test/androidx.test.runner.AndroidJUnitRunner
# Repeat after force-stop with expected:next:OSnight pairs:
# light:dark:yes, dark:auto:no, auto:auto:yes, auto:auto:no.
npm run check:affected -- --base 6272a9b51ec92cc4c32e2ff1a1eeb4fa38b142ed
```

## Boundaries

API29/30 and API31–36 do not have installed emulator images here; their resource/configuration paths are compiled but not device-run. Physical Android/OEM behavior, a physical Mac global OS-appearance change, real native system prompts/menus, actual macOS Increase Contrast/Reduce Transparency, and iOS/browser-extension apps (absent from this repository) are not claimed as tested. Android screenshot fixtures draw only this app's View tree; status/navigation appearance is additionally checked by native flags, not inferred from a canvas image. No model requests or personal-data captures were made.
