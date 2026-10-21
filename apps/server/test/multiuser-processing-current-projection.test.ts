import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {DatabaseSync,type SQLInputValue} from 'node:sqlite';
import {join} from 'node:path';
import {writeMessagesResponse} from '../../../scripts/fixtures/messages-provider.js';
import {defaultModelSettings} from '../src/model-settings.js';
import {defaultProcessingSettings} from '../src/scope/processing-schema.js';
import {archiveReadSet} from '../src/scope/archive-read-set.js';
import {scopedFilesFixture} from './fixtures/scoped-files.js';
import {png,settings,done} from './fixtures/multiuser-perception-history-suite.js';
import {waitForScopedState} from './fixtures/scoped-process.js';

// Fixed generated composition. Production admission, registered handlers, input
// authority and publication run unchanged. SQL below only sets negative states
// or locates already-admitted task IDs; no private-current/SQL-only oracle.
const mode=process.env.MOTE_PROCESSING_CURRENT_PROJECTION_BENCH;
assert.ok(mode===undefined||mode==='plain'||mode==='count','Unknown generated benchmark mode');
const gate=()=>{let release!:()=>void;const wait=new Promise<void>(resolve=>release=resolve);return {wait,release};};
type Files=Awaited<ReturnType<typeof scopedFilesFixture>>;
type Actor=Files['a'];
type Subject={actor:Actor;captureId:string;ref:string;parentId?:string;fileId?:string;externalId:string};
const normalized=(sql:string)=>sql.replace(/\s+/g,' ').trim();
function role(raw:string){
 const sql=normalized(raw);
 if(sql.includes('mp_file_controls')&&sql.includes('mp_file_policy_bindings')&&sql.includes('ig_file_generations'))return 'facts-projection';
 if(sql==='SELECT generation,cancelled FROM mp_file_controls WHERE user_id=$user AND original_id=?')return 'control';
 if(sql==='SELECT plan_id FROM mp_file_policy_bindings WHERE user_id=$user AND original_id=?')return 'policy';
 if(sql.startsWith('SELECT MAX(COALESCE(g.generation,0),COALESCE(f.generation,0)) generation FROM ig_originals'))return 'generation';
 if(sql==='SELECT capture_id FROM ig_originals WHERE user_id=$user AND id=?')return 'attachment-locator';
 if(sql.startsWith('SELECT c.json,l.binding_id,l.parent_capture_id,l.file_id FROM pd_captures c'))return 'attachment-binding';
 if(sql==='SELECT * FROM mp_state WHERE user_id=$user')return 'state';
 if(sql==='SELECT mime FROM ig_originals WHERE user_id=$user AND id=?')return 'mime';
 if(sql==='SELECT json FROM mp_perception_state WHERE user_id=$user')return 'perception';
 if(sql.includes('validation_task_user_id'))return 'task-valid';
 if(sql==='SELECT disabled,authorization_epoch FROM auth_accounts WHERE user_id=?')return 'account';
 if(sql==='SELECT model_receipt FROM user_tasks WHERE task_id=?')return 'model';
 if(sql==='INSERT OR IGNORE INTO user_configuration_state(user_id) VALUES(?)')return 'configuration-init';
 if(sql==='SELECT generation,deleted,restore_operation FROM user_configuration_state WHERE user_id=?')return 'configuration';
 if(sql==='SELECT profile_id,generation,recovery_generation,present,has_credentials,fingerprint,components FROM user_model_credential_generations WHERE user_id=? AND profile_id=?')return 'credential';
 if(sql==='SELECT * FROM execution_steps WHERE id=?')return 'engine';
 if(sql==='SELECT input FROM user_tasks WHERE user_id=$user AND task_id=?')return 'understanding-parent';
 if(sql==='SELECT state FROM execution_steps WHERE user_id=$user AND id=?')return 'parent-state';
 return 'OTHER';
}
type Counts={get:Record<string,number>;runs:Record<string,number>;prepare:Record<string,number>;columns:Record<string,number>;bytes:Record<string,number>;run:number;all:number;iterate:number;errors:number;overflow:number};
const emptyCounts=():Counts=>({get:{},runs:{},prepare:{},columns:{},bytes:{},run:0,all:0,iterate:0,errors:0,overflow:0});
// One native prototype wrapper, installed only for synchronous safety/count
// checks, restored in finally. No per-statement wrapping/recursive fanout.
function observe(db:DatabaseSync){
 const proto=Object.getPrototypeOf(db.prepare('SELECT 1')),originals=new Map<string,Function>(),prepare=db.prepare;
 let enabled=false,counts=emptyCounts(),after:undefined|((name:string)=>void),inside=false,total=0;
 for(const name of ['get','run','all','iterate'] as const){const original=proto[name];originals.set(name,original);proto[name]=function(...args:unknown[]){
  if(!enabled||inside)return Reflect.apply(original,this,args);
  const nameRole=role(this.sourceSQL);if(++total>100000){counts.overflow++;throw Error('Generated native observation cap');}
  if(name==='get')counts.get[nameRole]=(counts.get[nameRole]??0)+1;else{counts[name]++;if(name==='run')counts.runs[nameRole]=(counts.runs[nameRole]??0)+1;}
  let value:unknown;try{value=Reflect.apply(original,this,args);}catch(error){counts.errors++;throw error;}
  if(name==='get'){counts.columns[nameRole]=(counts.columns[nameRole]??0)+(value&&typeof value==='object'?Object.keys(value).length:0);counts.bytes[nameRole]=(counts.bytes[nameRole]??0)+Buffer.byteLength(JSON.stringify(value,(_key,item)=>typeof item==='bigint'?String(item):item)??'undefined');if(after){inside=true;try{after(nameRole);}finally{inside=false;}}}
  return value;
 };}
 db.prepare=function(sql:string){if(enabled&&!inside){const name=role(sql);counts.prepare[name]=(counts.prepare[name]??0)+1;}return Reflect.apply(prepare,this,[sql]);};
 return {start(hook?:typeof after){assert.equal(enabled,false);counts=emptyCounts();total=0;after=hook;enabled=true;},stop(){enabled=false;after=undefined;return structuredClone(counts);},restore(){enabled=false;db.prepare=prepare;for(const [name,original]of originals)proto[name]=original;}};
}
function temporary(db:DatabaseSync,work:()=>void){db.exec('SAVEPOINT current_fixture');try{work();}finally{db.exec('ROLLBACK TO current_fixture; RELEASE current_fixture');}}
function patchTask(db:DatabaseSync,id:string,patch:Record<string,unknown>){
 const input=JSON.parse(String(db.prepare('SELECT input FROM execution_steps WHERE id=?').get(id)!.input));
 for(const [key,value]of Object.entries(patch)){if(value===undefined)delete input[key];else input[key]=value;}
 const json=JSON.stringify(input);db.prepare('UPDATE execution_steps SET input=? WHERE id=?').run(json,id);db.prepare('UPDATE user_tasks SET input=? WHERE task_id=?').run(json,id);
}
function assertFactCounts(c:Counts,callbacks:number,archive=false,modelCalls=0){
 assert.equal(c.errors,0);assert.equal(c.overflow,0);assert.equal(c.run,modelCalls);assert.equal(c.runs['configuration-init']??0,modelCalls);assert.equal(c.all,0);assert.equal(c.iterate,0);
 assert.equal(c.get.state,callbacks);assert.equal(c.get.mime,callbacks);assert.equal(c.get.perception,callbacks);
 assert.equal(c.get['attachment-locator'],callbacks);assert.equal(c.get['attachment-binding'],callbacks);
 if(c.get['facts-projection']){assert.equal(archive,false,'Archive must retain exact original read witnesses');assert.equal(c.get['facts-projection'],callbacks);for(const name of ['control','policy','generation'])assert.equal(c.get[name]??0,0);}
 else for(const name of ['control','policy','generation'])assert.equal(c.get[name],callbacks);
}
async function fixture(t:TestContext,attachment=false){
 const releases=new Set<ReturnType<typeof gate>>(),seen=new Set<string>(),held=new Map<string,ReturnType<typeof gate>>(),failures:string[]=[];
 // A real Messages provider asks for pixels before the held second turn. The
 // generated provider alone is controlled; Central child/bridge are unchanged.
 const server=createServer((req,res)=>{void(async()=>{
  const parts:Buffer[]=[];for await(const part of req)parts.push(Buffer.from(part));const body=Buffer.concat(parts).toString();
  const id=[...new Set(body.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/g)??[])][0];assert.ok(id,'Generated provider must receive the real capture');
  const owner=String(req.headers['x-api-key']??req.headers.authorization).includes('CURRENT_B')?'b':'a',key=owner+':'+id;
  if(!seen.has(key)){seen.add(key);writeMessagesResponse(res,{stage:1,tool:{name:'read_image',args:{id,view:'image'}}});return;}
  const paused=gate();releases.add(paused);held.set(key,paused);await paused.wait;
  writeMessagesResponse(res,{stage:2,text:JSON.stringify({answer:JSON.stringify({text:'GENERATED_CURRENT_'+owner,regions:[]}),citationIds:[id]})});
 })().catch(error=>{failures.push(String(error));res.destroy();});});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 // Registered before app cleanup so owned pending transports are always freed.
 t.after(()=>{for(const release of releases)release.release();server.closeAllConnections();return new Promise<void>(resolve=>server.close(()=>resolve()));});
 const address=server.address();assert.ok(address&&typeof address!=='string');
 const f=await scopedFilesFixture(t,node=>{const registry=node.processing!.processors.imageRecipes;registry.registerStage({id:'generated.current-pixels',version:'1',kind:'understanding',run:input=>input.understand()});registry.registerRecipe({id:'generated.current-pixels',version:'1',steps:[{name:'pixels',stage:{id:'generated.current-pixels',version:'1'},dependsOn:[]}]});});
 const db=f.host.execution!.engine.store.db,engine=f.host.execution!.engine,bytes=await png(),subjects:Subject[]=[];
 for(const [label,actor]of [['a',f.a],['b',f.b]] as const){
  await f.checked(actor.token,'/api/configuration/models','PUT',{revision:(await f.checked(actor.token,'/api/configuration')).revision,value:{profiles:[{id:'current-language',name:'Generated current pixels',settings:{...defaultModelSettings(),provider:'custom',protocol:'anthropic-messages',baseUrl:'http://127.0.0.1:'+address.port+'/v1',model:'generated-current',apiKey:'GENERATED_CURRENT_'+label.toUpperCase()}}],selections:{file:{kind:'personal',id:'current-language'}}}});
  const page=await f.checked(actor.token,'/api/file-processing');await f.checked(actor.token,'/api/file-processing','PUT',{revision:page.revision,settings:page.settings,policy:{version:1,services:[{id:'language',name:'Generated current pixels',kind:'model',reference:{kind:'personal',id:'current-language'}}],profiles:[{id:'pixels',name:'Generated current pixels',processorId:'image.http',modelServiceId:'language',parameters:{},summarize:false,imageRecipe:{id:'generated.current-pixels',version:'1'}},{id:'archive',name:'Generated archive',processorId:'archive',parameters:{},summarize:false}],rules:[{type:'image/*',profileId:'pixels'},{type:'*/*',profileId:'archive'}]}});
  await settings(f,actor.token,{enabled:true,understandingEnabled:true});
  if(!attachment){const capture=await f.uploadBytes(actor.token,'same-current-image',bytes,'image/png');subjects.push({actor,captureId:capture.id,ref:capture.original.ref,externalId:'same-current-image'});}
  else{
   const upload='4f42fd35-ab9d-4083-bcd4-3cc15e4719fa';await f.checked(actor.token,'/api/import-uploads','POST',{id:upload,name:'generated-current.png',sizeBytes:bytes.length,mimeType:'image/png'});
   assert.equal((await f.request(actor.token,'/api/import-uploads/'+upload+'/parts/0','PUT',bytes,{'content-type':'application/octet-stream'})).statusCode,200);
   const file=await f.checked(actor.token,'/api/import-uploads/'+upload+'/commit','POST',{});
   const parent=(await f.checked(actor.token,'/api/ingress/sources/same-source/items','POST',{batchId:'current-parent',items:[{externalId:'current-parent',revision:'r1',observedAt:'2026-10-16T00:00:00Z',title:'Generated parent',text:'GENERATED_PARENT',kind:'message',layer:'original',document:{contentRole:'authored',timeBasis:'unknown',attachments:[{id:file.id,name:file.name,mimeType:file.mimeType}]}}]})).captures[0];
   // Existing host API establishes retained lineage; preparation itself enters
   // through the authenticated record attachment HTTP route.
   f.host.ingress.forUser(await f.host.authority.authenticate(actor.token)).attachArchivedFiles(parent.id,[file.id]);
   const child=await f.checked(actor.token,'/api/records/'+parent.id+'/attachments/'+file.id+'/processing','POST',{}),detail=await f.checked(actor.token,'/api/files/'+child.captureId);
   subjects.push({actor,captureId:child.captureId,ref:detail.originalRef,parentId:parent.id,fileId:file.id,externalId:'current-parent'});
  }
 }
 await waitForScopedState(()=>held.has('a:'+subjects[0].captureId)&&held.has('b:'+subjects[1].captureId),()=>JSON.stringify({held:held.size,providerErrors:failures.length}),12000);
 assert.deepEqual(failures,[]);
 const task=(subject:Subject,kind='processing.pipeline')=>{const rows=db.prepare("SELECT e.id FROM execution_steps e JOIN user_tasks u ON u.task_id=e.id AND u.user_id=e.user_id WHERE e.user_id=? AND e.kind=? AND json_extract(u.input,'$.originalRef')=? AND e.state IN('running','waiting')").all(subject.actor.userId,kind,subject.ref);assert.equal(rows.length,1,'Exactly one real held '+kind);return String(rows[0].id);};
 const current=(subject=subjects[0],kind='processing.pipeline')=>engine.isCurrentInputAuthority(task(subject,kind));
 const ids=subjects.map(s=>({pipeline:task(s),understanding:task(s,'processing.image-understanding')}));
 const finish=async()=>{for(const release of releases)release.release();for(const subject of subjects){await done(f,subject.actor.token,subject.captureId);assert.ok((await f.checked(subject.actor.token,'/api/images/'+subject.captureId)).products.length>0);}assert.deepEqual(failures,[]);};
 return {f,db,engine,subjects,ids,current,task,finish,held,forgetProviderConversation:(subject:Subject)=>{seen.delete((subject.actor.userId===f.a.userId?'a':'b')+':'+subject.captureId);},other:()=>new DatabaseSync(join(f.directory,'mote.sqlite'))};
}

