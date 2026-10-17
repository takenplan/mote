# Original Web recording scoped validation

All input is generated: A/B accounts, IDs, text, WAV and provider I/O. Tests use the
production scoped `buildApp`, M01/M03/M04/M05/M09/M10/M06 and original React
components. No legacy-app browser fixture, production private archive, real
provider account, live model, shared AVD, deployment or CI is used.

## Retained RED and exact narrow outcomes

| Scenario | Actual result and version boundary |
| --- | --- |
| Original page cannot choose its owned instance | RED at `2c9d3257`, `/tmp/web-recordings-red.log/.exit`, real `connector_not_found`; initial original-page GREEN1/1, exit0,9.34s at later3999 presentation before archive expansion. |
| Text retained/audio failed; explicit resume | Same original form drives actual tasks. No additional transcript or discovery calls on `retry{resume:true}`. A/B detached controls covered in the initial GREEN. |
| Save and start only saves | Actual original-control RED `/tmp/web-recordings-save-start-valid-red.log/.exit1`, test commit4a6d4c1a. A prior missing-tsx/compiler attempt is an environment failure, not this RED. |
| Admitted task poll lost then React reload | Actual original-control RED `/tmp/web-recordings-poll-valid-red.log/.exit1`: missing recovery control. No asserted duplicate vendor call is inferred from that failure. |
| Exact recovery and Save/start, both vendors | Runtime `45db83a772ce4f4c74aacbf91d73f263cf04ca2d`, Feishu and DingTalk original forms2/2,no skips,exit0,20.12s, `/tmp/web-recordings-both-recovery2.log/.exit`. Connect and select/sync recovery preserve task IDs and do not repeat account probes, discovery, transcript or media. Earlier failed sync-count assertions were fixture observation errors (matching `operationId` as `operation`, then an empty suffix matching the wrong task); preserved logs are not product REDs. |
| Opaque pagination/cancellation/late A/B/M09 lifecycle | Expanded original journey at45db plus test-only lifecycle expansion reaches the final shared history assertion:22 discovered checkpoints in20+2 pages, foreign/old-selection cursors400, held transcript cancellation publishes no new archive, late successful A read and detached A button cannot populate B, explicit B4 files, M09 pause/stop retain B's archive and reject disabled intake controls. The entire test is RED, not a collection of independent passing tests. `/tmp/web-recordings-lifecycle-expanded.log/.exit1`,26.71s. |
| Disconnect retains readable full history | Actual expected4/observed0, `/tmp/web-recordings-disconnect-red.log/.exit1`; retained by the expanded journey. This is the known shared boundary in the design document, not a waived assertion or skip. |
| Original FileDetail full acoustic export | Production paths unchanged by this client increment. `/tmp/web-recording-archive-pages.log/.exit`1/1,no skips,exit0,69.88s including existing download URL timers.101 exact transcript segments fully page; explicit acoustic clips load authenticated WAV only on request; actual tar includes101 current/raw/uncorrected segments, manifest, RTTM/CSV and both speaker clips. Held A export creates no B Blob/download; B's same-ID archive independently exports its own text. First listenEPERM was an environment refusal; subsequent wrong fake endpoint/legitimate alignment merging were fixture errors, not product REDs. |

The supported IAB ran an actual Vite production build and scoped loopback host:
original login → recording route → same-recorder → connect → native date edit and
source-context version1 → save → sync. It visibly showed completed text, failed
audio attempt1, and the canonical text archive card. B's original login and same-ID
selector showed no A content or draft. Proof is `/tmp/web-recordings-iab-proof.md`
and the emitted IAB screenshot. This is representative browser proof, not a claim
of IAB retry, full tar, physical speaker, account-service or restart coverage.
The agent-created tab/host and generated directory were closed/removed.

