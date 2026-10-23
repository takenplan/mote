import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {ModelSettings} from '@mote/shared/models';
import {HindsightModelRelay} from '../src/hindsight-model-relay.js';
import {HindsightService,ManagedHindsightRuntime,HindsightRuntimeLease,hindsightModelFingerprint} from '../src/hindsight-runtime.js';
import {HindsightEngine,hindsightEvidenceRanges} from '../src/hindsight-engine.js';
import {randomUUID} from 'node:crypto';
import {memorySchema} from '../src/memory-schema.js';
const profile:ModelSettings={provider:'openai',protocol:'openai-completions',baseUrl:'http://127.0.0.1:1/v1',model:'generated-transport-model',reasoningEffort:'medium',serviceTier:'default',maxTokens:1000,modelRequestTimeoutMs:null,agentTimeoutMs:1000,allowUnauthenticatedLocal:true,apiKey:'generated-fixture',headers:{},extraBody:{}};

test('one live process cannot claim its configuration twice, and an unclaimed close cannot release its owner',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'mote-hindsight-lease-')),path=join(directory,'runtime-host.json'),owner=new HindsightRuntimeLease(path),other=new HindsightRuntimeLease(path);
 try{await owner.claim();assert.equal(await owner.owns(),true);await assert.rejects(other.claim(),/Another live host/);await other.release();assert.equal(await owner.owns(),true);await owner.release();await other.claim();assert.equal(await other.owns(),true);}finally{await owner.release();await other.release();await rm(directory,{recursive:true,force:true});}
});

test('a crashed native host lease is reclaimed with a new token',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'mote-hindsight-crash-')),path=join(directory,'runtime-host.json');
 const child=spawn(process.execPath,['--input-type=module','-e',`import{writeFileSync}from'node:fs';import{execFileSync}from'node:child_process';writeFileSync(process.argv[1],JSON.stringify({pid:process.pid,started:execFileSync('ps',['-p',String(process.pid),'-o','lstart='],{encoding:'utf8'}).trim(),token:'generated-crashed-token-'.repeat(3)}));setInterval(()=>{},1000)`,path],{stdio:'ignore'});
 try{for(let attempt=0;;attempt++){try{await readFile(path);break;}catch{assert.ok(attempt<100);await new Promise(resolve=>setTimeout(resolve,10));}}const prior=JSON.parse(await readFile(path,'utf8'));const exited=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGKILL');await exited;const replacement=new HindsightRuntimeLease(path);await replacement.claim();assert.notEqual(JSON.parse(await readFile(path,'utf8')).token,prior.token);await replacement.release();}finally{child.kill('SIGKILL');await rm(directory,{recursive:true,force:true});}
});

test('legal long originals retain every exact UTF-16 range across native transport partitions',()=>{
 const text='outside|'+'x'.repeat(11999)+'🌱'+'y'.repeat(20000)+'|outside',record={id:'generated',ocrText:text} as any,offset=8,length=text.length-16;
 const {originals,transport}=hindsightEvidenceRanges([{record,offset,length}]);assert.equal(originals[0].text,text.slice(offset,offset+length));assert.equal(transport.map(range=>range.text).join(''),originals[0].text);let next=offset;
 for(const range of transport){assert.equal(range.offset,next);assert.ok(range.length<=12000);assert.equal(range.text,text.slice(range.offset,range.offset+range.length));assert.ok(!/^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/.test(range.text));next+=range.length;}assert.equal(next,offset+length);
 assert.throws(()=>hindsightEvidenceRanges([{record,offset:0,length:text.length+1}]),/bounded exact/);
});

test('configuration generations own distinct native runtime identities while credential rotation keeps semantics',()=>{
 assert.equal(hindsightModelFingerprint(profile),hindsightModelFingerprint({...profile,apiKey:'rotated',headers:{Authorization:'rotated'}}));
 assert.notEqual(hindsightModelFingerprint(profile),hindsightModelFingerprint({...profile,model:'different-model'}));
 const first=new ManagedHindsightRuntime({directory:'/generated/a',instanceId:'generated-instance',configurationIdentity:'generation-a',settings:profile}),second=new ManagedHindsightRuntime({directory:'/generated/b',instanceId:'generated-instance',configurationIdentity:'generation-b',settings:profile});
 assert.notEqual(first.container,second.container);assert.notEqual(first.volume,second.volume);
});

