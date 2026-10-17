# PR159 merge security and recovery regression — 2026-10-17

PR159 targets `codex/mote-multiuser-integration`. The frozen final candidate is
`73485575ef62536a355a526be225cddc51b20a7b`, based on
`a5f3bf460ae623bfdb30d459fef4c23f299182cf`. It includes the Cookie-aware generated
Files fixture, Library Memory evidence navigation, Library Files delete-recovery
fix, Android test-only tab selection and native acceptance report. No main-branch
cache/history or appearance changes are included.

The final required gate used JDK21, the installed Android SDK, and the repository's
original concurrency and wait budgets:

```sh
npm run check:affected -- --base origin/codex/mote-multiuser-integration
```

The complete gate naturally exited **0** against integration base
`6272a9b51ec92cc4c32e2ff1a1eeb4fa38b142ed`. Log SHA256:
`fee2a9a303d636ab83662da52c879aa07f05adeced5df690727bab49fb165fa6`. All frozen tracked files remained unchanged
through completion. The subsequent Web receipt and this report are documentation only.

| Final required stage | Actual result |
| --- | --- |
| Desktop | 587 passed; 62 files |
| Server | 2,941 passed; 2 existing conditional skips |
| Web | 576 passed |
| Agent | 317 passed; 1 existing conditional skip |
| Shared / Diagnostics | 192 / 5 passed |
| Root scripts / client / Central runner | 81 / 5 passed; runner passed |
| Android JVM | 358 tests in 75 XML suites; 0 failures/errors/skips |
| Gradle | 41 seconds; 25 tasks actually executed |

Every stage has zero failures and cancellations. The three existing conditional
skips remain unperformed: pinned private Python Source Pack mapping, the macOS
staged-input sandbox case, and Agent’s installed-Codex synthetic Responses fixture.

Final tracked-input digest: `2dc9d7977bc4ae5b88ec713b07223e3e3338778c3f5f19ab24a64d90ab659433`
over 2,873 tracked files (canonical sorted JSON of repository path to file SHA256).
A fresh final Web build exited 0. The final gate does not
relabel earlier recovery evidence: Server/shared production code and executable
recovery scripts are unchanged from the separately tested `a5f3bf46` source.

## Independent review and durable Web regressions

Independent review found no blocker in the final deltas. The generated Files
fixture resolves Cookie/Bearer ownership through production session/CSRF request
context while the real route retains authority. Its socket regression covers
generation races, lost deletion ACK, identical retry, stale sessions and B positive.

Library Memory navigation strips only the structural `context:` wrapper at the
declared typed reader. Its original Archive regression covers supporting evidence,
reload, a late A read and B positive. The Files collection declares the existing
`FileDetail` reader, so a capture-browser 404 cannot unmount delete recovery.
It retains no old capture body; API/collection and original-generation fences
still retire prior callbacks and receipts. The original Archive test commits a
delete, drops its ACK, reloads, retries the identical operation/decision and
rejects an old A button against B's equal-ID file. Existing incarnation and
navigation regressions remain in the gate.

The three-line Android test change reopens B's existing Memory tab before its
positive control. It changes no product source. Actual native acceptance is in
the [Android regression receipt](multiuser-pr159-android-regression-2026-10-17.md).

## Generated security and recovery on exact a5 source

These executions finished naturally before the final Web-only production delta.
No original assertion, timeout or wait was relaxed.

| Lane | Actual result |
| --- | --- |
| Fourteen security/lifecycle/recovery test files | 109/109, exit 0, no skips/cancellations; 336.295s |
| Fresh compiled real-HTTP issuance/restart/late-ACK driver | 3/3, exit 0, no skips/cancellations; 6.361s; repeats the original source scenarios |
| Fresh compiled joined-attachment personal export | 1/1, exit 0, no skips/cancellations; 5.134s |
| Actual container instance recovery | Exit 0; 19.997s |
| Actual container file-generation recovery | Exit 0; 12.389s |
| Actual container processing-policy recovery | Exit 0; 10.763s |
| Actual offline Hindsight/PostgreSQL recovery | Exit 0; 58.791s |

