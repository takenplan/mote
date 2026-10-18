import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash,randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import {Readable} from 'node:stream';
import {gunzipSync} from 'node:zlib';
import {setTimeout as delay} from 'node:timers/promises';
import {createServer} from 'node:http';
import {z} from 'zod';
import {keepFixture} from './fixtures/keep-controls.js';
import {defaultModelSettings} from '../src/model-settings.js';
import {materialId} from '../src/materials.js';
import {writeMessagesResponse} from '../../../scripts/fixtures/messages-provider.js';
import {EXECUTION_POLICIES} from '../src/execution-policy.js';

type Fixture=Awaited<ReturnType<typeof keepFixture>>;
type User={token:string;userId:string};
const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(r=>resolve=r);return {promise,resolve};};
async function until(check:()=>boolean|Promise<boolean>){const end=Date.now()+10000;while(!await check()){assert.ok(Date.now()<end,'bounded state transition timed out');await delay(10);}}
const hash=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
const limits={interactiveConcurrency:1,agentConcurrency:2,llmConcurrency:2,memoryConcurrency:1};
const diagnostics={enabled:false,debug:true,level:'debug',traceEnabled:false};
const exportPath='/api/files/export?mode=data&selection=current&type=text%2Fplain';

function untar(bytes:Buffer){
 const tar=gunzipSync(bytes),files=new Map<string,Buffer>();let ended=false;
 for(let at=0;at+512<=tar.length;){
  const h=tar.subarray(at,at+512);if(h.every(n=>n===0)){assert.ok(tar.subarray(at).every(n=>n===0));ended=true;break;}
  const name=h.subarray(0,100).toString().replace(/\0.*$/s,''),size=parseInt(h.subarray(124,136).toString(),8),checksum=parseInt(h.subarray(148,156).toString(),8),copy=Buffer.from(h);copy.fill(32,148,156);
  assert.equal(copy.reduce((a,b)=>a+b,0),checksum);assert.equal(h[156],48);assert.ok(!name.startsWith('/')&&!name.split('/').some(n=>!n||n==='..'));assert.ok(!files.has(name),'duplicate TAR member');assert.ok(Number.isSafeInteger(size)&&size>=0&&at+512+size<=tar.length);
  files.set(name,tar.subarray(at+512,at+512+size));at+=512+Math.ceil(size/512)*512;
 }
 assert.ok(ended,'TAR must end normally');return files;
}
async function source(f:Fixture,user:User){const r=await f.request(user.token,'/api/ingress/sources','POST',{id:'independent-source',name:'Hand authored synthetic source',kind:'local-files',deviceId:'independent-device',platform:'import',retention:'archive'});assert.equal(r.status,200,r.text);}
async function upload(f:Fixture,user:User,bytes:Buffer,{revision='v1',previousRevision=null as string|null,externalId='same-id',title=undefined as string|undefined,document=undefined as unknown}={}){
 await source(f,user);const opened=await f.request(user.token,'/api/ingress/sources/independent-source/uploads','POST',{batchId:externalId+revision,revision:{sourceId:'independent-source',previousRevision,item:{externalId,revision,observedAt:revision==='v1'?'2026-01-01T00:00:00Z':'2026-01-02T00:00:00Z',title:title??'Hand authored synthetic '+revision,text:'',kind:'file',layer:'original',mimeType:'text/plain',...(document?{document}:{})},sizeBytes:bytes.length,sha256:hash(bytes),relativePath:'synthetic.txt'}});assert.equal(opened.status,200,opened.text);
 const part=await f.request(user.token,'/api/ingress/uploads/'+opened.json().id+'/parts/0','PUT',{bytes:bytes.toString('base64'),checksum:hash(bytes)});assert.equal(part.status,200,part.text);
 const committed=await f.request(user.token,'/api/ingress/uploads/'+opened.json().id+'/commit','POST',{});assert.equal(committed.status,200,committed.text);return committed.json().captures[0];
}
async function attachment(f:Fixture,user:User,id:string,bytes:Buffer,mimeType:string){
 const opened=await f.request(user.token,'/api/import-uploads','POST',{id,name:'synthetic-attachment',sizeBytes:bytes.length,mimeType});assert.equal(opened.status,200,opened.text);
 assert.equal((await f.request(user.token,'/api/import-uploads/'+id+'/parts/0','PUT',bytes)).status,200);
 const r=await f.request(user.token,'/api/import-uploads/'+id+'/commit','POST',{});assert.equal(r.status,200,r.text);return r.json();
}
async function holdIndex(f:Fixture){
 const entered=deferred(),release=deferred(),kind='independent.index-lock';
 f.node.execution!.register({kind,pool:kind,concurrency:()=>1,policy:EXECUTION_POLICIES.control,parseInput:()=>({}),resources:()=>[{scope:'shared',key:'lexical-index-maintenance'}],execute:async run=>{entered.resolve();await Promise.race([release.promise,new Promise<void>(r=>run.signal.addEventListener('abort',()=>r(),{once:true}))]);return {};}});
 const r=await f.request(f.admin.token,'/api/tasks','POST',{kind,operationId:'synthetic-lock',input:{}});assert.equal(r.status,200,r.text);await entered.promise;return release;
}