test('remote native service requires TLS and a strong token; aborted transport is not a successful receipt',async()=>{
 assert.throws(()=>new HindsightService('http://example.com','x'.repeat(64)),/loopback HTTP/);
 assert.throws(()=>new HindsightService('https://example.com','short'),/strong access token/);
 assert.doesNotThrow(()=>new HindsightService('https://example.com','x'.repeat(64)));
 const controller=new AbortController();controller.abort(new Error('Generated cancel'));
 await assert.rejects(new HindsightService('http://127.0.0.1:1').request('POST','/fixture',{},controller.signal),/Generated cancel/);
});

test('relay shutdown interrupts a pending configured HTTP request and records unknown usage as failed',async()=>{
 let requestReady!:()=>void;const ready=new Promise<void>(resolve=>requestReady=resolve);
 const upstream=createServer(async(req)=>{for await(const _ of req){}requestReady();});
 await new Promise<void>(resolve=>upstream.listen(0,'127.0.0.1',resolve));
 const events:unknown[]=[],relay=new HindsightModelRelay({...profile,baseUrl:`http://127.0.0.1:${(upstream.address() as {port:number}).port}/v1`},{onRequestStarted:r=>events.push({type:'started',...r}),onRequestFinished:r=>events.push({type:'finished',...r}),onUsage:usage=>events.push({type:'usage',usage})});
 try{
  const endpoint=await relay.start(),pending=fetch(endpoint.baseUrl+'/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+endpoint.token,'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:'Generated transport fixture'}]})}).catch(()=>null);
  await ready;await relay.close();await pending;await new Promise(resolve=>setImmediate(resolve));
  assert.equal(events.filter((event:any)=>event.type==='started').length,1);assert.equal(events.filter((event:any)=>event.type==='finished'&&event.status==='failed').length,1);assert.equal(events.filter((event:any)=>event.type==='usage').length,0);
 }finally{await relay.close();upstream.closeAllConnections();await new Promise<void>(resolve=>upstream.close(()=>resolve()));}
});

test('an initially aborted capability probe does not initialize a native service or model',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'mote-hindsight-aborted-'));let starts=0;
 const engine=new HindsightEngine({directory,runtime:{service:async()=>{starts++;throw Error('Unexpected startup');},startWorker:async()=>{},stopWorker:async()=>{},close:async()=>{}}});
 try{const controller=new AbortController();controller.abort(new Error('Generated probe abort'));await assert.rejects(engine.probe(controller.signal),/Generated probe abort/);assert.equal(starts,0);}finally{await engine.close();await rm(directory,{recursive:true,force:true});}
});

test('native integration rejects visual parent proof before any service, bank or worker starts',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'mote-hindsight-visual-input-'));let remoteCalls=0,workerStarts=0;
 const engine=new HindsightEngine({directory,runtime:{service:async()=>{remoteCalls++;throw Error('Unexpected native service');},startWorker:async()=>{workerStarts++;},stopWorker:async()=>{},close:async()=>{}}});
 const id=randomUUID(),now='2026-10-01T00:00:00Z',record={id,ocrText:'Generated original-image host locator',capturedAt:now} as any;
 const parent=memorySchema.parse({id:randomUUID(),version:1,fingerprint:'a'.repeat(64),domain:'personal',tier:'episode',kind:'episodic',admission:{layer:'memory',reason:'Generated reference',scope:'Generated image only',attribution:'observed'},title:'Generated visual parent',statement:'A red rectangle is visible.',uncertainty:'Creator unknown.',evidenceIds:[id],evidence:[{id,capturedAt:now,receivedAt:now,contentHash:'b'.repeat(64),image:{original:{sha256:'c'.repeat(64),width:2,height:2,mimeType:'image/png',orientation:1,pages:1},coordinateSpace:'encoded-raster-pixels-v1',region:null,transform:'original-bytes@1',viewId:'d'.repeat(64),output:{sha256:'c'.repeat(64),width:2,height:2,mimeType:'image/png',sizeBytes:100}}}],createdAt:now,status:'published',model:'generated',runId:'generated-visual-parent'});
 try{await assert.rejects(engine.prepare({namespace:{ownerId:'generated-owner',instanceId:'generated-native-engine',bindingRevision:1},opId:randomUUID(),phase:'integrate',evidence:[record],relatedMemories:[parent]}),{code:'unsupported_input'});assert.equal(remoteCalls,0);assert.equal(workerStarts,0);}finally{await engine.close();await rm(directory,{recursive:true,force:true});}
});

