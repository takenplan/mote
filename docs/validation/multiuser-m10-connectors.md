# M10 connector validation

M06 independently closed the task-secret P1 at `8987feb6a88729ddfa56048c145ec9a67d000c71`.
Accepted M06 #133 is now stacked with real provider-original-to-Material integration.
Status: completed final runtime acceptance at `2ae03155ef766655f4996977e4eedcc0a2177e9d`.
M11 approved the complete composed freeze and the subjectless-email follow-up delta;
no remaining confirmed P0/P1/P2. Final receipts are recorded below.
Baseline: PR #132 `cdc5c34c36fc5743049007ee2c76d705fde3dd7f`.
Integration remains `6272a9b51ec92cc4c32e2ff1a1eeb4fa38b142ed`.
Additional accepted dependency: Draft #133 head `470516b7ed4ab7ee8b0fba344883c6b42bb7ce56`,
runtime `07ad9ddb17a0d2cd0004c50958670145b1457446`.
All data, OAuth codes, provider responses and credentials below are isolated synthetic fixtures.

## Acceptance mapping

Tests are in `apps/server/test/multiuser-connectors.test.ts` unless stated otherwise.
Every fixture uses the real production app, SQLite, M01 accounts, M04 ConfigService,
M05 executor, M09 packages/instances and M03 source/original services. Only provider
HTTP/CLI I/O is substituted; source/archive/task services are real.

