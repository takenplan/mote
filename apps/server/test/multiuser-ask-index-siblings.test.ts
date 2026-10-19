import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import {noteCapture} from '@mote/shared';
import {fixture,deferred} from './fixtures/ask-reader-host.js';
import {waitForState} from './fixtures/scoped-query-accounts.js';
import {expectedIndexProof,proofDigest} from './fixtures/ask-index-proof.js';
import {defaultModelSettings} from '../src/model-settings.js';
import {materialId} from '../src/materials.js';
import {EXECUTION_POLICIES} from '../src/execution-policy.js';

type Fixture=Awaited<ReturnType<typeof fixture>>;
const read=<T>(f:Fixture,work:(db:DatabaseSync)=>T)=>{const db=new DatabaseSync(join(f.root,'mote.sqlite'),{readOnly:true});try{return work(db);}finally{db.close();}};
async function blockPool(f:Fixture,pool:string,count:number,gate:ReturnType<typeof deferred>){
 const kind='generated.sibling-block-'+pool;f.node.execution!.register({kind,pool,concurrency:()=>count,policy:{...EXECUTION_POLICIES.control,timeoutMs:60000},parseInput:input=>input as Record<string,unknown>,execute:async run=>{await Promise.race([gate.promise,new Promise<never>((_,reject)=>run.signal.addEventListener('abort',()=>reject(run.signal.reason),{once:true}))]);return {};}});
 const tasks=[];for(let i=0;i<count;i++)tasks.push(await f.ok(f.a.token,'/api/tasks','POST',{kind,operationId:kind+':'+i,input:{}}));
 await waitForState(async()=>Promise.all(tasks.map(task=>f.ok(f.a.token,'/api/tasks/'+task.id))),rows=>rows.every(row=>row.state==='running'),'real pool blockers entered');
}
for(const phase of ['pending','inflight'] as const)test('retiring X from a real mixed capture batch preserves '+phase+' Y on its admitted proof and rejects replacement X under that proof',async t=>{
 const memory=deferred(),admission=deferred(),embedding=deferred();t.after(()=>{memory.resolve();admission.resolve();embedding.resolve();});const f=await fixture(t),requests:string[]=[];
 const provider=createServer((req,res)=>{void(async()=>{let raw='';for await(const chunk of req)raw+=chunk;requests.push(String(JSON.parse(raw).input));if(phase==='inflight')await embedding.promise;res.setHeader('content-type','application/json');res.end(JSON.stringify({data:[{embedding:[1,0]}],usage:{prompt_tokens:2,total_tokens:2}}));})().catch(()=>res.destroy());});await new Promise<void>(resolve=>provider.listen(0,'127.0.0.1',resolve));t.after(async()=>{provider.closeAllConnections();await new Promise<void>(resolve=>provider.close(()=>resolve()));});
 const config=await f.ok(f.a.token,'/api/configuration');await f.ok(f.a.token,'/api/configuration/models','PUT',{revision:config.revision,value:{profiles:[{id:'generated',name:'Generated batch embedding',settings:{...defaultModelSettings(),provider:'custom',protocol:'openai-completions',baseUrl:'http://127.0.0.1:'+(provider.address() as {port:number}).port+'/v1',model:'generated-embedding',apiKey:'GENERATED'}}],selections:{embedding:{kind:'personal',id:'generated'}}}});
 // Occupy the actual pools to control lifecycle ordering; no producer listener
 // is disabled/replaced and no journal/task/vector row is assembled by the test.
 await blockPool(f,'memory.materials',4,memory);if(phase==='pending')await blockPool(f,'embedding.admission',2,admission);
 const x=randomUUID(),y=randomUUID(),capture=(id:string,text:string)=>noteCapture({id,deviceId:'same-device',deviceName:'Generated',platform:'import',capturedAt:'2026-10-16T12:00:00Z',text}),oldX=capture(x,'GENERATED_X_OLD'),oldY=capture(y,'GENERATED_Y_UNCHANGED');
 await f.ok(f.a.token,'/api/ingress/sources/same-source/captures','POST',{batchId:'mixed',items:[oldX,oldY]});
 const original=read(f,db=>{const row=db.prepare('SELECT id FROM ma_embedding_events WHERE user_id=?').get(f.a.userId)!;assert.ok(row);return {id:String(row.id),proof:expectedIndexProof(db,f.a.userId,0,{kind:'captures',ids:[x,y],sourceIds:['same-source']},{sourceIds:['same-source'],materials:[],originalIds:[x,y]})};});
 if(phase==='inflight')await waitForState(async()=>requests,items=>items.some(text=>text.includes('GENERATED_X_OLD'))&&items.some(text=>text.includes('GENERATED_Y_UNCHANGED')),'both original paid requests issued');
 const yBefore=read(f,db=>db.prepare("SELECT e.id,u.input,u.model_receipt,a.grant_id FROM execution_steps e JOIN user_tasks u ON u.task_id=e.id JOIN task_authorizations a ON a.task_id=e.id WHERE e.user_id=? AND e.kind='ask.embedding' AND json_extract(u.input,'$.eventId')=? AND json_extract(u.input,'$.id')=?").get(f.a.userId,original.id,y));
 await f.ok(f.a.token,'/api/captures/'+x,'DELETE');await f.ok(f.a.token,'/api/ingress/sources/same-source/captures','POST',{batchId:'replacement',items:[capture(x,'GENERATED_X_REPLACEMENT')]});assert.equal((await f.ok(f.a.token,'/api/captures/'+x)).ocrText,'GENERATED_X_REPLACEMENT');
 admission.resolve();embedding.resolve();
 const childRows=()=>read(f,db=>db.prepare("SELECT e.id,e.state,u.input,u.model_receipt,a.grant_id FROM execution_steps e JOIN user_tasks u ON u.task_id=e.id JOIN task_authorizations a ON a.task_id=e.id WHERE e.user_id=? AND e.kind='ask.embedding' AND json_extract(u.input,'$.eventId')=? ORDER BY e.id").all(f.a.userId,original.id));
 await waitForState(async()=>childRows(),rows=>rows.some(row=>JSON.parse(String(row.input)).id===y&&row.state==='succeeded')&&rows.every(row=>!['waiting','running'].includes(String(row.state))),'unchanged Y completes from original batch');
 const rows=childRows(),yAfter=rows.find(row=>JSON.parse(String(row.input)).id===y)!;assert.equal(JSON.parse(String(yAfter.input)).receipt,original.proof.originals.find((pin:any)=>pin.id===y).receipt);
 if(yBefore)for(const key of ['id','input','model_receipt','grant_id'])assert.equal(yAfter[key],yBefore[key],'Y retains its own '+key);
 for(const row of rows.filter(row=>JSON.parse(String(row.input)).id===x))assert.notEqual(row.state,'succeeded','old X cannot accept replacement bytes');if(phase==='pending')assert.equal(rows.some(row=>JSON.parse(String(row.input)).id===x),false,'retired X is skipped individually before issuance');
 const vectors=read(f,db=>db.prepare('SELECT evidence_id,receipt FROM ma_embeddings WHERE user_id=?').all(f.a.userId));assert.equal(vectors.find(row=>row.evidence_id===y)!.receipt,original.proof.originals.find((pin:any)=>pin.id===y).receipt);for(const vector of vectors.filter(row=>row.evidence_id===x))assert.notEqual(vector.receipt,original.proof.originals.find((pin:any)=>pin.id===x).receipt);
 assert.equal((await f.request(f.b.token,'/api/captures/'+y)).statusCode,404);assert.equal(read(f,db=>db.prepare('SELECT count(*) n FROM ma_embeddings WHERE user_id=?').get(f.b.userId)!.n),0);
});