M13's independent source-only3999 review is
`/tmp/mote-m13-review-web-recordings-3999.md`. Its task-poll recovery candidate was
subsequently proved RED. The separate bounded45db follow-up is
`/tmp/mote-m13-review-web-recordings-45db.md`: no new confirmed P0/P1/P2; recovery
candidate closed in the inspected source path. Neither report ran the owner's
tests or accepted the shared history boundary.

## Exact compositions and retained RED evidence

Joint froze source `949e66b60a071406e8288f579a62e1d62439e0e9`; only the two runtime
lines were composed as local `90493771`. Tests at `17580db6` over that runtime
completed `/tmp/web-recordings-composed-narrow.log/.exit1`:5 tests,4 pass,1 fail,
0 skipped/cancelled,169.68s. The failures were not waived:

- Original full journey passes112.98s: restart between text success and explicit
  audio resume, no repeated text/discovery, checkpoint20+2 signed pages,
  cancellation/late A/B/M09, canonical24-item history20+4, disconnect retains20
  visible cards and canonical capture navigation.
- Both original vendor recovery journeys pass13.94s/11.33s, preserving exact root
  and successor task operation IDs after ACK/poll loss and React remount.
- Original FileDetail passes14.32s: original WAV load/download exact bytes;
  current/uncorrected/raw-ASR each101 segments, RTTM/CSV/manifest/two clips; held A
  export cannot create a B Blob/download, B independently exports its own text.
- Original stop-intake checkbox remains RED19.09s, expected4/actual0 after the
  actual Save settings task completes. Earlier broad timeout and draft-state exit0
  were fixture observations, not product outcomes. The valid first RED is
  `/tmp/web-recordings-intake-disable-ack-red.log/.exit1`16.64s, then repeated on the
  composed runtime above. Joint owns this remaining select/source boundary.

The main journey timeout was then increased120→240s to include its actual host
restart and24-file archive work; assertions are unchanged and the112.98s pass
precedes that test-only deadline adjustment. Additional standalone restart and
archive-page evidence at45db is `/tmp/web-recordings-owned-restart-valid3.log`
(the original disconnect RED remains) and
`/tmp/web-recordings-archive-pagination.log/.exit0`1/1,0 skips,61.87s process.

## Intermediate original-UI GREEN

Runtime `7ee65f42ac9aa0ce9dfc0f2454723950db9efac9` adds only the two runtime lines
from Joint's explicit pause freeze
`ab776d50c3d59679a5583c53f8cb1f55cee1b014` to the prior949e composition. No Joint
custom-image or observer WIP is selected. Test commit
`fdde4d6305a3c44c2a2a31490ccc141b23402198` adds the original stopped-page card
assertion. `/tmp/web-recordings-ready-narrow.log/.exit0` completes5/5,0 skips,
0 cancellations,71.32s process: FileDetail5.72s; Feishu recovery3.45s; DingTalk
recovery3.04s; original stop/save6.74s; full original recording journey50.07s.
The stopped-intake assertion now observes4 Files and4 original UI cards after
Save settings completes. The other original restart/page/cancel/owner/lifecycle/
disconnect and full original-byte/tar outcomes described above remain asserted.
Ready Server/Web types pass (`/tmp/web-recordings-ready-types.log/.exit0`).

## Environment and full gates

Node `v24.21.0`, ABI137. Both root and mem0's actual resolved better-sqlite3
constructors passed local/no-network SELECT1 after offline compilation of this
workspace's locked dependency. Paths and receipts are
`/tmp/web-recordings-native-smoke-green.log` (first tree) and
`/tmp/web-recordings-next-native-smoke.log` (second tree). No peer node_modules or
mismatched binary was copied. The second tree's missing Electron41.10.7 was
installed by its official locked package installer from existing cache with its
packaged checksums; installation alone did not launch a renderer.

