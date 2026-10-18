# Configuration parity: native Android consumers

Scope: the necessary native consumers of CONFIG-C01, CONFIG-C04 and CONFIG-C06,
plus the existing text-recognition settings entry's revision-bearing Files API
adapter. This does not change capture, permissions, privacy, lifecycle policy or
the host's model ownership rules.

| Disposition | Native behavior |
| --- | --- |
| KEEP | Original model settings location, profile editing/copy/deletion, native parameter controls, private credential status, explicit target-change decision, unsaved draft inspection, connection tests with generated evidence, feature defaults, and ConfigService revision/CAS. Existing text-recognition entry remains in extensions. |
| CHANGE | Personal profile drafts use the scoped catalog/probe API before saving; each personal feature reference may carry its own model. Text-recognition saves send `{revision,settings}` and display selected model metadata; settings exposes the same named entry. |
| REMOVE | Full models-domain JSON as the ordinary profile editor; mandatory save before inspecting a personal draft; dropping personal model overrides on default saves. |
| EXCEPTION | Shared resources remain fixed references with no editable transport, copied credentials or caller model override. A referenced personal preset cannot be deleted until its feature defaults are changed. |
| UNKNOWN | Native compilation, JVM execution and emulator instrumentation are **UNRUN at this module handoff**, pending the coordinated driver slot. Physical-device and live-provider behavior are unverified. |

`CentralAdmin.kt` uses the existing native field, spinner, checkbox, card, dialog
and task controls. Redacted secrets remain hidden; blank fields preserve their
same-profile status, explicit clear uses empty values, and replacements carry the
entered value. A changed provider/protocol/URL with retained credentials requires
the existing explicit confirmation before catalog, probe or save. Shared catalog
and probe calls carry only the fixed reference.

The native task host already captures navigation, foreground and account epochs.
Each editor additionally checks its captured owner/navigation and exact draft
before displaying catalog/probe results or returning from a save. A late accepted
save may finish on the server after navigation; its response cannot reopen the
retired editor. Feature connection changes clear the previous model override;
initial rendering and the same connection retain it. Shared choices disable the
model input and serialize no override. Profile/default edits preserve the entire
remaining personal configuration, credentials and unrelated selections. File
processing settings continue to omit the optional models update, preserving
existing model configuration.

Focused JVM scenarios in `CentralModelConfigurationTest`:

- Target changes with each retained credential, explicit replacement and clear.
- Revision-bound draft catalog/probe requests without configuration writes.
- Independent feature models on one personal connection and fixed shared refs.
- Immutable profile replacement, unrelated settings and credentials, and CAS.
- Rejection of a directory result after the account transport retires.

Actual native instrumentation uses the production scoped listener from
`apps/android/test-fixtures/multiuser-imports-backend.ts --models`. Only provider
HTTP replies and fault gates are generated. The fixture's model-only hold/release
controls cover directory, probe and configuration-save responses.

| Instrumentation method | Journey |
| --- | --- |
| `nativePersonalModelDraftsAndFeatureModelsPreserveOriginalJourney` | Native draft directory/probe before save; no effective configuration change; target reuse cancel/confirm before provider I/O; save; two personal feature models without copied credentials; fixed shared selection; held probe/save navigation retirement; B unchanged. |
| `actualNativeModelSettingsUseTheOwnedDomainAndPreserveMaskedCredentials` | The dedicated original editor changes a profile name while preserving masked credentials, defaults and B's settings. This replaces its obsolete full-domain JSON-editor assertion. |
| `originalNativeModelsCopySavedSecretsProbeAndReadFullDirectoryWithoutCrossingAccounts` | Existing copy-with/without-credentials, actual synthetic tool probe, complete provider catalog and held catalog across account switching. |
| `originalNativeFeatureDefaultsCanBindAndClearUnconfiguredChatWithoutDroppingUnavailableReferences` | Existing bind/clear behavior, explicit unavailable references, preserved unrelated defaults and retired-account controls. |

The integration driver records commands, variant, frozen SHA, exit statuses and
evidence paths separately. No native pass, screenshot, physical-device result or
live-model result is claimed by this source/test handoff.
