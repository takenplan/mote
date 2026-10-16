# QR pairing producer acceptance

All data is generated in fresh temporary SQLite databases. No running Central
instance, personal data, real credentials, screenshots, model, external provider,
Android build or deployment was used. This report covers the producer and its
real production entry point, not Web/Android/physical-camera delivery.

## Scope and dependencies

The local feature branch is `codex/mote-multiuser-qr-pairing`, targeting Draft PR
base `codex/mote-multiuser-integration` (`6272a9b51ec92cc4c32e2ff1a1eeb4fa38b142ed`).
The composed prerequisite snapshot is Joint `f6ac6cd1` (stable `c45fdb4a`) plus
M15 `edfba1fc` and `a648da5a`, locally applied as `9ef22bb6` and `f08edd47`.
The pending Joint Files-cancel candidate `3ddfd60d` is not included. This is a
stacked module PR: prerequisites remain visible until integration adopts them.
The isolated QR delta and checks use `f08edd47` as the comparison base.

Original capability mapping and frozen producer/consumer responsibilities are in
[the contract](../design/multiuser-qr-pairing.md). Web remains M13 and Android M15;
this module edits no QR consumer. M15's separate central-purpose prerequisite
contains its previously owned Web/native changes and retains their provenance.

## RED then GREEN

- On unchanged pre-producer `f08edd47`, the three original production HTTP cases
  failed at authenticated invitation creation: actual 503 `scope_unavailable`,
  expected 200, 0/3 pass, exit 1, 3.103 s. Command:
  `node --import tsx --test --test-concurrency=1 apps/server/test/multiuser-qr-pairing.test.ts`.
  Local generated-only evidence: `/tmp/mote-qr-red.log`.
- The independent seven handoff/SQLite cases were also run unchanged against an
  isolated source copy of `f08edd47`: 0/7 pass, exit 1, 1.521 s, after real
  account initialization, missing `handoffs.invitation`. Evidence:
  `/tmp/mote-qr-handoffs-baseline-red.log` and `.exit`. Its earlier run happened
  after producer edits and was actually GREEN; a misleading original filename
  was corrected, and that run is not counted as RED.
- Current QR HTTP and independent handoff files pass 11/11, exit 0, 3.477 s.
  Command uses both files with the same `node --import tsx --test
  --test-concurrency=1` entry. Evidence: `/tmp/mote-qr-combined2.log`.
- After the ingress positive/other-device negative and final retained-consent
  fence, the final narrow command adds `login-handoffs.test.ts` and
  `scope-architecture.test.ts`: 20/20 pass, no skips, exit 0, 5.678 s, including the additional source-only
  and ingress-only known-device regression. Evidence:
  `/tmp/mote-qr-final-narrow3.log`.
- `npm run typecheck -w @mote/server`: exit 0. Initial environment setup was
  missing the workspace-local mem0ai dependency directory; copying the installed
  dependency artifacts into this independent clone resolved that setup failure.
- `git diff --check`: exit 0. Scope inventory explicitly declares all three new
  production APIs; architecture tests pass without a bypass.

The HTTP tests invoke production `buildApp`, protocol/auth/CSRF route wrappers,
real Accounts and real SQLite. Independent handoff tests retain actual Accounts
issuance and revocation behind controlled async publication barriers. The
replacement failure uses a real SQLite trigger, not a mocked credential service.
No model calls or external I/O are needed.

Covered transitions: scan/URI/JSON contract; immutable account/deployment/origin/
purpose; forbidden central escalation; same-ID A/B; concurrent same-claim retry;
changed challenge/device/name/platform; wrong verifier; reapproval by B; cancellation
before and during publication; shutdown during publication; expiry/restart;
creator logout and account disable; token/PKCE secrecy in persisted records;
same grant polling; ACK retry tombstone and late old ACK; credential revocation
before ACK; device ingress/self/logout positive and private API/mint/ticket
negative; stale A tab using B cookie; explicit original-device replacement,
label preservation, real database failure rollback and independent B survival.

Independent source review accepted the producer without a new confirmed P0/P1/P2.
The reviewer reran its seven actual Accounts/SQLite cases: 7/7, exit 0, 1.357 s,
`/tmp/mote-qr-handoffs-final-green.log` and `.exit`. The follow-up source-only
known-device HTTP test was added after that review and passes in the final 20.
`node scripts/check-i18n.mjs`: 8440 bilingual messages/call sites, exit 0.

Production freeze: `6a84ec6a477bb4698002234fd81bb669ce98cc06`. Later commits
may add tests or evidence without changing these producer bytes.

## Broader checks and limits

`npm run check:affected -- --base f08edd47 --dry-run` selects i18n and
`check:central`. A full run requires the shared fresh heavy-slot protocol.
No uncoordinated full suite, Gradle or Docker is started.

An initial narrow adjacent run included all of `multiuser-auth.test.ts`: 22/23
passed, with one existing fixture failure:
`authentication composes with a binary private route while Cookie mutations
still require CSRF` registers `application/octet-stream` already registered by
composed M03. Both that test and the production Ingress parser are byte-identical
to `f08edd47`; the failure occurs before its authentication assertions and is
not presented as a new QR defect or a green full-M01 file.

Still unverified here: Web QR rendering/navigation retirement, Android scanner
and pending journal/account-switch lifecycle, Desktop v2 import, physical camera,
public HTTPS, deployment/CI and real models. The producer's stale-cookie and
late-state tests do not substitute for those consumers' real UI acceptance.
No PR merge, deployment or CI enablement is authorized or performed.

## Coordination transport

Initial parallel `mcp__codex_app__read_thread` calls for M13
`01a14387-a58b-7034-bf83-d52d244a301f`, M15
`01a143cf-0aef-76c1-b470-6e9cb05c301f` and Joint
`01a1458f-2412-722d-a4ca-9a9cb5ee4023` returned no output before the wrapper was
terminated; their read outcome is unknown. They were not blindly retried. Direct
M15 and Joint handoffs supplied the actual frozen contract and exact source IDs.

`mcp__codex_app__send_message_to_thread` to parent source
`01a12869-a15d-757c-915f-af280c62f003` returned `thread not found` (denied/not
sent). M15 and Joint returned `An earlier turn submission is not yet confirmed`
(pending/uncertain); those sends were not repeated. M13 messages succeeded,
including the request to relay producer scope and a fresh heavy-slot claim.
