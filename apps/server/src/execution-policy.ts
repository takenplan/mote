/** Host-owned execution budgets. A task's lifetime is independent of a single
 * transport request, a model repair round, and its renewable execution lease. */
export type ExecutionPolicy=Readonly<{timeoutMs:number|null;maxAttempts:number;maxRecoveryWindowMs:number|null}>;

const policy=(timeoutMs:number|null,maxAttempts:number):ExecutionPolicy=>Object.freeze({timeoutMs,maxAttempts,maxRecoveryWindowMs:null});

export const EXECUTION_POLICIES=Object.freeze({
 // Coordinators wait for their durable children; a child owns safe call retries.
 orchestration:policy(null,3),
 // Repeating an unchanged deterministic input cannot repair a contract failure.
 // One hour is a generous operation budget, matching existing Central batch
 // and processing-configuration budgets. It is not a workflow lifetime: large
 // multi-item work belongs in checkpointed orchestration, and known complexity
 // can override this budget at the actual operation boundary.
 deterministic:policy(3600000,3),
 // Initial execution plus two automatic retries of eligible failures. Unknown
 // read calls additionally require exact physical cleanup; effects reconcile.
 localProcessing:policy(3600000,3),
 modelCall:policy(3600000,3),
 // Acquisition uses the same finite failed-execution count.
 // Network request deadlines remain local to the relevant transport operation.
 networkAcquisition:policy(3600000,3),
 // Configuration/bookkeeping needs diagnosis after a real failure, not replay.
 control:policy(3600000,3),
});
