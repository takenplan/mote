# M10 connector validation

Status: independent M06 review rejected the earlier candidate for Lark secret
retention in durable task input. The repair and new regressions are implemented;
replacement frozen checks and independent re-review remain required.
Baseline: PR #132 `cdc5c34c36fc5743049007ee2c76d705fde3dd7f`.
Integration remains `6272a9b51ec92cc4c32e2ff1a1eeb4fa38b142ed`.
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
| Distinct process HTTP listener, pending OAuth recovery, A/B source/original reads, replay denial | `multiuser-connectors-process.test.ts`: `distinct real HTTP processes restore pending OAuth and publish scoped Gmail originals through the production composition` |
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

M13 renderer integration and M06/M07 processing/Memory consumers are separate
modules. M10 restores true source+provider-original intake. Native CLI binaries
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
M06 owns the heavy slot while M10 repairs and read-reviews its frozen implementation.
Final M06+M10 provider-original-to-Material combination remains required.
