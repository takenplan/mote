/** Host-owned execution budgets. A task's lifetime is independent of a single
 * transport request, a model repair round, and its renewable execution lease. */
export type ExecutionPolicy=Readonly<{timeoutMs:number|null;maxAttempts:number;maxRecoveryWindowMs:number|null}>;

const policy=(timeoutMs:number|null,maxAttempts:number):ExecutionPolicy=>Object.freeze({timeoutMs,maxAttempts,maxRecoveryWindowMs:null});

export const EXECUTION_POLICIES=Object.freeze({
 // Coordinators wait for their durable children; a child owns safe call retries.
 orchestration:policy(null,1),
 // Repeating an unchanged deterministic input cannot repair a contract failure.
 // One hour is a generous operation budget, matching existing Central batch
 // and processing-configuration budgets. It is not a workflow lifetime: large
 // multi-item work belongs in checkpointed orchestration, and known complexity
 // can override this budget at the actual operation boundary.
 deterministic:policy(3600000,1),
 // Retain the existing four-call bound for typed, safely replayable failures.
 // Capacity waits do not count, and an ambiguous issued call still needs its
 // domain's unknown-outcome guard before another physical request is permitted.
 localProcessing:policy(3600000,4),
 modelCall:policy(3600000,4),
 // Recording acquisition already permits five actual temporary call failures.
 // Network request deadlines remain local to the relevant transport operation.
 networkAcquisition:policy(3600000,5),
 // Configuration/bookkeeping needs diagnosis after a real failure, not replay.
 control:policy(3600000,1),
});
