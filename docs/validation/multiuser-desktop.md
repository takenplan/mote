# M14 Desktop validation checkpoint

## Portable import Activity

M16's exact `89ddc973f0eb68262f047826d2df23c4b41df5ad` is composed. RED
`690b85e7` exercises actual export, source deletion, same-account import and its
real preflight barrier: both Activity cases fail because no card exists
(`/tmp/m14-import-activity-red.log`, **0/2, exit 1**). The unchanged tests and
the original export/delete cases pass **6/6, exit 0** in
`/tmp/m14-import-activity-green.log` after adding the existing import receipt to
the metadata projection. Running, completed, cancelled and restart states stay
owner/current-epoch bound. Preserved domains are excluded branches, not restored
authority or record counts. Import has no artifact, evidence or technical task
IDs, and a committed import cannot be cancelled. B and an unrelated administrator
cannot inspect A's import. No second import runtime is introduced.

This is backend/consumer projection evidence, not yet the final affected check or
acceptance of M16's separately discovered restart notification regression.

## Resumed M16 Activity consumption

Composed the exact clean M16 dependency `ec6d12c6601109f7527b012fb28915dc76d6e598`
into the M14 feature. The earlier a439 required-affected success remains evidence
for that earlier composition, not for the new runtime. M16's later negative-byte
backup regression and newly approved personal import are not claimed covered by
ec6. No M12 handoff was read or relayed.

Actual production M01/M16 routes at RED `60a0fa00` omit all lifecycle Activity
cards: `/tmp/m14-lifecycle-activity-valid-red.log/.exit`, **0/3, exit 1**.
The unchanged tests pass **3/3, exit 0** after the narrow read projection:
`/tmp/m14-lifecycle-activity-green.log/.exit`. They cover a real held export,
completion/current owner artifact, cancel and restart, owner/epoch and state
filtering before pagination, and an actual administrator deletion that stops at
`result_unknown` and completes only after explicit retry. Administrator metadata
does not expose target data or export downloads. The first test attempt hung in
fixture cleanup before reporting assertions; its generated runner was identified
and stopped through standard review, and cleanup now releases its provider
barrier before closing the actual host. That first attempt is not a valid RED.

Server typecheck, scope inventory and bilingual catalog checks exit 0:
`/tmp/m14-lifecycle-server-typecheck.log/.exit`,
`/tmp/m14-lifecycle-scope.log/.exit`, `/tmp/m14-lifecycle-i18n.log`.
This checkpoint does not replace the pending Desktop entry-point, independent
review, final dependency combination and required-affected evidence.

The expanded production lifecycle Activity file now passes **4/4, exit 0** in
`/tmp/m14-lifecycle-activity-expanded2.log/.exit`, adding actual failed export /
explicit retry and retirement of an administrator credential. The unchanged
semantic record accounting never labels domains as records. The M13 stable Web
consumer `f1e059e4c0bf86b860d8b1c9154b1cb36b0fbd13` is composed at `d7e8ea88`;
merge conflicts retain the newer ec6 M16 documents and the lifecycle Activity host
injection. This includes M13's actual M07 model/material adapters and restored
Activity route, not its later raw archive WIP or final module acceptance.

`/tmp/m14-lifecycle-desktop-entry4.log/.exit`: **1/1 selected, exit 0** through
the emitted production main and preload, generated native-I/O substitutes and
actual M01/M16 backend. A's real successful Activity response is held, B activates
and the old response/document are rejected; restart retains B's empty view.
Fresh A credentials recover A's original export identity. The actual one-use
browser handoff is exchanged for A's Cookie session, which reads the exact work;
cancel removes its artifact. Native browser launch is the simulated external I/O,
so no browser or Electron is launched by this Node fixture. The other 27 cases
were not selected, not silently accepted. Earlier attempts 1–3 are fixture errors
(server authorization delayed past logout, reuse of a logged-out token, and
missing Wire2 exchange header), preserved in adjacent logs and not product REDs.

