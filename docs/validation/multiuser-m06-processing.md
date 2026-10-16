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
`3798e10e8a1845ada5bb7ba550ee7ddc97d741ec`; full M06 independent review remains
pending a frozen implementation, and is not substituted by this seam check.

Final frozen command/count/exit receipts and independent review will be appended
after completion. Interim passes and earlier failed diagnostics are not final
acceptance. Earlier fixture failures included sandbox EPERM loopback restrictions,
a corrected uploaded-JSON processor MIME check, a process barrier that matched
unstarted tasks, and a DOCX recovery fixture that incorrectly assumed one segment
per paragraph. No requirement or assertion was removed to hide a product failure.

## Unrun and remaining boundaries

CI workflows are disabled and must remain disabled. No CI result is claimed.
Real credentials/providers/models, native CLI authorization, physical clients and
deployment are unrun. Shared model weights and trusted installed provider code
remain outside a malicious-code sandbox. M16 must compose canonical originals,
Material, configuration and execution lifecycle domains for whole-user erasure;
M06's own receipt covers only its private processing data. Live or interrupted
requests remain result_unknown until physical settlement is established. M07 and
M10 full-stack consumer acceptance requires their own finalized implementation;
M06's synchronous hook and PR #132 stack do not claim those later journeys.

Frozen runtime/test implementation: `6c0eb66635c77d2d53679c219b052c5bc2e17f24`.
The following commands ran against that exact runtime and test tree:

| Command | Result | Receipt |
| --- | --- | --- |
| `node --import tsx --test --test-concurrency=1 apps/server/test/multiuser-processing.test.ts apps/server/test/multiuser-processing-process.test.ts apps/server/test/multiuser-ingress-process.test.ts` | 40/40, no fail/skip, exit0 | `/tmp/m06-prefreeze-focused.log`, `.exit` |
| `node --import tsx --test --test-concurrency=1 apps/server/test/multiuser-*.test.ts apps/server/test/scope*.test.ts` | 233/233, no fail/skip, exit0 | `/tmp/m06-frozen-combined.log`, `.exit` |
| `npm run build -w @mote/server` and `npm run build -w @mote/web` | each exit0; existing Web chunk warning | `/tmp/m06-frozen-{server,web}-build.log`, `.exit` |
| `MOTE_PROCESSING_PROCESS_ENTRY=$PWD/apps/server/dist/app.js MOTE_INGRESS_PROCESS_ENTRY=$PWD/apps/server/dist/index.js node --import tsx --test --test-concurrency=1 apps/server/test/multiuser-processing-process.test.ts apps/server/test/multiuser-ingress-process.test.ts` | 2/2, no fail/skip, exit0 | `/tmp/m06-frozen-emitted-smoke.log`, `.exit` |
| `node --test scripts/media-workers.test.mjs packages/agent/test/model-runtime.test.mjs` | 10/10, no fail/skip, exit0 | `/tmp/m06-frozen-workers-model.log`, `.exit` |
| `npm run typecheck -w @mote/server`; `node scripts/check-i18n.mjs`; `node scripts/check-scope-contracts.mjs`; `git diff --check` | each exit0 | `/tmp/m06-final-typecheck.log`, `/tmp/m06-frozen-i18n.log` and direct boundary checks |

Full `check:affected` and independent full-module review are still pending; the
matrix above does not mark them passed. Checks and Component checks were remotely
confirmed `disabled_manually`; Release workflows were active and untouched. No CI
execution is inferred from the empty pending status of a disabled workflow.