if(mode===undefined)test('real current checkpoints preserve native facts, lifecycle and archive witnesses',async t=>{
 const f=await fixture(t),{db,subjects:[a,b],ids}=f,uid=a.actor.userId,ref=a.ref.slice(9),id=ids[0].pipeline;
 assert.equal(f.engine.isCurrentInputAuthority(id),true);assert.equal(f.current(b),true);assert.equal(a.captureId,b.captureId,'Generated public identifiers collide across owners');
 const check=(expected:boolean)=>{assert.equal(f.engine.isCurrentInputAuthority(id),expected);assert.equal(f.current(b),true);};
 const change=async(name:string,mutate:()=>void,expected=false)=>t.test(name,()=>temporary(db,()=>{mutate();check(expected);}));
 await change('state deleted',()=>db.prepare('UPDATE mp_state SET deleted=1 WHERE user_id=?').run(uid));
 await change('state strict generation mismatch',()=>db.prepare('UPDATE mp_state SET generation=generation+1 WHERE user_id=?').run(uid));
 await change('state lazy default INSERT and reread remain visible in the caller transaction',()=>{db.prepare('DELETE FROM mp_state WHERE user_id=?').run(uid);patchTask(db,id,{generation:0});check(true);assert.deepEqual({...db.prepare('SELECT deleted,generation,settings FROM mp_state WHERE user_id=?').get(uid)!},{deleted:0,generation:0,settings:JSON.stringify(defaultProcessingSettings())});},true);
 for(const json of ['{','[]','{"enabled":"yes"}'])await change('perception malformed '+json,()=>db.prepare('UPDATE mp_perception_state SET json=? WHERE user_id=?').run(json,uid));
 await change('perception defaults after missing row',()=>db.prepare('DELETE FROM mp_perception_state WHERE user_id=?').run(uid),true);
 await change('perception schema defaults from empty object',()=>db.prepare("UPDATE mp_perception_state SET json='{}' WHERE user_id=?").run(uid),true);
 await change('perception changed execution stamp',()=>db.prepare("UPDATE mp_perception_state SET json=json_set(json,'$.providerRevision','changed') WHERE user_id=?").run(uid));
 await change('nonimage prefix does not parse perception JSON',()=>{db.prepare("UPDATE ig_originals SET mime='text/plain' WHERE user_id=? AND id=?").run(uid,ref);db.prepare("UPDATE mp_perception_state SET json='{' WHERE user_id=?").run(uid);patchTask(db,id,{perceptionStamp:undefined});},true);
 await change('control absent defaults to zero and not cancelled',()=>db.prepare('DELETE FROM mp_file_controls WHERE user_id=? AND original_id=?').run(uid,ref),true);
 for(const [label,value,expected]of [['zero',0,true],['numeric-text','0',true],['real',0.5,false],['text','invalid',false],['blob',Buffer.from('0'),false],['unsafe-integer',9007199254740993n,false]] as const)await change('control Number/native '+label,()=>db.prepare('INSERT INTO mp_file_controls VALUES(?,?,?,0) ON CONFLICT(user_id,original_id) DO UPDATE SET generation=excluded.generation').run(uid,ref,value),expected);
 for(const [label,value,expected]of [['zero',0,true],['real',0.5,false],['text','false',false],['empty-blob',Buffer.alloc(0),false]] as const)await change('control cancellation truthiness '+label,()=>db.prepare('INSERT INTO mp_file_controls VALUES(?,?,0,?) ON CONFLICT(user_id,original_id) DO UPDATE SET cancelled=excluded.cancelled').run(uid,ref,value),expected);
 await change('nullable control present row retains Number(null) and false cancellation',()=>{db.exec('CREATE TEMP TABLE mp_file_controls(user_id TEXT,original_id TEXT,generation,cancelled)');db.prepare('INSERT INTO temp.mp_file_controls VALUES(?,?,NULL,NULL)').run(uid,ref);},true);
 await change('missing policy does not equal the original plan',()=>db.prepare('DELETE FROM mp_file_policy_bindings WHERE user_id=? AND original_id=?').run(uid,ref));
 await change('absent policy equals absent input policy',()=>{db.prepare('DELETE FROM mp_file_policy_bindings WHERE user_id=? AND original_id=?').run(uid,ref);patchTask(db,id,{policyPlanId:undefined});},true);
 for(const [label,value]of [['null',null],['integer',7],['real',0.5],['blob',Buffer.from('plan')]] as const)await change('policy presence and strict raw scalar '+label,()=>{db.exec('CREATE TEMP TABLE mp_file_policy_bindings(user_id TEXT,original_id TEXT,plan_id); INSERT INTO temp.mp_file_policy_bindings SELECT * FROM main.mp_file_policy_bindings');db.prepare('DELETE FROM temp.mp_file_policy_bindings WHERE user_id=? AND original_id=?').run(uid,ref);db.prepare('INSERT INTO temp.mp_file_policy_bindings VALUES(?,?,?)').run(uid,ref,value);patchTask(db,id,{policyPlanId:undefined});});
 await change('original locator missing',()=>db.prepare('DELETE FROM ig_originals WHERE user_id=? AND id=?').run(uid,ref));
 await change('generation committed file incarnation',()=>db.prepare('INSERT INTO ig_file_generations VALUES(?,?,?,1) ON CONFLICT(user_id,source_id,external_id) DO UPDATE SET generation=generation+1').run(uid,'same-source',a.externalId));
 await change('missing generation relation is not zero',()=>{db.exec('CREATE TEMP TABLE pd_captures AS SELECT * FROM main.pd_captures');db.prepare('DELETE FROM temp.pd_captures WHERE user_id=? AND id=?').run(uid,a.captureId);});
 await change('native generation overflow remains false',()=>{db.exec('CREATE TEMP TABLE ig_file_generations(user_id TEXT,source_id TEXT,external_id TEXT,generation)');db.prepare('INSERT INTO temp.ig_file_generations VALUES(?,?,?,?)').run(uid,'same-source',a.externalId,9007199254740993n);});
 await t.test('current native prepare error is false; repaired schema and warm statement recover',()=>{temporary(db,()=>{db.exec('ALTER TABLE ig_file_generations RENAME TO generated_current_saved_generations');assert.equal(f.engine.isCurrentInputAuthority(id),false,'Missing shared generation schema fails closed for A');assert.equal(f.current(b),false,'Missing shared generation schema fails closed for B');});check(true);});
 await t.test('own transaction mutation and rollback retain exact current visibility',()=>{db.exec('BEGIN');try{db.prepare('UPDATE mp_state SET deleted=1 WHERE user_id=?').run(uid);check(false);}finally{db.exec('ROLLBACK');}check(true);});
 await t.test('independent connection changes are fresh; overlap is bounded to this checkpoint',()=>{
  const other=f.other(),obs=observe(db);try{
   other.prepare('UPDATE mp_state SET deleted=1 WHERE user_id=?').run(uid);check(false);other.prepare('UPDATE mp_state SET deleted=0 WHERE user_id=?').run(uid);check(true);
   let changed=false;obs.start(name=>{if(!changed&&(name==='control'||name==='facts-projection')){changed=true;other.prepare('INSERT INTO ig_file_generations VALUES(?,?,?,1) ON CONFLICT(user_id,source_id,external_id) DO UPDATE SET generation=generation+1').run(uid,'same-source',a.externalId);}});
   let overlap:boolean,c:Counts;try{overlap=f.engine.isCurrentInputAuthority(id);}finally{c=obs.stop();}
   assert.equal(changed,true);assert.equal(overlap!,Boolean(c!.get['facts-projection']),'Only the accepted same-checkpoint generation observation differs');check(false);
   other.prepare('DELETE FROM ig_file_generations WHERE user_id=? AND source_id=? AND external_id=?').run(uid,'same-source',a.externalId);check(true);
  }finally{obs.restore();other.close();}
 });
 await change('capture-source generation uses @capture identity',()=>{db.prepare("UPDATE pd_captures SET json=json_set(json,'$.source','screen') WHERE user_id=? AND id=?").run(uid,a.captureId);db.prepare('INSERT INTO ig_file_generations VALUES(?,?,?,1) ON CONFLICT(user_id,source_id,external_id) DO UPDATE SET generation=generation+1').run(uid,'@capture',a.captureId);});
 await change('invalid processing input schema is false',()=>patchTask(db,id,{fileGeneration:-1}));
 await change('optional file model reference is still checked',()=>patchTask(db,id,{fileModel:{reference:{kind:'personal',id:'generated-missing'},fingerprint:'0'.repeat(64)}}));
 await change('optional parent must still be current',()=>patchTask(db,id,{parentTaskId:'0'.repeat(64)}));
 await change('optional processing intent remains owner-bound',()=>patchTask(db,id,{intentTaskId:'0'.repeat(64)}));
 await t.test('existing DELETE read transaction blocks outside commits rather than promising a newer snapshot',()=>{
  const other=f.other();try{other.exec('PRAGMA busy_timeout=0');db.exec('BEGIN');try{check(true);assert.equal(db.isTransaction,true);assert.throws(()=>other.prepare('UPDATE mp_state SET deleted=1 WHERE user_id=?').run(uid),/locked|busy/);check(true);}finally{db.exec('ROLLBACK');}check(true);}finally{other.close();}
 });
 await t.test('short-circuit native error remains false and does not change later repaired success',()=>{
  temporary(db,()=>{db.prepare('UPDATE mp_state SET deleted=1 WHERE user_id=?').run(uid);db.exec('CREATE TEMP TABLE ig_file_generations(user_id TEXT)');assert.equal(f.engine.isCurrentInputAuthority(id),false);});check(true);
 });
 await t.test('same-owner archive replays exact captured rows while another owner remains independent',async()=>{
  const obs=observe(db);let witness;try{let c:Counts|undefined;witness=await archiveReadSet(uid,async()=>{obs.start();try{return f.engine.isCurrentInputAuthority(id);}finally{c=obs.stop();}});assert.equal(witness.value,true);assertFactCounts(c!,1,true);assert.equal(witness.current(),true);
   temporary(db,()=>{db.prepare("UPDATE pd_captures SET json=json_set(json,'$.windowTitle','changed observed row') WHERE user_id=? AND id=?").run(uid,a.captureId);assert.equal(f.engine.isCurrentInputAuthority(id),true);assert.equal(witness.current(),false,'Full c.json was an original witness even if authorization remains true');});
   temporary(db,()=>{db.prepare("UPDATE pd_captures SET json=json_set(json,'$.windowTitle','other owner') WHERE user_id=? AND id=?").run(b.actor.userId,b.captureId);assert.equal(witness.current(),true);});
   db.exec('BEGIN');try{assert.equal(witness.current(),true,'Publication-time replay uses original closures inside the caller transaction');}finally{db.exec('ROLLBACK');}
  }finally{obs.restore();}
 });
 await t.test('archive earlyfalse does not acquire witnesses of skipped policy or generation facts',async()=>{
  let pending:ReturnType<typeof archiveReadSet<boolean>>|undefined;
  temporary(db,()=>{db.prepare('UPDATE mp_state SET deleted=1 WHERE user_id=?').run(uid);pending=archiveReadSet(uid,async()=>f.engine.isCurrentInputAuthority(id));});
  // The synchronous read has finished and invalid state is restored before
  // awaiting the witness object; no background tick can retire this fixture.
  const witness=await pending!;assert.equal(witness.value,false);
  temporary(db,()=>{db.prepare('UPDATE mp_state SET deleted=1 WHERE user_id=?').run(uid);db.prepare('DELETE FROM mp_file_policy_bindings WHERE user_id=? AND original_id=?').run(uid,ref);db.prepare('INSERT INTO ig_file_generations VALUES(?,?,?,1) ON CONFLICT(user_id,source_id,external_id) DO UPDATE SET generation=generation+1').run(uid,'same-source',a.externalId);assert.equal(witness.current(),true);});
 });
 await t.test('other-owner archive scope does not capture A facts or force A legacy reads',async()=>{
  const obs=observe(db);try{let c:Counts|undefined;const witness=await archiveReadSet(b.actor.userId,async()=>{obs.start();try{return f.engine.isCurrentInputAuthority(id);}finally{c=obs.stop();}});assert.equal(witness.value,true);assertFactCounts(c!,1);temporary(db,()=>{db.prepare('UPDATE mp_state SET deleted=1 WHERE user_id=?').run(uid);assert.equal(witness.current(),true);});}finally{obs.restore();}
 });
 await f.finish();
 await t.test('normal app restart preserves fresh current checks and physical publication for both owners',async()=>{
  // Physical image work and its fixed pin disposers settle before normal app
  // shutdown. Same-DatabaseSync cache invalidation has separate native consumers.
  const oldEngine=f.engine,oldDb=db,oldCaptures=new Set(f.subjects.map(subject=>subject.captureId)),oldTasks=new Set(ids.flatMap(value=>[value.pipeline,value.understanding])),oldHeld=new Set(f.held.values());
  await f.f.restart();
  assert.equal(oldDb.isOpen,false);assert.throws(()=>oldEngine.isCurrentInputAuthority(id),{code:'ERR_INVALID_STATE'});
  const nextEngine=f.f.host.execution!.engine,nextDb=nextEngine.store.db;
  assert.notEqual(nextEngine,oldEngine);assert.notEqual(nextDb,oldDb);assert.equal(nextDb.isOpen,true);
  const nextSubjects:Subject[]=[];
  for(const actor of [a.actor,b.actor]){
   const capture=await f.f.uploadBytes(actor.token,'same-current-image-after-restart',await png(),'image/png');
   assert.equal(oldCaptures.has(capture.id),false,'Restart must admit a new capture, not reuse completed work');
   nextSubjects.push({actor,captureId:capture.id,ref:capture.original.ref,externalId:'same-current-image-after-restart'});
  }
  assert.equal(nextSubjects[0].captureId,nextSubjects[1].captureId,'Restart retains colliding public identities across owners');
  const heldKeys=nextSubjects.map((subject,index)=>(index===0?'a:':'b:')+subject.captureId);
  await waitForScopedState(()=>heldKeys.every(key=>{const held=f.held.get(key);return !!held&&!oldHeld.has(held);}),()=>'Restarted A/B images did not reach their own held second model requests',12000);
  const nextIds=nextSubjects.map(subject=>{
   const rows=nextDb.prepare("SELECT e.id FROM execution_steps e JOIN user_tasks u ON u.task_id=e.id AND u.user_id=e.user_id WHERE e.user_id=? AND e.kind='processing.pipeline' AND json_extract(u.input,'$.originalRef')=? AND e.state IN('running','waiting')").all(subject.actor.userId,subject.ref);
   assert.equal(rows.length,1,'Exactly one newly admitted held pipeline per owner');const taskId=String(rows[0].id);assert.equal(oldTasks.has(taskId),false);return taskId;
  });
  const nextCurrent=(index:number)=>nextEngine.isCurrentInputAuthority(nextIds[index]);
  assert.equal(nextCurrent(0),true);assert.equal(nextCurrent(1),true);
  const other=new DatabaseSync(join(f.f.directory,'mote.sqlite'));
  try{
   const previous=other.prepare('SELECT deleted FROM mp_state WHERE user_id=?').get(a.actor.userId)!;assert.equal(previous.deleted,0);
   assert.equal(other.prepare('UPDATE mp_state SET deleted=1 WHERE user_id=?').run(a.actor.userId).changes,1);
   try{assert.equal(nextCurrent(0),false);assert.equal(nextCurrent(1),true);}
   finally{assert.equal(other.prepare('UPDATE mp_state SET deleted=? WHERE user_id=?').run(previous.deleted,a.actor.userId).changes,1);}
   assert.equal(nextCurrent(0),true);assert.equal(nextCurrent(1),true);
  }finally{other.close();}
  for(const key of heldKeys)f.held.get(key)!.release();
  for(const subject of nextSubjects){await done(f.f,subject.actor.token,subject.captureId);assert.ok((await f.f.checked(subject.actor.token,'/api/images/'+subject.captureId)).products.length>0);}
  for(const taskId of nextIds)assert.equal(nextEngine.get(taskId)!.state,'succeeded');
 });
});