### Same-URL deployment replacement between requests

Actual RED `f6db6226`: **0/3, exit 1** in
`/tmp/m14-request-deployment-red.log/.exit`. The generated real app is stopped,
its deployment identity is replaced while its credential rows remain valid, and
the same URL resolves to the rebuilt real app. Production main Ask sends its
question to `/query-runs`; SourceManager sends original parts after an old
manifest ACK; capture upload sends bytes after old source registration. The old
single batch/factory identity check is insufficient even though the late receipt
is rejected. This is a confirmed production regression, not a provider fixture.

The unchanged three tests pass **3/3, exit 0** in
`/tmp/m14-request-deployment-green.log/.exit`: every ingress request reuses the
existing actual self confirmation and checks cancellation after that await; Ask
rechecks the same identity and its captured main connection before transport.
The source factory cache and redundant outer batch/heartbeat checks are removed.
The replacement receives only identity admission, no question/capture/parts;
source pending input and original spool remain intact. An already issued network
request cannot be retracted across a server replacement during that flight; this
guard admits the next request only under its confirmed stable owner. No protocol,
runtime, owner key, retry algorithm or system network setting is introduced.

M13 independently reviewed exact c18ca001's four runtime files without new
confirmed P0/P1/P2 (`/tmp/mote-m13-review-m14-c18.md`). M16 independently reviewed
exact96cd160a's lifecycle Activity and production composition without new
confirmed P0/P1/P2 (`/tmp/mote-m16-review-m14-96cd.md`). These were bounded static
reviews, not independently rerun suites.

At composition `6c239a23` (M15 stable8c92/backup473, M13 f1 and exact Vault07f54,
M16 ec6 and M14 c18), fresh shared build and Desktop typecheck exit 0. The first
full Desktop run exits 1: 462/488 pass, 26 failures include restricted loopback
`listen EPERM`, native watcher/background fixture restrictions and timeouts.
`/tmp/m14-c18-desktop-full.log/.exit` is retained. The exact suite was then
allowed by standard review and passes **59 files, 488/488, exit 0**, 68.99s:
`/tmp/m14-c18-desktop-full-approved.log/.exit`. Its standalone generated Desktop
background-policy fixture loads only a generated data page; this is not M13's
denied Web Electron action. No real capture, calendar, credential store or
external model was accessed, and no permissions or network settings changed.
New later runtime changes still require affected validation on their final SHA.

### Declared Ask evidence handoff

RED `9e8e34f6`, `/tmp/m14-ask-context-red.log/.exit`, **0/1, exit 1**: an actual
M07 canonical preview supplies evidence that is absent from raw M02 captures;
M08 reads A's canonical body while B gets404. The production main/preload browser
handoff rejects its explicitly declared context reader. Ask's UI citation callback
now marks that reader, and the existing central-browser handoff preserves it as
`context:capture:<id>`. Ingestion evidence keeps the raw reader. No error-driven
fallback or new backend read authority is introduced.

`/tmp/m14-ask-context-green.log/.exit`: **2/2 selected, exit 0**, same actual
M07/M08→main/preload→browser-route test plus strict context namespace validation.
The real Web evidence route retains the marker. Browser launch is external-I/O
substitution; this is not a live-model Ask run or native renderer citation click.
No unselected case is reported as passed, and the later full affected/native
evidence must identify its actual coverage.

This is an in-progress evidence record, not final acceptance or a delivery claim.
Work is isolated in task-18/mote on `codex/mote-multiuser-m14-desktop`.
The dirty original checkout was not modified. Initial characterization uses
M08 accepted `58944f00837c89bc1d302ecd7be7a568db4abe44`.

## Original capabilities and scope

