import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {keepFixture} from './fixtures/keep-controls.js';
import {historyAskFixture} from './fixtures/history-ask-fixture.js';
import {scopedMemoryFixture} from './fixtures/scoped-memory-host.js';
import {fixture as processingFixture,media,until} from './fixtures/scoped-processing.js';
import {ArchiveMaintenance} from '../src/scope/archive-maintenance.js';
import {bytesHash,identityHash} from '../src/scope/originals.js';
import type {PrivateData} from '../src/scope/private-data.js';

const day=86400000;
const at=(milliseconds:number)=>new Date(milliseconds).toISOString();
const source=(id='same-source',retention='snapshot')=>({id,name:'Generated retention source',kind:'custom',deviceId:'same-device',platform:'import',retention});
const capture=(capturedAt:string,id=randomUUID(),image?:Buffer)=>({id,deviceId:'same-device',deviceName:'Generated device',platform:'import',capturedAt,durationMs:0,source:'screen',ocrText:image?'':'GENERATED_EXPIRED_CONTEXT',...(image?{imageBase64:image.toString('base64'),imageMime:'image/png',ocr:{status:'pending'}}:{})});
const item=(externalId:string,observedAt:string,extra={})=>({externalId,revision:'same-r1',observedAt,title:'Generated retention input',text:'GENERATED_SOURCE_CONTEXT',kind:'file',layer:'snapshot',...extra});
const storageRetention=async(node:Awaited<ReturnType<typeof keepFixture>>['node'],retentionDays:number)=>{const service=node.configuration.instance;await service.replace('storage',{...service.current<Record<string,unknown>>('storage'),retentionDays},service.revision);};

test('production startup restores context-end retention, exact file exclusions, transitive withdrawal and logged-out owners',async t=>{
 const f=await keepFixture(t,undefined,{version:1,revision:0,storage:{retentionDays:30}}),clock=Date.now(),old=at(clock-31*day),recent=at(clock-day),boundary=clock-30*day;
 const checked=async(...args:Parameters<typeof f.request>)=>{const response=await f.request(...args);assert.equal(response.status,200,response.text);return response.json();};
 for(const account of [f.a,f.b])await checked(account.token,'/api/ingress/sources','POST',source());
 const removed=capture(old),retained=capture(recent,removed.id),state={...capture(at(boundary-60000)),source:'activity',ocrText:'',appId:'generated.app',appName:'Generated app',privacy:{excluded:false,redacted:false,mode:'none',collection:'activity'},stateSeries:{version:1,samples:[{at:at(boundary-60000),durationMs:0},{at:at(boundary+60000),durationMs:0}]}};
 await checked(f.a.token,'/api/ingress/sources/same-source/captures','POST',{batchId:'old-and-state',items:[removed,state]});
 await checked(f.b.token,'/api/ingress/sources/same-source/captures','POST',{batchId:'recent',items:[retained]});
 const records=await checked(f.a.token,'/api/ingress/sources/same-source/items','POST',{batchId:'source-times',items:[item('authored-old',recent,{document:{recordedAt:old}}),item('authored-recent',old,{document:{recordedAt:recent}}),item('generic-file',old)]});
 await checked(f.a.token,'/api/ingress/sources','POST',source('file-manifests','reference'));
 const upload=await checked(f.a.token,'/api/ingress/sources/file-manifests/uploads','POST',{batchId:'old-file-revision',revision:{sourceId:'file-manifests',relativePath:'generated.txt',sizeBytes:0,item:item('retained-file',old,{text:'',layer:'reference'})}}),file=await checked(f.a.token,'/api/ingress/uploads/'+upload.id+'/commit','POST',{});
 const context=await f.node.authority.authenticate(f.a.token),bound=f.node.ingress.bindSource(context,['same-source'],()=>{}),root='mat_'+identityHash(['same-source','retention-parent']),derived='mat_'+identityHash(['same-source','retention-child']);
 const material=(id:string,member:any)=>({id,kind:'document',schemaVersion:1,title:'Generated expired projection',origin:{sourceId:'same-source',externalId:id===root?'retention-parent':'retention-child'},members:[member],blocks:[{id:'body',kind:'text',format:'plain',text:'GENERATED_EXPIRED_PROJECTION',memberIds:['parent']}],coverage:{state:'complete'},fidelity:{state:'derived'},retention:{original:'retained',policy:'keep'}});
 const first=bound.publishMaterial(material(root,{id:'parent',kind:'capture',ref:'capture:'+removed.id}));bound.publishMaterial(material(derived,{id:'parent',kind:'material',ref:first.ref}));
 const expiredTransport=new DatabaseSync(join(f.directory,'mote.sqlite'));try{expiredTransport.prepare('UPDATE ig_uploads SET expires=0 WHERE user_id=? AND id=?').run(f.a.userId,upload.id);}finally{expiredTransport.close();}
 await checked(f.a.token,'/api/auth/logout','POST',{});
 await f.restart();
 const a=await f.login('generated-a');
 for(const batchId of ['old-and-state','new-replay'])assert.equal((await f.request(a.token,'/api/ingress/sources/same-source/captures','POST',{batchId,items:batchId==='old-and-state'?[removed,state]:[removed]})).status,410,'deleted raw capture cannot reenter through an old or new batch receipt');
 for(const batchId of ['source-times','new-source-replay'])assert.equal((await f.request(a.token,'/api/ingress/sources/same-source/items','POST',{batchId,items:batchId==='source-times'?[item('authored-old',recent,{document:{recordedAt:old}}),item('authored-recent',old,{document:{recordedAt:recent}}),item('generic-file',old)]:[item('generic-file',old)]})).status,410,'deleted source revision cannot reenter through an old or new batch');
 assert.equal((await f.request(f.b.token,'/api/ingress/sources/same-source/captures','POST',{batchId:'new-b-duplicate',items:[retained]})).status,200);
 const newlyAuthorized=capture(recent);assert.equal((await f.request(a.token,'/api/ingress/sources/same-source/captures','POST',{batchId:'new-authorized-id',items:[newlyAuthorized]})).status,200,'a new exact capture ID is independent from the deleted event');
 assert.equal((await f.request(a.token,'/api/captures/'+removed.id)).status,404);
 assert.equal((await f.request(f.b.token,'/api/captures/'+retained.id)).status,200,'equal B capture ID keeps its own recent context');
 assert.equal((await f.request(a.token,'/api/captures/'+state.id)).status,200,'last state sample controls retention');
 for(const index of [0,2])assert.equal((await f.request(a.token,'/api/captures/'+records.captures[index].id)).status,404,'receipt time and generic file kind cannot exempt old context');
 assert.equal((await f.request(a.token,'/api/captures/'+records.captures[1].id)).status,200,'source content time controls retention');
 assert.equal((await f.request(a.token,'/api/captures/'+file.captures[0].id)).status,200,'actual file revision keeps the old exclusion');
 for(const id of [root,derived])assert.equal((await f.request(a.token,'/api/materials/'+id)).status,404);
 assert.equal((await checked(a.token,'/api/data/search?query=GENERATED_EXPIRED_PROJECTION')).items.length,0);
 const db=new DatabaseSync(join(f.directory,'mote.sqlite'));try{assert.ok(db.prepare("SELECT 1 FROM ig_file_generations WHERE user_id=? AND source_id='@capture' AND external_id=?").get(f.a.userId,removed.id),'destructive generation journal retires stale reads');}finally{db.close();}
 await f.restart();assert.equal((await f.request(a.token,'/api/captures/'+file.captures[0].id)).status,200,'transport GC and restart cannot lose canonical file identity');
});

