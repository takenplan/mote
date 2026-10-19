import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHash,randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import {scopedFilesFixture} from './fixtures/scoped-files.js';
import {waitForScopedState} from './fixtures/scoped-process.js';
import {defaultModelSettings} from '../src/model-settings.js';
import {defaultProcessingSettings} from '../src/scope/processing-schema.js';

type Fixture=Awaited<ReturnType<typeof scopedFilesFixture>>;
const replacementPassword='Generated-index-incarnation-reset-01';
const read=<T>(f:Fixture,work:(db:DatabaseSync)=>T)=>{const db=new DatabaseSync(join(f.directory,'mote.sqlite'),{readOnly:true});try{return work(db);}finally{db.close();}};
const admissions=(f:Fixture,userId:string)=>read(f,db=>db.prepare("SELECT e.id,e.state,u.input,a.grant_id,a.authorization_epoch FROM execution_steps e JOIN user_tasks u ON u.task_id=e.id AND u.user_id=e.user_id JOIN task_authorizations a ON a.task_id=e.id AND a.user_id=e.user_id WHERE e.user_id=? AND e.kind='ask.index-admit' ORDER BY e.id").all(userId));
async function configure(f:Fixture,token:string){const view=await f.checked(token,'/api/configuration');await f.checked(token,'/api/configuration/processing','PUT',{revision:view.revision,value:{...defaultProcessingSettings(),automatic:true,understandingEnabled:false,summarize:false,semanticTurns:false,audioProcessor:'audio.http'}});}
async function upload(f:Fixture,token:string,bytes:Buffer,mimeType:string,batchId=randomUUID()){
 const checksum=createHash('sha256').update(bytes).digest('hex'),opened=await f.checked(token,'/api/ingress/sources/same-source/uploads','POST',{batchId,revision:{sourceId:'same-source',previousRevision:null,sizeBytes:bytes.length,sha256:checksum,relativePath:'same-input.bin',item:{externalId:'same-input',revision:'same-r1',observedAt:'2026-10-16T00:00:00Z',title:'Generated same input',text:'',kind:'file',layer:'original',mimeType}}});
 await f.checked(token,'/api/ingress/uploads/'+opened.id+'/parts/0','PUT',{bytes:bytes.toString('base64'),checksum});return f.checked(token,'/api/ingress/uploads/'+opened.id+'/commit','POST',{});
}
async function reset(f:Fixture){await f.checked(f.admin.token,'/api/admin/accounts/'+f.a.userId+'/password','POST',{password:replacementPassword});const fresh=await f.checked(undefined,'/api/auth/login','POST',{username:'generated-a',password:replacementPassword,mode:'client'});assert.equal(fresh.userId,f.a.userId);assert.equal((await f.request(f.a.token,'/api/auth/self')).statusCode,401);return fresh;}
async function settled(f:Fixture,userId:string){await waitForScopedState(()=>{const rows=admissions(f,userId);return rows.length>0&&rows.every(row=>row.state==='succeeded');},()=>JSON.stringify(admissions(f,userId)),10000);}