test('qualified Material journal proof exactly binds a known root, transitive Material and raw original through the real M03 publication seam',async t=>{
 const f=await fixture(t),id=randomUUID(),receipt=await f.ok(f.a.token,'/api/ingress/sources/same-source/captures','POST',{batchId:'nested',items:[noteCapture({id,deviceId:'same-device',deviceName:'Generated',platform:'import',capturedAt:'2026-10-16T12:00:00Z',text:'GENERATED_TRANSITIVE_ORIGINAL'})]}),context=await f.node.authority.authenticate(f.a.token),source=f.node.ingress.bindSource(context,['same-source'],()=>f.node.authority.assert(context));assert.equal(receipt.captures[0].id,id);
 const base={kind:'document',schemaVersion:1,title:'Generated proof',coverage:{state:'complete'},fidelity:{state:'lossless'},retention:{original:'retained',policy:'keep'}};
 const child=source.publishMaterial({...base,id:materialId('same-source','proof-child'),origin:{sourceId:'same-source',externalId:'proof-child'},members:[{id:'capture',kind:'capture',ref:'capture:'+id}],blocks:[{id:'child',kind:'text',format:'plain',text:'GENERATED_CHILD',memberIds:['capture']}]}),root=source.publishMaterial({...base,id:materialId('same-source','proof-root'),origin:{sourceId:'same-source',externalId:'proof-root'},members:[{id:'child',kind:'material',ref:child.id+'@'+child.revision}],blocks:[{id:'root',kind:'text',format:'plain',text:'GENERATED_ROOT',memberIds:['child']}]});
 read(f,db=>{const event={kind:'material',id:root.id,revision:root.revision,sourceIds:['same-source']},expected=expectedIndexProof(db,f.a.userId,context.authorizationEpoch,event,{sourceIds:['same-source'],materials:[{id:root.id,revision:root.revision},{id:child.id,revision:child.revision}],originalIds:[id]}),eventId=proofDigest(expected),row=db.prepare('SELECT input FROM ma_embedding_events WHERE user_id=? AND id=?').get(f.a.userId,eventId);assert.ok(row);assert.deepEqual(JSON.parse(String(row.input)),expected);const input={eventId},operation='ask-index:'+eventId,taskId=proofDigest([f.a.userId,operation,'ask.index-admit',input]),task=db.prepare('SELECT e.operation_id,u.input,a.user_id,a.authorization_epoch FROM execution_steps e JOIN user_tasks u ON u.task_id=e.id JOIN task_authorizations a ON a.task_id=e.id WHERE e.id=?').get(taskId)!;assert.ok(task);assert.equal(task.operation_id,'ask-index:'+proofDigest([f.a.userId,operation]));assert.deepEqual(JSON.parse(String(task.input)),input);assert.equal(task.user_id,f.a.userId);assert.equal(task.authorization_epoch,context.authorizationEpoch);});
});
