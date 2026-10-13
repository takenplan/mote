# Current task counts and invalidated inputs

Material organization status previously counted failed receipts from superseded generations as pending work. An organizer that failed and then succeeded after a source revision could therefore have a successful Operation while `pendingSteps` remained positive. The status now uses active membership in the step's own Operation, counts each step once, and reports waiting/running as pending with blocked and failed counts separately. Historical failure receipts remain readable.

Memory publication reports `failedBatches` only for processing failures and `invalidatedBatches` for changed or revoked input. A terminal task whose remaining inputs are all invalidated carries `outcome: input_invalidated` and a skipped execution envelope; mixed tasks retain `processing_failed`, the actual failure cause and both counts. The existing persisted terminal `status` remains unchanged for scheduling, lifecycle activation and historical authorization. Consumers should use the publication outcome to describe these historical tasks, rather than infer an executable retry from a terminal status alone. A transactional, versioned metadata migration rebuilds counters without replaying model work or changing batch evidence.

Action analysis global alerts require a surviving job and current matching evidence. Deleted and superseded inputs retain their receipts but no longer create a current failure banner. Unfinished superseded jobs are shown as stale; another independent valid failure remains visible. Completed and cancelled analysis receipts retain their historical meanings.

Supersession check:

- KEEP: current execution authority, immutable history, attempts, scheduling and unknown-outcome protection. Normal optional skips remain independent of required failures.
- CHANGE: organizer pending counts and separate attention counts; Memory publication outcome and failure/invalidated counts; action analysis current-error projection.
- REMOVE: aggregating obsolete organizer failures into backlog; treating every invalidated Memory input as a processing failure; global action alerts with no effective input.
- EXCEPTION: physical resource leases, lifecycle change-event counts and explicit historical receipt totals are not current-publication counts.
- UNKNOWN: fixture validation does not establish all plugin-specific counters or live model content quality.

Generated regressions cover source revision after organizer failure, current failure before a replacement exists, explicit retry, shared parent membership and restart; Memory source invalidation through the actual pipeline, list/detail agreement, mixed failures, old-counter migration, transaction rollback and restart without replay; action evidence deletion/replacement while another independent failure remains; and Memory UI counts and controls for invalidated, mixed, paused and cancelled tasks. All input data and analysis functions are synthetic.