| Acceptance / failure transition | Durable regression |
| --- | --- |
| Install is separate from per-user enablement/history | `installation creates no user instance, OAuth exchange, provider discovery or history collection` |
| A/B reverse callback order, same account/message IDs, originals, restart cursors | `A/B reversed OAuth callbacks and same provider account preserve stable owner, originals and independent cursors after restart` |
| Stop during token exchange, B continues | `stop after token exchange admission rejects late credentials while B remains usable` |
| Shared calendar ID, selections, duplicate sync, independent sync tokens | `Google Calendar selection, duplicate sync and original incremental cursor remain scoped for A/B sharing calendar IDs` |
| Browser switches to B, original A pending state survives restart | `OAuth callback ignores a switched browser session and restart preserves the original one-time state` |
| Expired/unrecognized states, no exchange or sibling mutation | `expired and unrecognized OAuth states never exchange codes or mutate an enabled sibling connection` |
| Concurrent duplicate callback and account disable barrier | `duplicate callbacks during a blocked exchange are consumed once; disabling the original account fences late token persistence` |
| Remove/recreate does not reuse tokens/cursors | `removing and recreating the same connection cannot recover prior tokens or cursor state` |
| Same user, multiple instances, same external account, cross-source denial | `same user independent connections to the same provider account keep sources and original references distinct` |
| Unknown provider, host path, invalid interval, user selector | `malformed provider selection and identity selectors are rejected before external I/O` |
| One durable timer chain, restart, pause/resume A while B polls | `one durable timer chain survives restart, pauses only A, and resumes without duplicating B work` |
| Actual Lark document/calendar adapter, full originals, idempotency, partial retry | `real Lark docs/calendar adapter preserves same external IDs, complete originals, partial failure retry and scoped restart state` |
| Real Feishu recording decoder, same IDs, paged discovery, transcript/audio recovery | `real feishu-recordings production provider keeps A/B transcripts, audio, pagination and checkpoints isolated` |
| Real DingTalk recording decoder, same profile, paged discovery, transcript/audio recovery | `real dingtalk-recordings production provider keeps A/B transcripts, audio, pagination and checkpoints isolated` |
| M03 archive repeated observation, immutable original negative | `M03 archive replay with a new observation preserves its first original, and one revision cannot replace original bytes` |
| Cancel during provider read barrier | `cancelling a real Gmail task while provider I/O is held rejects late source and original publication` |
| Generic M09 instance removal during provider I/O | `M09 instance removal while Gmail I/O is held fences the result through the actual plugin lifecycle` |
| Scoped export, no secrets/B, deletion pending until local work retires | `domain export excludes B and secrets; deletion fences held work before erasure and leaves B unchanged` |
| Source pause during provider read barrier | `pausing an owned source during provider read blocks its late batch while other sources remain usable` |
| Fixed provider failure receipt; no code/token/prose exposure; no callback replay | `provider authorization failure yields a fixed receipt without code, tokens or provider prose and cannot replay callback` |
| Local disconnect removes credentials, retains history | `disconnect erases local credentials and the next incarnation cannot inherit the prior Gmail identity` |
| Account epoch changes cannot reopen old provider authorization | `account disable and re-enable cannot reuse a prior epoch Gmail credential or cursor` |
| Portable restore, own envelope, changed replay, restart, no authorization | `portable restore applies credential-free settings through M04 once, survives restart, and rejects wrong owner or changed replay` |
| Host registration, no central provider branch | `a trusted registered connector definition uses real M09/M04/M05/M03 seams without adding a provider dispatch branch` |
| Actual subprocess env/config/temp isolation; inherited credential override removal | `multiuser-connectors-cli.test.ts`: `actual CLI child processes receive isolated HOME, config, data, cache, temp and no inherited provider identity` |
| Recording finite transient budget and explicit retry across restart | `recording transient failures retain the five-attempt budget across polls and restart until explicit scoped retry` |
| Interrupted authorization, no replay and result_unknown deletion | `an interrupted OAuth issuance survives restart as unknown and connector deletion cannot claim remote erasure` |
| Identical A/B raw bytes, capture IDs, owner-specific refs and erasure isolation | `identical Gmail original bytes and capture IDs keep different owner references and deleting A ingress preserves B bytes` |
| Per-user OAuth client changes revoke only A credentials | `changing A OAuth client settings revokes A credential namespace without changing B settings or in-flight identity` |
| Real child retirement and output-callback revocation | `multiuser-connectors-cli.test.ts`: `real lark runner joins physical child exit after cancellation and contains output-callback revocation`; same for `dingtalk` |
| Concurrent command idempotency and immutable payload conflict | `concurrent duplicate sync commands return one durable task and preserve immutable input identity across restart` |
| Controlled shutdown during a blocked Gmail read, original task resumes after restart | `controlled shutdown interrupts active Gmail work into waiting and restart resumes its admitted task and original cursor` |
| Seeded durable crash activity, purpose-bound erasure reconciliation and B denial | `durable crashed-activity fixture requires a purpose-bound stopped observation before connector erasure and never settles B` |
| Archive-retention Gmail incremental replay and immutable raw original | `snapshot-retention Gmail delta replay retains canonical normalized head and the same immutable provider original when only its provider envelope changes`; same for `archive-retention` |
| Distinct process HTTP listener, pending OAuth recovery, A/B raw originals and decoded subjectless Material, display fallback and foreign/replay denial | `multiuser-connectors-process.test.ts`: `distinct real HTTP processes restore pending OAuth and publish scoped Gmail originals and decoded subjectless Material through the production composition` |
| Configure secret never enters task/event/export storage, interrupted restart, A/B and scoped disconnect | `Lark configure encrypted task reference survives interrupted restart, isolates A/B and disconnect removes only A payloads` |
| Provider failure prose is fixed, encrypted retry survives restart | `failed Lark configuration keeps only encrypted retry payload across restart and exposes fixed errors` |
| Instance removal/domain erasure clears payload envelopes without changing B | `removing a configured Lark instance and deleting its connector domain erases operation payloads without erasing B` |
| Unknown operations/malformed secret-bearing payload fail before admission, no reflection | `invalid provider operation payloads reject before task admission and never persist or reflect supplied secrets` |
| Earlier candidate input upgrade preserves existing task identity/history | `startup migrates earlier candidate raw operation inputs into encrypted references without dropping task history` |

## Intermediate receipts and final gates

Earlier freeze `716b332245f4192e2f1f814dbd48f3a1d7ce278d` evidence (all exit 0):

| Command | Result | Receipt |
| --- | --- | --- |
| `node --import tsx --test --test-concurrency=2 --test-timeout=120000 apps/server/test/multiuser-connectors.test.ts apps/server/test/multiuser-connectors-cli.test.ts apps/server/test/multiuser-connectors-process.test.ts` | 36/36, zero failures/skips | `/tmp/m10-716b-focused.log`, `.exit` |
| `node --import tsx --test --test-concurrency=2 --test-timeout=120000 apps/server/test/scope*.test.ts apps/server/test/multiuser*.test.ts` | 229/229, zero failures/skips | `/tmp/m10-716b-combined.log`, `.exit` |
| `npm run build -w @mote/server` | passed | `/tmp/m10-716b-server-build.log`, `.exit` |
| `npm run build -w @mote/web` | passed | `/tmp/m10-716b-web-build.log`, `.exit` |
| `MOTE_CONNECTORS_PROCESS_ENTRY="$PWD/apps/server/dist/app.js" node --import tsx --test apps/server/test/multiuser-connectors-process.test.ts` | 1/1, two sequential real HTTP processes, zero failures/skips | `/tmp/m10-716b-emitted.log`, `.exit` |

