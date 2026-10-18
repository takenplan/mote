# Connector and recording journey parity

Baseline: `2c78ca8d52a7d17fae20962cf68d09a717ffc73a`. The comparison baseline is
`2c2627621e2598332ae8169845bc7343be7ed63e`. This record covers CONN-C01–C07;
independent review and final integration are separate gates.

## Supersession

| Disposition | Contract |
| --- | --- |
| KEEP | Existing provider transports/decoders, shared `RecordingFlow`, user selection, explicit preview/confirmation, independent extraction and review, exact transcript locators, raw exports and independent audio backup. |
| CHANGE | The account host preserves the next poll independently of one sync outcome, forwards the actual automatic origin, and enforces the original selection switch. It retains one canonical recording export/decoded full transcript rather than parallel segment producers. |
| CHANGE | A new recording source receives the existing recording recipe before first intake. Confirmed audio archive facts remain reusable across selection epochs within the same owner/source/provider identity. |
| REMOVE | Success-only polling continuation, implicit Lark document confirmation by a timer, duplicate recording segment SourceItems, and shared aggregate errors as the only UI phase explanation. |
| EXCEPTION | Stop, source privacy withdrawal, account/connection revocation, cancellation, deletion and unresolved external authorization still fence calls/publication. No old storage migration, startup repair, historical model rerun or automatic ASR is introduced. |
| UNKNOWN | Real OAuth/CLI authorization, suppliers/downloads, physical devices and model output quality require separate validation. |

The old `2c262762` native `CentralAdmin.kt` form hides `backupAudio` and writes
`true` in its recording selection (lines 106 and 783–785). Both the old and
current shared `recordings.ts` define `backupAudio:z.literal(true)`. C07 preserves
that mandatory independent backup and its existing playback/explicit-processing
controls. A switch to disable backups would be a separate product change.

## Durable generated scenarios

Fixtures enter through the production scoped app, account/configuration/plugin
routes and M05 execution. Only external provider/model transport is generated.

| Item | Scenario |
| --- | --- |
| C01 | Gmail/Google terminal 503 leaves one future poll; restart and provider recovery allow the next cycle. Existing pause/resume, stop/cancel and unknown-authorization fixtures remain required. |
| C02 | Lark and recording manual sync with selection `autoSync:false` produces no new background calls, including an already scheduled poll and restart. |
| C03 | A saved changed Lark document/folder scope is previewed while an old calendar polling chain exists; the timer does not confirm/download new bodies. Explicit sync does. |
| C04 | One multi-segment recording produces one canonical full transcript Material and exact locators, retaining original export bytes. Shorter/empty/unsupported revisions replace current speech without duplicate segment producers. |
| C05 | Recording recipe enumeration/default source binding and frozen intake recipe identities preserve the dedicated extraction and independent review contract, without overriding existing choices. |
| C06 | Changing selection and restarting reuses the same owner's exact confirmed audio original; identical provider IDs in another account cannot supply that receipt. Backup produces no automatic ASR. |
| C07 | Both provider pages show metadata failure, different transcript/audio errors and retry times, and transcript success alongside terminal audio failure after restart without provider calls. |
| C01/C02 | A non-abort-compliant recording discovery stays physically held while a new selection saves through M05; the old late result cannot publish, restart keeps the new selection, and B with equal IDs continues. A longer configured interval retains the old five-minute recording tick ceiling. |

Native Android C07 uses `CentralRecordings.kt` and
`RecordingParityInstrumentedTest.scopedRecordingPagePreservesIndependentStagesAfterRestartAndRetiresOldOwnerControls`.
Its dedicated `recording-parity-backend.ts` starts the real scoped app, creates
generated provider failures, syncs both owners and restarts before native reads.
The native case covers metadata and sibling errors/retry dates, signed 30+2
paging, explicit failed-stage retry retaining completed text, and account-switch
retirement of old controls. It reuses existing page/card/navigation/localization
patterns and changes no collector Worker or queue.

## Results