test('independent KEEP cross-domain CAS and strict identity selectors cannot modify instance settings',async t=>{
 const f=await keepFixture(t),execution='/api/admin/execution-settings',diag='/api/admin/diagnostics-settings';
 const before=(await f.request(f.admin.token,execution)).json();
 const simultaneous=await Promise.all([f.request(f.admin.token,execution,'PUT',{revision:before.revision,...limits}),f.request(f.admin.token,diag,'PUT',{revision:before.revision,...diagnostics})]);assert.deepEqual(simultaneous.map(r=>r.status).sort(),[200,409]);
 const current=(await f.request(f.admin.token,execution)).json();assert.equal(current.revision,before.revision+1);
 for(const user of [f.a,f.b])for(const [path,value]of [[execution,limits],[diag,diagnostics]] as const){assert.equal((await f.request(user.token,path,'PUT',{revision:current.revision,...value})).status,403);assert.equal((await f.request(user.token,path,'PUT',{revision:current.revision,...value,userId:f.admin.userId})).status,401);}
 const personal=(await f.request(f.a.token,'/api/configuration')).json();
 for(const domain of ['execution','diagnostics'])assert.ok((await f.request(f.a.token,'/api/configuration/'+domain,'PUT',{revision:personal.revision,value:domain==='execution'?limits:diagnostics})).status>=400);
 for(const extra of [{path:'/tmp/synthetic-forbidden'},{ownerId:f.b.userId},{traceEnabled:true}])assert.ok((await f.request(f.admin.token,diag,'PUT',{revision:current.revision,...diagnostics,...extra})).status>=400);
 assert.equal((await f.request(f.admin.token,execution)).json().revision,current.revision);
 await f.restart();assert.equal((await f.request(f.admin.token,execution)).json().revision,current.revision);
});

test('independent KEEP queued maintenance loses authority on administrator demotion, and duplicate never resurrects it',async t=>{
 const f=await keepFixture(t);await upload(f,f.a,Buffer.from('SYNTHETIC_DEMOTION_A'));
 const db=new DatabaseSync(join(f.directory,'mote.sqlite'));t.after(()=>db.close());db.exec('DELETE FROM pd_fts');const release=await holdIndex(f);
 try{
  const operationId=randomUUID(),r=await f.request(f.admin.token,'/api/admin/index/rebuild','POST',{operationId});assert.equal(r.status,200,r.text);const id=r.json().id;assert.equal(r.json().state,'waiting');
  // No role-change HTTP surface exists. This mutates only this disposable
  // synthetic account's flag, deliberately without an epoch bump: the host
  // must check administrator status itself, independently of the epoch fence.
  db.prepare('UPDATE auth_accounts SET administrator=0 WHERE user_id=?').run(f.admin.userId);release.resolve();
  await until(()=>['stale','cancelled','failed'].includes(String(db.prepare('SELECT state FROM execution_steps WHERE id=?').get(id)?.state)));
  assert.equal(Number(db.prepare('SELECT count(*) n FROM pd_fts').get()!.n),0);
  assert.equal((await f.request(f.admin.token,'/api/admin/index/rebuild','POST',{operationId})).status,403);
  db.prepare('UPDATE auth_accounts SET administrator=1 WHERE user_id=?').run(f.admin.userId);
  const duplicate=await f.request(f.admin.token,'/api/admin/index/rebuild','POST',{operationId});assert.equal(duplicate.status,200,duplicate.text);assert.equal(duplicate.json().id,id);assert.notEqual(duplicate.json().state,'succeeded');
  assert.equal(Number(db.prepare('SELECT count(*) n FROM pd_fts').get()!.n),0);
  const fresh=await f.request(f.admin.token,'/api/admin/index/rebuild','POST',{operationId:randomUUID()});assert.equal(fresh.status,200,fresh.text);await until(async()=>(await f.request(f.admin.token,'/api/admin/index')).json().job?.state==='succeeded');assert.ok(Number(db.prepare('SELECT count(*) n FROM pd_fts').get()!.n)>0);
 }finally{release.resolve();}
});

