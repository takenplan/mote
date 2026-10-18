# Scoped processing reliability validation — 2026-10-18

Decision: [scoped processing reliability](../adr-scoped-processing-reliability.md)
and [cross-client resource waiting](../adr-task-recovery-and-execution-budgets.md).

## Required journeys

| Journey | Important transitions and evidence |
| --- | --- |
| Shared worker capacity | Multiple accounts/originals share one physical worker; independent workers can progress. Busy is waiting, without consuming failed attempts or processing time. |
| Queue lifecycle | Restart before issuance resumes waiting; cancellation, configuration change and revoked authority prevent old dispatch/publication. |
| Execution-fact receipts | Exact authenticated request lookup, duplicate submission, worker restart, response loss, and no result-body persistence. Unknown is never inferred to be nonexecution. |
| Memory service fairness | Continuous extraction still allows ready review/publication; account fairness and consistency lock remain. |
| Safe diagnosis | Validation/tool/timeout/internal failures retain fixed safe causes, without arbitrary messages, original content or credentials. |
| Independent accounting | Multiple queries under one lease, failed queries with known usage, replacement cumulative samples, duplicate receipts, interrupted fragments and successful checkpoint reuse. |
| Recording authorization | Empty instance setup, authorize/reauthorize, complete device link, pending/expiry/cancel/reload and account isolation. |
| Dependency delivery | Supported fixed CLI versions are prepared by deployment; offline contracts and missing/wrong runtime behavior are checked separately from real login. |

## Execution results

All automated inputs were generated fixtures in isolated temporary storage,
loopback services or containers with networking disabled. No personal collection,
historical repair/replay/backfill or old-version compatibility was performed.

### Focused regressions

- Execution-engine and scoped-media queue journeys: 20/20 passed. This includes
  shared worker serialization across accounts/originals, independent workers,
  durable busy waiting, issuance, response loss, worker restart, explicit replay,
  cancellation/revocation, stage fairness and processing budgets.
- Both real import lease-recovery cases passed alongside these 20 cases (22/22
  jointly). The recovery tick immediately fences an expired grant without eagerly
  aborting its local handler. In the covered import recovery cases, the active-step
  guard prevents a replacement execution from racing the previous handler's
  asynchronous cleanup. Existing cancellation and renewal behavior remains separate.
  This preserves authorized import recovery after the first or last committed
  original without counting the interruption as a failed processing attempt.
- Worker wrapper, profile and storage-owner regressions: 14/14 passed; persistent
  execution-fact Python regression: 1/1 passed. Existing ASR checkpoint and media
  transport regressions: 2/2 passed; confirmed extraction retry cases: 8/8 passed.
- Final accounting follow-up: 31/31 passed across image acceptance (6), native
  provider interruption (3), fragment/429/Memory cases (17), and existing image
  harness/recipe/snapshot journeys (5). Nested JSON, schema and missing pixel-read
  rejection retain failed usage with known tokens, without a repair request.
  Native Hindsight cancel/model revocation retains reported cumulative tokens as
  incomplete; native Mem0 revocation keeps opaque usage unknown and sends no
  additional embedding request. Interruption cannot recreate erased rows.
- Real production-process Ask SIGKILL recovery passed with five independent
  fragments per account: four completed queries and the interrupted issued query
  with unknown usage. The interrupted/reexecuted child shares its frozen lease
  while retaining distinct fragment IDs. The real transcription/diarization
  restart case passed with two successful media fragments per account, distinct
  request IDs and no repeated successful ASR call.
- A native provider endpoint/model mismatch remains `blocked/config_invalid`,
  performs no transport, produces no usage and keeps the builtin binding. Its
  focused case and 16 related native/fragment/Memory regressions passed.
- The two M06 receipt tables are installed through the existing schema entry
  point. Private SQL, media queue and cleanup checks passed (22/22). The complete
  scope checker and architecture/private-data cases passed (19/19), including
  negative tests that reject the new helpers from unreviewed scoped consumers.
  New imports are registered as five exact caller/helper pairs, with no general
  import or SQL exemption.
- Recording authorization: 87 server, 16 Web and 7 deployment fixtures passed;
  22 fixed native CLI offline contracts and hidden Chromium desktop/mobile
  journeys passed. Detailed evidence and manual follow-up are in the
  [authorization record](connector-authorization-2026-10-18.md).
- Final Web follow-up: 8 focused cases and 4 server authority consumers passed.
  Owned recording commands survive the source-ID change caused by their own
  disconnect while account/API/instance generation changes still abort old work.
  The regression forces status to change before the terminal task receipt and
  rejects writes from old controls. Image unknown-confirmation exercises the
  original UI after its restarted coordinator has settled.

### Production container

The repository Dockerfile built successfully for `linux/arm64` from implementation
commit `f4c72639`. Local image identity:
`sha256:d47cf0e648f7540a52223637b034ac959c060e7e3b6e915c37ff2c2fc68bf667`.
The runtime was tested as UID 1000 (`node`) with `--network none` and fresh named
volumes:

- Production entrypoint, Docker health check, bundled Web, unauthenticated 401,
  generated-account login and same-volume restart retained the account identity.
- Fixed Lark 1.0.98 and DWS 1.0.64 binaries were executable by the runtime user.
- Root-only storage initialization prepared `/data`, `/models` and `/worker-facts`;
  the real OCR HTTP worker and execution-fact helper ran as `node`, with only the
  recognition function replaced by a generated stub. Authentication, exact scope
  lookup/deletion, duplicate requests and running-receipt erasure refusal passed.
  After SIGKILL and recreation with the same volume, an unfinished receipt became
  `unknown/worker_restarted`, its incarnation changed and the old ID did not run
  again. SQLite contained only the approved metadata columns. All temporary
  containers and volumes were removed; no model weights were loaded.

### Final repository gate

`npm run check:affected -- --base origin/main` passed (exit 0) against implementation
commit `f4c72639` and base `933566e1`. It selected all three consumers and tooling.
Node 26.11.1/npm 11.20.0 ran the TypeScript checks; Android used JDK 21 and SDK 36.

| Check | Result |
| --- | --- |
| Bilingual catalog/call sites | 8,636 messages checked |
| All workspace and script TypeScript checks | Passed |
| Desktop | 599 passed |
| Server | 3,118 passed, 2 opt-in checks skipped, 0 failed |
| Web | 601 passed |
| Agent | 327 passed, 1 opt-in check skipped, 0 failed |
| Diagnostics / Shared | 5 / 198 passed |
| Release, workers, security, reset and network fixtures | 90 passed |
| Client CLI | 5 passed |
| Central runner | Passed, including two noisy restarts and bounded private logs |
| Android debug unit tests | 77 suites, 366 passed, 0 failed/skipped; 25 Gradle tasks executed |

The existing opt-in skips were the configured pinned Python Source Pack, macOS
sandbox and installed-Codex synthetic Responses contracts. No skipped check is
claimed as verified. The final Web bundle was then rebuilt and the hidden
Chromium authorization journey passed again for both providers at desktop/mobile
widths, including refresh, cancellation, a fresh authorization and local QR.

## Remaining manual validation

Real Feishu/DingTalk browser or QR authorization, tenant permissions, first
selected recording sync and audio backup remain for the owner. No real model,
physical device, system permission dialog, native Android instrumentation,
macOS native build/signing, macOS x64/Linux amd64 runtime or live deployment was
verified.
Container OCR used a generated recognition stub; this is not an OCR/ASR model
quality or hardware performance result.