The KEEP/CHANGE/REMOVE ledger precedes implementation in
[multiuser-desktop.md](../design/multiuser-desktop.md). The existing Collector,
durable queue/input/blob journal, source adapters/watcher/spools, draft store,
history, native lifecycle and credential store are reused. Stable ownership is
origin/deployment/user; token rotation does not create another owner. Dormant
account directories/preferences contain no saved alternate token. Format-3
unbound data is rejected before mutation and is never adopted or deleted.

All executed input is generated. Native capture, credential storage, calendar,
browser launch and external network I/O are fixture substitutes; real M01/M03,
SQLite, queue/store/source code, worker/chunk path and main/preload/renderer are
used where stated. No real personal library, calendar, mail, model or screenshot
was accessed. No system permission/network-security/credential-access setting,
deployment or disabled CI configuration was changed.

## Characterization and behavioral RED → GREEN

| Journey / defect | Frozen evidence | Result |
| --- | --- | --- |
| Existing durable queue/blob/retry algorithms | `/tmp/m14-characterization.log`; parent58944f | 18/18, EXIT0 |
| Actual M01 identity and Collector → M03 queue ACK | RED99e6e0f6 → c7972113; `/tmp/m14-matrix-first.log` later extension | initial 1 pass/3 fail → GREEN; extended real chains11/11 |
| Source policies and exact predecessor/head | RED60aca35a → source PATCH0c98/head87d; `/tmp/m14-dialog-policy-green.log` | source policy plus native dialog cases3/3, EXIT0 |
| A native save dialog resumes after B activation | RED625ad9a0 → 49ead536; same generated actual main/native-I/O fixture | both queue/metadata exports rejected before first write; B data never written to A's selected file |
| Retired document and mid-transition private references/status | RED1b5616ff and c7f87de6 → 29d83227; `/tmp/m14-document-midtransition-green.log` | four real main/preload/dialog cases, EXIT0 |
| Packed batch and in-flight state-series prefix extension | REDda18cc20 → d365cd2a; `/tmp/m14-packed-state-green.log` | 2/2, EXIT0 |
| Real M03 source context CAS / current paused-device scope | RED816817f5 → 0d3a20df; `/tmp/m14-collector-contract-green.log` | 2/2, EXIT0 |
| Material member201 and legitimate >4MiB full OCR list page | REDc4ba0e2d → 2998c856; `/tmp/m14-reader-completeness-green.log` | 3/3, EXIT0; preview projection does not truncate full detail |
| Actual heartbeat and malformed original/receipt identity | RED7a62d588 → 793540fd; `/tmp/m14-heartbeat-receipt-green.log` | 5/5, EXIT0; corrupt ACK retains durable bytes, legal retry clears only matching bytes |
| Environment credential before first account store | REDb9e188ed → 42864208; `/tmp/m14-bootstrap-green.log` | 2/2, EXIT0; unknown credential stays signed out |
| Central screen extraction without raw provenance or Material device metadata | REDb2436476 → 6e405149, tightened86a9d263; `/tmp/m14-derived-reader-green3.log` | 3/3, EXIT0; only declared ready extraction replaces body, original detail budget and text pages retained |
| Snapshot release destroyed M06 artifact; expired input still downloaded | valid RED14a93bb1 → 580e7bce; `/tmp/m14-snapshot-public-green.log` | 3/3, EXIT0: metadata/artifact, exact recovery, lost ACK, pins/GC, B isolation and ordinary original retention |
| Account source manager skipped recovery | corrected actual managed-upload REDdd83419b → 86a9d263; `/tmp/m14-snapshot-desktop-green2.log` | snapshot/derived/member201 three scenarios, EXIT0 |
| Snapshot OCR released pixels before configured image understanding | RED303f0a73 → 272dfb02; `/tmp/m14-snapshot-image-green.log` | actual M03 → OCR → Harness read_image → publication1/1, EXIT0; held exact pin survives snapshot deadline without granting public download |

