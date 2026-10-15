# UI presentation rollout ledger

Date: 2026-10-15. Base: `9798e01cdce3b9ca26b9a86e6071186d8859c402`. Branch: `codex/ui-presentation-linear`.

The owner approved implementation, verification, fixes and a PR after regression. Merge and release are outside this request. [The accepted ADR](../adr-ui-presentation-packs.md) records the selected structure/visuals and supersession. [The readiness audit](ui-extension-readiness-2026-10-15.md) records the starting state.

| Package | Dependencies and completion criterion | Status |
| --- | --- | --- |
| U0: adoption | Approved structure A and visual A; capability map and supersession | Recorded and reviewed |
| U1: shared boundary | U0; versioned theme/layout, atomic activation, platform consumers, alternative-provider regression | Implemented; shared and platform replacement/removal regressions pass |
| U2: Web standard journey | U1; real import → formal material → source/activity/evidence → return, long text and unknown/error states | Actual hidden renderer journeys pass |
| U3: native pilots | U1; Mac local/central facts, Android native lifecycle and actual provider consumption | Mac startup/IPC/HTTP and Android windowless instrumentation pass |
| U4: default migration | U2/U3; all retained destinations, semantic components, old links, translations, responsive/dark surfaces | Implemented; independent review fixes and focused regression pass |
| U5: PR | U4; independent fixes, `check:affected`, targeted UI regression and evidence | Checks passed; prepared for PR |

## Capability migration map

| Existing capability | Destination and preserved boundary |
| --- | --- |
| Formal materials, original records, fragments, files/recordings, Memory, application activity/media | Existing Library / Content views. Default formal-material scope does not expand to raw records or Memory. |
| Notes, one-time import, continuous folder sync, screen recording | Existing add actions and auxiliary Home; original confirmation, scope and native picker behavior. |
| File/calendar/recording/mail/Coding/MCP/external connections and source descriptions | Sources and existing platform-specific pages. Local capture stays local; description edits do not authorize historical processing. |
| Work and recovery | Primary Activity backed by WorkActivity facts and links to owning workflows; local sending stays distinct from central processing. |
| Technical processing, upload receipts and application-use statistics | Existing technical/advanced pages, preserving their meaning. |
| Ask, conversations, citations and actual Agent reads | Existing Ask/evidence interfaces with drafts, versioned identity, privacy and return behavior. |
| Models, plugins/Memory plans, storage/encryption/backup, usage, diagnostics, connection, language/update | Existing settings and task entries. Policies and credentials remain unchanged. |
| Today/Home, insights, actions and complete discovery | Auxiliary Home and existing tools/catalog; no capability deleted to simplify navigation. |

## Executed evidence

These are the final local results for the frozen implementation. Fixture results do not imply physical-device or live-model validation.

