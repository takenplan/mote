# Profile and release regression journeys

Use generated accounts, credentials and data only. Local Electron fixtures run
with the repository's hidden-window harness; Android instrumentation runs on a
dedicated windowless emulator. Never collect personal screenshots or operate a
daily installation. Results below define coverage, not claims of execution.

| Journey | Required state transitions and assertions | Evidence level |
| --- | --- | --- |
| Dev build | Branch/commit → component build → SHA-named Actions artifact + build-info; no tag, Release or production package identity. | CLI/source fixtures, workflow review, platform packaging |
| Beta / stable | Exact component tag → mandatory component tests → Prod package → one attachment → prerelease true/false. Wrong tags, Dev metadata, other-component assets and altered archives fail before publishing. | Actual publisher entry with local gh fixture; real package metadata separately |
| Retry / immutability | Failed draft retry remains editable; published Release is rejected; component versions are independent and Android versionCode increases at each bump. | Release tool fixtures |
| Desktop Dev credentials | Dev build and Prod build with dev Profile → pairing → lost ACK → process termination → explicit recovery → authenticated queue → restart → logout. Every safeStorage method throws if touched; JSON is 0600, credentials never reach publicConfig/support and logout removes durable token. | Real Electron main/preload/renderer against generated loopback Central |
| Desktop storage mismatch | Old encrypted token or pending checkpoint in JSON mode; JSON token in system mode → clear error, unchanged files. Session-only login → no durable credential. | Unit and lifecycle fixtures |
| Android Dev credentials | Dev stores/reads JSON token and file-managed AES key without instantiating Keystore; encrypted private bytes retain authentication; restart preserves identity; old Dev format fails without migration. Prod/Test retain protected cipher. | JVM + generated Context instrumentation |
| Variant separation | Dev .dev/debuggable and Dev defaults; Prod original identity/non-debuggable/no fixture components; Test .test and independent fixture identities. | Gradle compilation, manifests, APK inspection and lint |
| Diagnostic defaults | New Dev enables debug/client sampling; new Prod/Test default off for extra detail. Explicit false and silent survive unrelated YAML saves and restart. Instance trace stays off and each user's trace stays opt-in. | Central config + real HTTP, client Profile tests |
| Download entry | Dev manual-download entry opens the component Actions workflow; Beta/stable use production packages and manual installation. No unsigned online update is implied. | Client unit/UI fixtures and link review |

Before a PR run `npm run check:affected`. For affected lifecycle/packaging paths,
also build Desktop, run its Dev credential journey and packaged metadata smoke,
run `npm run test:profiles` after `build:central`, and build/lint affected Android
variants. Record exact executed commands and outcomes in the PR. Rerun affected
checks after code changes; document-only edits do not require application tests.

GitHub signing-secret access and actual publication, Apple Developer ID /
notarization, real Keychain behavior, physical devices, Docker and live model
calls are separate acceptance items. Ad-hoc/generated tests cannot establish
them. Historical validation documents retain their original results.
