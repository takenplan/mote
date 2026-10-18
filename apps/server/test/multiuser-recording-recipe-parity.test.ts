import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {recordingPhaseHost,until} from './fixtures/recording-phase-host.js';
import {defaultModelSettings} from '../src/model-settings.js';
import {recordingMemoryRecipe} from '../src/connectors/recording-memory.js';
import {writeMessagesResponse} from '../../../scripts/fixtures/messages-provider.js';

test('a canonical recording automatic intake executes its frozen dedicated extraction and independent review against the complete owned original',async t=>{
 const requests:string[]=[],provider=createServer((req,res)=>{void(async()=>{let raw='';for await(const chunk of req)raw+=chunk;requests.push(raw);
  const targetScope=raw.match(/\\?"members\\?"\s*:\s*(\[.*?\])\s*,\s*\\?"contextMembers\\?"\s*:/s)?.[1]??raw,keys=[...new Set([...targetScope.matchAll(/\\?"key\\?"\s*:\s*\\?"(member_[0-9]+)/g)].map(match=>match[1]))];
  writeMessagesResponse(res,{stage:requests.length,text:JSON.stringify({answer:JSON.stringify({memories:[],coverage:keys.map(key=>({key,state:'no_candidates',candidateIndexes:[]}))}),citationIds:[]})});
 })().catch(()=>res.destroy());});await new Promise<void>(resolve=>provider.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{provider.closeAllConnections();await new Promise<void>(resolve=>provider.close(()=>resolve()));});
 const p=await recordingPhaseHost(t,true),{f}=p;
 let view=await p.checked(f.a.token,'/api/configuration');await p.checked(f.a.token,'/api/configuration/models','PUT',{revision:view.revision,value:{profiles:[{id:'generated-recording-memory',name:'Generated recording memory',settings:{...defaultModelSettings(),provider:'custom',protocol:'anthropic-messages',model:'generated-recording-memory',baseUrl:'http://127.0.0.1:'+(provider.address() as any).port+'/v1',apiKey:'GENERATED_RECORDING_A_KEY'}}],selections:{memory:{kind:'personal',id:'generated-recording-memory'}}}});
 const memory=(await p.checked(f.a.token,'/api/memory')).settings;memory.automatic=true;memory.lifecycle.extraction.minChanges=1;view=await p.checked(f.a.token,'/api/configuration');await p.checked(f.a.token,'/api/configuration/memory','PUT',{revision:view.revision,value:memory});
 await p.select(f.a.token);await p.settle(f.a.token);let jobId='';await until(()=>{jobId=f.read(db=>String(db.prepare("SELECT job_id FROM mm_intakes WHERE user_id=? AND state='complete'").get(f.a.userId)?.job_id??''));return Boolean(jobId);},'Automatic recording intake must enter a real Memory job',15000);
 let job:any;await until(async()=>{job=await p.checked(f.a.token,'/api/memory/jobs/'+jobId);assert.ok(!Object.values(job.tasks).some((task:any)=>['failed','blocked','cancelled','stale'].includes(task.state)),JSON.stringify(job));return Object.keys(job.tasks).length>=3&&Object.values(job.tasks).every((task:any)=>task.state==='succeeded');},'Dedicated recording extraction and review must actually finish',15000);
 const input=f.read(db=>JSON.parse(String(db.prepare('SELECT input FROM mm_jobs WHERE user_id=? AND id=?').get(f.a.userId,jobId)!.input)));
 assert.deepEqual({id:input.strategy.recipe.id,version:input.strategy.recipe.version},recordingMemoryRecipe);assert.equal(input.strategy.extract.id,'mote.recording-extraction');assert.equal(input.strategy.review.id,'mote.recording-review');assert.equal(requests.length,2,'The dedicated extractor and independent reviewer both issue actual fixture-model HTTP requests');
 for(const raw of requests){assert.ok(raw.includes('GENERATED_TEXT_'+f.a.userId+'_r1'));assert.ok(raw.includes('source creation/start timestamp'),'The recording corpus policy reaches both models');assert.ok(!raw.includes(f.b.userId));}
 assert.notEqual(job.tasks.extract.id,job.tasks.review.id);assert.equal((await p.checked(f.a.token,'/api/memories')).items.length,0,'A fully assessed empty selection is a valid independently reviewed result');
});
