# Shared business-flow corrections — 2026-10-18

Base: multi-user integration
`b26e797b5427fd089fa4fc4fa8b0cc45909f24af`.
Branch: `codex/business-flow-parity`.
The [accepted decision](../adr-shared-business-flows.md) and
[broader audit](../audits/business-flow-parity-2026-10-18.md) distinguish this
correction from remaining parity findings. Main's separate post-fork changes
are not incorporated or validated by this branch.

## Journeys and actual evidence

Only generated data, loopback model/media servers and generated Codex child
processes are used. The Harness and account/Ingress/task/archive entry points
are real; synthetic providers are not evidence of live-model quality.

| Journey | Executed coverage / result |
| --- | --- |
| Long internal instructions | Both HTTP model protocols and generated Codex runtime accept instructions over 20,000 characters without losing original evidence or coverage. Empty requests fail permanently before execution; real capacity rejections do not cause automatic replay. Nine new fixture cases pass. |
| Coding contract | Ten Coding understanding tests pass, including an 80-member complete coverage result and a policy over 20,000 characters. The complete coverage instruction occurs once in task context. |
| Recording domain | The three new real account/HTTP journeys pass for one and two owners: independent metadata/transcript/media failure receipts, date exclusion, completed-stage reuse, restart/retry and equal vendor IDs. The third holds transcript and later discovery independently, checks immediate first-page publication, page deduplication, unchanged-body metadata/title revisions, duplicate sync, source withdrawal before provider reads and explicit recovery after re-enable. Legacy recording characterization also exercises the common flow. |
| Backup intake and explicit ASR | `multiuser-recording-backup-processing.test.ts`: two tests pass. Real DingTalk transport fixture supplies spoken, empty and unsupported exports for A/B. All six backups remain readable/playable with no automatic processing admission, including retry, configuration update and restart. An explicit owner request performs ASR; ordinary audio with caller-forged role metadata still performs configured automatic ASR. |
| Backup data restoration | The second backup test deletes and restores the processing domain, twice restores the same archive, restarts, verifies actual restored format rows and exact original bytes, and finds no revived processing admission. Foreign-owner reads fail. |
| Backup export compatibility | A backup without processing products exports only `manifest.json` and exact `original` bytes. The manifest reports unprocessed state, MIME and original identity; it does not fabricate a transcript. Provider disconnect/restart retains original reads and export. Existing Files stream retirement checks cover the shared per-block source/owner fences. |
| Earlier scoped backup state | `recording-backup-upgrade.test.ts`: one generated real-startup journey passes. Before `app.ready`, it constructs earlier file-format/checkpoint/task states. Startup repairs only exact authenticated host-head originals before M05 starts, retires proven automatic roots and children, preserves owner/ordinary B processing and all unknown-call journals, and keeps an owner-selectable legacy intake key UNKNOWN. Internal retry stays fenced; one explicit root retry restores its safe retired child; same-key explicit processing establishes owner intent; unacknowledged unknown retry preserves the journal, and confirmed child retry uses the existing recovery protections. Repeated restart does not revive retired automatic work. |

Focused Agent runtime/context group: 75 passes, zero failures, one existing
installed-Codex opt-in skip. Agent and Server typechecks pass on the initial
composed source; the final affected check below supersedes those initial
typecheck results for the delivered source.

## Required affected-component check

```sh
npm run check:affected -- --base origin/codex/mote-multiuser-integration
```

The dry run selects i18n and `check:central`: Shared/Agent/Server/Web builds,
their typechecks and tests, Central runner and release-tool regressions. Final
execution and source identity are recorded here before PR publication.

## Preserved unsuccessful attempts

- The first full affected check was deliberately stopped during Server tests
  after review found that pre-existing automatic backup tasks also needed
  retirement. Its Shared/Agent results are focused evidence, not a completed
  final gate; interruption-generated test failures are not counted as passes.
  The required final run below uses the corrected source.
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
device, supplier account, real model or deployed release was used. No historical
failure was retried. Native client UI and runtime behavior were not validated
by the server fixtures. The audit's remaining business differences are not
closed by passing this correction's tests.
Earlier tasks lacking independent initiation-purpose facts retain their previous
behavior pending an owner decision; they may still continue ASR. Originals with
missing/mismatched authenticated host-head proof are not relabeled. The fixture
distinguishes those unknown cases from provable automatic admissions and does not
claim that every historical backup was found or stopped.
The scoped recording archive still publishes raw-export and segment Materials,
where the legacy archive stores one canonical transcript with chunks; audit F10
retains that consumer/product-shape difference for a subsequent decision. Stage
errors are independently durable and exposed by the API, while existing native
and Web recording settings still show the aggregate error.