Current45db Web types and8478-message synchronized i18n pass. Earlier server types
and Vite build0 cover the first presentation; they are not current45db build claims.
Composed Server/Web types exit0 at17580db6 (`/tmp/web-recordings-composed-types.log`).
The composed workspace's root and actual mem0 native constructors both passed
Node24/ABI137 read/write/close (`/tmp/web-recordings-final-native-smoke.log`).
A complete affected invocation on immutable456bd68a was started against exact
integration6272 in the first tree, which remained unchanged while the second tree
implemented recovery. It is not a final45db gate. Its Desktop500pass/1fail is an
actual missing Electron dependency error before the hidden fixture could launch.
Later phases/terminal outcome must be read from `/tmp/web-recordings-affected.log`
and `.exit`; no running result is called passed. The first immutable456bd68a gate is terminal exit1. Server2777 tests:2764 pass,
11 fail,2 existing skips; Web543 tests:539 pass,4 fail; Desktop500 pass/1 fail due
the missing Electron dependency. The old recording failure is the then-unfixed
history boundary. Other failing cases are preserved in
`/tmp/web-recordings-affected.log/.exit1`; no current source is inferred from that
older gate. Later workspaces finished, but root follow-on tooling/Android were not
reached because check:local failed.

All four preceding immutable full gates are terminal exit1, not final-source gates:

| Tested head | Desktop | Server pass/fail/skip | Web pass/fail/skip |
| --- | --- | --- | --- |
|456bd68a|500/1 missing runtime|2764/11/2|539/4/0|
|c5b28a73|501/0|2764/9/2|542/3/0|
|dd72902e|500/1 late-ACK timeout|2770/5/2|545/1/0|
|b877919f|501/0|2771/4/2|546/0/0|

The dd729 identical isolated late-ACK case passes6.63s with its original15000ms
deadline (`/tmp/web-recordings-composed-desktop-late-ack.log/.exit0`,1 pass/35
filtered); this does not erase its full suite failure. Separate full receipts are
`/tmp/web-recordings-{affected,final-affected,composed-affected,ready-affected}.log`
and their `.exit` files. No healthy gate was interrupted or source-mutated.

A standalone Android check atdd729 initially inherited system Node26.11.1/ABI147
because PATH was omitted:352tests/1citation404 failure. That environment result is
preserved in `/tmp/web-recordings-composed-android.log/.exit1`, its evidence JSON
and `/tmp/web-recordings-android-node26-results`. Corrected explicit Node24/ABI137
with fresh root/mem0 smoke and own Gradle rerun passes352/352,0 skips,3m22s,exit0:
`/tmp/web-recordings-composed-android-node24.log/.exit0` and evidence JSON. No
Android source fix was needed; these are distinct runtime receipts.

The ready workspace uses an independent copy of this task's identical locked
Node24 dependencies, including nested workspace modules. Its initial missing
nested mem0 preflight is preserved as
`/tmp/web-recordings-ready-native-smoke-missing-mem0.log`. After the copy completed,
its actual root and mem0 constructors/read/write/close pass under Node24/ABI137,
resolving only its own ready path (`/tmp/web-recordings-ready-native-smoke.log`,
exit0); a fresh complete shared build also passes. No peer module or ABI147 binary
was copied. The b877 ready full gate is terminal exit1: Desktop501/501, Web546/546,
Server2771 pass/4 fail/2 existing skips. The four Server failures are two real
Agent subtask Ask timeouts, a file unknown-outcome retry409, and processing summary
restart `input_changed`. Agent317 pass/1 existing Codex-fixture skip; shared192/192
and diagnostics5/5. Root follow-on tooling and Android were not reached because
check:local returned1. These failures remain unwaived.