test('independent KEEP rebuild excludes disabled owner and retains live owner after restart without cross-user search',async t=>{
 const f=await keepFixture(t),a=await upload(f,f.a,Buffer.from('SYNTHETIC_SEARCH_A'),{title:'SYNTHETIC_SEARCH_A'}),b=await upload(f,f.b,Buffer.from('SYNTHETIC_SEARCH_B'),{title:'SYNTHETIC_SEARCH_B'});assert.equal(a.id,b.id);
 const db=new DatabaseSync(join(f.directory,'mote.sqlite'));t.after(()=>db.close());db.exec('DELETE FROM pd_fts');const release=await holdIndex(f);
 try{
  const operationId=randomUUID(),r=await f.request(f.admin.token,'/api/admin/index/rebuild','POST',{operationId});assert.equal(r.status,200,r.text);
  assert.equal((await f.request(f.admin.token,'/api/admin/accounts/'+f.b.userId,'PATCH',{disabled:true})).status,200);release.resolve();await until(async()=>(await f.request(f.admin.token,'/api/admin/index')).json().job?.state==='succeeded');
  assert.equal(Number(db.prepare('SELECT count(*) n FROM pd_fts WHERE user_id=?').get(f.b.userId)!.n),0);assert.ok(Number(db.prepare('SELECT count(*) n FROM pd_fts WHERE user_id=?').get(f.a.userId)!.n)>0);
  assert.equal((await f.request(f.a.token,'/api/data/search?query=SYNTHETIC_SEARCH_B')).json().items.length,0);assert.ok((await f.request(f.a.token,'/api/data/search?query=SYNTHETIC_SEARCH_A')).json().items.length>0);
  await f.restart();const duplicate=await f.request(f.admin.token,'/api/admin/index/rebuild','POST',{operationId});assert.equal(duplicate.json().id,r.json().id);assert.equal(duplicate.json().state,'succeeded');assert.equal(Number(db.prepare('SELECT count(*) n FROM execution_steps WHERE id=?').get(r.json().id)!.n),1);
  assert.doesNotMatch((await f.request(f.admin.token,'/api/admin/index')).text,/SYNTHETIC_SEARCH|independent-source/);
 }finally{release.resolve();}
});