The original member201 fixture now declares an extraction artifact explicitly;
M08's on-read source-body organizer is a separate product, not the extracted
file body. Its complete text/member assertions remain. First snapshot fixture
omitted required fileIndex metadata (400); the corrected manifest produced the
two actual REDs. A global clock change also affected M05 authorization; subsequent
expiry fixtures adjust only deadlines in their generated SQLite database. The
first managed source assertion expected recovery during a local-only scan;
the corrected RED exercises actual flushPending and observes unresumed M06 work.
These setup/intermediate failures remain in `/tmp/m14-snapshot-*.log` and are not
counted as independent production failures or acceptance passes.

## Broader and native evidence

- Fresh shared Wire2 build EXIT0: `/tmp/m14-fresh-shared-build.log`.
- Desktop full suite at exact29d832275f3443e2b115fc35116827044baab3bf:
  `npm run test -w @mote/desktop`, 59 files,475/475, EXIT0,47.94s;
  `/tmp/m14-desktop-suite-composed.log`. Later runtime deltas require a final run.
- Desktop native build at793540fd runtime: `npm run build -w @mote/desktop`,
  EXIT0, including renderer, Swift helpers and icons;
  `/tmp/m14-desktop-native-build.log`. Earlier sandbox iconutil failure and the
  independently reviewed exact icon command are retained separately.
- Actual Desktop Electron main/preload/renderer, generated username/password,
  A offline note/draft → B empty/stopped → B input → SIGKILL/restart B → A resume
  and real backend account isolation: `node --import tsx
  apps/desktop/scripts/multiuser-native-runner.mjs`, EXIT0;
  `/tmp/m14-actual-native.log`. This was independently standard-reviewed Desktop
  execution, not a retry of the denied M13 Web Electron action. First missing
  external device-metadata stub was a fixture error, not a product RED.
- After snapshot/image fix, exact272dfb02 runtime: M03 ingress, M06 processing
  and snapshot full files64/64, EXIT0,54.43s;
  `/tmp/m14-snapshot-regressions.log`. Includes prior ASR/summary/pixel/model,
  plugin, revocation, restart, durable publication and lifecycle regressions.
- Current snapshot server TypeScript and scope inventory/import checks EXIT0:
  `/tmp/m14-snapshot-public-type.log`, `/tmp/m14-snapshot-scope.log`.

## Activity and central status preservation

Old `activity.test.ts` characterization: 9/9 EXIT0, including exact relationships
before pagination, original-record deduplication, owner questions, cross-source
work, real delegated receipts and selected-goal-only payload hydration.
`/tmp/m14-activity-characterization.log/.exit` records the original chain.

Actual M03/M06, M07 and M08 consumer assertions in539471e8 all received503
(3/3 RED), then the same3 passed after455d1dcf. Logs:
`/tmp/m14-activity-real-{red,green}.log/.exit`. No new executor or database was
introduced: the projection joins existing owner-qualified receipts in SQLite,
selects exact relationships/state before LIMIT and hydrates selected goals only.
The Desktop account reader verifies connections/self before this private read.

Expanded real Memory jobs preserve one original across two jobs, exact source
and Material filtering before a one-item page, branch pagination, and one record
with two evidence blocks awaiting an owner reply:2/2 EXIT0,
`/tmp/m14-activity-expanded2.log/.exit`.

M15's independent review of455d identified a legitimate unbatched owner-correction
crash and a completed extraction masking a failed admitted image stage. Both were
confirmed by the existing actual owner-correction and genuine-pixel-read-negative
chains (ba0c4c67 RED2/2) and the same2 passed after using frozen unbatched inputs
and all admitted stages of the exact original. Logs:
`/tmp/m14-activity-review-{red,green}.log/.exit`.