if(mode===undefined)test('actual document attachment current preserves every retained lineage predicate and late publication fence',async t=>{
 const f=await fixture(t,true),{db,subjects:[a,b],ids}=f,uid=a.actor.userId,id=ids[0].pipeline,ref=a.ref.slice(9);
 assert.ok(a.parentId&&a.fileId);assert.equal(f.engine.isCurrentInputAuthority(id),true);assert.equal(f.current(b),true);
 const mutate=async(name:string,sql:string,...args:SQLInputValue[])=>t.test(name,()=>temporary(db,()=>{db.prepare(sql).run(...args);assert.equal(f.engine.isCurrentInputAuthority(id),false,name);assert.equal(f.current(b),true);}));
 await mutate('attachment link missing','DELETE FROM ig_attachment_links WHERE user_id=? AND capture_id=?',uid,a.captureId);
 await mutate('retained archive link missing','DELETE FROM ig_archive_links WHERE user_id=? AND capture_id=? AND file_id=?',uid,a.parentId!,a.fileId!);
 await mutate('parent head replaced','DELETE FROM pd_source_heads WHERE user_id=? AND capture_id=?',uid,a.parentId!);
 await mutate('parent deleted flag',"UPDATE pd_captures SET json=json_set(json,'$.provenance.deleted',1) WHERE user_id=? AND id=?",uid,a.parentId!);
 await mutate('parent privacy excluded',"UPDATE pd_captures SET json=json_set(json,'$.privacy.excluded',1) WHERE user_id=? AND id=?",uid,a.parentId!);
 await mutate('source disabled',"UPDATE pd_sources SET json=json_set(json,'$.enabled',0) WHERE user_id=? AND id='same-source'",uid);
 await mutate('parent itself an attachment',"UPDATE pd_captures SET json=json_set(json,'$.provenance.document.attachmentOf',json('{}')) WHERE user_id=? AND id=?",uid,a.parentId!);
 await mutate('parent no longer declares file',"UPDATE pd_captures SET json=json_set(json,'$.provenance.document.attachments',json('[]')) WHERE user_id=? AND id=?",uid,a.parentId!);
 await mutate('child parent declaration mismatch',"UPDATE pd_captures SET json=json_set(json,'$.provenance.document.attachmentOf.captureId',?) WHERE user_id=? AND id=?",randomUUID(),uid,a.captureId);
 await mutate('child file declaration mismatch',"UPDATE pd_captures SET json=json_set(json,'$.provenance.document.attachmentOf.fileId',?) WHERE user_id=? AND id=?",randomUUID(),uid,a.captureId);
 await mutate('retained size mismatch',"UPDATE ig_archive_files SET json=json_set(json,'$.sizeBytes',999) WHERE user_id=? AND id=?",uid,a.fileId!);
 await mutate('retained MIME mismatch',"UPDATE ig_archive_files SET json=json_set(json,'$.mimeType','image/jpeg') WHERE user_id=? AND id=?",uid,a.fileId!);
 await t.test('original source mismatch and retained hash mismatch',()=>{
  for(const kind of ['source','hash'])temporary(db,()=>{if(kind==='source'){db.exec('CREATE TEMP TABLE ig_originals AS SELECT * FROM main.ig_originals');db.prepare('UPDATE temp.ig_originals SET source_id=? WHERE user_id=? AND id=?').run('generated-wrong-source',uid,ref);}else{db.exec('CREATE TEMP TABLE ig_archive_files AS SELECT * FROM main.ig_archive_files');db.prepare('UPDATE temp.ig_archive_files SET hash=? WHERE user_id=? AND id=?').run('0'.repeat(64),uid,a.fileId!);}assert.equal(f.engine.isCurrentInputAuthority(id),false);assert.equal(f.current(b),true);});
 });
 await mutate('binding incarnation changed','UPDATE ig_attachment_links SET binding_id=? WHERE user_id=? AND capture_id=?',randomUUID(),uid,a.captureId);
 await t.test('raw locator String conversion cannot mint a different capture',()=>{db.exec('PRAGMA foreign_keys=OFF');try{temporary(db,()=>{db.prepare('UPDATE ig_originals SET capture_id=? WHERE user_id=? AND id=?').run(Buffer.from('123'),uid,ref);assert.equal(f.engine.isCurrentInputAuthority(id),false);assert.equal(f.current(b),true);});}finally{db.exec('PRAGMA foreign_keys=ON');}});
 await t.test('archive attachment full c.json witness and binding ID are not synthesized',async()=>{
  const witness=await archiveReadSet(uid,async()=>f.engine.isCurrentInputAuthority(id));assert.equal(witness.value,true);assert.equal(witness.current(),true);
  temporary(db,()=>{db.prepare("UPDATE pd_captures SET json=json_set(json,'$.windowTitle','Generated observed attachment field') WHERE user_id=? AND id=?").run(uid,a.captureId);assert.equal(f.engine.isCurrentInputAuthority(id),true);assert.equal(witness.current(),false);});
  temporary(db,()=>{db.prepare('UPDATE ig_attachment_links SET binding_id=? WHERE user_id=? AND capture_id=?').run(randomUUID(),uid,a.captureId);assert.equal(witness.current(),false);});
 });
 // Real HTTP change while original model transport is held: the subsequent
 // input checks/publication must reject it; B's physical completion survives.
 await f.f.checked(a.actor.token,'/api/sources/same-source','PATCH',{enabled:false});assert.equal(f.engine.isCurrentInputAuthority(id),false);
 for(const paused of f.held.values())paused.release();
 await done(f.f,b.actor.token,b.captureId);
 await waitForScopedState(()=>!['waiting','running'].includes(f.engine.get(id)!.state),()=>'Retired attachment coordinator did not settle',12000);
 assert.notEqual(f.engine.get(id)!.state,'succeeded');
 assert.equal(db.prepare('SELECT count(*) n FROM mp_publications WHERE user_id=? AND original_id=?').get(uid,ref)!.n,0);
 assert.equal(db.prepare('SELECT count(*) n FROM mp_derivations WHERE user_id=? AND original_id=?').get(uid,ref)!.n,0);
 assert.equal((await f.f.request(a.actor.token,'/api/files/'+a.captureId)).statusCode,404);
 assert.ok((await f.f.checked(b.actor.token,'/api/images/'+b.captureId)).products.length>0);
});

