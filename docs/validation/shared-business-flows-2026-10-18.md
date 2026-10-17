# Shared business-flow corrections — 2026-10-18

Base: multi-user integration
`b26e797b5427fd089fa4fc4fa8b0cc45909f24af`.
Branch: `codex/business-flow-parity`.
The [accepted decision](../adr-shared-business-flows.md) and
[broader audit](../audits/business-flow-parity-2026-10-18.md) distinguish this
correction from remaining parity findings. Main's separate post-fork changes
are not incorporated into this branch. Evidence for the combined integration
candidate is identified separately below.

## Journeys and actual evidence

Fixture checks use generated data, loopback model/media servers and generated
Codex child processes. The Harness and account/Ingress/task/archive entry points
are real; synthetic providers are not evidence of live-model quality. The
separate real Codex check below also uses only generated content.

| Journey | Executed coverage / result |
| --- | --- |
| Long internal instructions | Both HTTP model protocols and generated Codex runtime accept instructions over 20,000 characters without losing original evidence or coverage. Empty requests fail permanently before execution; real capacity rejections do not cause automatic replay. Nine new fixture cases pass. |
| Coding contract | Ten Coding understanding tests pass, including an 80-member complete coverage result and a policy over 20,000 characters. The complete coverage instruction occurs once in task context. |
| Recording domain | The three new real account/HTTP journeys pass for one and two owners: independent metadata/transcript/media failure receipts, date exclusion, completed-stage reuse, restart/retry and equal vendor IDs. The third holds transcript and later discovery independently, checks immediate first-page publication, page deduplication, unchanged-body metadata/title revisions, duplicate sync, source withdrawal before provider reads and explicit recovery after re-enable. Legacy recording characterization also exercises the common flow. |
| Backup intake and explicit ASR | `multiuser-recording-backup-processing.test.ts`: two tests pass. Real DingTalk transport fixture supplies spoken, empty and unsupported exports for A/B. All six backups remain readable/playable with no automatic processing admission, including retry, configuration update and restart. An explicit owner request performs ASR; ordinary audio with caller-forged role metadata still performs configured automatic ASR. |
| Backup data restoration | The second backup test deletes and restores the processing domain, twice restores the same archive, restarts, verifies actual restored format rows and exact original bytes, and finds no revived processing admission. Foreign-owner reads fail. |
| Backup export compatibility | A backup without processing products exports only `manifest.json` and exact `original` bytes. The manifest reports unprocessed state, MIME and original identity; it does not fabricate a transcript. Provider disconnect/restart retains original reads and export. Existing Files stream retirement checks cover the shared per-block source/owner fences. |

Focused Agent runtime/context group: 75 passes, zero failures, one existing
installed-Codex opt-in skip. Agent and Server typechecks pass on the initial
composed source; the final affected check below supersedes those initial
typecheck results for the delivered source; the exact outcomes and source
identities are recorded below.

## Real local Codex validation

The installed `codex-cli 0.162.1 app-server`, using the normal local login,
acknowledged `gpt-6.1-sol` with low reasoning. One real native turn received a
59,081-character host policy, 11,310 characters across three generated originals
and their complete coverage contract. Host trace assertions verified exact
serialization. The actual model returned policy beginning/middle/end markers,
each original's beginning/middle/end/Unicode/backslash anchors and all target
coverage; one host validation passed with zero repairs in 15.478 seconds.

Reported thread-cumulative usage was 21,580 input and 557 output tokens (22,137
total; 25 reasoning tokens reported within that measurement). The underlying
request count and monetary charge are unknown; a zero request counter is not
evidence of no model invocation. The isolated runtime was cleaned.

The [sanitized receipt](shared-business-flows-codex-live-2026-10-18.json) records
the source head at execution and five Agent source hashes. Those match this
corrective branch at runtime freeze `9e9f112c`; the combined integration has its
own source identity and acceptance below. This validates the long-input Agent
path; it does not prove
the complete Coding product/independent Memory review journey or general recall.

## Required affected-component check