Source retirement initially hid its stale work from attention. The same real
held-job/source-delete chain now retains a stale semantic receipt when live
record mappings are gone, without inventing a zero record count. Empty-body
Memory input is rejected400 before admission; its first empty-job fixture was
not a valid production RED. Real durable M06-to-M07 intake waiting for its
automatic window was separately RED in65e208da, then joined as unfinished original
records before job assignment. Deduplication, correction, retirement and pending
intake4/4 EXIT0: `/tmp/m14-activity-pending-green.log/.exit`.

Memory branch artifacts and Ask child results were actual RED2/2 in7fa028de,
then the same2 passed after joining persisted publication/run/task relationships
and revalidating artifact access: `/tmp/m14-activity-branches-{red,green}.log/.exit`.
Historical completion does not claim a current artifact grant. The original
completed-Ask/source-delete behavior was separately RED in cb9d3ebd and restored
in c16bfb12; the complete Ask owner/isolation and delegated-worker cases2/2 EXIT0:
`/tmp/m14-activity-history-{red,green}.log/.exit`.

Desktop's actual emitted main IPC reads this projection, changes from A to B
without A's work, and observes an actual central OCR task that failed/staled
instead of the immutable received pending flag. The first OCR fixture expected
only blocked/failed before reaching its reader assertion and observed stale;
that was not the valid reader RED. Corrected ba0c4c67 reproduces pending versus
failed in `/tmp/m14-ocr-valid-red.log/.exit`. The same OCR case plus the actual
source/spool/snapshot/main Activity journey2/2 EXIT0 after the fix:
`/tmp/m14-activity-ocr-desktop-green2.log/.exit`. Initial combined GREEN attempt
stopped at a Desktop TypeScript document-field error before0 tests; retained in
`/tmp/m14-activity-ocr-desktop-green.log/.exit` and corrected before the pass.

M13 independently reviewed exact c16bfb12 Activity/OCR, with no confirmed new
P0/P1/P2; `/tmp/mote-m13-review-m14-c16.md`. This was bounded static review, not an
independent rerun or final performance/native acceptance.

The remaining unbatched-correction exact source relationship was RED in024eb946
and fixed by0c5e6450's two owner-qualified metadata joins from frozen inputs to
evidence/Material sources. The same correction and original deduplication cases
2/2 EXIT0: `/tmp/m14-activity-correction-source-{red,green}.log/.exit`. M13 also
reviewed that exact delta with no confirmed new finding; the same report is
appended. M15's c16 follow-up independently closes its earlier P1/P2 statically
in `/tmp/mote-m15-review-m14-c16.md`.

## Dependency and independent review checkpoints

Composed: M11 final98d76945, M15 public Wire2 107004df, M15 ingress2b45f6ce and
heartbeat4e394170, M13 public metadata c6b092ed. The pure web-assets scope exception
is identical to M13 independent16cdf161's single-file allowance. Full/final M13
is still pending. M12's explicitly denied handoff is not read, transferred or
consumed; a paused checkpoint is not completion.

M13 reviewed the export/dialog and transition fixes, then independently reviewed
793540fd/42864208/6e405149 consumers with no new confirmed P0/P1/P2. M15 reviewed
exact2998 ownership/readers with no confirmed finding, then d383 snapshot found
the image-stage P2 above; bounded63d66f17 follow-up closes it statically with no
new confirmed finding. Review reports are `/tmp/mote-m13-review-m14-*.md` and
`/tmp/mote-m15-review-m14-*.md`. Peer runtime evidence is not represented as an
independent rerun. All reviewers used existing execution conversations only.

Standalone server-only handoffs: source/state/context fdc50cdc; snapshot
d38372661b3628dd2442c494f02ebd8a747cbfb8 followed by image-stage fix
63d66f175a7873a3eac4201efcadbd04d0d2177e. Android's actual consumer acceptance
of the latter was subsequently reported GREEN by M15's actual provider/Worker
test, preserving one history version and the unchanged phone original; this is
peer evidence, not an independent rerun here. Desktop's actual consumer is
verified above.