- Shared focused regression: atomic selection, missing-version rejection, immutable data roles, executable/resource theme rejection, complete core destinations and active-provider disposal fallback.
- Server Activity: 9 tests passed, including exact material/source identity, same-title exclusion, capture/import membership, original deletion, pagination after filtering, no private original in responses, collector rejection and invalid scope rejection. Existing thousand-job metadata regressions remain passing.
- Web production build and hidden Electron scripts `test-web-presentation.cjs` and `test-web-feature-packs.cjs` passed. Actual generated TXT import proceeds through formal material, original reader, exact related Activity and return; Coding discovery proceeds from the visible Sources card to sync status and advanced receipts. Dark desktop, 390px and 320px layouts and 26/29 route probes pass. Evidence: ignored `.mote/ui-presentation/` and `.mote/feature-packs/`.
- Mac production build (TypeScript, renderer and native helper) and all three hidden Electron scripts passed: `workspace-presentation-smoke.cjs`, `ui-smoke.cjs`, `sync-history-smoke.cjs`. They exercise real startup/preload/IPC/HTTP, generated long originals, exact work identity through a one-use login ticket, paging, failures, late-response logout fencing, configuration drafts, offline notes, native picker stubs and return behavior. Capture remained stopped. Final full desktop test suite: 455 passed. Evidence: ignored `.mote/ui-default/` and `apps/desktop/release/`.
- Android: 326 JVM tests passed; development APK/test APK and lint passed (0 errors, 265 warnings). Four actual `NativeUiPackInstrumentedTest` journeys passed together on the frozen production APK using a dedicated windowless API 37 arm64 emulator and fresh generated central fixture: default Content/four destinations/auxiliary Home/deep links/rotation; Work Activity → result → read-only native conversation → Ask draft; central source and execution/API Key editor preservation; local sensitive drafts and independent provider removal. Screenshot evidence includes default Content, populated Activity, actual result and preserved central source selection. Local evidence: `/tmp/mote-ui-pack-06bf-evidence/`.
- Independent read-only review of shared/server boundaries, Web/Mac failure recovery and Android same-tree refresh found no remaining blocking defect after the regressions below were fixed. Review does not substitute for the executed fixtures.
- Final `npm run check:affected` passed with JDK 21 and the local Android SDK. It includes 8,250 bilingual messages/catalog synchronization, all workspace type checks, Mac 455, server 1,836, Web 392, Agent 312, diagnostics 5 and shared 187 passing tests; server and Agent each retain one opt-in skip. Root tool/security/backup tests passed 80/80, CLI 4/4 and the central runner fixture passed. Android debug JVM tests passed 326/326 with no failures/errors/skips. Final full log: ignored `.mote/ui-default/check-affected-final-rerun.log`.

UI verification uses generated content, independent profiles and hidden Electron windows or a dedicated windowless emulator. The Android fixture server, reverse mapping, emulator and temporary AVD were removed after verification; its crash buffer was empty. Android wide-screen rail/detail mapping has code/JVM coverage, but wide-screen interaction was not exercised. Physical devices, personal captures, foreground permission prompts, real model calls and release packaging/signing were not exercised and are not inferred from fixtures.

## Independent review and durable regressions

| Confirmed issue | Resolution and regression |
| --- | --- |
| A presentation observer could throw after selection committed, preventing other subscribers from seeing that selection | Shared host isolates observer failures, returns them explicitly and continues notification; focused regression verifies one consistent committed snapshot. |
| Failed Mac renderer setup could leave listeners and subscriptions behind before returning a dispose handle | Host-owned mount scope provides signal/listen/effect; abort and registered cleanup precede fallback. Partial setup, update/dispose failure and stale commands have explicit tests. |
| Mac work cards opened Activity without preserving the selected work identity | Separate validated `openWorkActivity(workId)` IPC enters the exact work via the existing one-use login exchange; actual renderer/main/HTTP fixture verifies encoded work identity and rejects invalid/mixed references. |
| Removing the duplicate work collection also orphaned Coding receipt discovery | Sources now resolves to the existing Coding status collection; Activity advanced renders receipt detail. The real discovery journey clicks the Sources card rather than relying on a manually assembled hash. |
| Changing related-activity scope could carry a previous page cursor | Scope changes reset paging and exclude the old cursor from the actual read; focused UI regression covers the second-page transition. |
| A syntactically date-shaped but impossible day in a library link could crash the collection | Calendar validation leaves invalid scope visible and recoverable, without issuing a widened request. Invalid month/day, malformed text, clear-and-recover and valid leap-day reads are covered. |
| Android theme changes recreated central editors whose drafts were local to the existing View tree | Theme/layout now refresh the same native tree and open dialogs. Instrumentation verifies central source name/retention/enabled/focus/selection, central execution settings/API Key and local sensitive drafts without saving them or serializing secrets into Bundle. |
| Saved-answer citations in Android Activity assumed every reference was a capture | Standard typed evidence dispatch preserves capture, material, Memory and artifact identities; JVM regression covers the saved citation namespaces. |
| Full regression exposed an existing long-article fixture race with the periodic organizer | A controlled in-flight organizer reproduced cursor 40/target 80 after `await tick()` returned without joining. The fixture now waits for the durable cursor and latest publication before asserting bounded text and all original reads. Production organizer behavior is unchanged; the focused file passes 3/3. |
