# Native originality continuation: independent evaluator

Date: 2026-10-13. Scope: macOS and Android candidates, with Central Web retained
as the visual and capability reference. The prior
[five-round evaluator ledger](ui-iteration-evaluator-2026-10-13.md) remains intact.
This document records the owner's stricter native originality target and the
subsequent independent evidence. The evaluator does not edit production code.

Historical `/tmp` paths below record the earlier review environment. Those
temporary directories have since been removed; their selected generated PNGs
and evaluation documents are retained in the frozen offline artifact. Current
continuation evidence uses `.mote/ui-continuation/`, as recorded at the end.

## Fixed criteria and new acceptance target

Retain the same five separate criteria: **Design quality**, **Originality**,
**Craft**, **Functionality**, and **First-look clarity and key-feature
completeness**. The first four preserve the original
[Anthropic method](https://www.anthropic.com/engineering/harness-design-long-running-apps);
the fifth is the owner's addition. Design quality and originality keep their
qualitative emphasis. There is no weighted aggregate or compensating average.
The anchors and unconditional blockers from the prior ledger still apply.

The owner now requires native Originality **strictly greater than 7**. On this
review's half-point scale, 7.5 is the first passing score. The other native floors
are Design quality ≥ 8, Craft ≥ 8.5, Functionality ≥ 8.5, and first-look
clarity/completeness ≥ 8.5. These are the owner's new targets, not thresholds
prescribed by the article. The new target supersedes the previous local
Originality ≥ 7 target for this continuation; it does not rewrite historical
scores or turn a previous 6.5 into a pass.

Scores require actual candidate evidence. A standalone HTML preview can support
the owner's design decision but cannot establish native functionality, native
layout adaptation, authorization, or lifecycle behavior. Scores remain informed
reviewer judgment rather than measured first-time-user comprehension.

| Selected baseline | Design quality | Originality | Craft | Functionality | Clarity/completeness |
| --- | --- | --- | --- | --- | --- |
| Web Round 5 | 8 | 7.5 | 8.5 | 8.5 | 8.5 |
| Mac Round 5 | 8 | 6.5 | 8.5 | 8.5 | 8.5 |
| Android Round 5 | 8 | 6.5 | 8.5 | 8.5 | 8.5 |

Native evidence and validation boundaries for these scores are in the prior
ledger. They are not fresh candidate checks.

## Why the native baseline remains generic

The generated Round 5 Mac Home image is
`/tmp/mote-native-ui/round-5/first-run-ui-fixture.png`. A large introductory block,
four equal white tiles, a separate retrieval strip, another sync strip, and
repeated Recent Content / Automatic Sources cards create a competent dashboard.
The relationships between saving, provenance, recovered originals, and central
processing are explained by copy but barely govern the composition. Distinct
icons and the Slate palette improve craft without making the page unmistakably
an evidence archive.

The generated Android Home image is
`/tmp/mote-native-ui/round-5/android/home.png`. Its large title and introduction,
2 × 2 white action panel, detached recovery links, rounded sync pill, and later
cards have the same limitation. The screen could belong to many file or utility
apps after replacing its labels. Large independent blocks consume the first
view; source and original-content relationships appear later.

The next direction should change the relationship and rhythm of these elements,
not merely decorate them. Adding numbers, a blue stripe, unusual icons, or a
different font to the same card arrangement does not by itself warrant a score
strictly above 7.

## Candidate direction: one archive folio

Use the established Slate tokens, accepted action-first navigation, evidence
list/detail pattern, and source-state vocabulary. The closest existing patterns
are Web's compact original-evidence rows and catalogue, native Content's real
source/body reading, and the four peer Add actions. Depart from repeated separate
Home cards because that composition still obscures the relationship between
input and recovered original content.

1. Compose intake as four equal, compact, indexed rows in one ruled frame.
   Indices identify categories; they must not imply an ordered setup procedure.
   Every row retains the actual action label, description, and direct route.
2. Relate those inputs to a local-content ledger through shared alignment,
   typography, and a compact recovery pair. The four save actions remain peers;
   one must not acquire a new product priority or become a prerequisite.
3. Let actual provenance carry the visual identity: source, observation/save
   time, and original excerpt in a consistent evidence gutter. Use the same
   reading hierarchy in populated Content and note detail. Empty content occupies
   the corresponding list structure without invented examples or counts.
4. Keep the local-save / central-receipt / actual-processing boundary compact but
   explicit. Use real state. An archive folio must not look like a completed
   pipeline when processing is unknown, and a saved count must not imply index
   readiness.
5. Adapt the composition to the platform. Compact the Android introduction so
   four rows remain usable at 320dp and 130% English text. Mac can use its wider
   space to connect intake and recovered content. Preserve ordinary native
   permission and picker controls.

The identity should survive a generated empty state and a saved real fixture
note. A striking empty Home alone is insufficient if populated Content falls
back to unrelated stock cards or original-body reading becomes harder.

## Scope and supersession check

| Classification | Disposition |
| --- | --- |
| KEEP | Native Home / Content / Ask, four peer save actions and their routes, all supported feature paths, local saving without central connection, true provenance and state, explicit permissions/privacy, draft/return/focus/lifecycle behavior, Slate colors and translations. |
| CHANGE | Native composition, alignment, type hierarchy, truthful empty/populated presentation, and the visual connection between input and recovered original evidence. The new originality threshold applies to subsequent candidates. |
| REMOVE | Redundant visual containers or repeated presentation only; no supported action, old route, original evidence, status distinction, or product policy. |
| EXCEPTION | Central Web and native clients retain their different responsibilities. Android's supported-native capability menu is not Web parity; native permissions and pickers remain platform controls. |
| UNKNOWN | Real-user comprehension, physical-device permissions/OEM background behavior, external accounts, live-model quality, and native modal behavior not exercised in the background fixture. |

Architecture and behavior remain governed by [Slate](../ui-slate.md),
[client navigation](../client-navigation.md), and the
[action-first ADR](../adr-client-action-first.md). No new product policy is
approved by this evaluator contract.

## Evidence and decision workflow

Review candidate screenshots first, then independently choose actions from the
actual running generated fixture. Use hidden Electron/CDP and the dedicated
headless development emulator; never show or focus a window, launch a visible
browser, capture personal screens, or relax Android `FLAG_SECURE`. Android
images come from the application's own generated view tree; UI trees may support
independent transitions. Keep generated credentials private and temporary.

For each candidate record its exact source/build state, locale/viewport, screenshot
paths, chosen transitions, state/result/return observations, five scores, concrete
critique, and refine/pivot/retain decision. Include empty and populated states,
local note save → Content → exact original, a disconnected restriction, and
narrow English / keyboard evidence. Separate generator automation from evaluator
interaction, and distinguish backend-free preview simulation from native behavior.

Any changed native composition or behavior supersedes the previous build's UI
checks for that affected surface. Keep previous results as history, identify the
checks that must be repeated, and record missing evidence rather than carrying a
functional or craft score forward. Final before/after comparison must use the
same rubric and state limitations explicitly.

## Candidate ledger

### Candidate A — Mac archive folio

Source/build state: the parent's real Round 6 Mac build, held unchanged during
review on 2026-10-13 in an isolated hidden generated profile. The parent reports
a fresh complete hidden `ui-smoke` pass; that is generator automation, separate
from the interactions below. Parent images:
`/tmp/mote-native-originality/round-6/mac/`. Evaluator scene manifest:
`/tmp/mote-ui-eval/mac-originality-candidate-a-scenes/manifest.json`.

| Platform/candidate | Design quality | Originality | Craft | Functionality | Clarity/completeness |
| --- | --- | --- | --- | --- | --- |
| Mac A, provisional | 8.5 | 7.5 | 8 | 8.5 | 8.5 |

Originality now passes the stricter target because the composition has changed
across the real journey. Home joins purpose, four peer inputs, recovery, real
state, and local content in one archive sheet. Add uses the same ruled input
ledger. Content replaces independent badges/cards with a type gutter, body and
actual source/time; the note editor and original detail carry the paper-reading
hierarchy. The design no longer depends only on new icons or an ornamental
stripe. It remains restrained rather than exceptional; do not assign a 9 simply
because it clears the target.

Independent choices: empty Home → Quick Note → type and save
`Generated Mac folio evaluator note. The saved original must retain this exact sentence.`
→ Content → its exact original → close → Settings → prepare the generated fixture
in English → Add at 820 × 620 → close → Content → Ask. Local saving succeeded
without a central URL. The detail body was exact, focus moved to its heading,
and the state said it was saved locally without central receipt. Disconnected
Ask explained the limitation, hid the inaccessible workspace/login, and offered
Connection Settings. English Add exposed all four peer actions in the modal;
the actual note row's source/time metadata fit and wrapped without page overflow.

Locale preparation used the actual isolated-profile preload language API and its
real renderer reload. Native language-confirmation interaction was not exercised,
so this is not an additional native-modal pass. The evaluator then captured 24
actual product scenes: Chinese and English × normal 1140 × 808 / compact
820 × 620 × populated Home, Add, unified Content, original reader, note composer,
and disconnected Ask. These repeat already observed real transitions for the
comparison artifact. Each scene has state/locale/viewport evidence in its JSON.
The generated note remains saved; its editor draft is empty. Viewport override
and Chinese locale were restored before releasing the parent's owned fixture.

Craft remains below the new floor because the new English type gutter does not
contain long unbroken labels. An explicitly temporary layout probe on the actual
visible Content row at 820px measured “Notifications” at 68.4px and “Coding
conversation” at 68.9px against a 54px gutter. The inherited flex centering pushes
text toward both edges; `overflow-wrap` and `word-break` remain normal. “Quick
notes”, “Page capture”, and “App activity” wrap at spaces. The probe restored the
original label. It proves rendered label geometry, not an actual saved record
of each source; it is excluded from the owner artifact's 24 actual scenes.
Probe evidence: `/tmp/mote-ui-eval/mac-originality-candidate-a-type-label-probe.json`.

Decision: **refine**, not accept yet. Contain unbroken translated labels within
the new gutter and intentionally align its text. Add an actual generated
mixed-source record regression before final Craft ≥ 8.5. Rebuild and repeat
affected populated Home/Content, compact English, original recovery, and focus
checks. The prior build's Craft score and affected screenshots are superseded
when that fix lands; preserve this candidate as history, not the final artifact.
The capability-guide entry was not freshly activated in this candidate review;
its prior fixture evidence is historical.

A second evaluator later compared the preserved Round 5 and candidate screenshots
without performing native interactions. That separate visual calibration also
found Originality 7.5 defensible for both platforms, with Android's margin
narrower and neither design warranting an 8. It identified duplicated Mac note
title/excerpt and conventional native controls as remaining limitations. This
supports calibration only; it is not another functionality or comprehension test.

### Candidate B — Mac gutter repair, reader wording still pending

Source/build state: the parent's rebuilt Round 7 Mac, held in a fresh generated
profile on 2026-10-13. The gutter now uses intentional left alignment and
`overflow-wrap: anywhere`. The parent's complete hidden smoke includes an actual
generated notification imported through the product's queue-import IPC, persisted
notes and a file, all rendered in English at 820px. Text ranges remain inside
their real gutters, and the generated notification's exact original opens.
Actual mixed-source proof:
`/tmp/mote-native-originality/round-7/mac/mixed-source-content-en-compact.png`.
Fixture seed corrections during that test were not product failures.

The evaluator repeated an actual local save and captured another 24 bilingual,
normal/compact scenes through the running renderer/preload. This replaced the
affected Candidate A source/layout checks. Manifest:
`/tmp/mote-ui-eval/mac-originality-candidate-b-scenes/manifest.json`.
The original still survives exactly, and the folio direction and other scores
remain supported. The English reader exposed a separate action-label failure:
its dismissal reads “Off”, reusing the shared translation of a state word.
Evidence: the actual `en-compact-reader.json` and PNG in that manifest directory.
This was not checked in the earlier Chinese-only native reader review and must
not be claimed as a historical English pass.

Decision: **refine**. Design quality 8.5, Originality 7.5, Functionality 8.5 and
clarity/completeness 8.5 remain supported; Craft stays 8 until the existing
action-specific “Close details” key is used and the affected actual reader and
journey are repeated. Candidate B scenes are intermediate evidence, not the
owner preview's final selected native implementation. The evaluator restored
the viewport and Chinese locale and released the parent's fixture before that
source change.

### Candidate C — Mac dismissal repaired, long metadata still pending

Source/build state: the parent's fresh label-fixed final-review build, held on
2026-10-13 with the same gutter refinement. Independent actual save/recovery
and all 24 bilingual normal/compact scenes were repeated. All four reader scenes
contained the exact saved original and the correct action-specific dismissal.
Manifest: `/tmp/mote-ui-eval/mac-originality-candidate-c-scenes/manifest.json`.
This supersedes Candidate B's reader wording evidence.

The evaluator also checked the actual current compact Content CSS with exact
catalogue labels: Notifications, UI page collection, App activity, and Coding
conversations. All four text ranges stayed within the 54px type gutter. A
separate valid long generated filename in the source/time metadata did not:
the text range was 654px wide in a 431.8px box and extended to x=901px beyond
the row's x=780px edge. That metadata still used normal wrapping. Probe evidence:
`/tmp/mote-ui-eval/mac-originality-candidate-c-label-metadata-probe.json`.
Both probes restored the actual note's original display text and are explicitly
layout-variation evidence, not persisted records of each source. They are not
included in the owner artifact's real-scene manifest.

Decision: **refine** the metadata wrapping and repeat affected current-build
scenes. Craft remains 8 while that observed overlap exists; the other provisional
scores remain 8.5 / 7.5 / 8.5 / 8.5 in their respective criteria. This needs no
new limit or product policy. Candidate C is intermediate evidence, not the
selected final implementation. Viewport override and locale were restored before
releasing the held fixture for the correction.

### Final Android candidate — archive sheet and original-text hierarchy

The initial Round 6 generated images show a continuous four-action Home sheet
with attached recovery/status, a populated local-content sheet with actual
source/time/body, and an original-text reader. These support the direction but
did not establish a final score. The generator found that the inherited
long English introduction delays the fourth row's explanation at 320dp / 130%
font size and refined equivalent purpose copy before holding the final build.
That initial first-fold evidence is superseded by the final build below.

Final source/build state: the held development APK with SHA256
`31a8f387488685604abaff8ca3a884b1732a63306bb1767b5e8ce252133d629d`, reviewed on
2026-10-13 in the dedicated headless `mote_ui_originality_api37` emulator. The
parent's native generator held source and session unchanged during interaction.
The UI began in English, at normal restored metrics, with stopped collection,
no credentials, empty source/queue/draft, and only the qualified future central
address. Actual application-drawn images are under
`/tmp/mote-native-ui/round-6/android/`, including `english/`, `compact/`, and
`compact-english/`. No device screen capture was used.

| Platform/candidate | Design quality | Originality | Craft | Functionality | Clarity/completeness |
| --- | --- | --- | --- | --- | --- |
| Android final | 8 | 7.5 | 8.5 | 8.5 | 8.5 |

Independent choices from actual UI-tree state: Home → Quick Notes → type and
save `Generated_Android_folio_originality_evaluator_original` → Content → open
its original → Close Details → Ask → More → Content category → Memories → Home.
The note saved locally without connecting. Content showed the real source,
localized time, and body; the reader identified Original Text, retained the exact
body, offered Close Details, and omitted irrelevant disabled-media copy. Ask and
Memories each retained their appropriate heading and connection explanation.
The capability menu explicitly said it covers central features supported by this
client. It did not claim complete Web parity. Own state evidence is
`/tmp/mote-ui-eval/android-originality-*.xml` and the matching text summaries.
The emulator was returned to Home and released; one generated evaluator note
remains saved and the draft is empty.

The evaluator inspected the current actual compact English Home image: all four
peer rows and full explanations fit at 320dp / 130% text. The native generator's
fresh final matrix ran two generated tests in each of Chinese normal, English
normal, compact Chinese with the real note IME, and compact English with the real
note IME. Those runs verify layout/input/lifecycle through scripted product
actions; the independent trace used normal English metrics. Neither proves
physical-device permissions or OEM background behavior.

Originality clears 7 because one composition now governs the primary journey:
four equal inputs form a continuous source-gutter sheet, recovery and truthful
sync state attach to it, populated Content carries actual provenance and original
excerpts, and writing/reading distinguish the saved original within the same
folio hierarchy. That is a product-specific relationship change, not a blue
stripe alone. The large source-management buttons and legacy capture browser
retain conventional platform treatments, so a higher or exceptional originality
score is not justified. Those preserved controls remain usable and do not block
the reviewed task.

Decision: **retain the final Android refinement** over Round 5. It meets the
new thresholds without adding policy or removing any supported action.

### Final Mac candidate D — source/metadata wrapping and reader complete

Source/build state: the parent's final rebuilt Round 7 Mac, with product source
held unchanged during the current review on 2026-10-13. The selected source adds
metadata `overflow-wrap: anywhere` to the gutter alignment/wrapping and existing
Close Details label fixes. The parent's complete hidden smoke now imports an
actual generated record with a 126-character unbroken device/source name,
checks real text ranges in both type and source/time columns, and opens its exact
notification original. That is durable product-ingress regression evidence,
separate from the evaluator's own note and layout checks.

| Platform/candidate | Design quality | Originality | Craft | Functionality | Clarity/completeness |
| --- | --- | --- | --- | --- | --- |
| Mac final D | 8.5 | 7.5 | 8.5 | 8.5 | 8.5 |

Independent current-build choices: Home → Quick Note → actual generated local
save → populated Home / Content → exact original → Close Details, plus Add,
empty note composer, and disconnected Ask in both Chinese and English at normal
1140 × 808 and compact 820 × 620. The 24 selected actual-scene manifest is
`/tmp/mote-ui-eval/mac-originality-candidate-d-scenes/manifest.json`. All scenes
had the expected locale and no page overflow. Each of the four reader scenes
retained the exact saved sentence and correct dismissal label. A separate
current-build focus recheck moved focus to `content-detail-title` on opening
and returned it to the actual saved `content-row` on closing. Evidence:
`/tmp/mote-ui-eval/mac-originality-candidate-d-focus-{detail,return}.json`.

The evaluator repeated exactly the previously failing compact-English layout
variation. All four exact translated source labels stayed within the 54px gutter.
The same long metadata now measured 428.4px inside its 431.8px box, rather than
the previous 654px overflow, with `overflow-wrap: anywhere`. Probe evidence:
`/tmp/mote-ui-eval/mac-originality-candidate-d-label-metadata-probe.json`.
All temporary strings were restored and are excluded from the 24 real-scene
manifest. They are layout-variation checks; the parent's actual imported long
source additionally covers persisted data and the real ingress path.

The evaluator restored the viewport and Chinese locale and released the parent's
owned fixture for cleanup. The generated note remains saved and the draft is
empty. Locale setup again used the isolated real preload API/reload; native
language-confirmation interaction remains unverified. The Mac capability guide
was not freshly activated in this continuation; the entry and its prior route
evidence remain unchanged and must not be presented as a new test.

Decision: **retain Mac D**, superseding A, B, and C. It keeps the folio's
substantive archive identity and resolves the confirmed craft failures without
changing authority, native navigation, save actions, or product policy. No
regression or blocker remains in the independently reviewed current-build
journeys and known layout variations.

## Frozen selection and before/after comparison

Select **Mac D and final Android Round 6**. The five-round history remains
unchanged. This continuation's accepted final evidence replaces the affected
native surface checks for the selected implementation; intermediate A/B/C
scores and screenshots remain historical and are not the final owner artifact.
Web retains its previously selected Round 5 result.

| Platform/state | Design quality | Originality | Craft | Functionality | Clarity/completeness |
| --- | --- | --- | --- | --- | --- |
| Web, unchanged Round 5 | 8 | 7.5 | 8.5 | 8.5 | 8.5 |
| Mac, before Round 5 | 8 | 6.5 | 8.5 | 8.5 | 8.5 |
| Mac, selected D | 8.5 | 7.5 | 8.5 | 8.5 | 8.5 |
| Android, before Round 5 | 8 | 6.5 | 8.5 | 8.5 | 8.5 |
| Android, selected final Round 6 | 8 | 7.5 | 8.5 | 8.5 | 8.5 |

Both native originality scores are strictly greater than 7, and each other score
meets its required floor. Originality improved through the repeated relationship
between input, real provenance, and original reading. It was not increased merely
because the owner requested a higher score. Conventional platform controls,
duplicated Mac note title/excerpt, Android source-management pills, and the
legacy capture browser limit exceptional originality; neither native result is
rated 8 or 9 for originality.

The standalone HTML preview is an owner-decision artifact. Actual captured
product scenes, simulated local preview interactions, missing baseline states,
and recorded metrics must remain clearly distinguished. It does not establish
backend, provider, capture, authorization, or native-modal functionality.

Final limitations: first-look scores are informed model review, not real-user
comprehension evidence. Physical devices, OEM background behavior, live accounts,
real capture permission flows, live models and answer quality, and unperformed
native modal behavior remain unverified. Supported-native capability discovery
does not imply Web feature parity or complete use of every feature. This review
does not claim universal usability, full accessibility conformance, a merged PR,
or a released commit. Later product changes require fresh affected review;
these scores and evidence are frozen for the inspected sources.

## Post-selection review — Android Home v2 pending

The subsequent read-only code/fixture review found a concrete evidence mismatch
and a pre-existing Home omission. The new populated-Home test saves a note and
looks for any `library-record:` view. Its recursive view walker includes cached
hidden pages; without `isShown` or active-page scoping, it accepts the earlier
Content note row. Meanwhile `MainActivity.loadHomeContent()` calls
`capturePage(..., limit = 3)` without `source`, so the queue's default screen-only
filter excludes the saved note. The preserved actual
`/tmp/mote-native-ui/round-6/android/home-populated.txt` says Recent Content is
empty. The test can therefore pass without the claimed populated Home.

The screen-only query predates the originality continuation. The false-positive
assertion and mislabeled populated-Home evidence are new. Independent actual
Content → original recovery remains valid; it never established that the note
appeared on Home. The prior Android scores and source record are preserved as
history, but its populated-Home proof is superseded and cannot support a current
completion claim. Mac D is unaffected and remains selected.

The parent explicitly authorized correcting Home to use `source = ""`, the
existing Library all-local browse mode, and requiring the actual active Home's
visible saved-note ID and preview in the regression. This displays already saved
local records; it does not collect anything new or expand authorization.

| Classification | Home correction disposition |
| --- | --- |
| KEEP | Existing capture browse default for other callers, three-record query limit, file ordering, local originals, save/retention/sync behavior, permission/collection boundaries, and the selected folio design. |
| CHANGE | Home explicitly displays all already collected local record types, matching its Recent Content label, and the fixture checks visible active-Home data rather than a hidden cached page. |
| REMOVE | The obsolete implicit screen-only filter from this Home call and the unsupported populated-Home evidence claim; no record or capability is removed. |
| EXCEPTION | Other screen/session/album callers retain their existing source filters and responsibilities. |
| UNKNOWN | Current-build Home recovery, false-empty removal and large-font/IME results until the fresh APK and independent trace are reviewed. |

Android v2 remains pending a new held APK, repeated generated matrix and an
independent Save → Home → the same visible note → exact original transition.
The final comparison will be appended after that review rather than silently
editing the earlier selection or carrying forward superseded Home checks.

## Android v2 / Round 7 — refreshed final selection

The corrected APK has SHA-256
`32d8ba9da2577eeafbd3c5c282c9bfd6a461ec4955188ef278ed1eb6cdb03112`.
The native agent held a fresh, generated-only, headless
`mote_ui_recent_fixture_api37` on `emulator-5580`, with English Home, normal
1080 × 2400 metrics, no capture, credential, local source, saved note, or draft.
No foreground window or device screenshot capture was used.

The independent evaluator selected this actual path:

1. Open Quick notes from Home and enter
   `Generated_Android_v2_Home_original_evaluator` using the real editor and IME.
2. Hide the IME and press Save quick note. The editor cleared and displayed
   “Quick note saved; sync follows your settings.”
3. Select Home directly, then scroll its own content to Recent content. The
   visible Home row contained that exact unique note and its localized source
   and time. Home was the selected navigation destination throughout.
4. Click that visible row. The reader showed “Original text,” the exact saved
   body, local-record provenance, and “Close details.” No plain-note media
   restriction appeared. Close the reader and return to the same Home row.

Independent UI-tree evidence is preserved under `/tmp/mote-ui-eval/`:
`android-v2-note-{draft,saved}.{xml,txt}`,
`android-v2-home-{after-save,recent,note-original}.{xml,txt}`, and
`android-v2-return-home.{xml,txt}`. This trace used a newly saved evaluator note;
it did not reuse the instrumentation note or visit Content to recover it. The
AVD was released to its owner on Home with only that generated saved note and
an empty draft, so the owner can perform cleanup and further affected checks.

The current native matrix separately passed three generated tests for each of
Chinese/English normal and Chinese/English 320dp at 130% text, including actual
IME use. Its Home assertions now scope the active `home-recent-content` subtree,
match the saved record ID and exact preview, require the full row's global
visible height, capture that visible Home immediately before clicking it, and
verify the reader's same record ID and exact original. Core navigation reported
eight passes and two optional skips; skipped capabilities are not passes.
These are native-agent fixture results, distinguished from the independent
normal-English interaction above.

Current own-view evidence is `/tmp/mote-native-ui/round-7/android/`, with
`english/`, `compact/`, and `compact-english/` variants. The evaluator inspected
the refreshed populated Home and original reader, including compact English
first-view peer actions and original-text wrapping. `home-populated.png` is
explicitly a Home scrolled to Recent content; `home-note-original.png` is the
reader opened from that Home row. The corresponding `home-visible-record.txt`
records the ID, full visible rectangle, row height, and original preview.
The Round 6 populated-Home images/assertion remain historical and superseded.

The change resolves the confirmed false-empty/recovery failure. It retains the
folio, source gutter, type/time/original relationship, existing actions and
permission boundaries. It supplies missing functional evidence, without
creating an additional reason to raise the design or originality scores.

| Final selected platform/state | Design quality | Originality | Craft | Functionality | Clarity/completeness |
| --- | --- | --- | --- | --- | --- |
| Web, unchanged Round 5 | 8 | 7.5 | 8.5 | 8.5 | 8.5 |
| Mac D, unchanged | 8.5 | 7.5 | 8.5 | 8.5 | 8.5 |
| Android v2 / Round 7 | 8 | 7.5 | 8.5 | 8.5 | 8.5 |

**Select Mac D and Android v2 / Round 7.** Both native originality scores remain
strictly greater than 7, and all other requested floors are met. The fixed
rubric, original five-round history, and intermediate scores are unchanged.
The earlier UNKNOWN about current Home recovery and repeated fixture matrix is
resolved for these generated states. This is a current-source UI acceptance,
not evidence of physical-device, real capture, live-model, native-modal, full
accessibility, or first-time-user validation. The prior general limitations
still apply. Final affected-component checks and delivery to a branch or
release remain the parent's responsibility and must be reported separately.

## Continuation in 5330 — Mac D2 and Android R8

The source was carried onto `codex/ui-continuation`, preserving the newer
speaker-display fixes in its base. Earlier D/R6/R7 results remain historical.
Fresh checks found two defects: Mac cached translated operation labels after a
locale change, and English Android at 320 dp / 130% text clipped 23 px from the
fourth Home action. The implementation retains authored operation keys and
translates each status snapshot; Android reduces existing vertical padding from
8 to 6 dp, keeping the text, fonts, 64 dp minimum height and four peer actions.

The independent root reviewer did not implement either correction. On hidden
Mac D2, the reviewer changed the real language selector to English, composed and
saved a unique note, selected Home, opened that exact visible note, checked its
unchanged original and “Close details,” verified focus returned to the same row,
then entered disconnected Ask. The operation label was “Saving quick note ·
Operation finished”; no capture started, and Ask retained local saving. Evidence
is `.mote/ui-continuation/mac/root/`. One language probe reached the existing
native confirmation after a previous reload removed the fixture hook; the
generated process was restarted and confirmation explicitly simulated. This
does not establish a page hang or validate native-dialog handling.

On dedicated headless `emulator-5582`, the reviewer used the real editor and IME
to save `Generated_root_Android_original_20261013`, selected Home without visiting
Content, scrolled to Recent content, opened the fully visible unique note,
verified its exact original and local provenance, and closed the reader to the
same Home row. UI-tree evidence is `.mote/ui-continuation/android/root-*.xml` and
`root-*.txt`. Accepted APK SHA-256:
`025178385afa56cb98a63daa382319bdc87e9c6588d4ac452dde530cbe37b793`.

The reviewer inspected refreshed English compact Home, Content and reader
images, plus Chinese/normal matrix evidence. Mac's folio, source gutter, type
hierarchy and original-reading relationship remain coherent; English labels wrap
inside their gutter and operation text follows locale. Android's native folio
remains legible with four complete actions above navigation at 320 dp / 130%
text; the original wraps without a media restriction. These corrections resolve
execution defects without grounds to inflate originality. The fixed anchors and
fifth additive criterion are unchanged.

| Current accepted state | Design quality | Originality | Craft | Functionality | Clarity/completeness |
| --- | --- | --- | --- | --- | --- |
| Web, Round 5 design retained | 8 | 7.5 | 8.5 | 8.5 | 8.5 |
| Mac D2 | 8.5 | 7.5 | 8.5 | 8.5 | 8.5 |
| Android R8 | 8 | 7.5 | 8.5 | 8.5 | 8.5 |

Select D2 and R8 for the owner-facing offline comparison. Scores describe the
inspected generated states, not a first-time-user experiment. Physical devices,
real capture, live models, external accounts, native dialogs and full
accessibility remain unverified. Component checks and branch delivery are
reported separately.

The final static-delivery audit added seven Mac screenshots from the same held
D2 build: all four guide-entry conditions and the three missing import-confirmation
conditions. The reviewer inspected English compact images. Guide correctly shows
the disconnected connection-settings destination; its caption explicitly states
that the full directory lives in central Web and has not opened here. Import
shows the real generated-file confirmation panel, without confirming a task.
The fixture finished with capture stopped, zero queue records and zero sources;
its process and profile were removed. This closes static walkthrough gaps without
changing product code or scores. Both native walkthroughs now have current images
for all four language/size conditions; old-baseline gaps remain explicit.