Stable three-consumer composition4ae2ee044840b6b0939713d5908357f3340a284b contains
Desktop c16bfb129720d7f6ac186aebfdf06dfd7d9c657d, Android
ac0fe8d111fb7cec7d14e7af0bd19626367558ae and Web
0cc7311af17463f17ba3b8664741bb9ac8f6b1ef. The merges preserve Activity registration,
capture-preview imports, one union of source/head/context and heartbeat methods,
the stronger Android heartbeat characterization and both clients' English
messages in synchronized catalogs. No Desktop runtime differs from c16bfb12.
Fresh shared build, composed server/Web typechecks and scope inventory EXIT0;
logs `/tmp/m14-composed-shared-build.log`, `/tmp/m14-composed-types.log`.
The affected dry-run EXIT0 selects check:local and the actual Android JVM suite;
`/tmp/m14-composed-affected-plan.log` is a plan, not a gate pass. M13's later
consumer work and M15's newly investigated native scenario are not declared
accepted by selecting these stable composition points.

The independently demonstrated Android Settings/queue lock-order fix5a0dd911
was subsequently merged as well. M15 reports340/340 JVM, APK/testAPK, retained
handles/process-death recovery, three source runs, snapshot recovery and late ACK
all passing at that exact freeze. M14 bounded static review found no new
confirmed issue (`/tmp/mote-m14-review-m15-5a0d.md`); no claim is made that it
explains the earlier untraced cold-login timeout.

The composed Desktop suite at4ae2ee04 ran59 files/484 tests:483 passed and1 failed
because the new native fixture's explanatory comment preceded the mandatory
first-line background-policy require. Moving only those comments preserved the
executable order. Exact background fixture rerun2/2 EXIT0 under standard review:
`/tmp/m14-composed-background-approved.log/.exit`. The first restricted rerun
could not launch its generic generated Electron window and is retained in
`/tmp/m14-composed-background-green.log/.exit`; this was an environment failure,
not a product RED. This is the existing generic `test-background-ui.cjs`, not the
denied M13 Web action. The initial full command remains EXIT1 and is not called
484/484. Adding the missing authored Activity English phrase and synchronizing
both catalogs makes8373-message i18n validation EXIT0:
`/tmp/m14-composed-i18n-green.log/.exit` (initial failure retained separately).

The later clean composition9bc65b53d5823443ad1ecffb49d2c6eecc687927 adds
Web's tested3300db2180ac9c935c9bfb7109a9d31b1e27fa03 Memory read consumer to
Android tested5a0dd911 and Desktop c16/0c5. Translation conflicts retain the
shared/Android union; i18n checks8376 messages and scope checks EXIT0. M14's
bounded read-only review of the Web increment found no confirmed new finding
(`/tmp/mote-m14-review-m13-3300.md`), without accepting its still-open parity.
Later peer WIP is not part of this composition.

Fresh shared build EXIT0 (`/tmp/m14-final-shared-build.log/.exit`). The restricted
Desktop build initially failed at macOS iconutil `Invalid Iconset`; the exact
standard-reviewed retry EXIT0 is retained separately in
`/tmp/m14-final-desktop-build-approved.log/.exit`. Generated native main/preload/
renderer A/B offline queues/drafts, SIGKILL/restart and actual backend isolation
EXIT0 in `/tmp/m14-final-native.log/.exit`. After the Web3300 shared message
addition, fresh Desktop build and the same actual native chain both EXIT0 in
`/tmp/m14-9bc-{desktop-build,native}.log/.exit`. These executions use only the
Desktop fixture, temporary generated profiles, synthetic native I/O and its own
child process; they do not run M13's denied Web Electron action.

