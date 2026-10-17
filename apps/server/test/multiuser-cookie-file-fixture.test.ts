import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';

const protocol={'x-mote-protocol-version':'2'};

// Run the real generated fixture entry point, not a hand-assembled route. The
// same endpoint remains usable by the native Bearer lane and the browser lane.
test('Files fixture holds and loses Cookie ACKs under the actual owner, preserving Bearer and stale-session fences',async t=>{
 const child=spawn(process.execPath,['--import','tsx','apps/android/test-fixtures/multiuser-files-backend.ts'],{
  cwd:fileURLToPath(new URL('../../../',import.meta.url)),stdio:['ignore','pipe','pipe'],
 });
 let output='',errors='',closed=false;
 const done=new Promise<number|null>(resolve=>child.once('close',code=>{closed=true;resolve(code);}));
 child.stderr.on('data',bytes=>{errors+=String(bytes);});
 t.after(async()=>{
  if(!closed)child.kill('SIGTERM');
  const timeout=setTimeout(()=>child.kill('SIGKILL'),15000);timeout.unref();
  try{assert.equal(await done,0,errors);}finally{clearTimeout(timeout);}
 });
 const metadata=await new Promise<any>((resolve,reject)=>{
  const timeout=setTimeout(()=>reject(Error('Generated Files fixture readiness deadline exceeded: '+errors)),45000);timeout.unref();
  child.once('error',error=>{clearTimeout(timeout);reject(error);});
  child.once('close',code=>{clearTimeout(timeout);reject(Error('Generated Files fixture exited before ready: '+code+' '+errors));});
  child.stdout.on('data',bytes=>{
   output+=String(bytes);if(!output.includes('\n'))return;
   clearTimeout(timeout);try{resolve(JSON.parse(output.split('\n')[0]));}catch(error){reject(error);}
  });
 });
 const native=(owner:'a'|'b',path:string)=>fetch(metadata.address+path,{headers:{...protocol,authorization:'Bearer '+metadata[owner].token}});
 const control=async(path:string)=>{
  const response=await fetch(metadata.controlAddress+path,{method:'POST'});assert.equal(response.status,200);return response.json() as Promise<any>;
 };
 const login=async(owner:'a'|'b')=>{
  const response=await fetch(metadata.address+'/api/auth/login',{method:'POST',headers:{...protocol,'content-type':'application/json'},body:JSON.stringify({username:'generated-'+owner,password:metadata.password,mode:'web'})});
  assert.equal(response.status,200);const grant=await response.json() as any,cookie=response.headers.get('set-cookie')!.split(';')[0];
  const self=await fetch(metadata.address+'/api/auth/self',{headers:{...protocol,cookie}});assert.equal(self.status,200);const identity=await self.json() as any;
  assert.equal(identity.userId,metadata[owner].userId);assert.equal(identity.credentialId,grant.credentialId);
  return {cookie,credentialId:identity.credentialId,csrf:identity.csrfToken};
 };
 const request=(session:Awaited<ReturnType<typeof login>>,path:string,method='GET',body?:unknown,extra:Record<string,string>={})=>fetch(metadata.address+path,{
  method,headers:{...protocol,cookie:session.cookie,'x-mote-session-id':session.credentialId,'x-mote-csrf':session.csrf,...(body===undefined?{}:{'content-type':'application/json'}),...extra},...(body===undefined?{}:{body:JSON.stringify(body)}),
 });
 const a=await login('a'),b=await login('b'),path='/api/files/'+metadata.captureId;
 const original=await request(a,path).then(async response=>{assert.equal(response.status,200);return response.json() as Promise<any>;});
 const bBefore=await request(b,path+'/chunks').then(response=>response.text());assert.match(bBefore,/Generated B raw recording/);
 assert.equal((await native('a',path)).status,200);

 await control('/generated/hold-file-delete-before-admission');
 const retiredBody={operationId:randomUUID(),originalGeneration:original.originalGeneration};
 // A familiar session header cannot select a fixture fault under B's Cookie.
 const stale=await request(b,path,'DELETE',retiredBody,{'x-mote-session-id':a.credentialId,'x-mote-csrf':a.csrf});assert.equal(stale.status,409);
 assert.equal((await control('/generated/file-retries')).deleteEntered,false);
 let completed=false;
 const pending=request(a,path,'DELETE',retiredBody).then(response=>{completed=true;return response;});const observed=pending.catch(()=>undefined);
 t.after(async()=>{await control('/generated/release-file-delete-before-admission').catch(()=>{});await observed;});
 const deadline=Date.now()+20000;while(!(await control('/generated/file-retries')).deleteEntered){assert.equal(completed,false,'Cookie A request completed without entering the armed A fault barrier');assert.ok(Date.now()<deadline,'Actual Cookie DELETE did not enter its A barrier');await delay(10);}
 await control('/generated/recreate-file-source');await control('/generated/release-file-delete-before-admission');
 assert.equal((await pending).status,409,'The held original generation cannot delete the replacement');
 const replacement=await request(a,path).then(response=>response.json()) as any;assert.ok(replacement.originalGeneration>original.originalGeneration);
 assert.equal(await request(b,path+'/chunks').then(response=>response.text()),bBefore);

 const operation={operationId:randomUUID(),originalGeneration:replacement.originalGeneration};
 await control('/generated/drop-file-delete-ack');
 await assert.rejects(request(a,path,'DELETE',operation),/fetch failed/);
 const lost=await control('/generated/file-retries');
 assert.ok(lost.deletes.some((entry:any)=>entry.actor==='a'&&entry.status===200&&entry.body.operationId===operation.operationId));
 assert.equal((await request(a,path)).status,404,'The real deletion committed before its ACK was dropped');
 await control('/generated/release-file-delete-ack');
 const retried=await request(a,path,'DELETE',operation);assert.equal(retried.status,200,await retried.text());
 const receipts=(await control('/generated/file-retries')).deletes.filter((entry:any)=>entry.body.operationId===operation.operationId);
 assert.equal(receipts.length,2);assert.ok(receipts.every((entry:any)=>entry.actor==='a'&&entry.status===200));
 assert.deepEqual(receipts.map((entry:any)=>entry.body),[operation,operation]);
 assert.equal(await request(b,path+'/chunks').then(response=>response.text()),bBefore);
 assert.equal((await native('b',path)).status,200,'The existing native Bearer path remains valid');
});