The durable crashed-activity scenario seeds a persisted synthetic activity record;
it verifies purpose-bound reconciliation, not a forcibly killed native process.
The separate emitted smoke exercises actual process restart with pending OAuth.
A subsequent independent synthetic probe changed only Gmail's raw `historyId`
and reproduced a blocked duplicate import. The adapter now preserves the first
original of an unchanged semantic revision; both snapshot/archive regressions
pass 2/2, exit 0 (`/tmp/m10-envelope-fixed.log`, `.exit`). Generic M03 supplied-byte
conflicts remain rejected. The earlier affected run is diagnostic because source
changed while it was running; it cannot serve as final-SHA evidence.

Intermediate 25/25 M10 source/CLI tests passed, no failures/skips:
`/tmp/m10-prefreeze2-tests.log` (before the final device-login test expansion).
Lark algorithm compatibility 31/31 passed in `/tmp/m10-lark-after-readfix.log`.
Gmail algorithm compatibility plus initial M10 7/7 passed in `/tmp/m10-gmail-and-host.log`.
Server typecheck/build succeeded during development; these are intermediate,
not final-SHA evidence. A 215-test combined diagnostic had 210 passes and five
loopback-listener EPERM failures under the filesystem/network sandbox. None of
those listener checks is recorded as passed; an authorized local-listener rerun
is required. One earlier caller-side assertion of a synchronous wrong-owner
restore rejection was repaired; its product denial was correct.

Final requirements: exact frozen SHA, module and actual combined counts/exits,
fresh Server/Web builds, emitted-code process smoke, required
`npm run check:affected -- --base origin/codex/mote-multiuser-integration`,
independent peer findings/fixes, and final remote PR head/base verification.
CI is disabled by instruction; workflows must remain disabled and CI unrun.

## Known boundaries

M13 renderer, M07 Memory and M11 MCP remain separate modules. The final M10 feature
includes accepted M06 and restores actual source/provider-original/processing/Material intake. Native CLI binaries
are deployment dependencies, verified at their pinned versions before use.
Windows native credential storage is explicitly unsupported until an isolated
backend exists; Google HTTP connectors are independent of that limitation.
No real mailbox, live OAuth grant, long-lived provider credential, deployed instance,
physical recorder or external model was accessed. No main/integration changes or
PR merges are authorized. Whole-instance recovery and external issuance settlement
remain M16 orchestration responsibilities.

## Independent P1 repair

M06 independently confirmed Lark configure secret retention in `user_tasks.input`
and `execution_steps.input` after disconnect. Report:
`/tmp/mote-m06-review-m10.md`. The unchanged peer probe now returns counts **0/0/0**
(task rows/execution rows containing the synthetic secret/remaining connector
secret rows), exit 0 (`/tmp/m10-peer-secret-probe-fixed.log`, `.exit`). Five new
real-app secret lifecycle regressions passed **5/5**, exit 0
(`/tmp/m10-secret-ref-tests.log`, `.exit`). They scan every SQLite table, verify
credential-free domain exports, retry/restart, scoped disconnect/removal/deletion,
pre-admission validation and history-preserving upgrade of earlier candidate input.
The interrupted full affected invocations exited 143 and are not accepted evidence.
At that repair stage M06 owned the heavy slot while M10 repaired and read-reviewed
its frozen implementation. The final real M06+M10 combination is now verified below.


## Real M06 composition acceptance

The accepted M06 source is stacked only on M10's feature. All joint tests use the
actual production app, SQLite, M03 original/source services, M04 configuration and
media leases, M05 shared executor, M09 instances, existing FileProcessorRegistry,
real provider decoders and Material/FTS publication. Only external provider I/O
and external ASR responses are scripted. Component fixtures explicitly disable
processing automation; these joint scenarios explicitly enable the real pipeline.

