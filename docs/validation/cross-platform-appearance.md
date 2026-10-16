# Cross-platform appearance validation

This record uses generated data only. No local central configuration, private database, captured screenshot or derived personal content is used. Theme behavior requires no model requests.

Base `6272a9b51ec92cc4c32e2ff1a1eeb4fa38b142ed`; independent branch `codex/mote-cross-platform-theme`. [Decision](../adr-cross-platform-appearance.md).

## Finite acceptance matrix

For each actual UI (Web, Electron, Android), cover all six selection/OS pairs. Each pair checks first/cold frame, restart/refresh, live OS change, an open modal with an unsaved field, and native controls/chrome. Pairwise route coverage includes settings, navigation, reader/code, forms, menus/dialogs, errors/disabled/focus/selection and status/chart roles. There is no iOS or browser-extension UI to run.

| Selection | OS light | OS dark | OS live change | Back to Auto |
| --- | --- | --- | --- | --- |
| Light | Light | Light | Retains Light | Immediately adopts current OS |
| Dark | Dark | Dark | Retains Dark | Immediately adopts current OS |
| Auto | Light | Dark | Immediately adopts new OS | Already follows OS |

Additional failure/lifecycle cases: missing/corrupt/rejected Web storage; Web cross-tab preference; background return; native profile restart; Android uiMode with draft/focus/selection; open modal retained; generated tokens synchronized; ordinary text >=4.5:1 and required controls >=3:1; no page overflow on phone widths. No navigation/editor remount or model/capture request is expected from an appearance change.

## Executed

- TDD: three-state resolver test first failed due to missing implementation, then passed. Shared resolver/live-change tests and generated-token presentation contract tests pass.
- Web narrow tests: blocked/corrupt storage, six-state first-paint bootstrap, cross-tab/resume, stable actual textarea/selection/focus/hash/open modal, and React presentation/draft lifecycle pass.
- Palette checks: both built-in palettes pass semantic text/status/selection pairs at 4.5:1 and control outlines at 3:1.
- `check:i18n` passes with synchronized English/Android catalog. Web and Desktop type checks pass after building their required shared declarations.

- Android: installed JDK21/SDK37 emulator; offline debug JVM suite **331/331, zero skipped**; development app and instrumentation APKs compiled. Dedicated clean read-only no-window emulator `5584` (own data/cache, API37) ran `AppearanceInstrumentedTest`: **4/4 pass, 16.872s**. Includes all six selection/OS pairs cold Activity + explicit recreation/native status-bar flags, actual Settings single-choice, actual note/open dialog identity/text/selection/focus across live OS changes/Auto/background return, and an already-open native Spinner popup. 18 app-owned generated PNGs were pulled, then only this emulator was stopped. Existing `5562` was untouched.
- Android fixture corrections were assertions, not product changes: package-local manual appearance intentionally keeps process resources fixed while the global OS changes; Android can reuse DecorView across Activity recreation; clearing a package override delivers an asynchronous configuration callback. The final test waits for that callback and asserts the new Activity identity where recreation is requested.
- Production Web build passes. Desktop TypeScript, renderer bundle, both Swift helpers and icon packaging pass in the normal approved host environment. The initial restricted-sandbox `iconutil` invocation rejected its generated iconset; rerunning the same component build with normal approved host access passed.
- Real Electron emitted app: six preference/OS pairs with a generated OS input (mapped through the actual Electron nativeTheme), plus six independent process restarts: **12/12 pass**. Confirms trusted synchronous preload, native color source, unchanged CSP, actual note draft/selection/focus/page and open Add dialog, atomic-save failure preserving the acknowledged state, refresh and process restart. No global macOS appearance setting was changed. Screenshots are generated fixture windows only.
- Joint existing task performed bounded read-only independent review, with no confirmed P0/P1/P2 finding. Source hashes and execution gaps were recorded in `/tmp/mote-joint-review-theme-appearance-current.md`. The review itself ran no tests or builds.

- Actual production Web UI matrix passes all six pairs in hidden Electron browser renderers: module fetch held before app execution under the real server CSP verifies canvas/background/meta color on first paint; unique cache-disabled URLs ensure a new cold request. Refresh, live media changes, cross-tab Settings changes, real controlled Login dialog and Notes draft identity/selection/focus/hash, phone widths without overflow, and emulated increased-contrast/reduced-transparency media all pass. `scripts/test-appearance-ui.cjs` uses its own loopback fixture server, not a local central instance. Initial failures were fixture session UUID, renderer initialization and cache assumptions; they did not alter product code.
- Screenshot inspection confirms the same navigation, hierarchy and spacing in both colors. Retained images: [Web Light](appearance/web-light.png), [Web Dark phone](appearance/web-dark-phone.png), [Desktop Light](appearance/desktop-light.png), [Desktop Dark](appearance/desktop-dark.png), [Android Light](appearance/android-light.png), [Android Dark](appearance/android-dark.png). Every image is a generated fixture window; no user content appears.

Final bounded delta review also reports no new confirmed P0/P1/P2 finding (`/tmp/mote-joint-review-theme-appearance-final-delta.md`), with hashes of the four changed lifecycle files. Full affected gates remain pending.

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
npm run check:affected -- --base 6272a9b51ec92cc4c32e2ff1a1eeb4fa38b142ed
```

## Boundaries

API29/30 and API31–36 do not have installed emulator images here; their resource/configuration paths are compiled but not device-run. Physical Android/OEM behavior, a physical Mac global OS-appearance change, real native system prompts/menus, actual macOS Increase Contrast/Reduce Transparency, and iOS/browser-extension apps (absent from this repository) are not claimed as tested. Android screenshot fixtures draw only this app's View tree; status/navigation appearance is additionally checked by native flags, not inferred from a canvas image. No model requests or personal-data captures were made.
