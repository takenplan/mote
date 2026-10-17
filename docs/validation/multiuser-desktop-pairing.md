# Desktop v2 pairing validation

Work in progress. This record is not a final affected/build acceptance claim.
All accounts, invitations, device metadata and content used here are generated.
No personal Central database, log, derived data, live model or real credential
was read, attached, stashed or committed.

## Actual RED and bounded GREEN

- Parser RED used the existing shared v1 production parser with the new v2
  contract: 5 failed / 50 passed, exit 1. The standalone Desktop v2 parser then
  passed 55/55, exit 0. Logs: `/tmp/mote-desktop-v2-parser-{red,green}.log/.exit`.
- Real Electron RED used M14's existing generated main/preload/renderer. A
  production-generated v2 URI entered through the actual connection page and
  IPC failed with the old v1-required error. Exit 1, retained in
  `/tmp/mote-desktop-pairing-native-red-authorized.log/.exit`. An earlier
  sandbox startup exit happened before product assertions and is not this RED.
- Production host narrow tests use real Fastify TCP, Accounts and SQLite, not a
  helper-only self response. Latest parser 55 + host 31 = **86/86**, exit 0,
  with actual ConfigStore session-only save/load and unchanged source hashes:
  `/tmp/mote-desktop-v2-same-invitation-green.log/.exit`.
- Translation catalog and Desktop noEmit checks passed during implementation.
  The full `check:affected` dry-run correctly selects all TypeScript consumers
  and Android; a dry-run is not a gate pass.

## Original-device timer regression

Independent review of `ed87457b` identified a P2: redeem revokes the original
device token, so the ordinary auth timer could sign out while the new pairing
was still in flight, then hide its recovery checkpoint. Actual emitted-main
Electron RED held poll across 16 seconds and observed one old-token self 401,
local sign-out and no visible pending recovery. Exit 1:
`/tmp/mote-desktop-pairing-auth-timer-red.log/.exit`. A production-host recovery
test independently reproduced the hidden checkpoint after the exact sign-out
transformation, exit 1: `/tmp/mote-desktop-v2-source-signout-red.log/.exit`.

The fix defers only automatic sign-out while pairing is active and retains an
exact original signed-out fingerprint for explicit recovery. Explicit logout,
B login and current-document fences remain mandatory. Actual Electron GREEN
passed both the 16-second real auth-timer/lost-poll/SIGKILL/recovery journey and
explicit preload logout during held new self, with no late ACK/publication and
queue recovery to the original A account:
`/tmp/mote-desktop-pairing-auth-timer-green4.log/.exit`, exit 0. A fixture-only
stale signed-out snapshot and an old-document Promise wait were corrected;
their earlier failure logs remain failures.

A separate actual ConfigStore RED reproduced process-only login restart with
`token:undefined` but stored `authSignedOut:false`; its original account recovery
was hidden, while B correctly remained denied. The exact source projection fix
then passed all 83 parser/host tests. RED:
`/tmp/mote-desktop-v2-session-only-red.log/.exit`; GREEN:
`/tmp/mote-desktop-v2-session-only-green.log/.exit`.

## Prior bounded native snapshot

Before the additional same-invitation fix, the hidden Electron runner passed **19/19**, exit 0:
`/tmp/mote-desktop-pairing-native-final.log/.exit`. It exercises actual
main/preload/renderer and the production host, including URI/JSON/generated QR,
pre-POST PKCE persistence, real device 403 capability checks, original-device
replacement, A/B queues and actual ingress, three lost responses/SIGKILL recovery,
Central restart/ACK410, revoked/expired credentials, exact self/poll mismatches,
late A callback after B login, same-URL deployment replacement, real auth timer,
explicit logout and recovery-button cleanup. External native/network I/O only is
substituted.

The source/compiled-output/script manifests before and after are byte-identical:
`/tmp/mote-desktop-pairing-final-{before,after}.sha256`, manifest SHA-256
`a4516a9a084d129b0f8b3a876ebd789468191c5fbb134cf9b7f187c89b366025`.
Runtime base `5574ba45` plus the now-committed UI/test delta is the tested source.
Generated hidden-window screenshot was visually inspected at
`/tmp/mote-desktop-v2-connection-ui.png`; the final DOM proves no pending
checkpoint and hidden recover button, and a visible origin-confirmation preview.
The earlier actual DOM stale-button RED remains
`/tmp/mote-desktop-pairing-ui-cleanup.log/.exit`; its focused GREEN is
`/tmp/mote-desktop-pairing-ui-cleanup-green.log/.exit`.