test('independent KEEP attachment MIME, declared-link authority and collision IDs produce only exact owner bytes and safe TAR members',async t=>{
 const f=await keepFixture(t),uploadId=randomUUID(),aBytes=Buffer.from('SYNTHETIC_PDF_A'),bBytes=Buffer.from('SYNTHETIC_PDF_B');
 const aFile=await attachment(f,f.a,uploadId,aBytes,'application/pdf'),bFile=await attachment(f,f.b,uploadId,bBytes,'application/pdf'),id=aFile.id;
 // Commit assigns archive IDs independently of upload IDs. Rekey only B's
 // disposable fixture row to force a collision, after both real HTTP uploads.
 const db=new DatabaseSync(join(f.directory,'mote.sqlite'));t.after(()=>db.close());
 db.exec('BEGIN; PRAGMA defer_foreign_keys=ON');
 try{db.prepare("UPDATE ig_archive_files SET id=?,json=json_set(json,'$.id',?) WHERE user_id=? AND id=?").run(id,id,f.b.userId,bFile.id);db.prepare('UPDATE ig_import_uploads SET file_id=? WHERE user_id=? AND file_id=?').run(id,f.b.userId,bFile.id);db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}
 const parentA=await upload(f,f.a,Buffer.from('SYNTHETIC_PARENT_A'),{externalId:'../synthetic-path',document:{attachments:[{id,name:aFile.name,mimeType:aFile.mimeType}]}}),parentB=await upload(f,f.b,Buffer.from('SYNTHETIC_PARENT_B'),{document:{attachments:[{id,name:bFile.name,mimeType:bFile.mimeType}]}});
 const ingressA=f.node.ingress.forUser(await f.node.authority.authenticate(f.a.token)),ingressB=f.node.ingress.forUser(await f.node.authority.authenticate(f.b.token));
 // A declaration alone must not become an archive-byte capability.
 const unlinked=untar((await f.request(f.a.token,'/api/files/export?mode=data&selection=current&type=application%2Fpdf')).bytes);assert.equal(JSON.parse(unlinked.get('metadata.json')!.toString()).attachments.length,0);
 ingressA.attachArchivedFiles(parentA.id,[id]);ingressB.attachArchivedFiles(parentB.id,[id]);
 for(const [user,expected,other]of [[f.a,aBytes,bBytes],[f.b,bBytes,aBytes]] as const){
  const r=await f.request(user.token,'/api/files/export?mode=data&selection=current&type=application%2Fpdf');assert.equal(r.status,200,r.text);const files=untar(r.bytes),manifest=JSON.parse(files.get('metadata.json')!.toString());assert.equal(manifest.originals.length,0);assert.equal(manifest.attachments.length,1);assert.equal(files.size,2);assert.deepEqual(files.get(manifest.attachments[0].member),expected);assert.ok(![...files.values()].some(value=>value.equals(other)));
  const onlyOriginal=untar((await f.request(user.token,exportPath)).bytes);assert.equal(JSON.parse(onlyOriginal.get('metadata.json')!.toString()).attachments.length,0);
 }
 for(const selector of ['&path=%2Ftmp%2Fsynthetic','&userId='+f.b.userId,'&ownerId='+f.b.userId])assert.ok((await f.request(f.a.token,exportPath+selector)).status>=400);
 await upload(f,f.a,Buffer.from('SYNTHETIC_PARENT_A_V2'),{revision:'v2',previousRevision:'v1',externalId:'../synthetic-path'});
 const current=untar((await f.request(f.a.token,'/api/files/export?mode=data&selection=current&type=application%2Fpdf')).bytes);assert.equal(JSON.parse(current.get('metadata.json')!.toString()).attachments.length,0);
 const history=untar((await f.request(f.a.token,'/api/files/export?mode=data&selection=history&type=application%2Fpdf')).bytes),retained=JSON.parse(history.get('metadata.json')!.toString()).attachments;assert.equal(retained.length,1);assert.equal(retained[0].current,false);assert.deepEqual(history.get(retained[0].member),aBytes);
});

test('independent KEEP replacing a current head during export retires the snapshot and history still has exact versions',async t=>{
 const entered=deferred(),release=deferred();let hold=false;
 const f=await keepFixture(t,node=>node.app.addHook('onSend',async(req,_reply,payload)=>{if(hold&&req.url.startsWith('/api/files/export')){entered.resolve();await release.promise;}return payload;}));
 const first=Buffer.from('SYNTHETIC_CURRENT_V1'),second=Buffer.from('SYNTHETIC_CURRENT_V2');await upload(f,f.a,first);hold=true;
 const pending=f.request(f.a.token,exportPath).catch(()=>({bytes:Buffer.alloc(0)}));
 try{await entered.promise;await upload(f,f.a,second,{revision:'v2',previousRevision:'v1'});release.resolve();const retired=await pending;assert.throws(()=>untar(retired.bytes));}finally{hold=false;release.resolve();}
 const current=untar((await f.request(f.a.token,exportPath)).bytes),manifest=JSON.parse(current.get('metadata.json')!.toString());assert.equal(manifest.originals.length,1);assert.deepEqual(current.get(manifest.originals[0].member),second);
 const history=untar((await f.request(f.a.token,exportPath.replace('selection=current','selection=history'))).bytes),versions=JSON.parse(history.get('metadata.json')!.toString()).originals;assert.equal(versions.length,2);assert.equal(versions.filter((r:{current:boolean})=>r.current).length,1);for(const r of versions)assert.equal(hash(history.get(r.member)!),r.sha256);
});

