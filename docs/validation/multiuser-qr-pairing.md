# QR pairing producer acceptance

All data is generated in fresh temporary SQLite databases. No running Central
instance, personal data, real credentials, screenshots, live model, external provider,
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
`check:central`. All full runs used the serial heavy slot; no Gradle, Docker or
live-model opt-in ran.

The first sandboxed run reproduced loopback `listen EPERM`; it was terminated
with exit 143. The first unsandboxed run had an inappropriate 600-second total
boundary and exited 124. That incomplete run is not acceptance evidence. A
subsequent run was stopped after 59 seconds solely to resolve a delayed resource
claim collision; it is void. Only the owned process groups were stopped.

The next required command ran to its **natural terminal**, with no total cutoff,
at `340fca21baf6bf3602f04fff2b23072d3ae7329b`:

- **EXIT 1**, 963 seconds overall. Server: 2679 tests, **2673 pass, 4 fail,
  0 cancelled, 2 existing skips**, 847.469 seconds.
- Central shared/agent/server/Web builds and all four typechecks: pass.
- Shared: **192/192**; Agent: **317 pass, 1 existing installed-Codex opt-in
  skip**; Web: **515/515**, no skips, 62.894 seconds.
- Server failure prevented central-runner and release-tool stages from running.
- Generated-only local evidence: `/tmp/mote-qr-complete-affected.log` and `.exit`.
  No log or generated database is committed or attached to the PR.

The natural terminal disproved the suspected Ask hang: its 47 cases completed,
including the real 71-second automatic Insight case. Earlier cancellations were
caused by the total cutoff, not accepted evidence of a product hang. Existing
per-case timeouts and suite concurrency remain unchanged.

The two earlier failures were reproduced against unchanged `f08edd47` and repaired
without weakening assertions in `340fca21`:

- Export child import now resolves from `import.meta.url`, independent of npm's
  workspace cwd. Its settle/child timeout/error/exit assertions remain. Baseline
  workspace RED 0/1; repaired root GREEN 1/1 and workspace composition GREEN 13/13.
- The binary auth/CSRF fixture replaces the inherited octet-stream parser before
  registering its synthetic parser. Baseline RED 0/1; the same workspace
  composition is GREEN 13/13. All byte and authorization assertions remain.
- Both cases also passed in the natural complete full run above.

The four failures found by the complete run received named-case reproduction
(durations below are command wall times):

| Case | Unchanged prerequisite baseline | Current RED | Repair and actual narrow GREEN |
| --- | --- | --- | --- |
| MCP UTF-16 read | Isolated 1/1; implicated test/production paths unchanged | 0/1 `not_found`, before range assertions | Wait for actual formal publication and use its canonical original reference; retain emoji/range/spans/raw-UUID rejection assertions. 1/1, 2.293 s. |
| Summary pages across restart | 0/1 `provider_unavailable` | Same 0/1 | Use explicit 429 capacity rejection rather than ambiguous 503, wait for real persisted `rate_limited` state. Retain completed-page, restart, old model snapshot, usage and final output assertions. Bare 503 acknowledgement remains covered by its dedicated case. 1/1, 5.319 s. |
| Exact snapshot recovery | 0/1 upload commit 409 `external_result_unknown` | Same 0/1 | Production local-byte admission now precedes external issuance on cache miss, sharing one exact-original pin through extraction. Retain all recovery/retry/B assertions and add zero-issued-call assertion before recovery. 1/1, 2.815 s. |
| Web feature metadata | 0/1 obsolete absent-import assertion | Same 0/1 | Assert the actually registered scoped imports route, real empty response and anonymous 401; keep all Library assertions. 1/1, final 2.033 s. |

