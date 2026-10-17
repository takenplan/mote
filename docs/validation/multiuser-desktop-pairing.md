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
