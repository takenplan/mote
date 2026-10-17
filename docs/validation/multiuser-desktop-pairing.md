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
  helper-only self response. Latest parser 55 + host 28 = **83/83**, exit 0,
  with actual ConfigStore session-only save/load and unchanged source hashes:
  `/tmp/mote-desktop-v2-session-only-green.log/.exit`.
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

## Final bounded native snapshot

The final hidden Electron runner passed **19/19**, exit 0:
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
