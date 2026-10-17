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
  helper-only self response. The exact current count and native GREEN results
  will be filled after the final source is fixed.
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

## Environment and pending work

The first loopback fixture bind returned sandbox EPERM; the original narrow
command then passed through the standard approval path. The first background
Electron startup also ended before document load; its original command was
reviewed and then reached the real product RED. No approval rejection was
bypassed. Native fixtures remain hidden, with generated external-I/O substitutes.

Full Desktop Swift/native build, complete affected checks, final native GREEN,
independent source review, Draft PR and remote SHA verification remain open at
this checkpoint. Parent resource allocation was requested once; the app send
returned `thread not found`, so the request is also recorded in commentary and
`/tmp/mote-desktop-v2-resource-status.md`, with no blind message retry.