The first real required affected run on clean9bc65b53 is retained as EXIT1 in
`/tmp/m14-required-affected.log/.exit`: Desktop59files/484tests passed, Web490
passed, all workspace typechecks passed. Server2495 tests had2493 pass,1 failure
and1 default opt-in OS-sandbox skip. The failed old Lark overlap fixture fixed
`Date.now` to2026-10-15 while `observedAt` used real `new Date`; after24 hours,
the unchanged future-observation guard correctly rejected its fixture inputs.
The unchanged single-case reproduction fails in
`/tmp/m14-lark-overlap-diagnostic.log/.exit`. Test-onlya43979dc anchors the same
:13→:33→next-hour:13 windows to the current hour and retains all event/file/body
fetch/dedup assertions, adding an explicit first-poll completed assertion. The
same case1/1 EXIT0 is `/tmp/m14-lark-overlap-green.log/.exit`. There is zero
production runtime diff from9bc65b53. M13's independent exacta439 read review
found no weakened assertion or new confirmed finding in
`/tmp/mote-m13-review-m14-a439.md`. The default skip is the existing
`MOTE_TEST_PYTHON_OS_SANDBOX` opt-in scenario, not a claimed native permission
check. No skipped or narrow result is substituted for the required command.

This host's default shell has no Java runtime. Before the final run reached its
Android stage, an ignored workspace-local `node_modules/.bin/java` launcher was
configured for installed Homebrew JDK21 and the existing Android SDK. It changes
no system Java, permissions, credentials or tracked source and is removed after
the run. The equivalent
reproduction environment is
`JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home`
and `ANDROID_HOME=/Users/utopiafar/Library/Android/sdk`. The required command's
Android stage still runs the actual Gradle JVM tests; no checker step is skipped.

The final required command on exacta43979dc18a90517cd641d38787674586a20499d
completed EXIT0: `/tmp/m14-required-affected-final.log/.exit`. It runs
`check:local` and the actual `:app:testDebugUnitTest`, without a cached or skipped
checker stage. Desktop59files/484tests passed; Server2494 passed/0 failed with
the1 default OS-sandbox opt-in skip; Web490 passed; Agent317 passed/0 failed
with1 default installed-Codex synthetic-fixture opt-in skip; Diagnostics5 and
Shared192 passed. The repository script group81, CLI characterization4 and
generated Node supervisor fixture passed. Android rebuilt25 tasks in48 seconds;
JUnit XML has72 suites/340 tests,0 failures/errors/skips. Workspace types and
the8376-message i18n check passed. No opt-in skip is presented as live-model,
real permissions or physical-device evidence. Only these two evidence/design
documents change aftera439; production and fixture diff is zero.

## Finite remaining acceptance

Activity and the central status consumer now have the real-chain evidence above.
Native M12 calendar Actions require
the explicit human authorization of its denied handoff. M16 owns personal export
and instance backup/restore/delete public orchestration; this snapshot byte
recovery is a separate existing collector path. No replacement framework is
introduced to bypass those owners.

M16's first export/delete contractf24dbad6 and credential cleanup23e135ac were
received and independently reviewed in bounded source ranges, but are not in
this frozen composition. M14's static credential-retention P1 received an actual
M16 RED→GREEN and bounded follow-up closure; this is peer evidence, not an M14
rerun. M16's Activity categories, personal import and instance orchestration
remain future composition work. The root `scripts/client.ts`/`import-files.ts`
still use their legacy v2/token-hash consumer in this candidate; their generated
fake-fetch characterization passing does not prove a scoped production CLI.
That concrete entry-point gap was handed to M16, without changing its workspace.

The current frozen consumer combination, bounded reviews, Desktop build/native
journey and required affected gate are verified above. This supports a Draft
checkpoint, not final M14 or joint acceptance: authorized M12 consumption,
M13's later final parity and M16's later real consumers remain open. Remote
feature/PR identity is reported in the final delivery note after verification.
No merge/main/deployment is authorized. The remote integration ref remains
6272a9b5. Physical-device, live-model, real permissions and production deployment
checks remain unrun.