if(mode===undefined)test('real nonimage review keeps allowCancelled and a publication callback still rolls back retired output',async t=>{
 const pause=gate();let entered=false;
 const server=createServer((req,res)=>{void(async()=>{for await(const _ of req){}entered=true;await pause.wait;writeMessagesResponse(res,{stage:1,text:JSON.stringify({answer:JSON.stringify({suggestions:[]}),citationIds:[]})});})().catch(()=>res.destroy());});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>{pause.release();server.closeAllConnections();return new Promise<void>(resolve=>server.close(()=>resolve()));});
 const address=server.address();assert.ok(address&&typeof address!=='string');const f=await scopedFilesFixture(t),db=f.host.execution!.engine.store.db,engine=f.host.execution!.engine;
 const capture=await f.upload(f.a.token,'current-text','GENERATED_CURRENT_TEXT'),ref=capture.original.ref;
 const submitted=await f.checked(f.a.token,'/api/processing','POST',{originalRef:ref,operationId:'generated-current-text'});
 await waitForScopedState(()=>engine.get(submitted.id)?.state==='succeeded',()=>'Real text pipeline did not publish',12000);
 await f.checked(f.a.token,'/api/configuration/models','PUT',{revision:(await f.checked(f.a.token,'/api/configuration')).revision,value:{profiles:[{id:'review',name:'Generated current review',settings:{...defaultModelSettings(),provider:'custom',protocol:'anthropic-messages',baseUrl:'http://127.0.0.1:'+address.port+'/v1',model:'generated-current-review',apiKey:'GENERATED_REVIEW'}}],selections:{file:{kind:'personal',id:'review'}}}});
 const proposed=await f.checked(f.a.token,'/api/files/'+capture.id+'/reviews','POST',{operationId:'generated-current-review',kind:'terms'});
 await waitForScopedState(()=>entered,()=>'Real review model did not enter',12000);assert.equal(engine.isCurrentInputAuthority(proposed.taskId),true);
 temporary(db,()=>{db.prepare('INSERT INTO mp_file_controls VALUES(?,?,0,1) ON CONFLICT(user_id,original_id) DO UPDATE SET cancelled=1').run(f.a.userId,ref.slice(9));assert.equal(engine.isCurrentInputAuthority(proposed.taskId),true,'Review uses the original allowCancelled=true current callback');});
 temporary(db,()=>{db.prepare('INSERT INTO mp_file_controls VALUES(?,?,1,1) ON CONFLICT(user_id,original_id) DO UPDATE SET generation=1,cancelled=1').run(f.a.userId,ref.slice(9));assert.equal(engine.isCurrentInputAuthority(proposed.taskId),false,'allowCancelled cannot bypass incarnation generation');});
 await f.checked(f.a.token,'/api/tasks/'+proposed.taskId+'/cancel','POST',{});pause.release();
 await waitForScopedState(()=>!engine.isActiveStep(proposed.taskId),()=>'Review transport cleanup did not settle',12000);
 assert.notEqual(engine.get(proposed.taskId)!.state,'succeeded');
 // A separate real text pipeline exercises the existing synchronous material
 // listener inside its production grant transaction, including postcallback.
 let callbacks=0,nextRef='';const off=f.host.processing!.onMaterialPublished((run,_material,origin)=>{if(origin.originalRef!==nextRef)return;callbacks++;db.prepare('UPDATE mp_state SET generation=generation+1 WHERE user_id=?').run(run.context.userId);});t.after(off);
 const next=await f.upload(f.a.token,'current-postcommit','GENERATED_CURRENT_POSTCOMMIT');nextRef=next.original.ref;
 const before=db.prepare('SELECT generation FROM mp_state WHERE user_id=?').get(f.a.userId)!.generation,task=await f.checked(f.a.token,'/api/processing','POST',{originalRef:nextRef,operationId:'generated-current-postcommit'});
 await waitForScopedState(()=>!['waiting','running'].includes(engine.get(task.id)!.state),()=>'Postcallback retirement did not settle',12000);
 assert.ok(callbacks>0);assert.notEqual(engine.get(task.id)!.state,'succeeded');assert.equal(db.prepare('SELECT generation FROM mp_state WHERE user_id=?').get(f.a.userId)!.generation,before,'failed grant transaction rolls back its generation change');
 assert.equal(db.prepare('SELECT count(*) n FROM mp_publications WHERE user_id=? AND original_id=?').get(f.a.userId,nextRef.slice(9))!.n,0,'No publication survives failed postcallback authority');
});

