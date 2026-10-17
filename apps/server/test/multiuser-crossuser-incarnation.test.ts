import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {scopedFilesFixture} from './fixtures/scoped-files.js';

const protocol={'x-mote-protocol-version':'2','x-mote-ingress-version':'3'};
const gate=()=>{let resolve!:()=>void;return {promise:new Promise<void>(done=>{resolve=done;}),resolve:()=>resolve()};};

// Same public wire consumed by Web/native Files. Only delivery of an already
// committed response is held; Accounts, M03, HTTP, SQLite and source lifecycle
// stay real. No SQL seeding, invented receipt, model or replacement runtime.
test('held committed delete ACK stays an old receipt after same-owner same-ID source replacement, while B and the new original remain usable',async t=>{
 const entered=gate(),release=gate();let oldToken='',captureId='',held=false;
 const f=await scopedFilesFixture(t,host=>host.app.addHook('onSend',async(request,reply,payload)=>{
  if(!held&&captureId&&request.method==='DELETE'&&request.url==='/api/files/'+captureId&&request.headers.authorization==='Bearer '+oldToken&&reply.statusCode===200){held=true;entered.resolve();await release.promise;}
  return payload;
 }));
 t.after(()=>release.resolve());
 await f.host.app.listen({host:'127.0.0.1',port:0});
 const address=f.host.app.server.address();assert.ok(address&&typeof address!=='string');const base='http://127.0.0.1:'+address.port;
 const request=(token:string,path:string,method='GET',body?:unknown)=>fetch(base+path,{method,headers:{...protocol,authorization:'Bearer '+token,...(body===undefined?{}:{'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const ok=async(token:string,path:string,method='GET',body?:unknown)=>{const response=await request(token,path,method,body);assert.equal(response.status,200,await response.clone().text());return response.json() as Promise<any>;};
 const source={id:'same-source',name:'Generated replacement source',kind:'local-files',deviceId:'same-device',platform:'import',retention:'archive'};
 const upload=async(token:string,text:string)=>{
  const bytes=Buffer.from(text),checksum=createHash('sha256').update(bytes).digest('hex');
  const value=await ok(token,'/api/ingress/sources/same-source/uploads','POST',{batchId:'same-batch',revision:{sourceId:'same-source',previousRevision:null,item:{externalId:'same-file',revision:'same-r1',observedAt:'2026-10-17T00:00:00Z',title:'Generated file',text:'',kind:'file',layer:'original',mimeType:'text/plain'},sizeBytes:bytes.length,sha256:checksum,relativePath:'generated.txt'}});
  await ok(token,'/api/ingress/uploads/'+value.id+'/parts/0','PUT',{bytes:bytes.toString('base64'),checksum});
  return (await ok(token,'/api/ingress/uploads/'+value.id+'/commit','POST',{})).captures[0];
 };
 const original=async(token:string,file:any)=>{
  const path='/api/ingress/originals/'+file.originalRef.slice(9),ticket=await ok(token,path+'/tickets','POST',{});
  return path+'/content?ticket='+encodeURIComponent(ticket.ticket);
 };
 const a=await upload(f.a.token,'GENERATED_A_OLD_ORIGINAL'),b=await upload(f.b.token,'GENERATED_B_UNCHANGED_ORIGINAL');assert.equal(a.id,b.id);
 captureId=a.id;oldToken=f.a.token;const path='/api/files/'+a.id,prior=await ok(f.a.token,path),oldTicket=await original(f.a.token,prior),intent={operationId:randomUUID(),originalGeneration:prior.originalGeneration};
 const pending=request(f.a.token,path,'DELETE',intent);await entered.promise;
 try{
 // A second actual client sees the committed tombstone before the first
 // client receives its ACK, then explicitly allows and recreates the source.
 assert.equal((await request(f.a.token,path)).status,404);
 const forgotten=await ok(f.a.token,path+'/forgotten');assert.equal(forgotten.blocked,true);
 await ok(f.a.token,path+'/allow-again','POST',forgotten.decision);
 await ok(f.a.token,'/api/sources/same-source','DELETE',{});
 await ok(f.a.token,'/api/ingress/sources','POST',source);
 const replacement=await upload(f.a.token,'GENERATED_A_NEW_ORIGINAL');assert.equal(replacement.id,a.id);
 const current=await ok(f.a.token,path);assert.ok(current.originalGeneration>prior.originalGeneration);
 const newTicket=await original(f.a.token,current),bFile=await ok(f.b.token,path),bTicket=await original(f.b.token,bFile);
 assert.equal((await request(f.a.token,oldTicket)).status,404,'same-owner source replacement cannot revive the prior original grant');
 assert.equal((await request(f.b.token,newTicket)).status,404);
 assert.equal(await(await request(f.a.token,newTicket)).text(),'GENERATED_A_NEW_ORIGINAL');
 assert.equal(await(await request(f.b.token,bTicket)).text(),'GENERATED_B_UNCHANGED_ORIGINAL');
 release.resolve();const late=await pending;assert.equal(late.status,200);const receipt=await late.json() as any;
 assert.deepEqual(receipt.decision,forgotten.decision);assert.equal(receipt.decision.generation,intent.originalGeneration+1);
 assert.ok(current.originalGeneration>=receipt.decision.generation,'old receipt must not be mistaken for a current descriptor');
 assert.deepEqual((await ok(f.a.token,path)).originalGeneration,current.originalGeneration);
 const replay=await ok(f.a.token,path,'DELETE',intent);assert.deepEqual(replay,receipt);
 assert.equal(await(await request(f.a.token,newTicket)).text(),'GENERATED_A_NEW_ORIGINAL','fixed receipt replay cannot remove a replacement original');
 assert.equal((await request(f.a.token,path,'DELETE',{...intent,operationId:randomUUID()})).status,409,'an unsent old-generation action cannot rebase to the current file');
 assert.equal((await request(f.a.token,path+'/allow-again','POST',receipt.decision)).status,404,'the retired source decision is absent, so it cannot authorize the recreated source');
 assert.equal((await request(f.b.token,path)).status,200);
 await ok(f.a.token,path,'DELETE',{operationId:randomUUID(),originalGeneration:current.originalGeneration});
 assert.equal((await request(f.a.token,path)).status,404);assert.equal((await request(f.a.token,newTicket)).status,404);
 assert.equal(await(await request(f.b.token,bTicket)).text(),'GENERATED_B_UNCHANGED_ORIGINAL');
 console.info(JSON.stringify({contract:'held-delete-incarnation-http',before:prior.originalGeneration,replacement:current.originalGeneration,lateReceipt:receipt.decision.generation,oldIntentRebased:false,bUnaffected:true}));
 }finally{release.resolve();await pending.catch(()=>{});}
});