```sh
npm run check:affected -- --base origin/codex/mote-multiuser-integration
```

The run on `3753e30e70700bab0fd1029f71b632e0e67589be` selected i18n and
`check:central`: Shared/Agent/Server/Web builds, typechecks and tests, Central
runner and release-tool regressions. It completed with exit code **1**:

| Component | Passed | Failed | Existing skips |
| --- | ---: | ---: | ---: |
| Shared | 192 | 0 | 0 |
| Agent | 326 | 0 | 1 |
| Server | 2,946 | 1 | 2 |
| Web | 576 | 0 | 0 |

The sole failure was the production import boundary: the new shared
`connectors/recording-flow.ts` had not been explicitly declared. The correction
adds exactly this module to the import exception list. It accepts already-bound
ports, constructs no legacy Store, scheduler or default owner, and declares no
new scope surface. After the correction, `node scripts/check-scope-contracts.mjs`
and all four `scope-architecture.test.ts` cases passed. The standalone full run
is retained as a failure, not relabeled as a passing check. That failure stopped
`check:central` before the Central runner and release-tool regressions, which
were not executed in this standalone attempt.

The corrected source's dry run also selects Desktop/Android/tooling because the
import-boundary script changed: `check:local` plus Android unit tests.
Final combined-candidate affected checks are run by the main integration task,
including this correction, before PR publication. Their source identity and
actual results will be recorded here when complete.

## Initial combined-candidate check — failed

The main integration task ran `npm run check:affected -- --base origin/main`
on `e284df41a4e495227d01034b532aa81181cc4d42` (tree
`b8fa7da3c2d3942831935fd4be3064865b8dfcd9`). Its second parent is this branch's
runtime freeze `9e9f112c9bb4d26a66b14b1006226cf622137f03`; ancestry was verified.
All five affected groups were selected. The command ended with exit code **1**:

| Component | Passed | Failed | Existing skips |
| --- | ---: | ---: | ---: |
| Desktop | 589 | 0 | 0 |
| Server | 3,013 | 1 | 2 |
| Web | 583 | 0 | 0 |
| Agent | 327 | 0 | 1 |
| Diagnostics | 5 | 0 | 0 |
| Shared | 195 | 0 | 0 |

The failure was `multiuser-ask.test.ts`, “pending-child admission still retires a
stale conversation before the held child settles”: its assertions passed, then
the after hook's `rmSync` returned `ENOTEMPTY` while workspace cleanup could still
recreate an empty work directory. The result is retained as a failure. The
root-level script/Central-runner regressions and Android unit task were not
executed because the workspace command failed. The main integration task owns
the lifecycle correction and final affected rerun; this attempt does not
establish final acceptance.

Before this full attempt, the same combined source passed a fresh Central build,
13 recording/backup/revision/decode-settlement fixture tests, and seven local
Codex acceptance scenarios including two actual model Ask calls for separate
users. Those are separate, source-specific observations; they do not convert
the failed full command into a pass.

## Second combined-candidate check — application suites passed, tooling failed

On `bfc4cbdf05b9b8af98ae592828856efd09f1c3a3` (tree
`8777b57d8d260c5c98c112c1a06ad3f46ce5e46f`), the same full affected command
passed every application workspace: Desktop 589; Server 3,069 plus two existing
skips; Web 583; Agent 327 plus one existing skip; Diagnostics 5; Shared 195.
Server included the original pending-child case unchanged and 55 new cleanup
regression nodes. Fresh Central build and seven real local Codex scenarios,
including two model Ask calls, had also passed on this source.

The following combined script group reported 81 passes and two failures. Both
`dev-log-retention.test.mjs` failures were generated-service startup timeouts:
the fixture returned only `{ok:true}`, while current CLI readiness requires the
multi-user public health contract. This is not a capacity-preflight failure or
evidence that startup merely needs a longer budget. Correct the generated
response, retaining the production health check and existing capacity assertions.
The full command remains a failure; later script stages and Android were not
executed in this attempt. The final corrected-source results are recorded
separately before publication.