test('zero retains history; strict cutoff and saved Ask history follow the shared deletion path',async t=>{
 const f=await historyAskFixture(t),material=await f.publish(f.a,'A'),conversationId=randomUUID(),id=randomUUID();
 await f.checked(f.a.token,'/api/conversations','POST',{id:conversationId});await f.checked(f.a.token,'/api/query-runs','POST',{id,input:{conversationId,question:'Generated retained context'}});assert.equal((await f.wait(f.a,id)).status,'completed');
 await f.restart();assert.match(JSON.stringify(await f.checked(f.a.token,'/api/conversations/'+conversationId)),/Generated answer A/,'retention zero does not clear old saved dialogue');
 const context=await f.node.authority.authenticate(f.a.token),data=f.node.services.forUser(context).get<PrivateData>('private-data');
 assert.equal(data.prune('2026-01-01T00:00:00.000Z'),0,'equal context_end is retained at the strict cutoff');
 await storageRetention(f.node,30);await f.restart();await f.node.app.ready();
 const erased=await f.checked(f.a.token,'/api/conversations/'+conversationId);assert.equal(erased.turns[0].evidenceDeleted,true);assert.equal(erased.turns[0].result,undefined);assert.equal((await f.request(f.a.token,'/api/materials/'+material.id)).statusCode,404);
 assert.equal((await f.request(f.a.token,'/api/query-runs/'+id+'/traces')).statusCode,404);
});

test('published generated Memory cannot survive expiry of its original and derived evidence',async t=>{
 const f=await scopedMemoryFixture(t),material=await f.publish(f.a,'A');await f.wait(f.a,(await f.submit(f.a,[material.id])).id);
 const before=(await f.request(f.a.token,'/api/memories')).json();assert.equal(before.items.length,1);
 await storageRetention(f.node,30);await f.restart();await f.node.app.ready();
 assert.equal((await f.request(f.a.token,'/api/memories')).json().items.length,0);assert.equal((await f.request(f.a.token,'/api/memories/'+before.items[0].id)).statusCode,404);assert.equal((await f.request(f.a.token,'/api/materials/'+material.id)).statusCode,404);
});