The fourteen-file group covers the E1–E8 critical seams through real production
HTTP, SQLite, worker and SDK entry points, with generated external I/O:

| Journey | Targeted evidence |
| --- | --- |
| E1 identity/retirement | Production bootstrap/login/restart/revocation, equal A/B IDs, late JSON/export rejection and same-URL deployment replacement |
| E2 intake/restart | Real intake and lost ACKs, retired grants, late output and explicit owner retry after real process death |
| E3 original → Material → Memory → Ask | Original scoped M03–M08/MCP chain; across-await deletion/recreation/source fences and B-positive controls |
| E4 settings/authority | Configured runtime limits through generated model transport, cross-domain CAS, administrator demotion, immutable named plans and current controls |
| E5 Memory/history/KEEP | Real rebuild/read/export, unchanged rollback versus committed cache invalidation, retained historical versions and fresh host authorization |
| E6 file/export | Exact declared attachment bytes and safe TAR members, current file incarnation, old ticket/delete-intent retirement and joined-attachment export |
| E7 external operations | Exact issuance identity, confirmation and retry ledgers through restart; unresolved calls remain distinct and owner-bound |
| E8 recovery | Stopped native and actual Docker restore, portable merge, corrupt/foreign atomic rejection, fresh deployment authority and no replay |

The actual Docker runs perform fresh cold starts, exact generated original-byte
checks, two policy/identity recovery cycles, old-token rejection and fresh owner
positive controls. The Hindsight lane uses actual offline API/PostgreSQL canonical
reads with generated rows; it proves recovery, not semantic retention quality.
Unknown external outcomes remain unknown and no model work is replayed.
The executable opt-in drivers are [instance recovery](../../scripts/validation/container-recovery.ts),
[file generation](../../scripts/validation/recovery-file-generation-container.ts),
[policy recovery](../../scripts/validation/recovery-policy-container.ts) and
[Hindsight recovery](../../scripts/validation/hindsight-recovery.ts). They consume
already-installed local images and clean up only their uniquely owned resources.

The fresh runtime image was
`sha256:9dbff398874de6e729e03634bfaf8a79c1cee133f1a1608413c947ab9f528df9`.
All 1,799 consumed runtime files matched the host exactly, digest
`a0f5fb9a488afc2d7bef8fcdd759dde500085e7744d9a317555cb6614756f9a1`;
lockfile digest `6cb27ab7fc9ec5ce28da66b6c31051cd23f7c2b3269eda217b4d39a55e0bdae9`.
Host Node26/ABI147 and image Node24/ABI137 independently passed actual root and
Mem0 SQLite construction/write/read/close plus workspace module-identity checks.

## Preserved failures, cleanup and limits

The initial exact-a5 full gate failed the Desktop hidden-Electron fixture because
the fresh installation lacked its binary: 586 passed, one failed. After installing
that existing dependency, its two focused fixture cases passed. The original full
gate remained active in Server tests when the final Web candidate froze; it was
explicitly stopped with SIGTERM (driver exit 143), so it is incomplete and is not
a passing gate. Its log digest is
`e38b0953b97e22dfd7c72640b30644de3e241fd8d78ce4c24e5e313006c21b28`.
All 19 recorded owned processes were independently absent before the final gate.

All recovery-owned containers and volumes were removed; at that checkpoint the
inventory had zero containers and all six original volumes had unchanged metadata.
Final cleanup removed the owned runtime image and temporary dependency tag while
preserving the existing base image. The six original volumes still match exactly;
concurrently created unrelated containers were left untouched. No owned host or
fixture process remains, and the known interrupted-baseline scratch directory was
removed. Source worktree and evidence logs remain for review.

All accounts, originals, attachments, recordings and external responses in this
lane are generated. There were zero live-model calls, real personal accounts,
personal screenshots or physical-device checks. Browser interaction and native
instrumentation are separate evidence; this report does not turn a headless
fixture into either. The earlier [C2 report](multiuser-final-joint-e2e.md) retains
its original source, failures, skips and historical acceptance boundaries.
The completed [original Web acceptance](multiuser-web-acceptance-2026-10-17.md)
records actual browser actions and the manually confirmed cancellation separately.
