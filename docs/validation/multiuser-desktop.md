# M14 Desktop validation checkpoint

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
of the latter remains pending; Desktop's actual consumer is verified above.

## Finite remaining acceptance

Original Activity aggregate and the remaining status projection are still being
closed against real scoped domain receipts. Native M12 calendar Actions require
the explicit human authorization of its denied handoff. M16 owns personal export
and instance backup/restore/delete public orchestration; this snapshot byte
recovery is a separate existing collector path. No replacement framework is
introduced to bypass those owners.

Remaining gates: actual final dependency composition; bounded review of later
deltas; final Desktop suite/build/generated native journey; required
`npm run check:affected -- --base origin/codex/mote-multiuser-integration` on the
final runtime candidate; then push and verify remote feature SHA and create a
Draft PR targeting integration. No merge/main/deployment is authorized.
The remote integration ref was fetched and remains6272a9b5. No final affected
pass, remote feature SHA or PR is claimed at this checkpoint. Physical-device,
live-model, real permissions and production deployment checks remain unrun.