Development checks ran on Node 24.22.0 (ABI 137), using an isolated fixed-lock
`npm ci --no-audit --no-fund` installation. Server/Mem0 native SQLite environment
preflight passed. Focused results below describe development inputs based on
`abd8c4956daa0bbd41df8f484c67eb92516d5746` plus the module working tree at each
command start; subsequent summary/test changes require the final frozen gate.

| Actual command / input | Result | Evidence |
| --- | --- | --- |
| `node --import tsx --test --test-concurrency=2 --test-timeout=120000` with polling parity, source-default, recording revision parity, multiuser-connectors, recording-backup-processing and recording-reader test files | 76/76, exit 0, no skips; before final archive-summary projection | `/tmp/mote-connectors-final-server-focused.log` |
| `TSX_TSCONFIG_PATH=apps/web/tsconfig.json node --import tsx --test apps/web/test/multiuser-recording-status.test.ts apps/web/test/recordings-settings.test.ts` | 13/13, exit 0, no skips; includes restored summary | `/tmp/mote-connectors-c07-current.log` |
| `npm run typecheck -w @mote/server`; `npm run typecheck -w @mote/web` | exit 0 on development inputs | `/tmp/mote-connectors-current-typecheck.log`, `/tmp/mote-connectors-web-typecheck.log` |
| Generated Android backend startup/sync/restart/API smoke; `node scripts/check-i18n.mjs` | exit 0; 8641 bilingual messages | `/tmp/mote-android-recording-parity-api-smoke.log`, `/tmp/mote-android-recording-parity-i18n.log` |
| `node --import tsx --test --test-name-pattern='during an admitted media' apps/server/test/multiuser-recording-revision-parity.test.ts` | 1/1, exit 0; copied public provider metadata cannot impersonate the trusted backup format | `/tmp/mote-connectors-forged-metadata-focused.log` |
| `node scripts/check-scope-contracts.mjs` | exit 0 after inventory/import declaration and owner-bound archive-count adapter | `/tmp/mote-connectors-scope-contracts-final.log` |
| `node --import tsx --test --test-name-pattern='three-paragraph\|persists promptly\|five-minute' apps/server/test/multiuser-recording-revision-parity.test.ts apps/server/test/multiuser-connector-polling-parity.test.ts` | 5/5, exit 0; final summary/selection adapters | `/tmp/mote-connectors-summary-selection-focused.log` |
| `TSX_TSCONFIG_PATH=apps/web/tsconfig.json node --import tsx --test apps/web/test/multiuser-recording-status.test.ts` | 2/2, exit 0; final owner-bound summary adapter | `/tmp/mote-connectors-freeze-web.log` |

The exact six-file Server command was:

```sh
node --import tsx --test --test-concurrency=2 --test-timeout=120000 \
  apps/server/test/multiuser-connector-polling-parity.test.ts \
  apps/server/test/recording-source-default.test.ts \
  apps/server/test/multiuser-recording-revision-parity.test.ts \
  apps/server/test/multiuser-connectors.test.ts \
  apps/server/test/multiuser-recording-backup-processing.test.ts \
  apps/server/test/multiuser-recording-reader.test.ts
```

Earlier fixture attempts failed on an incorrect recipe/member response shape,
an upload observation older than the current head, and the real missing
`extracted-text` producer dependency. Those were corrected and rerun. An initial
Web command without its workspace JSX tsconfig failed before the corrected run.
The receipt history is retained rather than relabeled as a successful attempt.
An initial scope check also detected the new count query outside `PrivateSql`
and undeclared handler/import surfaces; the final implementation uses the
existing owner-binding gateway and explicitly inventories its two handlers.

Memory's minimal default/installation dependency is original
`c6e1e48f92b5eea549cfc079dab3b7709ce3113c`, cherry-picked as `abd8c495` here.
The necessary complete nonempty `extracted-text` producer declaration is isolated
as `e84b8bb72ac195e047d9a590eec7221b9ffcfdcb`; it preserves existing extraction
receipts and the recording recipe's fingerprint.

Android Gradle/APK/emulator and final `npm run check:affected` are **UNRUN** while
waiting for the integration driver's resource slots. They are required before
the module PR. Real supplier/model and physical-device checks remain unperformed.