| Actual composed journey | Durable regression |
| --- | --- |
| A/B same Gmail account, plain/HTML MIME, 65000-character body across provider parts, snapshot/archive, immutable raw bytes and correct searchable Material after duplicate/restart | `real M06 automatic pipeline decodes Gmail MIME originals for A/B in snapshot and archive without indexing provider JSON or losing long bodies` |
| Actual Lark document bytes and long calendar SourceItem originals, A/B and restart | `real M06 automatic pipeline consumes actual Lark document bytes and long calendar SourceItem originals into scoped Material after restart` |
| Feishu/DingTalk vendor export decoder plus binary audio through real M04 ASR leases; correct speaker/timing/JSON MIME; same IDs/bytes, private cache/keys and no repeated ASR on restart | `real M06 pipeline decodes feishu-recordings vendor originals and binary audio into separate scoped Material with genuine M04 ASR leases`; same prefix for `dingtalk-recordings` |
| Held ASR response after source pause; A cannot publish while B completes | `real connector-to-M06 held media result cannot publish after its source is paused while B processing continues` |
| Synthetic pre-M06 format-metadata fixture, existing archive original and immutable first bytes | `pre-M06 retained Gmail archive re-observation restores its trusted decoder format and keeps its first raw original` |
| Copied opaque credential reference refused for another task, instance, owner and revoked generation | `an opaque configuration payload reference cannot authorize a different task, instance, owner or revoked generation` |

Diagnostic prototype Gmail/Lark2/2 exit0 `/tmp/m10-joint-gmail-lark-paged.log`;
both recordings and source barrier3/3 exit0 `/tmp/m10-joint-recordings-first.log`.
The first long-body assertions read only the API's first12000 characters; the test
client now follows actual `nextOffset` pages and verifies the complete tail.
The first foreign-snapshot negative expected401/403, but the real M09 privacy
contract deliberately returns404/not_found; the assertion was corrected to that
exact denial. Neither issue was hidden by weakening production guards.
The first full composed module47/47 exit0 `/tmp/m10-stack-prefreeze-module.log`
preceded the final two upgrade/reference regressions and 65000-character expansion.
Final SHA receipts replace these diagnostics below; no diagnostic is final acceptance.

Independent M06 review closed P1 with its unchanged probe0/0/0,1/1 exit0 and
independent five secret-lifecycle regressions5/5 exit0. Report
`/tmp/mote-m06-review-m10.md`. M10 independently approved full M06 runtime07ad
using literal source archives (8 core,2 image-context and8 final lineage/legacy
cases, all exit0); report `/tmp/mote-m10-review-m06.md`.
M11 completed read-only independent review of the final new composition and its
follow-up repair. Completed M06 was not awakened; no extra execution conversation
was created.


## Subjectless Gmail publication repair

An additional emitted-production probe at `41d2775307db5afecbb5b40b81b5fd8c8a0b9b9b`
confirmed that a valid Gmail message without Subject extracted successfully but
failed Material publication: its canonical empty title violated Material's nonempty
display title schema (`processing_output_invalid`). Both the initial probe and the
probe with explicit real M04 local extraction settings failed; neither is a pass
(`/tmp/m10-41d-joint-emitted.log`, `/tmp/m10-41d-joint-emitted-configured.log`, exits1).
The repair preserves empty canonical source evidence, uses the existing display
fallback for empty titles, and retains exact nonempty titles. The existing durable
two-process OAuth recovery smoke now explicitly enables the real local pipeline
through M04 and asserts A/B decoded subjectless Material, display title, the actual
Gmail processor engine, raw originals, and foreign Material/original denial.
The first repaired assertion read title at the wrong response level; it now uses
the real Material metadata endpoint. Final targeted process regression1/1, exit0
(`/tmp/m10-subjectless-fixed-final.log`, `.exit`).

Prior exact41d module49/49, actual combination282/282, Server/Web builds and original
emitted smoke all exited0. The subsequent exact41d full affected was interrupted
with exit143 when this source repair became necessary and is diagnostic only.
The final frozen-source checks and follow-up peer review below replace these receipts.


## Final frozen-source acceptance

All commands below ran on clean final runtime commit
`2ae03155ef766655f4996977e4eedcc0a2177e9d`, including accepted M06 #133
head `470516b7ed4ab7ee8b0fba344883c6b42bb7ce56` and baseline #132
head `cdc5c34c36fc5743049007ee2c76d705fde3dd7f`. Post-validation publication
changes contain Markdown evidence only; the exact remote publication head and
protected base are recorded in the Draft PR and executor final handoff.

