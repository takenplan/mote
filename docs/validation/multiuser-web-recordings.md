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

## Final original-UI GREEN

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

Second immutablec5b28a73 gate is still running; Desktop60files/501tests passes.
Third immutabledd72902e gate is still running; Desktop500pass/1late-ACK timeout.
The same third candidate's isolated late-ACK case passes6.63s without changing its
15000ms deadline (`/tmp/web-recordings-composed-desktop-late-ack.log/.exit0`,
1 pass/35 filtered); this does not erase the full suite failure.

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
was copied. Final ready same-candidate affected/Android receipts and independent
Draft PR will be recorded after their terminal results. Running gates remain
unaccepted; no merge, deployment or CI dispatch is requested.