if(mode)test('fixed100 real image-understanding authority calls in five blocks20',async t=>{
 const f=await fixture(t),id=f.ids[0].understanding,db=f.db;
 const connection={journalMode:db.prepare('PRAGMA journal_mode').get()!.journal_mode,synchronous:db.prepare('PRAGMA synchronous').get()!.synchronous,isTransaction:db.isTransaction};assert.equal(connection.isTransaction,false);
 assert.equal(f.engine.get(id)!.kind,'processing.image-understanding');assert.equal(f.engine.isCurrentInputAuthority(id),true);
 // Only count mode installs a wrapper. Plain wall/user/system excludes it.
 const observer=mode==='count'?observe(db):undefined,blocks:unknown[]=[];
 try{
  for(let block=0;block<5;block++){
   observer?.start();const cpu=process.cpuUsage(),started=performance.now();for(let i=0;i<20;i++)assert.equal(f.engine.isCurrentInputAuthority(id),true);
   const wallMs=performance.now()-started,used=process.cpuUsage(cpu),counts=observer?.stop();
   if(counts){assertFactCounts(counts,40,false,20);assert.equal(counts.get['task-valid'],40);assert.equal(counts.get.account,60);assert.equal(counts.get.configuration,20);assert.equal(counts.get.credential,20);assert.equal(counts.get.model,20);assert.equal(counts.get.engine,20);assert.equal(counts.get['understanding-parent'],20);assert.equal(counts.get['parent-state'],40);}
   blocks.push({block,calls:20,wallMs,userMs:used.user/1000,systemMs:used.system/1000,...(counts?{counts}:{})});
  }
 }finally{observer?.restore();}
 assert.equal(f.current(f.subjects[1]),true);await f.finish();
 t.diagnostic(JSON.stringify({fixture:'processing-current-public-image-understanding',mode,connection,totalCalls:100,blocks,nativeObserverInstalled:mode==='count',generatedOwners:2,realModelChildren:true,scope:'local composition only; not full-load or fixed-cause proof'}));
});

