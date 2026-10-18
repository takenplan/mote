import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {AgentResponseError,AgentTimeoutError} from '@mote/agent';
import {ModelUsageLedger,portableUsageReceipt} from '../src/scope/model-usage.js';
import {usageTotals} from '../src/usage-metrics.js';
import {safeAgentFailure} from '../src/scope/model-query.js';
import {failureContext} from '../src/execution-failures.js';

const cumulative={requests:0,reportedRequests:0,inputTokens:400,outputTokens:200,totalTokens:600,cacheReadTokens:0,cacheWriteTokens:0,measurement:'thread_cumulative' as const,complete:true};
const binding=()=>({userId:'generated-user',leaseId:randomUUID(),provider:'generated',model:'generated-model',operation:'memory',operationId:'generated-operation'});
function fixture(t:any){const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON; CREATE TABLE user_model_usage(user_id TEXT NOT NULL,id TEXT NOT NULL,json TEXT NOT NULL,PRIMARY KEY(user_id,id))');let now=Date.parse('2026-10-18T00:00:00Z');const ledger=new ModelUsageLedger(db,()=>now);t.after(()=>{ledger.close();db.close();});return {db,ledger,advance:(ms:number)=>{now+=ms;},rows:()=>db.prepare('SELECT json FROM user_model_usage ORDER BY id').all().map(row=>JSON.parse(String(row.json)))};}

test('prepared and confirmed non-execution preserve facts without counting model runs or queue duration',t=>{
 const f=fixture(t),model=binding(),queued=f.ledger.start(model,()=>{});f.advance(120000);
 assert.equal(usageTotals(f.rows()).runs,0);assert.equal(f.rows()[0].durationMs,0);
 queued.issued();queued.issued();f.advance(50);queued.update(cumulative);const receipt=queued.finish('completed');assert.equal(receipt.durationMs,50);assert.equal(receipt.estimatedCost,null);
 const rejected=f.ledger.start(model,()=>{});rejected.issued();rejected.update({requests:1,reportedRequests:1,inputTokens:0,outputTokens:0,totalTokens:0});f.advance(100);const busy=rejected.finish('failed',{executionStarted:false});assert.ok(busy.issuance?.issuedAt);assert.equal(busy.issuance?.executionStarted,false);assert.equal(busy.durationMs,0);
 assert.equal(usageTotals(f.rows()).runs,1);assert.equal(usageTotals(f.rows()).failed,0);assert.equal(usageTotals(f.rows()).totalTokens,600);
});

test('same lease supports independent queries; cumulative snapshots and duplicate finalization never add twice',t=>{
 const f=fixture(t),model=binding(),options={attribution:{jobId:'generated-job',requestId:'generated-request'}},one=f.ledger.start(model,()=>{},options),same=f.ledger.start(model,()=>{},{...options,id:one.id});
 one.issued();same.update({...cumulative,inputTokens:200,outputTokens:100,totalTokens:300});one.update(cumulative);same.update(cumulative);f.advance(10);const first=one.finish('failed',{executionStarted:false});assert.equal(first.issuance?.executionStarted,undefined,'a later rejected turn cannot erase reported consumption');assert.deepEqual(same.finish('failed'),first);
 const two=f.ledger.start(model,()=>{});assert.notEqual(one.id,two.id);two.issued();two.update({...cumulative,inputTokens:80,outputTokens:40,totalTokens:120});two.finish('completed');
 const totals=usageTotals(f.rows());assert.equal(totals.runs,2);assert.equal(totals.totalTokens,720);assert.equal(totals.failed,1);assert.equal(totals.unknownUsage,0);assert.equal(totals.unknownRequestCounts,2);assert.equal(totals.requests,0);assert.equal(totals.costs.USD,null);
 assert.throws(()=>f.ledger.start({...model,leaseId:randomUUID()},()=>{},{id:one.id}),{code:'config_conflict'});
 assert.throws(()=>one.update(cumulative),{code:'config_conflict'});
});

test('another live host cannot finalize fragments; shutdown retains partial cumulative usage and fences the old meter',t=>{
 const f=fixture(t),model=binding(),meter=f.ledger.start(model,()=>{});meter.issued();meter.update(cumulative);
 const snapshot=portableUsageReceipt(f.rows()[0]);assert.equal(snapshot.status,'failed');assert.equal(snapshot.tokens!.complete,false);assert.equal(f.rows()[0].status,'running','export never closes the live owner');
 const another=new ModelUsageLedger(f.db);assert.equal(f.rows()[0].status,'running');another.close();assert.equal(f.rows()[0].status,'running');
 f.ledger.close();const restored=new ModelUsageLedger(f.db);const receipt=f.rows()[0];assert.equal(receipt.status,'failed');assert.equal(receipt.tokens.totalTokens,600);assert.equal(receipt.tokens.complete,false);assert.equal(receipt.estimatedCost,null);assert.equal(usageTotals([receipt]).unknownUsage,1);
 assert.throws(()=>meter.issued(),{code:'config_unavailable'});restored.close();
});

test('safe Agent failures retain fixed reasons and host identities without provider prose or structural error authority',()=>{
 const secret='GENERATED_PRIVATE_ORIGINAL_AND_CREDENTIAL';
 const error=safeAgentFailure(new AgentResponseError(secret,'host_validation'),{jobId:'generated-job',batchId:'generated-batch',phase:'extract',causeCode:'quote_not_found'});
 assert.equal((error as any).code,'agent_host_validation');assert.equal((error as any).category,'permanent');assert.ok(!JSON.stringify(error).includes(secret));assert.ok(!String(error).includes(secret));assert.deepEqual(failureContext(error),{jobId:'generated-job',batchId:'generated-batch',phase:'extract',causeCode:'quote_not_found'});
 assert.equal((safeAgentFailure(new AgentTimeoutError()) as any).code,'agent_request_timeout');
 assert.equal((safeAgentFailure({name:'AgentResponseError',reason:secret,message:secret}) as any).code,'agent_internal_error');
});

test('an existing meter can interrupt only its retained fragment after revocation without late samples or deleted-row resurrection',t=>{
 const f=fixture(t),model=binding();let revoked=false;const meter=f.ledger.start(model,()=>{if(revoked)throw Error('generated revoked grant');});meter.issued();meter.update(cumulative);revoked=true;
 assert.throws(()=>meter.finish('completed'));assert.throws(()=>meter.update({...cumulative,inputTokens:800,outputTokens:400,totalTokens:1200}));const interrupted=meter.interrupt()!;assert.equal(interrupted.status,'failed');assert.equal(interrupted.tokens!.totalTokens,600);assert.equal(interrupted.tokens!.complete,false);assert.equal(interrupted.estimatedCost,null);assert.deepEqual(meter.interrupt(),interrupted);
 f.db.prepare('DELETE FROM user_model_usage WHERE user_id=? AND id=?').run(model.userId,meter.id);assert.equal(meter.interrupt(),undefined);assert.equal(f.rows().length,0);
});
