import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {fixture} from './fixtures/scoped-actions.js';
import {defaultProcessingSettings} from '../src/scope/processing-schema.js';

type Fixture=Awaited<ReturnType<typeof fixture>>;
const at='2026-10-16T00:00:00Z';
async function setup(f:Fixture){const view=await f.ok(f.a.token,'/api/configuration');await f.ok(f.a.token,'/api/configuration/processing','PUT',{revision:view.revision,value:{...defaultProcessingSettings(),automatic:false,understandingEnabled:false}});}
const capture=(source='screen',redacted=false)=>({id:randomUUID(),deviceId:'same-device',deviceName:'Generated device',platform:'import',capturedAt:at,durationMs:0,source,appId:'generated.todo',appName:'Generated task evidence',windowTitle:'Generated original',ocrText:'GENERATED_PRIVATE_TASK_ORIGINAL',privacy:{excluded:false,redacted,mode:'none',collection:'content'}});
async function raw(f:Fixture,source='screen',redacted=false){const value=capture(source,redacted);await f.ok(f.a.token,'/api/ingress/sources/same-source/captures','POST',{batchId:value.id,items:[value]});return value.id;}
async function source(f:Fixture,id:string,retention='snapshot'){return f.ok(f.a.token,'/api/ingress/sources','POST',{id,name:'Generated '+id,kind:'custom',deviceId:'same-device',platform:'import',retention});}
async function item(f:Fixture,sourceId:string,externalId:string,revision='v1',options:{layer?:string;deleted?:boolean}={}){const value={externalId,revision,observedAt:at,kind:'file',layer:options.layer??'original',title:'Generated task source item',text:options.layer==='reference'||options.deleted?'':'GENERATED_PRIVATE_TASK_ORIGINAL',...(options.deleted?{deleted:true}:{}),...(options.layer==='reference'?{uri:'file:///generated/reference.txt'}:{})};const receipt=await f.ok(f.a.token,'/api/ingress/sources/'+sourceId+'/items','POST',{batchId:externalId+':'+revision,items:[value]});return receipt.captures[0].id as string;}
async function archive(f:Fixture){const sourceId='generated-task-archive';await source(f,sourceId,'archive');const bytes=Buffer.from('GENERATED_ARCHIVE_TASK_ORIGINAL'),hash=createHash('sha256').update(bytes).digest('hex'),upload=await f.ok(f.a.token,'/api/ingress/sources/'+sourceId+'/uploads','POST',{batchId:'archive-task',revision:{sourceId,item:{externalId:'archive',revision:'v1',observedAt:at,kind:'file',layer:'original',title:'Generated archived task source',text:'',mimeType:'text/plain'},sizeBytes:bytes.length,sha256:hash,relativePath:'generated.txt'}});await f.ok(f.a.token,'/api/ingress/uploads/'+upload.id+'/parts/0','PUT',{bytes:bytes.toString('base64'),checksum:hash});return (await f.ok(f.a.token,'/api/ingress/uploads/'+upload.id+'/commit','POST',{})).captures[0].id as string;}
async function canonical(f:Fixture,originalId:string,externalId:string){
 const context=await f.node.authority.authenticate(f.a.token),materialId='mat_'+createHash('sha256').update(JSON.stringify(['same-source',externalId])).digest('hex');
 f.node.ingress.bindSource(context,['same-source'],()=>{}).publishMaterial({id:materialId,kind:'document',schemaVersion:1,title:'Generated task formal Material',origin:{sourceId:'same-source',externalId},blocks:[{id:'text',kind:'text',format:'plain',text:'GENERATED_PRIVATE_TASK_ORIGINAL',memberIds:['original']}],members:[{id:'original',kind:'capture',ref:'capture:'+originalId}],coverage:{state:'complete'},fidelity:{state:'lossless'},retention:{original:'retained',policy:'keep'}});
 const reader=f.node.ask!.bind(context,{assertCurrent:()=>f.node.authority.assert(context)}).reader(),history=await reader.logicalHistory({sourceId:'same-source',externalId:'material-original'});const selected=history.items.find(item=>item.provenance?.externalId===materialId);assert.ok(selected);return selected.id;
}
async function plain(f:Fixture){const response=await f.request(f.a.token,'/api/todos','POST',{title:'Generated editable task'});assert.equal(response.statusCode,201,response.body);return response.json();}
async function unavailable(f:Fixture,id:string){const created=await f.request(f.a.token,'/api/todos','POST',{title:'Generated unavailable reference',evidenceIds:[id]});assert.equal(created.statusCode,404,created.body);const task=await plain(f),updated=await f.request(f.a.token,'/api/todos/'+task.id,'PATCH',{version:task.version,evidenceIds:[id]});assert.equal(updated.statusCode,404,updated.body);const page=await f.ok(f.a.token,'/api/todos');assert.equal(page.items.find((item:any)=>item.id===task.id).version,task.version);}