## Same-invitation retry regression

Review after `cb368d67` found a second P2: reconfirming an already claimed
invitation with a changed device name could overwrite the only encrypted PKCE
checkpoint, then fail the immutable server claim. Exact signed-out source
reconfirmation also failed to reuse that checkpoint. Three real production-host
regressions failed, exit 1, before the fix:
`/tmp/mote-desktop-v2-same-invitation-red.log/.exit`. Actual emitted-main Electron
also reproduced changed journal/verifier/name and a second redeem POST through
the connection UI, exit 1:
`/tmp/mote-desktop-pairing-same-invitation-red.log/.exit`.

The fix keeps the original same-invitation claim immutable. Changed metadata
or a different source connection gets a local conflict without rewriting the
journal; the exact signed-out source reuses the same verifier. Parser 55 plus
production-host 31 passed 86/86, exit 0, with unchanged source hashes:
`/tmp/mote-desktop-v2-same-invitation-green.log/.exit`. The earlier `cb368d67`
review conclusion is superseded by this finding and repair. The actual Electron single-case GREEN then kept journal/verifier/name unchanged,
sent only the first redeem POST before explicit recovery, and published the
original durable device name. Exit 0:
`/tmp/mote-desktop-pairing-same-invitation-green.log/.exit`. Source, output and
script manifests stayed identical (SHA-256
`fea0d745f438f17c4fd63c600402ca37ec73d2327b896bc9ff9f18547caa6c31`). A new
fixed candidate still requires a complete affected run and all native scenarios.

## Environment and pending work

The first loopback fixture bind returned sandbox EPERM; the original narrow
command then passed through the standard approval path. The first background
Electron startup also ended before document load; its original command was
reviewed and then reached the real product RED. No approval rejection was
bypassed. Native fixtures remain hidden, with generated external-I/O substitutes.

The independent source review identified and then followed up the original-device
P2; no new P0/P1/P2 remained in the reviewed fix. Parent allocated the next
heavy window at 00:27. A fresh reviewed process inventory found no active
heavy candidates (`/tmp/mote-desktop-v2-fresh-resource-check.json`). Full
Desktop Swift/native build, complete affected checks, Draft PR and remote SHA
verification remain open at this fixed candidate. The earlier parent app send
returned `thread not found` and was not blindly retried; the allocation arrived
as a new delegation. No other owner process was stopped.

## Inherited delegated-test wait budget

The full affected run at runtime candidate `32f8215c` encountered an inherited
M14 Ask test failure: the default 20-second `f.wait` expired while the second
child had validated and its parent was still advancing. Isolated original-source
execution reproduced `Ask timeout`, exit 1:
`/tmp/mote-desktop-v2-ask-retry-isolated.log/.exit`. A temporary same-source
probe changed only that test's wait to 60 seconds and retained all three business
assertions: completed parent, `{one:1,two:2}` child starts, and one stored turn.
It passed in 25.448 seconds (27.288 overall), exit 0:
`/tmp/mote-desktop-v2-ask-wait-probe.log/.exit`. The adjacent delegated scenario
already uses 60 seconds; production has no 20-second cutoff for this journey.

The committed correction changes only the one test's explicit finite wait to
60 seconds, under the existing 120-second Node test bound. It does not alter
production retries or weaken assertions. The already-failed own gate was stopped
only after exact launcher/PGID verification; its partial output and controlled
interruption remain `/tmp/mote-desktop-v2-affected-attempt4.*`, never a pass. The corrected repository test then passed 1/1 in 30.249 seconds
(31.833 overall), exit 0: `/tmp/mote-desktop-v2-ask-wait-green.log/.exit`. A
new complete affected run is required. Desktop runtime/source and the actual
Electron 20/20 acceptance remain byte-identical to runtime candidate `32f8215c`.

## Complete natural run and isolated Actions completion budget

The full affected command at `531b64ae547cb8bee0f8141aeca21d12eab83dcb` reached
a natural exit 1, with identical before/after SHA. Preserved evidence:
`/tmp/mote-desktop-v2-affected-attempt5.{log,exit,sha,after.sha,started,finished}`
and `.result.json`. It ran from 01:23:30Z to 01:50:29Z on 2026-10-17.
Desktop passed 587/587, Web 515/515, Agent 317 with one skip, Diagnostics 5/5,
and Shared 192/192. Server had 2,636 passes, one failure, one skip and zero
cancellations. The corrected Ask retry case passed in the full run (17.599 s).
The nonzero workspace result short-circuited the root extra scripts and Android
phase; those were not claimed as run.