The b877 explicit Node24/ABI137 forced Android JVM consumer run is terminal
exit1:352 tests,351 pass/1 fail/0 skips,2m32s. A bounded identical failed-case
rerun also fails404. Receipts are `/tmp/web-recordings-ready-android.log/.exit1`,
`/tmp/web-recordings-ready-android-citation.log/.exit1`, the evidence JSON and
`/tmp/web-recordings-ready-android-full-results`. The failure is
`MultiuserIngressTest.native query citations use actual scoped read and cannot
fall back to raw owner history`, line173: actual note Ingress3 ACK then
`CentralEvidenceReference.readQuery` POST `/api/context/read` returns404. No
native/query behavior is changed by this recording consumer. Cause is not
confirmed; the earlier corrected Node24 pass and current Node24 failure do not
support attributing this failure to Node version. Native/query remains with its
existing owners; no raw-history fallback or bypass is introduced.


## Final actual App evidence entry

The preceding direct FileDetail harness did not prove the actual App modal entry.
Supported IAB and valid original-card regression RED at
`ad96f6a90363deee9894459eb9c513f0cdf650b8` exposed missing original-file controls:
`/tmp/web-recordings-app-entry-red.log/.exit1`,1 fail/0 skips,54.98s.

Runtime `0304fd66eb5aaa0ea76a83124a8bc342d8541da9` retains the human raw capture read
and adds only an owned capture-browser file advertisement when that raw file has
neither declared file reader. This mounts the existing FileDetail without a new
viewer or backend. M13 explicitly confirmed exclusive ownership and no existing
frozen fix. Its bounded independent source review at
`/tmp/mote-m13-review-web-recordings-0304.md` found no new confirmed P0/P1/P2;
source-only, no independently reproduced tests.

Final test `1764806956ba0e15313d99cd90b29c46c195e204` composes the actual
RecordingsSettings and EvidenceDialog, and separately tests all archive outcomes
through EvidenceDialog. `/tmp/web-recordings-entry-all-green.log/.exit0`:5/5,
0 skips/cancelled,81.55s. Main original journey57.50s; modal full archive6.48s;
Feishu/DingTalk exact recovery4.94s/5.57s; original stop/save8.54s. All earlier
recording restart/cursor/cancel/late-owner/history assertions remain. Authenticated
original WAV load/download bytes,101 complete current/raw/uncorrected segments,
actual tar manifest/RTTM/CSV/two clips and held-A-export/B-positive isolation are
now asserted through the original App evidence modal rather than direct FileDetail.

Vite build exit0 at the same final source/test tree:
`/tmp/web-recordings-entry-web-build.log/.exit0`. Final supported IAB used that
build, fresh generated accounts and actual scoped host: original login, owned
instance, source-context version1, Save/start, Disconnect retains2 history cards,
original audio card opens actual EvidenceDialog, Load original gives audio
controls=true/blob=true/duration0.5s/readyState4. Production GET Files200 and POST
playback200 recorded. This browser run enabled synthetic media before Save;
failed-stage retry and full tar are separate automated evidence. No physical
sound or real service claim. `/tmp/mote-web-recordings-entry-iab-proof.md` and
emitted screenshot preserve the proof; created tab/host closed, listener absent.

Final full affected source/test head is17648069, production runtime0304fd66, base
exact integration6272a9b51ec92cc4c32e2ff1a1eeb4fa38b142ed. Command:
`npm run check:affected -- --base origin/codex/mote-multiuser-integration`, explicit
Node24.21.0/ABI137 PATH. Fresh actual root/mem0 constructor/read/write/close smoke
passes in `/tmp/web-recordings-entry-native-smoke.log`; own Electron41.10.7 locked
official installer exit0 before the gate. Final terminal results: RUNNING, not accepted: `/tmp/web-recordings-entry-affected.log/.exit` on immutable17648069. Desktop501/501 terminal pass; Server has already reported the proposal-pagination failure and continues. Later phases and the full exit must be read at terminal. No healthy run is interrupted or duplicated. A documentation-only delivery commit does not change the tested source or dependencies..

No merge, deployment or CI dispatch. The recording-specific5/5 is finite
acceptance; it does not accept the prerequisite stack or waive other failures.