test('manual Todo create/update accepts owned raw screen, file, reference, Material-covered original and archive IDs without processing',async t=>{
 const f=await fixture(t);await setup(f);const screen=await raw(f),file=await raw(f,'file');await source(f,'generated-task-reference','reference');const reference=await item(f,'generated-task-reference','reference','v1',{layer:'reference'}),original=await item(f,'same-source','material-original'),material=await canonical(f,original,'manual-task-material'),archived=await archive(f),references={screen,file,reference,original,material,archived};
 const before=f.read(db=>Number(db.prepare('SELECT count(*) n FROM execution_steps').get()!.n));
 for(const [label,id] of Object.entries(references)){
  const input={id:randomUUID(),title:'Generated task '+label,evidenceIds:[id]},response=await f.request(f.a.token,'/api/todos','POST',input);assert.equal(response.statusCode,201,response.body);const task=response.json();assert.deepEqual(task.evidenceIds,[id]);assert.equal(task.dueAt,null);assert.deepEqual((await f.request(f.a.token,'/api/todos','POST',input)).json(),task);assert.ok(!response.body.includes('GENERATED_PRIVATE_TASK_ORIGINAL'));
  const updated=await f.ok(f.a.token,'/api/todos/'+task.id,'PATCH',{version:task.version,evidenceIds:[id],status:'completed'});assert.equal(updated.version,2);assert.equal(updated.status,'completed');assert.equal((await f.request(f.a.token,'/api/todos/'+task.id,'PATCH',{version:task.version,evidenceIds:[id]})).statusCode,409);
  assert.equal((await f.request(f.b.token,'/api/todos','POST',{title:'Generated foreign task',evidenceIds:[id]})).statusCode,404);
 }
 assert.equal(f.read(db=>Number(db.prepare('SELECT count(*) n FROM execution_steps').get()!.n)),before);
 await f.restart();const task=await plain(f),updated=await f.ok(f.a.token,'/api/todos/'+task.id,'PATCH',{version:task.version,evidenceIds:Object.values(references)});assert.deepEqual(updated.evidenceIds,Object.values(references));
});

for(const control of ['disabled-source','deleted-source','deleted-capture','superseded','deleted-revision','redacted'])test(`manual Todo evidence rejects ${control} for create and update`,async t=>{
 const f=await fixture(t);await setup(f);let id:string;
 if(control==='superseded'||control==='deleted-revision'){id=await item(f,'same-source','changing');const current=await item(f,'same-source','changing','v2',{deleted:control==='deleted-revision'});if(control==='deleted-revision')id=current;}
 else{id=await raw(f,'screen',control==='redacted');if(control==='disabled-source')await f.ok(f.a.token,'/api/sources/same-source','PATCH',{enabled:false});if(control==='deleted-source')await f.ok(f.a.token,'/api/sources/same-source','DELETE');if(control==='deleted-capture')await f.ok(f.a.token,'/api/captures/'+id,'DELETE');}
 await unavailable(f,id);
});

test('excluded captures cannot enter the Todo evidence store and duplicate evidence IDs remain invalid',async t=>{
 const f=await fixture(t);await setup(f);const excluded={...capture(),privacy:{excluded:true,redacted:false,mode:'none',collection:'content'}};assert.equal((await f.request(f.a.token,'/api/ingress/sources/same-source/captures','POST',{batchId:'excluded',items:[excluded]})).statusCode,400);await unavailable(f,excluded.id);
 const id=await raw(f),create=await f.request(f.a.token,'/api/todos','POST',{title:'Generated duplicate proof',evidenceIds:[id,id]});assert.equal(create.statusCode,400);const task=await plain(f);assert.equal((await f.request(f.a.token,'/api/todos/'+task.id,'PATCH',{version:task.version,evidenceIds:[id,id]})).statusCode,400);
});

test('Todo evidence operations fence stale services and HTTP after account disable while B remains private',async t=>{
 const f=await fixture(t);await setup(f);const id=await raw(f),context=await f.node.authority.authenticate(f.a.token),held=f.node.todos!.forUser(context),task=held.create({title:'Generated held task',evidenceIds:[id]});
 await f.ok(f.admin.token,'/api/admin/accounts/'+f.a.userId,'PATCH',{disabled:true});assert.throws(()=>held.create({title:'Generated stale create',evidenceIds:[id]}),{code:'invalid_identity'});assert.throws(()=>held.update(task.id,{version:task.version,evidenceIds:[id]}),{code:'invalid_identity'});assert.equal((await f.request(f.a.token,'/api/todos','POST',{title:'Generated stale HTTP',evidenceIds:[id]})).statusCode,401);assert.equal((await f.request(f.b.token,'/api/todos','POST',{title:'Generated foreign task',evidenceIds:[id]})).statusCode,404);assert.deepEqual((await f.ok(f.b.token,'/api/todos')).items,[]);
});


test('Todo canonical Material references keep current-version validation while their retained raw original remains referenceable',async t=>{
 const f=await fixture(t);await setup(f);const original=await item(f,'same-source','material-original'),id=await canonical(f,original,'revision-task-material'),anchor=f.read(db=>db.prepare('SELECT material_id,material_revision FROM mm_evidence WHERE user_id=? AND id=?').get(f.a.userId,id)!),draft=f.read(db=>JSON.parse(String(db.prepare('SELECT json FROM pd_material_versions WHERE user_id=? AND material_id=? AND revision=?').get(f.a.userId,anchor.material_id,anchor.material_revision)!.json)));
 const accepted=await f.request(f.a.token,'/api/todos','POST',{title:'Generated current canonical proof',evidenceIds:[id]});assert.equal(accepted.statusCode,201,accepted.body);
 draft.blocks[0].text='GENERATED_CURRENT_MATERIAL_REVISION';const context=await f.node.authority.authenticate(f.a.token);f.node.ingress.bindSource(context,['same-source'],()=>{}).publishMaterial(draft,String(anchor.material_revision));
 await unavailable(f,id);const rawReference=await f.request(f.a.token,'/api/todos','POST',{title:'Generated retained original reference',evidenceIds:[original]});assert.equal(rawReference.statusCode,201,rawReference.body);
});