| Final command | Result | Receipt |
| --- | --- | --- |
| `node --import tsx --test --test-concurrency=2 --test-timeout=120000 apps/server/test/multiuser-connectors.test.ts apps/server/test/multiuser-connectors-cli.test.ts apps/server/test/multiuser-connectors-process.test.ts` | 49/49, zero failures/cancellations/skips, exit0 | `/tmp/m10-2ae-focused.log`, `.exit` |
| `node --import tsx --test --test-concurrency=2 --test-timeout=120000 apps/server/test/scope*.test.ts apps/server/test/multiuser*.test.ts` | 282/282, zero failures/cancellations/skips, exit0 | `/tmp/m10-2ae-combined.log`, `.exit` |
| `npm run build -w @mote/server` | fresh build, exit0 | `/tmp/m10-2ae-server-build.log`, `.exit` |
| `npm run build -w @mote/web` | fresh build, exit0; existing chunk-size warning | `/tmp/m10-2ae-web-build.log`, `.exit` |
| `MOTE_CONNECTORS_PROCESS_ENTRY="$PWD/apps/server/dist/app.js" node --import tsx --test apps/server/test/multiuser-connectors-process.test.ts` | 1/1, zero failures/cancellations/skips, exit0; genuine emitted HTTP two-process pending OAuth recovery, decoded subjectless Material and A/B denials | `/tmp/m10-2ae-emitted.log`, `.exit` |
| `npm run check:affected -- --base origin/codex/mote-multiuser-integration` | full affected plan, exit0 | `/tmp/m10-2ae-affected.log`, `.exit` |

The affected plan selected `check:local` and
`apps/android/gradlew -p apps/android --no-daemon :app:testDebugUnitTest`.
It used the existing documented environment, without installing or changing it:

```sh
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
ANDROID_HOME=/Users/utopiafar/Library/Android/sdk \
PATH="/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home/bin:$PATH" \
npm run check:affected -- --base origin/codex/mote-multiuser-integration
```

I18n, library builds and every workspace/scripts typecheck passed. Actual full
check counts (the focused and combined commands above overlap these suites):

| Full affected component | Passed | Skipped | Failed |
| --- | ---: | ---: | ---: |
| Desktop, 58 test files | 456 | 0 | 0 |
| Server | 2238 | 1 | 0 |
| Web | 469 | 0 | 0 |
| Agent | 317 | 1 | 0 |
| Diagnostics | 5 | 0 | 0 |
| Shared | 190 | 0 | 0 |
| Root release/media/security/reset/proxy scripts | 81 | 0 | 0 |
| CLI client | 4 | 0 | 0 |
| Android, 70 JUnit XML suites | 329 | 0 | 0 |

The two existing opt-in skips are `macOS sandbox permits staged input but denies
files and network outside it` and `installed Codex speaks to a synthetic local
Responses fixture with Mote evidence tools and ephemeral planning only`. They
were not run and are not passes. The central runner also returned its actual
`status:passed` receipt, including restart/log bounds, private content suppression,
file mode, exit/signal preservation and disk-failure handling. Android was fresh
in this checkout: `BUILD SUCCESSFUL in 41s`, `25 actionable tasks: 25 executed`;
JUnit totals329, failures0, errors0, skipped0. Existing Kotlin/compiler warnings
remain warnings; no physical device or emulator validation is claimed.

## Completed independent review

M06's original P1 secret-retention finding is closed at
`8987feb6a88729ddfa56048c145ec9a67d000c71`; its unchanged probe reports0/0/0,
1/1 exit0, plus independent five secret-lifecycle regressions5/5 exit0. Report:
`/tmp/mote-m06-review-m10.md`.

M11 reviewed exact clean composition
`41d2775307db5afecbb5b40b81b5fd8c8a0b9b9b`, then the full `41d..2ae`
subjectless-mail delta, without sibling source or existing database writes. It
found no remaining confirmed P0/P1/P2. Its independent receipts are:

- Real joint/upgrade/opaque-reference scenarios7/7, exit0:
  `/tmp/m11-independent-m10-joint-authorized.log`, `.exit`.
- Secret lifecycle and synchronous admission scenarios6/6, exit0:
  `/tmp/m11-independent-m10-secrets-admission.log`, `.exit`.
- Final2ae existing source-entry real HTTP two-process subjectless-mail smoke1/1,
  zero failures/cancellations/skips, exit0:
  `/tmp/m11-independent-m10-subjectless-process.log`, `.exit`.

Report: `/tmp/mote-m11-review-m10.md`. The first M11 joint invocation could not bind
loopback in the default sandbox (`EPERM`, exit1); the exact same command with
authorized generated loopback fixtures passed. That first invocation is diagnostic.
M11 did not overlap a heavy affected or Android run, and M06 was not awakened.

CI Checks and Component checks remain `disabled_manually`; CI is **unrun**, never
reported as passed. Existing tag/manual Release Android/Central/Desktop settings
are unchanged. The protected integration branch and main were not modified; no PR
was merged. All runtime acceptance uses generated isolated provider/model fixtures,
not real mail, user data, grants, persistent live credentials, devices or deployment.