test('independent KEEP a real HTTP stream already emitting bytes fails on account disable and leaves B usable',async t=>{
 const entered=deferred(),release=deferred();let hold=false,emitted=0;
 const f=await keepFixture(t,node=>node.app.addHook('onSend',async(req,_reply,payload)=>{
  if(!hold||!req.url.startsWith('/api/files/export'))return payload;
  const stream=payload as Readable;
  // This barrier is at the external HTTP-output boundary. The original TAR,
  // gzip, authorization and object readers run unchanged on the real stream.
  return Readable.from((async function*(){try{for await(const chunk of stream){emitted++;yield chunk;if(emitted===1){entered.resolve();await release.promise;}}}finally{stream.destroy();}})());
 }));
 const bytes=Buffer.concat(Array.from({length:32768},(_,n)=>createHash('sha256').update('HAND_AUTHORED_SYNTHETIC_A_'+n).digest()));await upload(f,f.a,bytes);await upload(f,f.b,Buffer.from('SYNTHETIC_SURVIVING_B'));hold=true;
 const pending=f.request(f.a.token,exportPath).then(r=>({ok:true,bytes:r.bytes})).catch(()=>({ok:false,bytes:Buffer.alloc(0)}));
 try{
  await entered.promise;assert.equal(emitted,1);assert.equal((await f.request(f.admin.token,'/api/admin/accounts/'+f.a.userId,'PATCH',{disabled:true})).status,200);release.resolve();
  const response=await pending;assert.equal(response.ok,false,'retired HTTP stream cannot finish successfully');assert.equal(emitted,1,'no second compressed output block after disable');
 }finally{hold=false;release.resolve();}
 const b=await f.request(f.b.token,exportPath);assert.equal(b.status,200,b.text);assert.ok([...untar(b.bytes).values()].some(value=>value.equals(Buffer.from('SYNTHETIC_SURVIVING_B'))));
});

test('independent KEEP cancellation while waiting on live model gate never issues the held operation',async t=>{
 const f=await keepFixture(t),release=deferred(),entered:string[]=[],kind='independent.physical-gate';
 f.node.execution!.register({kind,pool:kind,concurrency:()=>8,policy:EXECUTION_POLICIES.modelCall,parseInput:raw=>z.object({label:z.string()}).strict().parse(raw),execute:async run=>{entered.push(String(run.task.input.label));run.external.begin('synthetic-held');await release.promise;run.external.complete();return {};}});
 const initial=(await f.request(f.admin.token,'/api/admin/execution-settings')).json();assert.equal((await f.request(f.admin.token,'/api/admin/execution-settings','PUT',{revision:initial.revision,...limits,agentConcurrency:1,llmConcurrency:1})).status,200);
 const submit=async(user:User,label:string)=>(await f.request(user.token,'/api/tasks','POST',{kind,operationId:label,input:{label}})).json();
 try{
  await submit(f.a,'synthetic-issued');await until(()=>entered.length===1);const waiting=await submit(f.b,'synthetic-cancel-before-issue');
  await until(async()=>(await f.request(f.admin.token,'/api/admin/execution-settings')).json().queues.agents.waiting===1);
  assert.equal((await f.request(f.b.token,'/api/tasks/'+waiting.id+'/cancel','POST',{})).status,200);release.resolve();
  await until(async()=>['cancelled','stale'].includes((await f.request(f.b.token,'/api/tasks/'+waiting.id)).json().state));assert.deepEqual(entered,['synthetic-issued']);
  await until(async()=>{const q=(await f.request(f.admin.token,'/api/admin/execution-settings')).json().queues;return q.agents.active===0&&q.models.active===0;});
 }finally{release.resolve();}
});