After that failure, the main task separately ran the previously truncated
consumer stages on the same `bfc4cbdf` source: client script tests passed 5/5,
the Central runner passed, and Android `:app:testDebugUnitTest` passed all 362
tests with no failures, errors or skips. These are separate successful commands,
not a relabeling of the failed affected check. The generated readiness fixture
was then corrected in `3518706b68ece5781fb8813d5a5ad8c8dbaa22ad`; its focused
eight release-tool tests passed. That commit changes only
`scripts/release/dev-log-retention.test.mjs`, so application/runtime source and
the preceding real Codex acceptance source are identical to `bfc4cbdf`.

## Third combined-candidate check — late directory creation

The full affected check on `3518706b68ece5781fb8813d5a5ad8c8dbaa22ad` (tree
`892fa9868776447df26c7ea308954d7ebc46558f`) naturally exited **1** after failing
in the workspace stage:
Server reported 3,068 passes, one failure and two existing skips. Desktop 589,
Web 583, Agent 327 plus one existing skip, Diagnostics 5 and Shared 195 passed.
The failure was `multiuser-processing.test.ts`, “held file term review cannot
publish after file-cancel”. Its business assertions passed; the after hook's
directory removal returned `ENOTEMPTY` as late work created empty directories.
This is a cleanup/lifecycle failure, not observed late-result publication. The
failure is retained, and root script, Central-runner and Android stages were
not reached in this attempt. The main task owns the remaining directory-creation
and close-order correction and subsequent affected checks.

The main task then ran the truncated stages separately on the same `3518706b`
source: all 83 root script tests, all five client tests and the Central runner
passed. Android's unit-test command exited successfully with its test task
`UP-TO-DATE`; the previously executed 362-test result on `bfc4cbdf` is retained
as the actual Android execution. These supplemental commands do not turn the
failed full affected check into a pass.

## Preserved unsuccessful attempts

- Initial affected checks were interrupted while review investigated
  earlier-version task compatibility. The owner then explicitly excluded that
  scope for the MVP. The additional origin journal, startup repair, retry hooks
  and upgrade tests were removed; none of their results validates the delivered
  code. A subsequent run was also stopped to remove old boolean/receipt mirrors;
  the final affected run covers the current-version-only implementation.
- Initial library build raced the in-progress `AgentInputError` edit and found
  an incompatible status-code override. The override was removed; the complete
  library build and focused typechecks then passed.
- The first new backup test imported a model-settings factory from the wrong
  module. The import was corrected before any product assertion ran.
- A subsequent new test used an invalid capture-browser URL. The actual route
  now verifies the existing `fileArchive` navigation advertisement.
- The first combined backup/export run correctly served B's own equal-ID
  recording after both owners synchronized; the new foreign-ID assertion had
  assumed capture IDs were globally unique. The denial check now runs before
  B has synchronized that recording, while original references retain their
  separate cross-owner denial check.
- Attempting to delete/restore the whole processing domain after an unsupported
  vendor export returned `result_unknown`. The pre-existing deterministic
  decoder failure/physical-activity classification gap is retained as audit
  finding F13. The backup test does not clear or acknowledge that unknown fact.
  Data restoration is verified separately with a fresh backup-only domain.

## Limits

No production configuration, personal archive, original screenshot, physical
device, supplier recording account or deployed release was used. Only the real
Codex checks identified above used the local model login; no historical failure
was retried.
Native client UI and runtime behavior were not validated
by the server fixtures. The audit's remaining business differences are not
closed by passing this correction's tests.
Older-version task inference, migration and recovery are outside the explicitly
accepted MVP scope. Current-version restart and data restoration remain covered
by the backup journeys above.
The scoped recording archive still publishes raw-export and segment Materials,
where the legacy archive stores one canonical transcript with chunks; audit F10
retains that consumer/product-shape difference as an implementation follow-up
under the existing ADR. Stage
errors are independently durable and exposed by the API, while existing native
and Web recording settings still show the aggregate error.
