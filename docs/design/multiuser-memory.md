# M07 Memory implementation checkpoints

The module branch is `codex/mote-multiuser-m07-memory`, based on Draft PR
[#132](https://github.com/utopiafar/mote/pull/132), exact head
`cdc5c34c36fc5743049007ee2c76d705fde3dd7f`. The integration branch remains
`6272a9b51ec92cc4c32e2ff1a1eeb4fa38b142ed`. This document describes an
**incomplete implementation checkpoint**, not completed M07 acceptance.

## First review checkpoint

`scope/memory-data.ts` owns composite user keys, Material-backed evidence pins,
Memory/current/history rows, original dependencies, FTS candidates, signed
cursors, deletion records, commands and restore receipts on the shared SQLite
connection. `PrivateSql` revalidates the captured host authority at each access.
HTTP and worker inputs cannot choose a user. A Material's uploader and semantic
subject are separate: source/block attribution metadata is preserved, and the
existing extraction and independent review policy decides the claim's subject.

The production builder registers `MemoryHost` with the existing M05 executor.
Extraction and review have separate M04 model snapshots admitted before execution;
publication uses one user resource. Original hashes, binding revision, domain
generation and deletion snapshot are checked at admission, every model request,
after awaits, checkpoint writes and final publication. Pausing admission preserves
admitted work; stopping increments only that user's publication generation.
Completed drafts/reviews are retained before the execution receipt is completed.
Recovery observes those retained outputs instead of charging another successful
model call.

The old Memory exact-output validator, independent reviewer, semantic deletion
review and provider write/readback seam are shared with this host. Pure contracts
were separated from the legacy Store constructors. The old fixture Store and
its executor remain test-only; no additional Store, database or scheduler is
constructed by M07. The legacy extraction transaction still encloses validation
and mutation.

Portable builtin restore validates the account envelope and every original
Material/evidence identity in one transaction, preserves deletions, restores
Memory as stale and never restores task authority. Whole-instance recovery is
different: its original scoped database retains the original tasks and grants.

## Minimal M06 connection

M07 consumes a current Material ID/revision and its exact original dependencies.
Its first checkpoint is exercised through actual M03/M02 Material publication,
not a substitute data service. Final acceptance must also consume **real M06**
output through the production upload/processing path.

Automatic admission needs a synchronous, host-only Material-published hook from
the M06 M05 commit, carrying the current `TaskRun`, Material ID and revision.
The hook must persist an M07 intake grant in that same transaction; retaining an
already completed M06 task context for asynchronous admission is invalid. If M05
needs an explicit synchronous no-model admission method, it should be a generic
extension of that existing framework. A model lease cannot be acquired inside
a synchronous publication transaction.

## Remaining implementation before final M07 review

- Bind source-specific, immutable existing Memory recipes/integration policies,
  complete range coverage and automation windows through the existing registries.
  The checkpoint's small `memory` configuration domain is provisional; it does
  not supersede delivered recipe choices or scheduling semantics.
- Restore native Mem0 literal repository/retrieval and Hindsight engine modes
  through M09's fixed instance/configuration/binding namespace and M04 model
  authority. Unsupported combinations must reject explicitly. Never combine a
  shared credential with a plugin-selected endpoint.
- Implement provider binding prepare/migration/activate/cancel, read snapshots,
  exact-version search and durable external-write/erasure reconciliation. External
  failure must never disclose the SQL body mirror to an API or model.
- Complete external-domain export/restore/cleanup, historical reads and native
  draft recovery. The checkpoint deliberately reports those modes unavailable;
  that does not count as restoration of the existing capability.
- Compose the accepted M06 implementation, exercise automatic end-to-end intake,
  integration and two-process recovery, obtain independent review, then run the
  final compilation/combined/affected checks before creating a Draft PR.

KEEP: attribution/evidence rules, exact immutable provider records, independent
review, one publication coordinator per user, shared service/database/executor.
CHANGE: every private key, candidate, model input, task and lifetime fence carries
host user authority. REMOVE: default owner and legacy private Store production
dispatch. EXCEPTION: trusted plugins/operators are not a malicious-code sandbox.
UNKNOWN: real credentials/models/providers, physical devices and deployment are
outside this authorization; synthetic fixtures do not establish those results.
