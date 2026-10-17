# M06 processing acceptance

Scope: PR #132 exact `cdc5c34c36fc5743049007ee2c76d705fde3dd7f`
(M00/M01/M02/M03/M04/M05/M09) plus M06 in an independent checkout. Integration
base remains `6272a9b51ec92cc4c32e2ff1a1eeb4fa38b142ed`.
No integration/main edits, merge, real user data, credentials, deployment or
external production model calls. Every fixture account, key and media byte is
generated; actual model I/O is a loopback scripted transport at the external
boundary. The production Agent, Cordis processors, M03 originals, M04 leases,
M05 engine and M09 worker RPC remain real.

## Journey matrix

All names below refer to `apps/server/test/multiuser-processing.test.ts` unless
another file is named. Each row maps a user-visible or lifecycle outcome, rather
than replacing a real host with a fake binder.

| Journey / risk | Durable coverage |
| --- | --- |
| Same bytes, business IDs, concurrent owners and differing config | `production text decoder processes equal bytes/IDs per user`; `OCR and ASR use real M04 leases`; foreign task/artifact/source denial; distinct Material/FTS and usage |
| Saved versus processed versus indexed | automatic M03 intake and real decoder tests; malformed/unsupported files retain originals; no partial publication on failed analysis |
| Algorithms and private temporary state | DOCX locations, UTF-8/JSON and SourceItem distinction; binary OCR/ASR; acoustic alignment; semantic-turn repair; actual image pixels and region geometry; missing-pixel refusal |
| Cache and durable recovery | duplicate operation/cache test; failed diarization checkpoint/restart; multi-page summary checkpoint/restart retaining admitted M04 model and page usage |
| Physical process death | `multiuser-processing-process.test.ts`: real SIGKILL, natural M05 lease expiry, two owners, no raw-ASR replay, fixed admitted model snapshots |
| Late media results | held actual response across cancel, config edit, credential revoke, account disable, processing/ingress deletion, source disable and capture deletion; B continues |
| Late language results | actual Agent summary across cancel, source-context edit, processing deletion and account disable; no derived Material |
| M09 production processor seam | real generated worker `processOriginal`; foreign original/source refusal; stop/grant narrowing/domain delete fences; validated custom extraction commits through M05 |
| Attribution and model disclosure | real A/B summary Agent requests preserve third-party attribution; foreign evidence tool call refused; each request excludes the other user's original text; secrets excluded from request body and task receipts |
| Typed errors and retries | real binary 429/503 finite attempts/capacity facts, provider prose redaction; real language 503 retry survives restart; M05 native failure tests retain branded control facts |
| M07 synchronous handoff | fresh consumer grants survive publisher retirement; hook rollback is atomic; async hook/model sync refused; caller-caught nested failure leaves zero child authority/work/resource/operation rows |
| Lifecycle recovery | wrong owner/hash/stitched parent/changed replay refused; idempotent owned restore/restart; deleted processing cannot renew live work; purpose-bound stopped observation required for unknown erasure |
| Production process entry | `multiuser-ingress-process.test.ts`: actual index.ts HTTP listener, A/B automatic processing, lost ACK/restart, original ticket download and foreign artifact denial |
| Worker private directories | `scripts/media-workers.test.mjs`: actual Python process, opaque request scope, normalized temporary file within request root and cleanup |
| Consumer protocol boundary | `packages/agent/test/model-runtime.test.mjs`: language runtime refuses media-only protocol; ordinary existing model protocols remain valid |

## Review and verification receipts

The prerequisite M03/M09 seam was independently reviewed from
`7f00c8b6cb2800109202af840d03e3498dc50935` to `cdc5c34c36fc5743049007ee2c76d705fde3dd7f`.
27/27 real source/ingress journeys passed, exit0; no confirmed P0/P1/P2 remained.

M07 independently reproduced P1 in the new synchronous admission seam: if
`resources()` threw after step insertion and a listener caught it, the parent
commit retained a runnable child. Nested admission now uses a savepoint.
Unchanged external probe changed from childExecutions=1 to 0 while parent
succeeded. M05 full execution tests11/11 passed, exit0. Exact isolated fix is
`3798e10e8a1845ada5bb7ba550ee7ddc97d741ec`. This narrow seam review does not
replace the final full-module independent review recorded below.

Final frozen command/count/exit receipts and independent review appear below.
Interim passes and earlier failed diagnostics are not final acceptance. Earlier fixture failures included sandbox EPERM loopback restrictions,
a corrected uploaded-JSON processor MIME check, a process barrier that matched
unstarted tasks, and a DOCX recovery fixture that incorrectly assumed one segment
per paragraph. No requirement or assertion was removed to hide a product failure.

## Unrun and remaining boundaries

