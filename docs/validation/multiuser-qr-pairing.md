# QR pairing producer acceptance

All data is generated in fresh temporary SQLite databases. No running Central
instance, personal data, real credentials, screenshots, model, external provider,
Android build or deployment was used. This report covers the producer and its
real production entry point, not Web/Android/physical-camera delivery.

## Scope and dependencies

Draft PR [#144](https://github.com/utopiafar/mote/pull/144) was created and
attached to the task. It is not merged.

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

`npm run check:affected -- --base f08edd47 --dry-run` selected i18n and
`check:central`. After the fresh M15 RELEASE, QR took the sole heavy CLAIM and
actually ran that required command.

The first sandboxed run failed to bind fixture loopback servers. A selected actual
Codex fixture reproduced `listen EPERM: operation not permitted 127.0.0.1`; this
was an environment failure, not a QR RED. Only that run's own process tree was
terminated (exit 143). The rerun outside the sandbox used generated fixtures and
a 600-second total boundary, with no live-model opt-in:

- Central shared/agent/server/Web builds: pass. All four typechecks: pass.
- Shared full suite: **192/192**, no failures/skips.
- Agent full suite: **317 pass, 0 fail, 1 existing optional installed-Codex skip**,
  318 total, 30.998 s. The sandbox failures did not recur.
- Server full suite: **incomplete**. The wrapper reached 600 seconds and exited
  **124**, preserving `/tmp/mote-qr-affected-unsandboxed.log` and `.exit`. Server
  records include unfinished Ask/connectors/import files and cancellation of
  later files, including QR files not reached in that full run. These are not
  relabeled as new QR product defects or a green complete suite. They have not
  received a separate baseline run in this task.
- Two confirmed existing fixture incompatibilities are independently located:
  `file-export-stream.test.ts` uses repository-root-relative import under the npm
  server workspace cwd (`apps/server/apps/server/src/file-export-tar.ts` missing);
  `multiuser-auth.test.ts` adds the already registered octet-stream parser before
  its assertions. Both tests and implicated production files are byte-identical
  to `f08edd47`. The export case passes **1/1** from repo root (0.185 s) and fails
  **0/1** from workspace cwd (0.178 s), `/tmp/mote-qr-export-root.log` and
  `/tmp/mote-qr-export-workspace.log`. The earlier adjacent M01/narrow composition
  was 22/23 with that same duplicate parser failure.
- Web tests started around termination, but no completed Web suite result is
  claimed. Central runner and release-tool checks were not completed. No Gradle
  or Docker ran.

The bounded wrapper's termination allowed remaining npm children to continue
briefly. Only writers of this exact generated check log were identified and
stopped as the same owned process group. `lsof` confirmed zero remaining log
writers. QR then explicitly RELEASED the heavy slot in commentary for M15/Joint.
The independent final QR/legacy/scope narrow run remains **20/20**, as recorded
above; full-run canceled file records do not supersede that completed run.

The full affected gate is therefore **not green**. Its remaining Server/Web/
runner/release coverage must not be inferred from successful builds, narrow QR
checks or a later docs-only selector check. The complete local log contains only
generated test data and is not committed or attached externally.

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
Later explicit parent requests to return the exact freeze still returned `thread
not found`. New M15/Joint fresh-status and actual-RELEASE replies still returned
`An earlier turn submission is not yet confirmed`; no blind retries were made.
The parent and M15 supplied subsequent direct handoffs confirming they had read
producer freeze `6a84ec6a`, and M15 combined it while retaining consumer ownership.
The parent reports M13 remains stuck in its old turn; Web integration is not
claimed. Commentary supplied the actual CLAIM/RELEASE and interface summary when
native message delivery could not be confirmed.
