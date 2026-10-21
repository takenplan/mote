# Lifecycle revision after the c0bf80d6 gate

> 2026-10-20 delivery follow-up: this record keeps its original candidate, commands, results and UNRUN scope. Related source is now in main through the integration and later fixes; Draft/pending/under-validation statements below describe their recorded stage. Current module heads, named per-item evidence and remaining qualification are reconciled in [Project progress](../project-progress.md). This note neither changes an old FAIL into PASS nor treats functional gates as complete native/model/deployment acceptance.

This ledger supersedes the pending-gate status in the initial
[lifecycle ledger](parity-lifecycle.md). It records a repair candidate, not an
accepted integration or release. The integration base remains
`2c78ca8d52a7d17fae20962cf68d09a717ffc73a`.

## Failed input and repair scope

The driver ran the frozen 22-step affected plan on
`c0bf80d6f884c0cde15ab40bfff6cc9c8197b962`. Fourteen steps passed; the Server
step reported 3,146 pass, nine fail and two skip. The remaining seven steps,
including Android, were unrun. The original receipt is
`lifecycle-c0bf80d6-required-gate-failed.json` (SHA-256
`80b960d774a94f86f65a259bc16eb86bac875842cbbec40b91728352262028d5`), driver
run `a6dc2854-d582-4c4c-932a-48bc5ecd7b74`. The original raw output remains
`/tmp/mote-parity-lifecycle-driver-c0bf80d6.log`. These are failed historical
inputs and must not be relabeled as a passing revision gate.

The independent static prereview (`static-prereview-v1.json`, SHA-256
`3b7f120ca541626d3499382a64e084fe7397064417d8705138327d6287f3e651`)
identified two additional repair boundaries: the pre-scope Todo/artifact storage
admission paths, and independent future recovery scopes. Its earlier conjecture
about a cached failed child was withdrawn and is not a claimed fix.

The nine failed tests stopped at an obsolete replay precondition: explicit
capture deletion now correctly rejects the same owned capture ID with 410.
The revised consumers retain actual held work and assert its final rejection.
They also exercise legal same-ID ABA through source retirement and Files
forget/allow-again. They do not replace the ID, loosen the journal, or accept the
old held result.

| Original failure group | Current generated regression |
| --- | --- |
| Ask reader, changed and identical text/app | Real Memory provider await; explicit capture replay returns 410; source recreation preserves the UUID and identical text with changed app identity; held read fails, fresh canonical read succeeds. |
| Pending attachment profile | Real profile await; explicit parent replay is rejected; source recreation preserves the parent UUID and attachment; old request cannot publish a child, while B and current legal admission work. |
| Thumbnail, different and identical bytes | Actual thumbnail encoding is held; explicit replay is rejected or legal source recreation retains the UUID; old response is rejected and fresh bytes/B remain correct. |
| Cached attachment OCR | Explicit parent deletion revokes old anchors and children. Separately, an actual file parent is forgotten, allowed again and uploaded with the same UUID/content; cached child OCR is reused only under a new binding. |
| File source incarnation | New upload parts reach the real commit and receive 410 after capture deletion. Legal source recreation and Files allow-again preserve same-ID/text ABA with monotonic generations; old delete intent remains invalid. |
| SDK MCP reader, changed and identical text/app | Real SDK and provider await with a preexisting account-wide credential; old readset fails, the same session reads the new canonical entity. Source-pinned credentials retain their existing source-incarnation fence. No new manual session, source or authorization step is introduced. |

## Capacity and recovery fixes

Todo create reserves serialized bytes plus the established 1,024-byte allowance;
positive update growth reserves its delta before mutation. A completed processing
provider result reserves serialized output plus the established 4,096-byte
allowance inside the final publication transaction. All use the shared owner
ledger. Known physical settlement, revocation and deletion remain possible when
content admission is refused. This restores proven admission points without a
new blanket block on every ledger table.

The generated RED evidence separately demonstrates Todo create returning 201,
Todo growth returning 200, and a held processor publishing one artifact after B
fills the remaining space. GREEN assertions require 507/no Todo version change,
zero rejected artifacts, settled physical activity, and successful explicit
retry after B erasure frees space. The processor RED uses valid generated output
and the real lifecycle host; the initial invalid-output/custom-lifecycle fixture
is retained as development evidence and does not establish that RED.