Checks and Component checks are disabled and must remain disabled. No CI result
is claimed; release workflows are untouched.
Real credentials/providers/models, native CLI authorization, physical clients and
deployment are unrun. Shared model weights and trusted installed provider code
remain outside a malicious-code sandbox. M16 must compose canonical originals,
Material, configuration and execution lifecycle domains for whole-user erasure;
M06's own receipt covers only its private processing data. Live or interrupted
requests remain result_unknown until physical settlement is established. M07 and
M10 full-stack consumer acceptance requires their own finalized implementation;
M06's synchronous hook and PR #132 stack do not claim those later journeys.

## Final frozen implementation

Runtime `07ad9ddb17a0d2cd0004c50958670145b1457446` has no further source changes.

| Command | Result | Receipt |
| --- | --- | --- |
| `node --import tsx --test --test-concurrency=1 apps/server/test/multiuser-processing.test.ts apps/server/test/image-processing.test.ts` | 64/64, no fail/skip, exit0 | `/tmp/m06-07ad-focused.log`, `.exit` |
| `node --import tsx --test --test-concurrency=1 apps/server/test/multiuser-*.test.ts apps/server/test/scope*.test.ts` | 233/233, no fail/skip, exit0 | `/tmp/m06-07ad-combined.log`, `.exit` |
| `npm run build -w @mote/server` and `npm run build -w @mote/web` | each exit0; existing Web chunk warning | `/tmp/m06-07ad-{server,web}-build.log` |
| `MOTE_PROCESSING_PROCESS_ENTRY=$PWD/apps/server/dist/app.js MOTE_INGRESS_PROCESS_ENTRY=$PWD/apps/server/dist/index.js node --import tsx --test --test-concurrency=1 apps/server/test/multiuser-processing-process.test.ts apps/server/test/multiuser-ingress-process.test.ts` | 2/2, no fail/skip, exit0 | `/tmp/m06-07ad-emitted.log` |
| `node --test scripts/media-workers.test.mjs packages/agent/test/model-runtime.test.mjs` | 10/10, no fail/skip, exit0 | `/tmp/m06-07ad-workers-model.log` |
| `npm run typecheck -w @mote/server`; scope inventory; `git diff --check` | each exit0 | `/tmp/m06-image-lineage-typecheck.log`, `.exit`, direct checks |

The sequential fresh build / compiled smoke / workers command returned exit0 in
`/tmp/m06-07ad-build-smoke.exit`; each prerequisite had to exit0 before the next.

M10 independently reviewed the exact core `6c0eb66635c77d2d53679c219b052c5bc2e17f24`
with 8/8 real seam tests, and the image-context repair with 2/2 native tests.
Final literal `07ad9ddb` archive additionally passed 8/8 independent native image,
pixel-negative, late source-context and existing image-consumer journeys, no
fail/skip, exit0: `/tmp/m10-independent-m06-lineage-final.log`, `.exit`.
The reviewer approved final M06 with no remaining P0/P1/P2;
`/tmp/mote-m10-review-m06.md` records exact source snapshots and commands.
M07's unchanged admission probe and final4/4 narrow seam regressions independently
closed the caught-child P1 at observed `3f3399e0`, without claiming full M06 review.

A self-audit found the image Agent first request omitted declared source prose
after oversized OCR was removed from its question. The unchanged external native
probe reproduced it. The repair uses the existing background task-context envelope
for a 12000-unit OCR excerpt with explicit range/total, complete source declaration
and exact original/source dependency pins. Existing lineage guards initially
rejected the new context without provenance (62/64, two old image consumers);
adding the proper dependencies fixed those consumers without relaxing a guard.
The final64/64,233/233 and independent8/8 above supersede those diagnostics.
The first affected invocation was intentionally stopped143 for this confirmed
repair and is not a pass. Final required affected receipt is recorded below.

Checks and Component checks were remotely confirmed `disabled_manually`; Release
workflows were active and untouched. No CI execution is inferred from an empty
pending status. Final local affected, PR head/base and CI readback are separate
gates and are not replaced by independent code review.

## Required full affected gate

`JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home ANDROID_HOME=<redacted-personal-path> npm run check:affected -- --base origin/codex/mote-multiuser-integration`
ran against final runtime `07ad9ddb17a0d2cd0004c50958670145b1457446`, exit0;
`/tmp/m06-07ad-affected.log` and `.exit`. Existing JDK/SDK only; no CI settings changed.

Desktop456, Server2189, Web469, Agent317, Diagnostics5, Shared190, root81 and
client4 passed; central-runner checks passed. Two preexisting opt-in checks were
skipped: the Server macOS native sandbox fixture and Agent installed-Codex fixture.
They are not counted as passes. The unchanged thousand-original background
regression passed in132270ms. Android compiled and executed25 tasks, `BUILD
SUCCESSFUL in38s`; own generated XML reports329 tests across70 suites, no failure,
error or skip. Existing compiler/bundle warnings remain, with no failed gate.

Final documentation-only updates preserve this tested runtime and dependency
state. Remote Draft PR/head/base/CI observation is recorded at publication.
