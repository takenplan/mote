import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {MemoryFeedback} from '../src/scope/memory-feedback.js';
import {TaskExecution} from '../src/scope/task-execution.js';
import type {MemoryFeedbackRequest} from '../src/memory-feedback.js';

// Parser/partition negatives complement the real two-account SIGKILL feedback
// journey. These generated controls do not establish account or model authority.
const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
const member=(index:number)=>({key:hash('generated-local-range-'+index),id:randomUUID(),offset:0,length:30,fingerprint:hash('generated-local-original-'+index),state:'pending' as const,memoryIds:[]});
const targets=[member(0),member(1)],context=member(2),request:MemoryFeedbackRequest={jobId:randomUUID(),batchId:randomUUID(),round:1,contextTime:'2026-10-21T00:00:00Z',targets,authorized:[...targets,context],coverage:targets.map(target=>({key:target.key,state:'needs_context',candidateIndexes:[],contextRefs:[context.key]})),requireNewContext:true};
const units=()=>targets.map((target,index)=>({localId:'generated-unit-'+index,capabilityId:'memory.feedback-group',capabilityVersion:'1',goal:'Inspect this exact generated target',input:{memberKeys:[target.key],contextKeys:[context.key],instruction:'Use the authorized new generated context.'}}));
const consume=(value:unknown,selected=request)=>{let assertions=0;const host={payload:()=>({request:selected})},run={context:{},task:{input:{id:request.jobId}},assert:()=>{assertions++;},checkpoint:{read:()=>structuredClone(value)}};const result=(MemoryFeedback.prototype as any).proposal.call(host,run);assert.ok(assertions>=2);return result;};

test('local feedback consumes the same complete exact group or stop proposal without a model handle',()=>{
 const value=units(),first=consume(value);assert.equal(first.groups.length,2);assert.deepEqual(consume(value),first);assert.deepEqual(value,units());assert.deepEqual(consume([{localId:'generated-stop',capabilityId:'memory.feedback-stop',capabilityVersion:'1',goal:'Keep unavailable context explicit',input:{reason:'Generated context remains unavailable.'}}]),{groups:[],stop:'Generated context remains unavailable.'});
});

for(const malformed of ['missing','partial','version','unknown-type','duplicate-id','foreign-context','old-context','overlap','extra-field','invalid-stop','mixed-stop'] as const)test('local feedback rejects durable proposal '+malformed,()=>{
 const value:any[]=units();let selected=request;
 if(malformed==='missing')value.length=0;if(malformed==='partial')value.pop();if(malformed==='version')value[0].capabilityVersion='2';if(malformed==='unknown-type')value[0].capabilityId='generated.unknown';if(malformed==='duplicate-id')value[1].localId=value[0].localId;if(malformed==='foreign-context')value[0].input.contextKeys=[hash('generated-ungranted')];if(malformed==='old-context')selected={...request,history:[{batchId:'generated-prior',targets,contextMembers:[context]}]};if(malformed==='overlap')value[1].input.memberKeys=[targets[0].key];if(malformed==='extra-field')value[0].unexpected=true;if(malformed==='invalid-stop')value.splice(0,value.length,{localId:'stop',capabilityId:'memory.feedback-stop',capabilityVersion:'1',goal:'Generated stop',input:{reason:''}});if(malformed==='mixed-stop')value.push({localId:'stop',capabilityId:'memory.feedback-stop',capabilityVersion:'1',goal:'Generated stop',input:{reason:'Generated stop reason'}});
 assert.throws(()=>consume(value,selected));
});

test('the synchronous local validation gate rejects thenables without starting their continuation',async()=>{
 let invoked=0;const host={localResumeView:()=>({})};assert.throws(()=>(TaskExecution.prototype as any).resumeLocal.call(host,{resumeLocal:()=>({then:()=>{invoked++;}})},{}),{code:'asynchronous_task_local_resume'});await Promise.resolve();assert.equal(invoked,0);assert.throws(()=>(TaskExecution.prototype as any).resumeLocal.call(host,{resumeLocal:()=>Promise.reject(Error('Generated rejected async validator'))},{}),{code:'asynchronous_task_local_resume'});await Promise.resolve();
});
