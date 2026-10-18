import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fixture,media} from './fixtures/scoped-processing.js';

test('worker receipt deletion is an exact retired-processing lifecycle capability, never a restored model lease',async t=>{
 const f=await fixture(t),requests:{method:string|undefined;path:string|undefined;key:string|undefined;scope:string|undefined;body:number}[]=[];let response:'deleted'|'busy'|'malformed'='deleted';
 const endpoint=await media(t,(req,res,bytes)=>{requests.push({method:req.method,path:req.url,key:String(req.headers.authorization),scope:String(req.headers['x-mote-request-scope']),body:bytes.length});if(response==='busy'){res.writeHead(409).end('{}');return;}res.setHeader('Content-Type','application/json');res.end(JSON.stringify({version:1,requestId:response==='malformed'?randomUUID():req.url!.split('/').at(-1),deleted:true}));});
 const key='GENERATED_WORKER_DELETION_KEY',scope='a'.repeat(64),requestId=randomUUID();await f.models(f.alice.token,endpoint,key);await f.models(f.bob.token,endpoint,'GENERATED_OTHER_WORKER_KEY');
 const context=await f.node.authority.authenticate(f.alice.token),lease=await f.node.configuration.forUser(context).lease('ocr','generated-cleanup-model'),other=await f.node.configuration.forUser(await f.node.authority.authenticate(f.bob.token)).lease('ocr','generated-other-cleanup-model');
 const input={snapshotId:lease.snapshotId,requestId,scope};
 const subject=async(userId:string,purpose:'delete'|'export'='delete')=>{const operationId=randomUUID();f.grants.set(operationId,{deploymentId:f.deploymentId,userId,domain:'processing',operationId,purpose});return f.lifecycleAuthority.authorize(operationId);};
 const deletion=await subject(f.a.userId),wrongPurpose=await subject(f.a.userId,'export'),foreign=await subject(f.b.userId);
 f.read(db=>db.prepare('INSERT INTO mp_worker_cleanup VALUES(?,?,?,?,1)').run(f.a.userId,requestId,scope,lease.snapshotId));
 await assert.rejects(f.node.configuration.eraseWorkerReceipt(deletion,input),{code:'invalid_identity'});assert.equal(requests.length,0,'active business processing cannot use cleanup transport');
 f.read(db=>db.prepare('UPDATE mp_state SET deleted=1 WHERE user_id=?').run(f.a.userId));
 for(const identity of [context,wrongPurpose,foreign,{...deletion}])await assert.rejects(f.node.configuration.eraseWorkerReceipt(identity as any,input),{code:'invalid_identity'});
 await assert.rejects(f.node.configuration.eraseWorkerReceipt(deletion,{...input,scope:'b'.repeat(64)}),{code:'invalid_identity'});assert.equal(requests.length,0);
 await f.restart();assert.equal(await f.node.configuration.eraseWorkerReceipt(deletion,input),'deleted');assert.deepEqual(requests[0],{method:'DELETE',path:'/executions/'+requestId,key:'Bearer '+key,scope,body:0});
 response='busy';assert.equal(await f.node.configuration.eraseWorkerReceipt(deletion,input),'pending');response='malformed';assert.equal(await f.node.configuration.eraseWorkerReceipt(deletion,input),'pending');
 const before=requests.length;f.read(db=>db.prepare('UPDATE mp_worker_cleanup SET snapshot_id=? WHERE user_id=? AND request_id=?').run(other.snapshotId,f.a.userId,requestId));assert.equal(await f.node.configuration.eraseWorkerReceipt(deletion,{...input,snapshotId:other.snapshotId}),'pending');assert.equal(requests.length,before,'a foreign snapshot cannot become cleanup credentials');
 const usage=await f.checked(f.bob.token,'/api/usage');assert.equal(usage.items.length,0,'cleanup does not consume a model or create usage');
});
