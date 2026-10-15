import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalRunStatus,executionEnvelope,retryDelay} from '../dist/execution.js';

test('current domain states have explicit execution projections',()=>{
  assert.equal(canonicalRunStatus({state:'completed'}),'succeeded');
  assert.equal(canonicalRunStatus({status:'waiting_for_model',errorCode:'model_unconfigured'}),'waiting');
  assert.equal(canonicalRunStatus({state:'interrupted'}),'queued');
  assert.equal(canonicalRunStatus({state:'stale'}),'skipped');
  const value=executionEnvelope({status:'waiting_for_model',attempts:2,errorCode:'model_unconfigured'});
  assert.equal(value.status,'waiting');
  assert.equal(value.waiting?.reason,'provider_unavailable');
  assert.deepEqual(value.allowedActions,['continue','cancel']);
  assert.equal(value.attempts,2);
});

test('failure scope distinguishes item failures from shared provider waits',()=>{
  const provider=executionEnvelope({status:'failed',errorCode:'model_unconfigured'});
  assert.equal(provider.failure?.scope,'provider');
  assert.equal(provider.failure?.recovery,'needs_action');
  const item=executionEnvelope({status:'failed',errorCode:'invalid_model_output'});
  assert.equal(item.failure?.scope,'item');
  assert.equal(item.failure?.recovery,'permanent');
  assert.deepEqual(item.allowedActions,['reprocess']);
});

test('backoff is bounded and deterministic when randomness is injected',()=>{
  const taskPolicy={maxAttempts:4,maxDurationMs:3600000,maxRecoveryWindowMs:86400000,baseDelayMs:30000,maxDelayMs:3600000,jitterRatio:.2};
  assert.equal(retryDelay(taskPolicy,1,()=>0),24000);
  assert.equal(retryDelay(taskPolicy,2,()=>1),72000);
  assert.equal(retryDelay({...taskPolicy,maxDelayMs:50000},20,()=>.5),50000);
});

test('capacity waiting is automatic and does not request configuration changes',()=>{
 const next=Date.now()+5000;
 const waiting=executionEnvelope({state:'waiting',attempts:0,errorCode:'rate_limited',availableAt:next});
 assert.equal(waiting.waiting.reason,'resource_limit');assert.equal(waiting.failure.recovery,'auto_retry');
 assert.equal(waiting.waiting.requiredAction,undefined);assert.ok(waiting.waiting.retryAfterMs>0&&waiting.waiting.retryAfterMs<=5000);
 const unavailable=executionEnvelope({state:'waiting',errorCode:'provider_unavailable',availableAt:next});
 assert.equal(unavailable.waiting.requiredAction,undefined);
 const historical=executionEnvelope({state:'failed',attempts:4,errorCode:'rate_limited'});
 assert.equal(historical.status,'failed');assert.equal(historical.failure.recovery,'needs_action');assert.equal(historical.waiting,undefined);
});

test('shutdown interruption distinguishes replayable tasks from runs requiring explicit retry',()=>{
 const resumable=executionEnvelope({state:'waiting',errorCode:'interrupted'}),interactive=executionEnvelope({state:'failed',errorCode:'interrupted'});
 assert.equal(resumable.failure.scope,'system');assert.equal(resumable.failure.recovery,'auto_retry');
 assert.equal(interactive.failure.scope,'system');assert.equal(interactive.failure.recovery,'needs_action');assert.deepEqual(interactive.allowedActions,['retry','reprocess']);
 const cancelled=executionEnvelope({state:'cancelled',errorCode:'cancelled'});assert.equal(cancelled.status,'cancelled');assert.deepEqual(cancelled.allowedActions,[]);
});

test('unknown and missing states are rejected instead of granting recovery actions',()=>{
  for(const input of [{status:'old_pending_state'},{status:'canceled'},{}])assert.throws(()=>executionEnvelope(input),/Unsupported domain execution state/);
});


test('terminal provider failure does not promise auto retry and unknown calls require acknowledgement',()=>{
 assert.equal(executionEnvelope({state:'failed',errorCode:'provider_unavailable'}).failure.recovery,'needs_action');
 const unknown=executionEnvelope({state:'blocked',errorCode:'processor_response_unknown'});assert.equal(unknown.waiting.reason,'outcome_unknown');assert.equal(unknown.waiting.requiredAction,'acknowledge_unknown_execution');assert.equal(unknown.failure.recovery,'needs_action');
 assert.equal(executionEnvelope({state:'blocked',errorCode:'processor_not_configured'}).waiting.reason,'configuration');
});
