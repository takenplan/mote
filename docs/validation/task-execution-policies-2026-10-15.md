# Central execution policy regression record

Date: 2026-10-15. Scope: all Central task registrations, parent/child waiting,
failure classification, local workers and Agent admission accounting.

## Generated journeys

An isolated comparison ran the same generated loopback HTTP 429 worker and
injected scheduler clock against `9798e01c` and the implementation candidate.
The old engine failed after four requests at virtual elapsed time 7,000 ms and
stayed failed after worker release. The candidate retained `waiting`, zero
failed-processing attempts after eight busy responses, then committed once after
release. This is an executor/HTTP reproduction with generated input and a fake
clock, not a physical recording or a complete old-release end-to-end run. The
durable core and file-intake regressions below cover the repaired lifecycle.

| Journey | Regression boundary |
| --- | --- |
| Twenty-five archived generated files, worker busy for six rounds, restart and release | Actual file HTTP intake; shared cooldown prevents per-file request storms; parents and children retain zero failed-processing attempts; originals remain; all files finish after release. |
| Long extraction followed by diarization | Two 650 ms stages each fit their explicit 1 s call budget even though the workflow exceeds the old 1 s total. Alignment holds no ASR resource. |
| ASR and diarization share one actual Python HTTP worker | Generated model/dependency stubs exercise the real worker entry point; concurrent rejection certifies non-execution and Retry-After; timeout cleanup releases the slot. OCR uses the same explicit busy contract. |
| Legacy perception and production image processing contend for OCR | Shared durable cooldown and managed-listener resource identity; busy is waiting with no unknown ledger, independent custom-service concurrency preserved. |
| Summary page succeeds, later page is busy, restart and finish | Successful page checkpoint is reused; no duplicate model call for the earlier page; summary publication waits for all pages. Explicit reprocessing and deletion follow their existing boundaries. |
| File summary citations and semantic turn groups fail host validation | Actual default Agent and generated loopback model return an invalid first answer, receive trusted validation feedback, then correct it in the same session under the existing finite repair bound. |
| Actual Central Ask/Insight waits longer than the configured model budget | Real host concurrency gates and generated Agent; admission waits do not expire an outer copied model timer. Explicit actual-call timeout still fails with its typed cause and fences late publication. |
| Actual Central file semantic grouping and summary wait beyond the file call budget | Real host model gates hold generated file work longer than its explicit 1 s transport setting, then release it; no model is dispatched while waiting, ASR is not repeated, and each semantic stage commits once. |
| Import prepare and commit wait, shut down and restart | Generated archived inputs retain parsing/publication checkpoints and the next eligible time; original records and completion notification are not duplicated. An unclassified network failure remains terminal. |
| Actual fake-Codex session waits before a model turn | Generated executable and isolated auth fixture; no turn is sent during resource waiting; admitted turn completes within its own budget. Explicit host cancellation removes the queued call. |
| Central model gate cancellation and cooldown accounting | A queued operation cancelled or rejected before dispatch creates no unissued usage receipt; partial reported tokens and actual issued failures remain recorded. Query, file analysis and import use the same trusted admission accounting boundary. |
| Lifecycle prerequisites, safe transient failure and deterministic exception | Waiting does not increment failure count; typed actual failures stop at the extension bound; an unknown/deterministic failure stops once rather than being reopened by an outer loop. |
| Core waiting across restart, old recovery deadline and revoked input | Repeated busy cannot exhaust attempts or a generic elapsed window; re-admission rechecks authority; terminal children stay terminal. |
| Lease interruption, unknown issued call and late results | Interruption preserves checkpoints and refunds the unconfirmed attempt; domain unknown guards still prevent unsafe replay; revoked fences reject late publication. |
| Format/asset subprocess queueing | Concrete subprocess protection starts after a worker slot, while queued cancellation remains effective. |
| Failure receipts, provider/worker cooldown and API projection | Safe execution/admission facts and actual next eligibility survive restart; no provider prose or credentials; longer concurrent cooldown wins and late success cannot clear it. Historical failed tasks remain terminal. |
| Terminal organizer, processing and lifecycle children are observed again | Registering the same organizer version, replaying its parent or restarting a saved lifecycle window cannot revive a failed execution. Existing explicit manual retry entry points still recover their precisely linked children. |
| Automatic Insight fails transiently after saving its child checkpoint | A generated real lifecycle/Insight run reproduces the stuck checkpoint before the fix. The same window preserves backoff and yielded admission across restart, replaces only its linked typed-transient failed observation, retains the old receipt, completes and admits the next window. Repeated real failures stop at four; permanent/unclassified failure, cancellation and a legacy parent replay do not reopen the observation. |
| Summary checkpoint and cooldown storage | New metadata participates in logical quota accounting; rollback, restart and file deletion retain correct ledger totals. |

Focused generated suites were run during implementation. Preliminary exploratory
runs are not acceptance evidence. The final checks below used a clean, isolated
checkout of the committed candidate, excluding unrelated pre-existing untracked
workspace files.

## Final checks

Code candidate: `2b4e0d80a9193d77b4e6ce231d250abf093bd0ed`, compared with
`origin/main` at `9798e01cdce3b9ca26b9a86e6071186d8859c402`.

- `npm run build:central`: passed.
- `npm run check:affected -- --base origin/main --head HEAD`: passed. Shared
  contracts, Agent and catalog changes selected all consumers: `check:local`
  followed by Android `:app:testDebugUnitTest`.
- The complete check included translation/catalog synchronization, all workspace
  type checks, the workspace suites below, release/security/media-worker tests,
  generated client journeys and the actual Central runner fixture.
- Changed Markdown rendered with a CommonMark/table parser; local link targets,
  policy table structure and `git diff --check` passed. Subsequent changes only
  record this validation result.

| Suite | Final result |
| --- | --- |
| Central | 1,887 passed; 1 environment-gated skip |
| Web | 388 passed |
| Agent | 316 passed; 1 environment-gated skip |
| Desktop | 442 passed in 55 files |
| Diagnostics | 5 passed |
| Shared | 184 passed |
| Android debug unit tests | 319 passed in 68 JUnit suites; no failures/errors/skips |

The skipped scenarios were macOS sandbox confinement and the opt-in installed
Codex integration. Generated worker and fake-Codex tests ran; those do not prove
native sandbox availability or compatibility with an installed real Codex.

## Deliberately unperformed

- No real personal recording or captured screenshot was replayed or collected.
- No historical failed task was rerun or reset.
- No physical Android/macOS lifecycle or live-model quality acceptance was run.
- No running Central, FRP, model profile or privacy setting was changed.
- A generated model stub/fake Codex process is not a live ASR, speaker model or
  paid model quality evaluation.

This change does not implement a distributed multi-central worker queue. Worker
health readiness alone still does not prove that its physical processing slot is
idle.

Successful published stages and summary pages are durable checkpoints. An
unpublished multi-round Agent draft is not a durable checkpoint: after a restart
or a later admission rejection, resuming its containing stage can reconstruct
that Agent session and repeat earlier internal model rounds. This change does
not claim exactly-once model execution or persist every intermediate draft.

File call guards also remain conservative after process loss. A file stage can
enter the guard before an in-memory model slot becomes available; a crash then
loses proof of whether admission occurred. Such a guard may become `unknown`
and require its existing explicit recovery, rather than automatic resubmission.
The generated gate-wait tests prove live waiting and cancellation; persisted
busy/restart tests prove recovery where explicit non-execution is known.