The one failure was the inherited Actions catalog scenario, before its pagination
assertions: `complete(other-source)` returned false at the default 15-second
`waitForState` deadline. The production watcher itself has a 15-second interval,
and actual model generation is additional work. The test title's “before its
limit” means filtering sources before applying a result-count limit, not a
performance threshold. An isolated temporary-source probe retained all original
assertions and observed the job move from absent through pending/running to
completed/succeeded in 23.034 s, one attempt and no error, with 16 proposals.
The complete scenario passed in 36.099 s (37.631 s overall), exit 0:
`/tmp/mote-desktop-v2-action-catalog-probe.log/.exit`. Its 15-second scheduled
sample was not dispatched before the job completed; no intermediate sample at exactly
15 seconds is claimed. Detailed observations are in
`/tmp/mote-desktop-v2-action-catalog-probe-result.md`.

The minimal correction adds an optional timeout to the local `complete` helper,
keeps its default 15 seconds and changes only this catalog scenario's
`other-source` wait to 60 seconds. Shared helpers, other cases, all business
assertions and production deadlines remain unchanged. A fresh complete affected
run is still required. The corrected repository source case passed 1/1 in
30.084 seconds (31.460 overall), exit 0:
`/tmp/mote-desktop-v2-action-catalog-source-green.log/.exit`. Tested blob
`435a4eadd6d1d887cc487112c3d8cba41a7c49b0` remained identical before and after.

Timing here is uncontrolled functional evidence. Concurrent local work and
resource snapshots are retained in
`/tmp/mote-desktop-v2-concurrent-load-context.json` and
`/tmp/mote-desktop-v2-current-resource-metrics.json`: 18 logical CPUs, reported
74% available memory and approximately 228 MiB swap use at the later sample.
The initial I/O snapshot is cumulative, not a sample at the failure. There is
no controlled performance baseline or proof of timing causality; neither the
wait corrections nor individual successes establish absence of a performance
regression. No global timeout increase or production retry-policy change was
made. The residual old-run Web paging failure separately passed its original
single-file test in 86.07 s without changes; its cause was not inferred from
that single success.

## Inherited PID-marker publication race

Complete attempt 6 at `fa13a8c6f5797ab30e3d1a44c3aa16a07bfec0cb` naturally
exited 1, with identical before/after SHA, from 01:56:27Z to 02:24:43Z on
2026-10-17. Desktop passed 587/587, Server had 2,636 passes, one failure, one
skip and zero cancellations, Web passed 515/515, Agent had 317 passes and one
skip, Diagnostics passed 5/5 and Shared passed 192/192. The only failure was
`multiuser-plugin-ingress.test.ts`: after plugin deletion, the observed PID
still appeared alive. Evidence is retained as
`/tmp/mote-desktop-v2-affected-attempt6.*` and `.result.json`. Root extra scripts
and Android were short-circuited and are not counted as run. Both earlier
finite-wait repairs passed in this full run: Ask 35.062 s and catalog 43.560 s.

The original isolated plugin-delete test passed 1/1 in 1.199 s; that alone did
not explain the whole-run failure. A same-source production-entry probe made
the async marker's existing create-before-write window explicit. The parent
read zero bytes and parsed PID 0, while the actual worker PID was 14337. After
deletion the actual worker had exited, but `process.kill(0,0)` continued to
observe the current process group and the unchanged 10-second assertion failed.
Probe exit 1: `/tmp/mote-desktop-v2-plugin-pid-race-red.log/.exit`. This confirms
a fixture defect; the earlier whole-run log did not capture its PID, so its
historical cause is not claimed as proven.

The durable real-entry regression enables a 200 ms partial PID write only in
the plugin-delete scenario. With the original parent observation it failed,
exit 1: `/tmp/mote-desktop-v2-plugin-pid-source-red.log/.exit`. The minimal fix
waits for a positive safe-integer PID before deletion, under the unchanged
10-second readiness deadline. The subsequent 10-second process-exit assertion,
stale task, null result, no events, no A publication and unaffected B assertions
are unchanged. The entire real plugin/Ingress file then passed **9/9**, exit 0,
in 17.421 s: `/tmp/mote-desktop-v2-plugin-pid-source-green.log/.exit`, tested blob
`b03b075120e49df1a17db58010e435549aaecc6f`. No production code, shutdown policy
or timeout was changed. A new complete affected run is required.