Snapshot recovery is an inherited **production seam regression**, not a test
expectation to relax: recording an external call before a local expired-byte
check left an unknown result, so the existing no-blind-replay guard correctly
blocked recovery. The separate minimal repair keeps that guard and all external
activity tracking. Pin acquisition is lazy inside actual uncached work, so cached
stages and artifact-only transforms do not acquire a new byte requirement.
Related real single cases remain GREEN: pin/retention 1.164 s, snapshot release
2.421 s, unknown external transport 2.621 s, ASR checkpoint restart 2.563 s.
Fully cached stages after byte expiry received source review, not a separately
forced runtime scenario.

Named-case local evidence uses `/tmp/mote-qr-*-baseline-repro.log`,
`/tmp/mote-qr-*-current-red.log`, `/tmp/mote-qr-*-fixture-green.log` and
`/tmp/mote-qr-*-pin-green.log`, each with its actual exit file. No new skip or timeout increase was introduced. The obsolete Web absent-import
assertion was explicitly superseded by registered-route, real-response and
authentication assertions; Library, range, checkpoint and recovery outcome
assertions remain.

Fixture repair commit: `79d94dfd77077d44337102e8553ca92f4135b0f6`. Separate
production seam repair: `87ba2f2c4d2738d32673a1a9d586a7af5810d33c`. Both
received bounded independent source review; reviewers ran no additional heavy
checks. Joint also independently reviewed exact `87ba2f2c` and accepted composition
with its current M06 physical-call and unknown-result fences, with no newly
confirmed issue. It did not run tests or modify this workspace. QR authentication
producer bytes remain at the original `6a84ec6a` freeze.

The repaired composition then ran the **complete required command to natural
EXIT 0**, 983 seconds, at `489943ad790103dfa3ec5f0169753484c8e9db81`:
shared **192/192**, agent **317 pass + 1 existing opt-in skip**, Server **2677 pass,
0 fail/cancelled, 2 existing skips (2679 total)**, Web **515/515**, central runner
passed, release tools **52/52**. All four builds and typechecks passed. The four
previously failing cases passed in this full run. Evidence is local generated-only
`/tmp/mote-qr-repaired-affected.log` and `.exit`. The owned process group 22906
was verified empty and the log had no writers before explicit heavy RELEASE.

During that run, Joint found a further real cleanup defect outside the existing
assertions: disabling an account made an acquired pin's release reauthorize and
throw `invalid_identity`. The shared pin's longer held-response lifetime made
this cleanup boundary relevant to the preceding repair. This is a new confirmed
regression scenario, not a reason to label the earlier completed suite a failure
or to claim it covered this case.

The untouched full snapshot continued while an isolated committed-source copy
ran real service/SQLite regression cases: primitive and held-response **0/2 RED**,
exit 1. A separate real held-response case also failed with remaining pin count 1.
The minimal repair is `1d6d933c6eda6b8fb8baa1e01db34024872359b2`:
`PrivateSql.pinDisposer` authorizes preparation of one fixed owner/UUID DELETE;
`Originals.pin` prepares it before the still-authorized INSERT and returns it only
on success. The zero-argument disposer can remove only that pin, returns no data,
and cannot renew reads, allocate pins or restore grants. Ordinary SQL remains
authorized. It changes no external-call/unknown-result bookkeeping.

Actual final code in this workspace passes **9/9**, no skips, 11.783 seconds wall
time: A's two pins and B's equal-byte pin remain distinct; duplicate disposal only
removes the allocated UUID; retired A reads/new holds stay denied; B remains
usable; all eight existing held-response retirement cases acquire one pin and
release it after actual completion. Their original no-publication/A/B assertions
remain. Evidence: `/tmp/mote-qr-pin-candidate-red.log`,
`/tmp/mote-qr-held-pin-red.log`, `/tmp/mote-qr-pin-final-own-green.log` and exit
files. Intermediate candidate runs are not substituted for that final-code result.
Bounded independent source review accepted the exact cleanup capability and mint
ordering without running additional tests.

The complete **post-disposer** affected gate is pending fresh serial allocation.
The completed green `489943ad` check does not cover the new disposer commit.

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
