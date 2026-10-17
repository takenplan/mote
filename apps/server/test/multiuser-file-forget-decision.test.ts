import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {scopedFilesFixture} from './fixtures/scoped-files.js';

async function deleteRequest(f:Awaited<ReturnType<typeof scopedFilesFixture>>,token:string,path:string){const file=await f.checked(token,path);assert.equal(typeof file.originalGeneration,'number');return {operationId:randomUUID(),originalGeneration:file.originalGeneration};}

test('a delayed allow-again decision cannot undo a newer forget of the identical capture',async t=>{
 const f=await scopedFilesFixture(t),bytes=Buffer.from('GENERATED_SAME_CAPTURE_DECISION'),a=await f.upload(f.a.token,'same-forget-cycle',bytes.toString()),b=await f.upload(f.b.token,'same-forget-cycle',bytes.toString()),path='/api/files/'+a.id;assert.equal(a.id,b.id);const initialBody=await deleteRequest(f,f.a.token,path),first=await f.checked(f.a.token,path,'DELETE',initialBody),oldDecision=first.decision;await f.checked(f.a.token,path+'/allow-again','POST',oldDecision);await f.checked(f.a.token,path+'/allow-again','POST',oldDecision);const next=await f.upload(f.a.token,'same-forget-cycle',bytes.toString());assert.equal(next.id,a.id);const second=await f.checked(f.a.token,path,'DELETE',await deleteRequest(f,f.a.token,path)),late=await f.request(f.a.token,path+'/allow-again','POST',oldDecision),blocked=await f.request(f.a.token,'/api/ingress/sources/same-source/uploads','POST',{batchId:'generated-stale-decision-probe',revision:{sourceId:'same-source',previousRevision:null,sizeBytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),relativePath:'same-forget-cycle.txt',item:{externalId:'same-forget-cycle',revision:'same-r1',observedAt:'2026-10-16T00:00:00Z',title:'Generated file',text:'',kind:'file',layer:'original',mimeType:'text/plain'}}});assert.equal((await f.request(f.b.token,'/api/files/'+b.id)).statusCode,200);assert.deepEqual({decision:late.statusCode,upload:blocked.statusCode},{decision:409,upload:410});assert.equal(typeof first.decision.decisionId,'string');assert.notEqual(first.decision.decisionId,second.decision.decisionId);const current=await f.checked(f.a.token,path+'/forgotten');assert.deepEqual(current.decision,second.decision);await f.checked(f.a.token,path+'/allow-again','POST',second.decision);assert.equal((await f.request(f.a.token,path)).statusCode,404);
});

test('a lost delete ACK repeats its fixed receipt and an old duplicate never deletes reimported data',async t=>{
 const f=await scopedFilesFixture(t),a=await f.upload(f.a.token,'same-delete-ack','GENERATED_DELETE_ACK'),path='/api/files/'+a.id,body=await deleteRequest(f,f.a.token,path),first=await f.checked(f.a.token,path,'DELETE',body);await f.restart();const repeat=await f.request(f.a.token,path,'DELETE',body);assert.equal(repeat.statusCode,200,repeat.body);assert.deepEqual(repeat.json(),first);await f.checked(f.a.token,path+'/allow-again','POST',first.decision);assert.equal((await f.upload(f.a.token,'same-delete-ack','GENERATED_DELETE_ACK')).id,a.id);const late=await f.request(f.a.token,path,'DELETE',body);assert.equal(late.statusCode,200);assert.deepEqual(late.json(),first);assert.equal((await f.request(f.a.token,path)).statusCode,200,'old delete intent is a receipt replay, not another deletion');assert.equal((await f.request(f.a.token,path,'DELETE',{...body,originalGeneration:77})).statusCode,409,'changing a stable operation body cannot replace its deletion intent');
});


test('missing decision metadata and a different old delete operation cannot rebase onto the next incarnation',async t=>{
 const f=await scopedFilesFixture(t),a=await f.upload(f.a.token,'same-forget-generation','GENERATED_FORGET_GENERATION'),path='/api/files/'+a.id,body=await deleteRequest(f,f.a.token,path),first=await f.checked(f.a.token,path,'DELETE',body);
 assert.equal((await f.request(f.a.token,path+'/allow-again','POST',{sourceId:'same-source',externalId:'same-forget-generation'})).statusCode,409);
 await f.checked(f.a.token,path+'/allow-again','POST',first.decision);await f.upload(f.a.token,'same-forget-generation','GENERATED_FORGET_GENERATION');
 assert.equal((await f.request(f.a.token,path,'DELETE',{...body,operationId:randomUUID()})).statusCode,409);
 assert.equal((await f.request(f.a.token,path,'DELETE',{})).statusCode,409);assert.equal((await f.request(f.a.token,path)).statusCode,200);
});


test('old tombstone schema upgrade mints a decision once and resumes an interrupted nullable-column upgrade',async()=>{
 const {DatabaseSync}=await import('node:sqlite'),{installIngress}=await import('../src/scope/ingress-schema.js'),db=new DatabaseSync(':memory:');try{
  db.exec("CREATE TABLE pd_sources(user_id TEXT,id TEXT,PRIMARY KEY(user_id,id)); CREATE TABLE pd_captures(user_id TEXT,id TEXT,source_id TEXT,json TEXT,PRIMARY KEY(user_id,id)); CREATE TABLE ig_file_forgets(user_id TEXT,source_id TEXT,external_id TEXT,capture_id TEXT,generation INTEGER,blocked INTEGER,PRIMARY KEY(user_id,source_id,external_id));");
  db.prepare('INSERT INTO ig_file_forgets VALUES(?,?,?,?,?,?)').run('generated-owner','generated-source','generated-ext',randomUUID(),1,1);installIngress(db);const read=()=>String(db.prepare('SELECT decision_id FROM ig_file_forgets').get()!.decision_id),first=read();assert.match(first,/^[a-f0-9-]{36}$/);installIngress(db);assert.equal(read(),first);
  db.exec('UPDATE ig_file_forgets SET decision_id=NULL');installIngress(db);assert.notEqual(read(),first);assert.match(read(),/^[a-f0-9-]{36}$/);
 }finally{db.close();}
});