test('queued native inference rechecks revoked evidence authority before reaching the configured endpoint',async()=>{
 let release!:()=>void,queued!:()=>void,revoked=false,upstreamCalls=0;
 const waiting=new Promise<void>(resolve=>queued=resolve),admitted=new Promise<void>(resolve=>release=resolve);
 const upstream=createServer((_req,res)=>{upstreamCalls++;res.end('{}');});await new Promise<void>(resolve=>upstream.listen(0,'127.0.0.1',resolve));
 const events:string[]=[];const relay=new HindsightModelRelay({...profile,baseUrl:`http://127.0.0.1:${(upstream.address() as {port:number}).port}/v1`},{onRequestStarted:()=>events.push('started'),onRequestFinished:()=>events.push('finished'),runModel:async task=>{queued();await admitted;return task();},assertModelAuthority:()=>{if(revoked)throw Error('Generated evidence authorization revoked');}});
 try{const endpoint=await relay.start(),pending=fetch(endpoint.baseUrl+'/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+endpoint.token,'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:'Generated evidence'}]})});await waiting;revoked=true;release();assert.equal((await pending).status,502);assert.equal(upstreamCalls,0);assert.deepEqual(events,[]);}finally{release();await relay.close();upstream.closeAllConnections();await new Promise<void>(resolve=>upstream.close(()=>resolve()));}
});

test('host model admission remains occupied until the complete inference body arrives',async()=>{
 let finish!:()=>void,headers!:()=>void,slotActive=false;
 const bodyReady=new Promise<void>(resolve=>finish=resolve),headersSent=new Promise<void>(resolve=>headers=resolve);
 const upstream=createServer(async(req,res)=>{for await(const _ of req){}res.writeHead(200,{'Content-Type':'application/json'});res.flushHeaders();headers();await bodyReady;res.end(JSON.stringify({choices:[{message:{role:'assistant',content:'Generated response'}}]}));});await new Promise<void>(resolve=>upstream.listen(0,'127.0.0.1',resolve));
 const relay=new HindsightModelRelay({...profile,baseUrl:`http://127.0.0.1:${(upstream.address() as {port:number}).port}/v1`},{runModel:async task=>{slotActive=true;try{return await task();}finally{slotActive=false;}}});
 try{const endpoint=await relay.start(),pending=fetch(endpoint.baseUrl+'/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+endpoint.token,'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:'Generated evidence'}]})});await headersSent;await new Promise(resolve=>setImmediate(resolve));assert.equal(slotActive,true);finish();assert.equal((await pending).status,200);assert.equal(slotActive,false);}finally{finish();await relay.close();upstream.closeAllConnections();await new Promise<void>(resolve=>upstream.close(()=>resolve()));}
});