Future recovery records outcomes per scope. Only configuration writes serialize;
actual verifier work proceeds independently within the existing execution
concurrency setting. Valid siblings and their connector timer get fresh authority
while another verifier is held or fails. Failed scope progress stays visible;
trusted relogin retries the fresh failed scope without repeating successful
ones. A newer explicit stop removes that saved scope. Configuration publication
preserves a just-completed check only if its live generation and current
signature match. No old grants, snapshots, attempts or sync are revived.

## Focused checks and remaining gates

Revision logs are generated under `/tmp/mote-lifecycle-revision/` and copied with
hashes into the immutable handoff bundle. These are targeted generated fixtures,
not another full affected run.

| Evidence | Result |
| --- | --- |
| `control-*-red.log`, `control-*-binding.json` | Four independently repeated RED controls bind the final fixture hash and exact baseline module Git bytes. Every control restores the candidate bytes in `finally`; no control is a complete c0bf gate. |
| `R1-processor-red.log`, `R1-update-red.log`, `R1-update-red.json`, `R1-red.log` | Preserved RED/development inputs, with the distinctions above. The update RED temporarily restored only the exact c0bf Todo module; its fixed bytes were restored afterward. |
| `R2-red.log` | Actual held verifier prevents unrelated valid plugin/timer admission in the original implementation. |
| `R1-R2-frozen-green.log`, `frozen-green-binding.json` | Five pass on the final bound modules/fixtures: Todo create and growth, held processing publication, independent future retry and explicit stop. |
| `R1-R2-current.log` | 26 pass: targeted held processing, capacity, restore and existing Todo boundaries, including both create-first and growth-first admission. |
| `R2-final.log` | Two pass: held then failed real verifier, successful sibling/timer authority, bounded failure progress, retry and explicit-stop resolution, no old replay or duplicate timer. |
| `R1-processor-final.log` | One pass with the exact blocked/storage_limit outcome, zero artifact, preserved physical settlement and explicit successful retry. |
| `mcp-existing-wide.log` | Four pass using the original account-wide session across both deletion and source ABA. |
| `read-consumers-final.log` | 60 pass across all six consumer files, including the nine original failure boundaries and legal same-ID ABA. |
| `recovery-consumers-final.log` | 38 pass, including stopped backup, the real plugin host and the 60-second future connector/Actions timer journey. |
| `typecheck-frozen.log`, `scripts-typecheck-final.log`, `scope-frozen.log` | Server and scripts TypeScript, scope inventory and production import boundary passed. |

The driver alone executes the next complete `check:affected` gate on the new
frozen commit. No Draft PR is opened before that pass. Exact composition with
Extensions asynchronous checks, Execution parent-generation schema, current
Memory tables, Files heads/restore, Configuration and Ask follow-up commits is
unrun here and must be validated on their actual integrated inputs. Old candidate
or other-owner results do not prove those compositions.

Mac real-device UI and Android emulator acceptance are **PENDING**. The owner
explicitly accepted an emulator for Android; physical Android/OEM behavior is
unverified and does not block that approved scope. Real-model acceptance
through the existing local **Codex Server** is **PENDING**. The driver inventories
the actual configuration first and schedules isolated profiles, databases and
devices. This repair did not start a model, install components, open UI, collect
personal screenshots, run Gradle/emulators, deploy or merge main.

| Pending acceptance journey | Required observed transitions |
| --- | --- |
| Retention and capacity in real clients | Capture generated content; retain across logout/restart; exercise strict cutoff and infinite retention; fill the shared ceiling from another owner, observe refusal without partial content, erase/revoke, and retry through the ordinary UI. |
| Direct full export | Use the existing one-action Web/Android export; verify retained bytes and save destination; switch account or delete during delivery; reject a late/incomplete file; retry the current export. |
| Stopped restore and future policy | Restore an isolated stopped vault; confirm no authority before password login; log in, observe future processing, valid plugin and connector progress alongside a failed verifier; resolve only that failure; restart without old native effects, unknown-request replay or duplicate timers. |
| Existing private MCP through real Codex Server | Inventory the configured endpoint and model, use the authorized private MCP source path, query generated evidence before/during deletion and legal ABA, and verify citation/readset isolation and current subsequent reads through the existing contract. Public MCP sources retain their prior contract and do not acquire manual source/session steps. |

The final delivery must distinguish actually observed Mac UI, Android emulator
and real Codex results from fixture evidence. Until the driver supplies them, they remain
pending acceptance rather than passed validation.