for(const bumpEpoch of [false,true])test('Ask accepts same-ID source recreation with '+(bumpEpoch?'a fresh reset epoch':'the current epoch')+' while retired ASR remains held, without reviving prior grants',async t=>{
 let release!:()=>void;const held=new Promise<void>(resolve=>release=resolve),calls:string[]=[];t.after(()=>release());
 const accepted:{userId:string;epoch:number;ids:string[]}[]=[],f=await scopedFilesFixture(t,host=>{host.ingress.onAccepted((context,receipt)=>{accepted.push({userId:context.userId,epoch:context.authorizationEpoch,ids:receipt.captures.map(item=>item.id)});});});
 const endpoint=async(owner:string)=>{const server=createServer((req,res)=>{void(async()=>{for await(const _ of req){}calls.push(owner);const retired=owner==='A'&&calls.filter(value=>value==='A').length===1;if(retired)await held;res.setHeader('X-Mote-Execution','local');res.end(JSON.stringify({durationMs:1,segments:[{startMs:0,endMs:1,text:retired?'GENERATED_RETIRED_A':'GENERATED_CURRENT_'+owner}],coverage:'full',engine:'generated-index-incarnation'}));})().catch(()=>res.destroy());});await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>{release();server.closeAllConnections();return new Promise<void>(resolve=>server.close(()=>resolve()));});return 'http://127.0.0.1:'+(server.address() as {port:number}).port;};
 for(const [owner,account]of [['A',f.a],['B',f.b]] as const){const view=await f.checked(account.token,'/api/configuration');await f.checked(account.token,'/api/configuration/models','PUT',{revision:view.revision,value:{profiles:[{id:'same-asr',name:'Generated ASR',settings:{...defaultModelSettings(),provider:'custom',protocol:'mote-media',model:'generated-asr',baseUrl:await endpoint(owner),apiKey:'GENERATED_'+owner}}],selections:{asr:{kind:'personal',id:'same-asr'}}}});await configure(f,account.token);}
 const bytes=Buffer.from('GENERATED_IDENTICAL_AUDIO'),old=(await upload(f,f.a.token,bytes,'audio/wav')).captures[0],other=(await upload(f,f.b.token,bytes,'audio/wav')).captures[0];assert.equal(old.id,other.id);
 await waitForScopedState(()=>calls.includes('A'),()=>JSON.stringify(calls),10000);await waitForScopedState(async()=>(await f.checked(f.b.token,'/api/files/'+other.id)).processing.indexed,()=>'B did not finish',10000);await settled(f,f.a.userId);
 const prior=admissions(f,f.a.userId),bBefore=admissions(f,f.b.userId);assert.equal(prior.length,1);assert.equal(prior[0].authorization_epoch,0);
 await f.checked(f.a.token,'/api/sources/same-source','DELETE');assert.equal((await f.request(f.a.token,'/api/files/'+old.id)).statusCode,404);const current=bumpEpoch?await reset(f):f.a;
 await f.checked(current.token,'/api/ingress/sources','POST',{id:'same-source',name:'Generated replacement source',kind:'local-files',deviceId:'same-device',platform:'import',retention:'archive'});await configure(f,current.token);
 const receipt=await upload(f,current.token,bytes,'audio/wav'),replacement=receipt.captures[0];assert.equal(receipt.state,'received');assert.equal(replacement.id,old.id);assert.equal(replacement.original.ref,old.original.ref);await settled(f,f.a.userId);
 const fresh=admissions(f,f.a.userId).filter(row=>!prior.some(oldRow=>oldRow.id===row.id));assert.equal(fresh.length,1);assert.equal(fresh[0].authorization_epoch,bumpEpoch?1:0);assert.notEqual(fresh[0].grant_id,prior[0].grant_id);assert.deepEqual(admissions(f,f.a.userId).filter(row=>prior.some(oldRow=>oldRow.id===row.id)),prior,'old succeeded task and old grant remain historical');assert.ok(accepted.some(event=>event.userId===f.a.userId&&event.epoch===(bumpEpoch?1:0)&&event.ids.includes(old.id)));
 const beforeDuplicate=admissions(f,f.a.userId);await upload(f,current.token,bytes,'audio/wav');assert.deepEqual(admissions(f,f.a.userId),beforeDuplicate,'a new transport batch with duplicate current originals creates no admission');assert.equal(calls.filter(owner=>owner==='A').length,1,'new physical work waits for the retired ASR response');
 assert.equal((await f.checked(f.b.token,'/api/files/'+other.id)).processing.indexed,true);assert.deepEqual(admissions(f,f.b.userId),bBefore);
 release();await waitForScopedState(async()=>(await f.checked(current.token,'/api/files/'+replacement.id)).processing.indexed,()=>'new current input did not publish after physical settlement',10000);await settled(f,f.a.userId);
 const file=await f.checked(current.token,'/api/files/'+replacement.id),material=await f.checked(current.token,'/api/materials/'+file.processing.materialId+'/read');assert.match(material.text,/GENERATED_CURRENT_A/);assert.doesNotMatch(material.text,/GENERATED_RETIRED_A|GENERATED_CURRENT_B/);assert.equal(calls.filter(owner=>owner==='A').length,2);assert.equal((await f.checked(f.b.token,'/api/materials/'+(await f.checked(f.b.token,'/api/files/'+other.id)).processing.materialId+'/read')).text.includes('GENERATED_CURRENT_B'),true);
});

test('the same exact Material revision admits fresh reset authority and remains idempotent within that authority',async t=>{
 const f=await scopedFilesFixture(t);await configure(f,f.a.token);const capture=(await upload(f,f.a.token,Buffer.from('GENERATED_CANONICAL_TEXT'),'text/plain')).captures[0];await waitForScopedState(async()=>(await f.checked(f.a.token,'/api/files/'+capture.id)).processing.indexed,()=>'initial text publication missing',10000);await settled(f,f.a.userId);
 const publication=()=>read(f,db=>db.prepare('SELECT material_id,revision FROM mp_publications WHERE user_id=?').get(f.a.userId)!);const original=publication(),prior=admissions(f,f.a.userId),fresh=await reset(f);
 const republish=async()=>{const task=await f.checked(fresh.token,'/api/processing','POST',{originalRef:capture.original.ref,operationId:randomUUID()});await waitForScopedState(async()=>{const state=await f.checked(fresh.token,'/api/tasks/'+task.id);assert.ok(!['failed','blocked','stale'].includes(state.state),JSON.stringify(state));return state.state==='succeeded';},()=>'fresh current publication did not complete',10000);await settled(f,f.a.userId);};
 await republish();assert.deepEqual(publication(),original,'this case deliberately retains the exact canonical revision');const current=admissions(f,f.a.userId),materialAdmissions=current.filter(row=>!prior.some(old=>old.id===row.id));assert.equal(materialAdmissions.length,1);assert.equal(materialAdmissions[0].authorization_epoch,1);assert.deepEqual(current.filter(row=>prior.some(old=>old.id===row.id)),prior);
 await republish();assert.deepEqual(admissions(f,f.a.userId),current,'duplicate current Material publication reuses only its current-epoch admission');assert.deepEqual(publication(),original);
});
