# Configuration resource consumer handoff — 2026-10-18

This extension restores the existing Web Images/File and Voice cards and the
necessary native settings consumers. It introduces no format migration, model
selection fallback, automatic download, historical confirmation or new privacy
default. The closest existing patterns are `PerceptionSettings`,
`FileProcessingSettings`, `ScopedStorageSettings` and the native field/spinner/
checkbox/card controls. Derived services remain read-only metadata. Installation
does not select a personal model, enable processing or confirm history.

## Inspected production inputs

| Owner | Exact inspected head | Consumer contract |
| --- | --- | --- |
| Files | `192110c226a21f2f22b44a4f8ef61bb53c6200a9` | `scope/processing-perception.ts`, `scope/media-assets.ts`, actual generated startup `test/fixtures/scoped-media.ts` |
| LIFE | `c0bf80d6f884c0cde15ab40bfff6cc9c8197b962` | `scope/storage-settings.ts` saved/effective administrator CAS contract |
| Ask | `e23c06a3f3ea30a5d844fbadb76de0475b17246b` | Optional `embedding` feature/label and account `allowQueryImages` read port |

These inputs are read from Git, not merged into the independent Configuration
worktree. Files' earlier `f4618a5a` is superseded because its public history
progress exposed global positions. Files may publish a test-only successor;
the driver must record the actual final SHA and complete combination tree.
The inspected `scoped-media.ts` SHA-256 is
`7bef27cb4342501ea57418d04af2c603269fae327750aaa1de32dc6848bc7e45`.

The Files delta in `apps/server/src/scope/configuration.ts` adds exactly one
`forUser(...).modelDescriptor(feature, explicit?)` member. It resolves the
current account's explicit/default reference and returns metadata
`{reference,provider,model,baseUrl}` under the existing account/resource fences.
Keep this hunk when resolving that file against Configuration's Codex/Usage
changes. It creates no second model runtime or access to credentials. LIFE also
changes that file for its owned lifecycle flow; preserve those separate hunks.
Do not replace the whole file with any owner's version. The shared model feature
enum comes from Ask; Configuration already renders `MODEL_FEATURES` dynamically.
Merge English catalog keys by key and keep Android's catalog identical.

## Permissions and state transitions

| Surface | Ordinary account | Administrator |
| --- | --- | --- |
| Images settings | Own complete revision-bearing save; profile reference; concurrency, disclosure and processing flags | Same own settings |
| History | Own source/date/mode preview; explicit opaque-token confirmation; no cursor/watermark | Same own history |
| Model health | Safe OCR/ASR/speaker status, progress, error and runtime readiness | Same safe status |
| Install/cancel | No controls; producer returns 403 | Explicit `/api/admin/media-models/:role/install` or `/cancel` |
| Retention/capacity | Existing own content encryption only; producer returns 403 for instance storage | `/api/admin/storage-settings` CAS; saved/effective and restart/invalid feedback |

Media states stay distinct: not installed, downloading, verifying, installing,
failed, cancelled and installed. Installed with `runtimeReady:false` remains
waiting for its Worker or dependencies. No state is fabricated on read errors.
History displays actual failed/blocked/cancelled/stale results and queued counts.
Changing settings or range retires a displayed or in-flight preview. Local date
ends use the following local midnight, including daylight-saving transitions.
Capacity conversion preserves exact bytes when only retention changes.

## Coordinated commands — not yet executed

Q009 remains the driver's sole full gate. Run the following only in its released
window and fixed combined worktree, with its existing worktree-local dependencies
and validated Node/JDK runtimes. Do not bypass the mandatory affected gate or
treat any dry-run as a pass. Shared English/Android catalog changes select all
TypeScript workspaces, i18n, root/scope/tooling checks and Android unit tests.

```sh
npm run check:affected -- --base 2c78ca8d52a7d17fae20962cf68d09a717ffc73a
```

After the combination's Web build, run the hidden production resource journey:

```sh
MOTE_WEB_FIXTURE_NODE=/opt/homebrew/Cellar/node/26.11.1/bin/node node_modules/.bin/electron apps/web/test/parity-configuration-resources-browser.cjs
```

It starts the actual scoped app through the Files-owned `scopedMediaFixture`,
logs in through the production cookie flow, seeds two generated image originals
per account through ingress, and uses generated installer bundles/worker
transport. A loopback proxy only records requests and optionally delays the
exact image-save response; it does not alter producer DTOs. The flow verifies
image CAS, A/B settings/history, source/date preview before confirmation, actual
durable history, safe non-admin status, Ask's optional embedding selector,
explicit admin OCR cancel/resume and Worker readiness, actual ASR hash failure
and recovery, optional speaker installation, and LIFE's saved/effective storage.
Expected output is `.mote/parity-configuration-resources-browser/result.json`
and `images-personal.png`, `ocr-administrator.png`, `audio-administrator.png`,
`storage-administrator.png`. A failure writes `failure.json`; inspect it and
rerun only after fixing the recorded combination inputs. All images are
generated fixture UI, never personal captures.

Compile and run native JVM tests/builds with JDK 21:

```sh
apps/android/gradlew -p apps/android --no-daemon -Pmote.testBuildType=multiuserFixture :app:testDebugUnitTest :app:assembleMultiuserFixture :app:assembleMultiuserFixtureAndroidTest
```

For resource instrumentation, start a **fresh** generated host independently of
the completed browser run. Create the output directory first; keep this file
outside source control because it contains generated session credentials.

```sh
node --import tsx apps/server/test/fixtures/configuration-resources-browser.ts --output /tmp/mote-configuration-resource-host.json
```

The emitted JSON includes `resourceFixture:true`, `port`, `controlPort`,
`androidAddress`, `androidControlAddress` and generated A/B/admin tokens. For a
windowless SDK emulator, reverse `tcp:port` and `tcp:controlPort` to the same host
ports, then push the unchanged JSON to
`/data/local/tmp/mote-configuration-resource-host.json`. Install
`app/build/outputs/apk/multiuserFixture/app-multiuserFixture.apk` and
`app/build/outputs/apk/androidTest/multiuserFixture/app-multiuserFixture-androidTest.apk`
from `apps/android`, then run:

```sh
adb -s "$emulatorSerial" shell am instrument -w -r -e fixture /data/local/tmp/mote-configuration-resource-host.json -e class dev.mote.collector.ConfigurationResourcesInstrumentedTest dev.mote.collector.m15fixture.test/androidx.test.runner.AndroidJUnitRunner
```

The class requires the isolated fixture package and SDK emulator fingerprint.
Its three methods cover image preview/draft retirement and held-save A/B
switching, administrator OCR/ASR/speaker lifecycle, and saved/effective storage
permissions. Set the emulator timezone to Asia/Shanghai to match the browser;
the pure JVM test separately covers America/New_York daylight-saving dates.
Stop the fixture with SIGTERM and remove its generated credential JSON when
finished. No heavy install, emulator, browser or native run has been performed
for this extension at handoff.

The original model-native scenarios remain required separately, using
`apps/android/test-fixtures/multiuser-imports-backend.ts --models` and the four
methods recorded in the [native parity record](configuration-native-parity-2026-10-18.md).
That fixture prints address/controlAddress metadata; the driver maps those
ports to `androidAddress`/`androidControlAddress` before pushing its fixture JSON.

## Evidence boundary

Author checks on this extension are Web TypeScript, focused generated component
regressions, i18n synchronization, syntax checks and diff review only. Exact
commands, results, source hashes and frozen module head belong in the external
module manifest. Combined startup, resource browser, JVM compilation/execution,
emulator, affected gate and PR are **UNRUN / pending the driver window**.
The earlier `79bf9610` model/Usage checks remain historical evidence for their
exact inputs and cannot establish these new resource consumers. No physical
device, live supplier, real model download or personal screenshot is used or
claimed. READY requires the frozen combination, its successful gate, actual
consumer journeys and explicit reporting of any remaining gap.