test('independent KEEP all four live limits reach actual Memory and Ask HTTP producers and external model transport',async t=>{
 const requests:{owner:string;raw:string}[]=[],holds=new Map<string,ReturnType<typeof deferred>>();let askPhase=false;
 const content=(owner:string)=>'SYNTHETIC_MEMORY_'+owner+': Fictional actor prefers generated tea.';
 const provider=createServer((req,res)=>{void(async()=>{
  let raw='';for await(const chunk of req)raw+=chunk;const owner=String(req.headers['x-api-key']).includes('_A_')?'A':'B';requests.push({owner,raw});await holds.get(owner)?.promise;
  if(askPhase){writeMessagesResponse(res,{stage:requests.length,text:JSON.stringify({answer:'This is a hand authored synthetic admission check.',citationIds:[]})});return;}
  const id=raw.match(/[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}/)?.[0],target=raw.match(/\\?"members\\?"\s*:\s*(\[.*?\])\s*,\s*\\?"contextMembers\\?"\s*:/s)?.[1]??raw,keys=[...new Set([...target.matchAll(/\\?"key\\?"\s*:\s*\\?"(member_[0-9]+)/g)].map(match=>match[1]))];
  const memories=id?[{title:'Synthetic '+owner,statement:`Fictional actor prefers generated tea. [${id}]`,uncertainty:'Hand authored fixture only',admission:{layer:'memory',reason:'Synthetic explicitly expressed preference',scope:'Fictional actor in synthetic fixture',attribution:'third_party'},evidenceIds:[id],evidence:[{id,quote:content(owner)}]}]:[];
  writeMessagesResponse(res,{stage:requests.length,text:JSON.stringify({answer:JSON.stringify({memories,...(keys.length?{coverage:keys.map((key,index)=>({key,state:index===0&&memories.length?'checked':'no_candidates',candidateIndexes:index===0&&memories.length?[0]:[]}))}:{})}),citationIds:id?[id]:[]})});
 })().catch(()=>res.destroy());});
 await new Promise<void>(resolve=>provider.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{for(const hold of holds.values())hold.resolve();provider.closeAllConnections();await new Promise<void>(resolve=>provider.close(()=>resolve()));});
 const f=await keepFixture(t),modelUrl='http://127.0.0.1:'+(provider.address() as {port:number}).port+'/v1';
 const request=async(user:User,path:string,method='GET',body?:unknown)=>{
  const response=await f.request(user.token,path,method,body);assert.equal(response.status,200,response.text);return response.json();
 };
 for(const [user,label]of [[f.a,'A'],[f.b,'B']] as const){const config=await request(user,'/api/configuration');await request(user,'/api/configuration/models','PUT',{revision:config.revision,value:{profiles:[{id:'same-model',name:'Synthetic limit model',settings:{...defaultModelSettings(),provider:'custom',protocol:'anthropic-messages',model:'synthetic-limit-model',baseUrl:modelUrl,apiKey:'SYNTHETIC_'+label+'_KEY',headers:{},extraBody:{}}}],selections:{memory:{kind:'personal',id:'same-model'},chat:{kind:'personal',id:'same-model'}}}});}
 const publish=async(user:User,label:string)=>{
  const sourceId='synthetic-memory-source',externalId='same-material';await request(user,'/api/ingress/sources','POST',{id:sourceId,name:'Synthetic Memory input',kind:'custom',deviceId:'synthetic-device',platform:'import',retention:'snapshot'});
  const bound=f.node.ingress.bindSource(await f.node.authority.authenticate(user.token),[sourceId],()=>{}),receipt=bound.receiveSourceItems(sourceId,'synthetic-material-batch',[{externalId,revision:'v1',observedAt:'2026-01-01T00:00:00Z',title:'Synthetic Memory input',text:content(label),kind:'file',layer:'original'}]);
  return bound.publishMaterial({id:materialId(sourceId,externalId),kind:'document',schemaVersion:1,title:'Synthetic Material '+label,origin:{sourceId,externalId,deviceId:'synthetic-device'},blocks:[{id:'same-block',kind:'text',format:'plain',text:content(label),memberIds:['original']}],members:[{id:'original',kind:'capture',ref:'capture:'+receipt.captures[0].id}],coverage:{state:'complete'},fidelity:{state:'lossless'},retention:{original:'retained',policy:'keep'}});
 };
 const finished=async(user:User,id:string)=>{const job=await request(user,'/api/memory/jobs/'+id),tasks=Object.values(job.tasks) as {state:string}[];assert.ok(!tasks.some(task=>['failed','stale','blocked','cancelled'].includes(task.state)),JSON.stringify(job));return tasks.length>=3&&job.state!=='admitting'&&tasks.every(task=>task.state==='succeeded');};
 const view=()=>request(f.admin,'/api/admin/execution-settings');
 const configure=async(value:typeof limits)=>request(f.admin,'/api/admin/execution-settings','PUT',{revision:(await view()).revision,...value});
 const a=await publish(f.a,'A'),b=await publish(f.b,'B'),aHold=deferred(),bHold=deferred();holds.set('A',aHold);holds.set('B',bHold);
 try{
  await configure({...limits,agentConcurrency:1,llmConcurrency:1,memoryConcurrency:1});
  const aj=await request(f.a,'/api/memory/jobs','POST',{materialIds:[a.id],operationId:randomUUID()}),bj=await request(f.b,'/api/memory/jobs','POST',{materialIds:[b.id],operationId:randomUUID()});
  await until(async()=>{const q=(await view()).queues;return requests.length===1&&q.memory.active===1&&f.node.execution!.engine.list({kind:'memory.extract',state:'waiting'}).items.length===1;});
  assert.equal((await view()).queues.memory.waiting,0,'capacity waiting stays in the durable Memory pool before acquiring physical gates');
  await configure({...limits,agentConcurrency:1,llmConcurrency:1,memoryConcurrency:2});
  await until(async()=>{const q=(await view()).queues;return q.memory.active===2&&q.agents.active===1&&q.agents.waiting===1;});assert.equal(requests.length,1);
  await configure({...limits,agentConcurrency:2,llmConcurrency:1,memoryConcurrency:2});
  await until(async()=>{const q=(await view()).queues;return q.agents.active===2&&q.models.active===1&&q.models.waiting===1;});assert.equal(requests.length,1);
  await configure({...limits,agentConcurrency:2,llmConcurrency:2,memoryConcurrency:2});
  await until(()=>requests.length===2);const active=(await view()).queues;assert.equal(active.memory.active,2);assert.equal(active.agents.active,2);assert.equal(active.models.active,2);
  aHold.resolve();bHold.resolve();await Promise.all([until(()=>finished(f.a,aj.id)),until(()=>finished(f.b,bj.id))]);
 }finally{aHold.resolve();bHold.resolve();holds.clear();}
 const ah=deferred(),bh=deferred(),offset=requests.length;holds.set('A',ah);holds.set('B',bh);askPhase=true;
 try{
  await configure({...limits,interactiveConcurrency:1,memoryConcurrency:2});
  const aid=randomUUID(),bid=randomUUID();await request(f.a,'/api/query-runs','POST',{id:aid,input:{question:'State that this is a synthetic admission check without using archive evidence.'}});await request(f.b,'/api/query-runs','POST',{id:bid,input:{question:'State that this is a synthetic admission check without using archive evidence.'}});
  await until(async()=>{const q=(await view()).queues;return requests.length===offset+1&&q.interactive.active===1&&f.node.execution!.engine.poolSnapshot('ask.models').interactive.waiting===1;});
  assert.equal((await view()).queues.interactive.waiting,0,'capacity waiting stays in the durable interactive lane');
  const waiting=(await view()).queues;assert.equal(waiting.models.active,0);assert.equal(waiting.agents.active,0);
  await configure({...limits,interactiveConcurrency:2,memoryConcurrency:2});await until(()=>requests.length===offset+2);assert.equal((await view()).queues.interactive.active,2);ah.resolve();bh.resolve();
  for(const [user,id]of [[f.a,aid],[f.b,bid]] as const){await until(async()=>(await request(user,'/api/query-runs/'+id)).status!=='running');assert.equal((await request(user,'/api/query-runs/'+id)).status,'completed');}
 }finally{ah.resolve();bh.resolve();holds.clear();}
 for(const item of requests){assert.ok(!item.raw.includes(content(item.owner==='A'?'B':'A')));assert.doesNotMatch(item.raw,/SYNTHETIC_[AB]_KEY/);}
});
