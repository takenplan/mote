# M07 Material organizer task identity

Original status: candidate, source review and execution qualification pending.

Progress update, 2026-10-20: source `66a576fd` and the later `60e` shipping port are
in main at documentation baseline `af11ab7c`. The
[first executed fixture record](validation/memory-material-fixture-first-failures-2026-10-19.md)
retains 81 tests with 76 passed and 5 failed; the
[restoration matrix](validation/multiuser-parity-restoration-matrix.md) records
subsequent bounded corrections and composed results. Full public reset,
automatic/image/save and lifecycle qualification must be matched to those exact
inputs; source integration does not prove complete qualification or deployment.
See the [current progress ledger](project-progress.md). The original UNKNOWN
list below describes this proposal's required evidence, not a claim that no
checks have since executed or a new request for a product-policy vote.

The M07 organizer consumes both new M03 captures and exact M06 publications.
The former operation key used capture ID, source ID, capture hash and event
(intake, processing admission or Material revision). Those values can remain
identical when an owner explicitly republishes an unchanged original after an
account authorization reset. M05 correctly rejects the resulting lookup of an
old task's expired grant. Control review F03 established this conditional source
counterexample; it was not a measured new M07 incident.

M07 owns the producer identity. Its operation and input now also pin the trusted
context's authorization epoch and a private capture/source lifetime token.
`mm_organizer_origins` lazily records that token on an actual event, with owned
foreign keys to both canonical rows. Capture or source deletion removes it;
ordinary edits and restart retain it. Input admission, execution and publication
require the same token and epoch. M05 still owns grant issuance, current-account
validation and duplicate-task admission. Ask owns its separate event identity.

The token is runtime metadata, excluded from portable Memory export's active
authority contract. Whole-instance SQLite recovery preserves it; the current
backup schema requires the table. Memory-domain erasure removes owned tokens.
No historical scan or new task is started by schema installation or restart.

- KEEP: existing M05 expired-grant refusal; exact original/head/hash checks;
  same-current event deduplication; successful execution checkpoints; retained
  intake policy; no historical model replay; current source/deletion fences.
- CHANGE: M07 deterministic event identity includes current authority and the
  exact capture/source lifetime, including raw, attachment and M06 events.
- REMOVE: body/revision identity alone as a sufficient task admission identity.
- EXCEPTION: current MVP task inputs and instance schema only; no compatibility,
  grant renewal, task migration or automatic historical reconstruction.
- UNKNOWN: execution results, runtime cost, complete Ask+M07 republication and
  instance/portable lifecycle regressions until their authorized checks run.

The complete public reset/republication journey must keep all consumers enabled
and assert the exact canonical revision. The narrower M05 admission regression
is supplementary. See [validation plan](validation/memory-material-incarnation-2026-10-19.md).
