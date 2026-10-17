# Shared business-flow corrections — 2026-10-18

Base: multi-user integration
`b26e797b5427fd089fa4fc4fa8b0cc45909f24af`.
Branch: `codex/business-flow-parity`.
The [accepted decision](../adr-shared-business-flows.md) and
[broader audit](../audits/business-flow-parity-2026-10-18.md) distinguish this
correction from remaining parity findings. Main's separate post-fork changes
are not incorporated or validated by this branch.

## Joint-integration follow-up — 2026-10-18

The original branch-local executions retain their stated source checkpoints.
The failed complete affected check used
`3753e30e70700bab0fd1029f71b632e0e67589be`; `9e9f112c` adds the explicit import
declaration and its focused boundary check. These are not final merged-`main`
receipts. Later main-integration work addresses F10's stale recording tail/
empty/unsupported projection subcase, F12's history/equality contracts and F13's
known in-process decoder failure settlement. Their actual sources and narrow
results are in the [recording revision report](main-multiuser-recording-revisions-2026-10-18.md),
[aggregate integration report](main-multiuser-integration-2026-10-17.md) and
[decoder report](main-multiuser-local-decoder-failure-2026-10-18.md).
F02/F03/F04 and the audit's other unresolved capabilities/decisions remain open;
passing these corrections does not establish complete business parity.

The [real Codex receipt](shared-business-flows-codex-live-2026-10-18.json) is
unchanged. Its recorded execution head is
`866046e99bbf9a39d7bd1f0127134a66028f46c0`; its five Agent source hashes match
`3753e30e`, which defines “the delivered files” in the original receipt discussion
below. The joint merge retains separate main types/history/task-context changes;
no claim is made that all five hashes match final `main` or that this old native
turn validates the merged candidate. Its final checks and live-model acceptance
require their own source-bound integration evidence.

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
the source head at execution and five Agent source hashes, which still match
the delivered files. This validates the long-input Agent path; it does not prove
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
is retained as a failure, not relabeled as a passing check.

Final combined-candidate affected checks are run by the main integration task,
including this correction, before PR publication. Their source identity and
actual results will be recorded here when complete.

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
Codex check above used the local model login; no historical failure was retried.
Native client UI and runtime behavior were not validated
by the server fixtures. The audit's remaining business differences are not
closed by passing this correction's tests.
Older-version task inference, migration and recovery are outside the explicitly
accepted MVP scope. Current-version restart and data restoration remain covered
by the backup journeys above.
The scoped recording archive still publishes raw-export and segment Materials,
where the legacy archive stores one canonical transcript with chunks; audit F10
retains that consumer/product-shape difference for a subsequent decision. Stage
errors are independently durable and exposed by the API, while existing native
and Web recording settings still show the aggregate error.