if(mode===undefined)test('HTTP forget and allow-again bind identical bytes to a new input incarnation while old model is held',async t=>{
 const f=await fixture(t),{subjects:[a,b],db,ids}=f,oldId=ids[0].pipeline,old=f.engine.get(oldId)!,oldInput=old.input,oldHeld=f.held.get('a:'+a.captureId)!;
 const detail=await f.f.checked(a.actor.token,'/api/files/'+a.captureId),removed=await f.f.checked(a.actor.token,'/api/files/'+a.captureId,'DELETE',{operationId:randomUUID(),originalGeneration:detail.originalGeneration});
 assert.equal(f.engine.isCurrentInputAuthority(oldId),false);assert.equal(f.current(b),true);
 await f.f.checked(a.actor.token,'/api/files/'+a.captureId+'/allow-again','POST',removed.decision);
 f.forgetProviderConversation(a);
 const reimported=await f.f.uploadBytes(a.actor.token,a.externalId,await png(),'image/png');assert.equal(reimported.id,a.captureId);assert.equal(reimported.original.ref,a.ref);
 let nextId='';await waitForScopedState(()=>{const row=db.prepare("SELECT e.id FROM execution_steps e JOIN user_tasks u ON u.task_id=e.id AND u.user_id=e.user_id WHERE e.user_id=? AND e.kind='processing.pipeline' AND json_extract(u.input,'$.originalRef')=? AND e.id<>? AND e.state IN('running','waiting')").get(a.actor.userId,a.ref,oldId);nextId=row?String(row.id):'';return !!nextId;},()=>'New original did not receive a real coordinator',12000);
 const next=f.engine.get(nextId)!;assert.ok(Number(next.input.originalGeneration??0)>Number(oldInput.originalGeneration??0));assert.notEqual(next.ownership!.grantId,old.ownership!.grantId);assert.equal(f.engine.isCurrentInputAuthority(oldId),false);assert.equal(f.engine.isCurrentInputAuthority(nextId),true);
 oldHeld.release();await waitForScopedState(()=>f.held.get('a:'+a.captureId)!==oldHeld,()=>'New incarnation did not reach its own pixel-reading model call',12000);
 assert.equal(f.engine.isCurrentInputAuthority(oldId),false);assert.notEqual(f.engine.get(oldId)!.state,'succeeded');assert.equal(f.engine.isCurrentInputAuthority(nextId),true);
 assert.deepEqual((await f.f.checked(a.actor.token,'/api/images/'+a.captureId)).products,[],'Retired physical response cannot publish into identical replacement IDs');
 await f.finish();assert.equal(f.engine.get(nextId)!.state,'succeeded');
});