test('startup and the hourly callback clean expired transport while preserving active pins and unknown activities across owners',async t=>{
 const f=await keepFixture(t),checked=async(...args:Parameters<typeof f.request>)=>{const r=await f.request(...args);assert.equal(r.status,200,r.text);return r.json();};
 for(const user of [f.a,f.b])await checked(user.token,'/api/ingress/sources','POST',source());
 const bytes=Buffer.from('Generated pinned bytes'),input=capture(at(Date.now()),randomUUID(),bytes),acks:any[]=[];
 for(const user of [f.a,f.b])acks.push(await checked(user.token,'/api/ingress/sources/same-source/captures','POST',{batchId:'generated-image',items:[input]}));
 const aContext=await f.node.authority.authenticate(f.a.token),aIngress=f.node.ingress.forUser(aContext);aIngress.holdOriginal(acks[0].captures[0].original.ref);
 await checked(f.a.token,'/api/captures/'+input.id,'DELETE');
 const root=(user:any)=>join(f.directory,'originals',identityHash([f.node.deploymentId,user.userId])),object=(user:any)=>join(root(user),'objects',bytesHash(bytes));
 let releaseWork!:()=>void,entered!:()=>void;const enteredWork=new Promise<void>(resolve=>{entered=resolve;}),heldWork=new Promise<void>(resolve=>{releaseWork=resolve;});t.after(()=>releaseWork());
 const work=aIngress.withWorkspace(async workspace=>{workspace.write('generated.bin',bytes);entered();await heldWork;return true;});await enteredWork;
 const activeDb=new DatabaseSync(join(f.directory,'mote.sqlite'));try{activeDb.prepare('UPDATE ig_work SET expires=0 WHERE user_id=?').run(f.a.userId);assert.equal(f.node.archiveMaintenance.run().deferredOwners,1,'an actual active workspace retains its physical hold beyond metadata expiry');assert.ok(existsSync(object(f.a)));}finally{activeDb.close();releaseWork();await work;}
 await f.restart();assert.ok(existsSync(object(f.a)),'restart preserves a current physical pin');assert.ok(existsSync(object(f.b)));
 const db=new DatabaseSync(join(f.directory,'mote.sqlite'));t.after(()=>db.close());
 const begin=async(user:any,key:string)=>{const opened=await checked(user.token,'/api/ingress/sources/same-source/uploads','POST',{batchId:key,revision:{sourceId:'same-source',relativePath:'generated.bin',sizeBytes:bytes.length,sha256:bytesHash(bytes),item:item(key,at(Date.now()),{text:'',layer:'original'})}});await checked(user.token,'/api/ingress/uploads/'+opened.id+'/parts/0','PUT',{bytes:bytes.toString('base64'),checksum:bytesHash(bytes)});return opened;};
 const unknownUpload=await begin(f.a,'unknown-expired'),expired=await begin(f.b,'expired');
 const importedBytes=Buffer.from('Generated unlinked import subject to the existing staging deadline'),imported=await checked(f.b.token,'/api/import-uploads','POST',{name:'generated-expired.txt',sizeBytes:importedBytes.length,mimeType:'text/plain'});
 await checked(f.b.token,'/api/import-uploads/'+imported.id+'/parts/0','PUT',importedBytes);const archived=await checked(f.b.token,'/api/import-uploads/'+imported.id+'/commit','POST',{});db.prepare('UPDATE ig_import_uploads SET expires=0 WHERE user_id=? AND id=?').run(f.b.userId,imported.id);
 db.prepare('UPDATE ig_uploads SET expires=0 WHERE user_id IN (?,?)').run(f.a.userId,f.b.userId);db.prepare('INSERT INTO ig_activity VALUES(?,?)').run(f.a.userId,'generated-unknown-external');
 let tick:(()=>void)|undefined,stopped=false;const maintenance=new ArchiveMaintenance({db,deploymentId:f.node.deploymentId,directory:f.directory,cursorKey:String(db.prepare('SELECT cursor_key FROM pd_meta').get()!.cursor_key),configuration:f.node.configuration,contentCipher:f.node.contentStorage?.cipher},(work,milliseconds)=>{assert.equal(milliseconds,3600000);tick=work;return ()=>{stopped=true;};});t.after(()=>maintenance.close());
 assert.equal(maintenance.start()!.deferredOwners,1);assert.ok(existsSync(join(root(f.a),'uploads',unknownUpload.id)));assert.ok(!existsSync(join(root(f.b),'uploads',expired.id)));assert.ok(existsSync(object(f.a)));
 assert.equal(db.prepare('SELECT id FROM ig_archive_files WHERE user_id=? AND id=?').get(f.b.userId,archived.id),undefined);assert.ok(!existsSync(join(root(f.b),'objects',bytesHash(importedBytes))),'unlinked generic import cleanup uses the original staging policy');
 const next=await begin(f.b,'next-hour');db.prepare('UPDATE ig_uploads SET expires=0 WHERE user_id=?').run(f.b.userId);tick!();assert.ok(!existsSync(join(root(f.b),'uploads',next.id)),'the registered periodic callback invokes owner GC');
 maintenance.close();assert.ok(stopped);await f.restart();assert.ok(existsSync(join(root(f.a),'uploads',unknownUpload.id)),'restart does not infer an unknown external activity has stopped');assert.ok(existsSync(object(f.a)));
});