test('relay queued cancellation releases frozen snapshots without charging and leaves its sibling independent',async()=>{
 let release!:()=>void,accepted!:()=>void,settled!:()=>void,abortObserved!:()=>void,upstreamCalls=0,currentOperation='first';
 const cancelled=new Promise<void>(resolve=>abortObserved=resolve),gate=new Promise<void>(resolve=>release=resolve),done=new Promise<void>(resolve=>settled=resolve),snapshots=new Map<string,string>(),events:{type:string;id:string;operation?:string;status?:string}[]=[];
 const upstream=createServer(async(req,res)=>{for await(const _ of req){}upstreamCalls++;res.end(JSON.stringify({choices:[{message:{role:'assistant',content:'Generated independent result'}}],usage:{prompt_tokens:2,completion_tokens:3,total_tokens:5}}));});await new Promise<void>(resolve=>upstream.listen(0,'127.0.0.1',resolve));
 const relay=new HindsightModelRelay({...profile,baseUrl:`http://127.0.0.1:${(upstream.address() as {port:number}).port}/v1`},{
  onRequestAccepted:r=>{snapshots.set(r.requestId,currentOperation);events.push({type:'accepted',id:r.requestId});accepted();},
  assertModelAuthority:r=>{assert.ok(snapshots.has(r.requestId));},runModel:async(task,signal)=>{signal?.addEventListener('abort',abortObserved,{once:true});try{await gate;return await task();}finally{signal?.removeEventListener('abort',abortObserved);}},
  onRequestStarted:r=>events.push({type:'started',id:r.requestId,operation:snapshots.get(r.requestId)}),
  onRequestFinished:r=>events.push({type:'finished',id:r.requestId,status:r.status}),
  onRequestSettled:r=>{snapshots.delete(r.requestId);events.push({type:'settled',id:r.requestId});if(events.filter(e=>e.type==='settled').length===2)settled();},
 });
 try{
  const endpoint=await relay.start(),controller=new AbortController();
  const send=(signal?:AbortSignal)=>fetch(endpoint.baseUrl+'/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+endpoint.token,'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:'Generated queue fixture'}]}),signal});
  const firstAccepted=new Promise<void>(resolve=>accepted=resolve),first=send(controller.signal).catch(()=>null);await firstAccepted;
  currentOperation='second';const secondAccepted=new Promise<void>(resolve=>accepted=resolve),second=send();await secondAccepted;currentOperation='later-operation';
  assert.equal(snapshots.size,2);assert.equal(events.filter(e=>e.type==='started').length,0);assert.equal(upstreamCalls,0);
  controller.abort();await first;await cancelled;release();assert.equal((await second).status,200);await done;
  assert.equal(upstreamCalls,1);assert.deepEqual(events.filter(e=>e.type==='started').map(e=>e.operation),['second']);assert.deepEqual(events.filter(e=>e.type==='finished').map(e=>e.status),['completed']);assert.equal(snapshots.size,0);
 }finally{release();await relay.close();upstream.closeAllConnections();await new Promise<void>(resolve=>upstream.close(()=>resolve()));}
});

for(const failure of ['authority','started','usage'] as const)test(`relay ${failure} callback failure releases its captured operation`,async()=>{
 let issued=0,started=0,finished=0,released!:()=>void;const snapshots=new Set<string>(),done=new Promise<void>(resolve=>released=resolve);
 const upstream=createServer(async(req,res)=>{for await(const _ of req){}issued++;res.end(JSON.stringify({choices:[{message:{role:'assistant',content:'Generated response'}}],usage:{prompt_tokens:2,completion_tokens:3,total_tokens:5}}));});await new Promise<void>(resolve=>upstream.listen(0,'127.0.0.1',resolve));
 const relay=new HindsightModelRelay({...profile,baseUrl:`http://127.0.0.1:${(upstream.address() as {port:number}).port}/v1`},{onRequestAccepted:r=>snapshots.add(r.requestId),assertModelAuthority:r=>{assert.ok(snapshots.has(r.requestId));if(failure==='authority')throw Error('Generated authority failure');},onRequestStarted:()=>{started++;if(failure==='started')throw Error('Generated started failure');},onUsage:()=>{if(failure==='usage')throw Error('Generated usage failure');},onRequestFinished:r=>{finished++;assert.equal(r.status,'failed');},onRequestSettled:r=>{snapshots.delete(r.requestId);released();}});
 try{const endpoint=await relay.start(),response=await fetch(endpoint.baseUrl+'/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+endpoint.token,'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:'Generated callback fixture'}]})});assert.equal(response.status,502);await done;assert.equal(snapshots.size,0);assert.equal(started,failure==='authority'?0:1);assert.equal(finished,started);assert.equal(issued,failure==='usage'?1:0);}finally{await relay.close();upstream.closeAllConnections();await new Promise<void>(resolve=>upstream.close(()=>resolve()));}
});
