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
| Lifecycle prerequisites, safe transient failure and deterministic exception | Waiting does not increment failure count; typed actual failures stop at the extension bound; an unknown/deterministic failure stops once rather than being reopened by an outer loop. |
| Core waiting across restart, old recovery deadline and revoked input | Repeated busy cannot exhaust attempts or a generic elapsed window; re-admission rechecks authority; terminal children stay terminal. |
| Lease interruption, unknown issued call and late results | Interruption preserves checkpoints and refunds the unconfirmed attempt; domain unknown guards still prevent unsafe replay; revoked fences reject late publication. |
| Format/asset subprocess queueing | Concrete subprocess protection starts after a worker slot, while queued cancellation remains effective. |
| Failure receipts, provider/worker cooldown and API projection | Safe execution/admission facts and actual next eligibility survive restart; no provider prose or credentials; longer concurrent cooldown wins and late success cannot clear it. Historical failed tasks remain terminal. |
| Terminal organizer, processing and lifecycle children are observed again | Registering the same organizer version, replaying its parent or restarting a saved lifecycle window cannot revive a failed execution. Existing explicit manual retry entry points still recover their precisely linked children. |
| Summary checkpoint and cooldown storage | New metadata participates in logical quota accounting; rollback, restart and file deletion retain correct ledger totals. |

Focused generated suites were run during implementation. Intermediate full-server
exploration included stale build products and concurrent edits and is not final
acceptance evidence. Final affected checks are recorded below after running the
isolated PR candidate.

## Final checks

Pending final candidate validation. The required scope is selected with
`npm run check:affected -- --dry-run`; shared contracts, Agent and catalog changes
select all consumers (`check:local` plus Android debug unit tests).

## Deliberately unperformed

- No real personal recording or captured screenshot was replayed or collected.
- No historical failed task was rerun or reset.
- No physical Android/macOS lifecycle or live-model quality acceptance was run.
- No running Central, FRP, model profile or privacy setting was changed.
- A generated model stub/fake Codex process is not a live ASR, speaker model or
  paid model quality evaluation.

This change does not implement the separate Android Memory authorization/derived
Material continuity issue, or a distributed multi-central worker queue. Worker
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