test('a real ambiguous processing call protects expired pins until observed physical settlement, across restart and another owner GC',async t=>{
 let calls=0;const endpoint=await media(t,(_request,response)=>{calls++;response.writeHead(503);response.end('Generated unknown processing outcome');}),f=await processingFixture(t);
 await f.models(f.alice.token,endpoint,'GENERATED_UNKNOWN_PROCESSING');const bytes=Buffer.from('Generated processing-original bytes'),a=(await f.upload(f.alice.token,bytes,'image/png')).captures[0],b=(await f.upload(f.bob.token,bytes,'image/png')).captures[0];
 const ingress=f.node.ingress.forUser(await f.node.authority.authenticate(f.alice.token));ingress.holdOriginal(a.original.ref);await f.intake(f.alice.token,a.original.ref);
 await until(()=>f.read(db=>!!db.prepare("SELECT 1 FROM mp_activity WHERE user_id=? AND state='unknown'").get(f.a.userId)),'generated ambiguous media response did not retain its real physical journal');assert.equal(calls,1);
 const root=(user:any)=>join(f.directory,'originals',identityHash([f.node.deploymentId,user.userId])),object=(user:any)=>join(root(user),'objects',bytesHash(bytes));
 f.read(db=>{db.prepare('UPDATE ig_pins SET expires=0 WHERE user_id=?').run(f.a.userId);assert.equal(db.prepare('SELECT count(*) n FROM ig_activity WHERE user_id=?').get(f.a.userId)!.n,0,'this hold is the processing journal, not an ingress workspace');});
 await f.checked(f.alice.token,'/api/captures/'+a.id,'DELETE');
 const pendingBytes=Buffer.from('Generated B staging eligible for automatic cleanup'),pending=await f.checked(f.bob.token,'/api/ingress/sources/same-source/uploads','POST',{batchId:'generated-expired-b-stage',revision:{sourceId:'same-source',relativePath:'pending.bin',sizeBytes:pendingBytes.length,sha256:bytesHash(pendingBytes),item:item('b-pending',at(Date.now()),{text:'',layer:'original'})}});await f.checked(f.bob.token,'/api/ingress/uploads/'+pending.id+'/parts/0','PUT',{bytes:pendingBytes.toString('base64'),checksum:bytesHash(pendingBytes)});f.read(db=>db.prepare('UPDATE ig_uploads SET expires=0 WHERE user_id=? AND id=?').run(f.b.userId,pending.id));
 assert.equal(f.node.archiveMaintenance!.run().deferredOwners,1);assert.ok(existsSync(object(f.a)));assert.ok(!existsSync(join(root(f.b),'uploads',pending.id)),'B cleanup remains independent of A unknown processing');
 await f.restart();await f.node.app.ready();assert.ok(existsSync(object(f.a)),'startup cannot expire a physical hold merely because its pin deadline passed');assert.equal(calls,1,'startup never replays the unknown provider call');
 const operationId=randomUUID();f.grants.set(operationId,{deploymentId:f.deploymentId,userId:f.a.userId,domain:'processing',purpose:'delete',operationId});const control=await f.lifecycleAuthority.authorize(operationId),cleanup=f.node.services.forLifecycle(control);assert.equal((await cleanup.run() as any).status,'result_unknown');
 const activities=f.node.processing!.pendingErasure(control);assert.equal(activities.length,1);assert.equal(activities[0].live,false);f.node.processing!.settleErasure(control,activities[0].id,'stopped');assert.equal((await cleanup.run() as any).status,'complete');
 assert.equal(f.node.archiveMaintenance!.run().deferredOwners,0);assert.ok(!existsSync(object(f.a)),'observed physical settlement permits reclamation');assert.deepEqual(f.node.ingress.forUser(await f.node.authority.authenticate(f.bob.token)).readOriginal(b.original.ref).bytes,bytes);
});
