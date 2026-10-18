import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {DatabaseSync} from 'node:sqlite';
import {rmSync} from 'node:fs';
import {join} from 'node:path';
import {defaultMemorySettings} from '../src/scope/memory-schema.js';
import {scopedFilesFixture} from './fixtures/scoped-files.js';
import {waitForScopedState} from './fixtures/scoped-process.js';

type Fixture=Awaited<ReturnType<typeof scopedFilesFixture>>;
const captureId=(source:string,external:string,revision:string)=>{const hash=createHash('sha256').update(JSON.stringify([source,external,revision])).digest('hex');return hash.slice(0,8)+'-'+hash.slice(8,12)+'-5'+hash.slice(13,16)+'-a'+hash.slice(17,20)+'-'+hash.slice(20,32);};
async function exportPortable(f:Fixture){
 const id=randomUUID();await f.checked(f.a.token,'/api/portable/exports','POST',{operationId:id});
 await waitForScopedState(async()=>{const state=await f.checked(f.a.token,'/api/portable/exports/'+id);if(state.state==='failed')assert.fail(JSON.stringify(state));return state.state==='completed';},()=>'generated head export missing',15000);
 return f.checked(f.a.token,'/api/portable/exports/'+id+'/content');
}
async function mergePortable(f:Fixture,archive:unknown){
 const id=randomUUID();await f.checked(f.a.token,'/api/portable/imports','POST',{operationId:id,archive});
 await waitForScopedState(async()=>(await f.checked(f.a.token,'/api/portable/imports/'+id)).state!=='working',()=>'generated head restore missing',15000);
 return f.checked(f.a.token,'/api/portable/imports/'+id);
}
async function noAutomaticMemory(f:Fixture){const view=await f.checked(f.a.token,'/api/configuration');await f.checked(f.a.token,'/api/configuration/memory','PUT',{revision:view.revision,value:{...defaultMemorySettings(),automatic:false}});}

test('a retained file head survives UUID-sorted personal restore, older archive merge and restart with its original evidence',async t=>{
 const f=await scopedFilesFixture(t);await noAutomaticMemory(f);
 const external='restore-history',firstRevision='earlier-file',firstId=captureId('same-source',external,firstRevision);let secondRevision='';
 for(let n=0;!secondRevision;n++)if(captureId('same-source',external,'later-file-'+n)<firstId)secondRevision='later-file-'+n;
 const upload=async(revision:string,previousRevision:string|null,observedAt:string,text:string,deleted=false)=>{
  const bytes=Buffer.from(text),hash=createHash('sha256').update(bytes).digest('hex'),value=await f.checked(f.a.token,'/api/ingress/sources/same-source/uploads','POST',{batchId:revision,revision:{sourceId:'same-source',previousRevision,relativePath:'projects/restored.txt',sizeBytes:bytes.length,...(!deleted?{sha256:hash}:{}),item:{externalId:external,revision,observedAt,title:'Restored history',text:'',kind:'file',layer:'original',mimeType:'text/plain',deleted}}});
  if(!deleted)await f.checked(f.a.token,'/api/ingress/uploads/'+value.id+'/parts/0','PUT',{bytes:bytes.toString('base64'),checksum:hash});
  return (await f.checked(f.a.token,'/api/ingress/uploads/'+value.id+'/commit','POST',{})).captures[0];
 };
 const first=await upload(firstRevision,null,'2026-10-14T00:00:00Z','Generated older original'),older=await exportPortable(f),second=await upload(secondRevision,firstRevision,'2026-10-15T00:00:00Z','Generated latest retained original');assert.ok(first.id>second.id,'fixture deliberately makes UUID insertion order disagree with revision order');
 const task=await f.checked(f.a.token,'/api/processing','POST',{originalRef:second.original.ref,operationId:'generated-restored-file-head-extract'});
 await waitForScopedState(async()=>(await f.checked(f.a.token,'/api/tasks/'+task.id)).state==='succeeded',()=>'generated retained file extraction missing',15000);
 const tombstone=await upload('deleted-file',secondRevision,'2026-10-16T00:00:00Z','',true),saved=await exportPortable(f),ingress=saved.domains.find((domain:any)=>domain.domain==='ingress').payload;
 assert.deepEqual(ingress.fileHeads,[{source_id:'same-source',external_id:external,capture_id:second.id,head_capture_id:tombstone.id}]);assert.equal(ingress.coverage.fileHeads,true);
 assert.equal((await mergePortable(f,older)).state,'completed','an older archive must retain the newer live source head and its last file');
 const verify=async()=>{
  const list=await f.checked(f.a.token,'/api/files');assert.deepEqual(list.items.map((item:any)=>item.captureId),[second.id]);assert.equal(list.items[0].originMissing,true);assert.equal(list.items[0].processing.current,false);
  const detail=await f.checked(f.a.token,'/api/files/'+second.id);assert.equal(detail.hasOriginal,true);
  const playback=await f.checked(f.a.token,'/api/files/'+second.id+'/playback','POST',{});assert.equal((await f.request(f.a.token,playback.url)).body,'Generated latest retained original');
  const exported=await f.request(f.a.token,'/api/files/'+second.id+'/export');assert.equal(exported.statusCode,200,exported.body);assert.ok(gunzipSync(exported.rawPayload).includes(Buffer.from('Generated latest retained original')));
 };
 await verify();await f.checked(f.a.token,'/api/sources/same-source','DELETE');assert.deepEqual((await f.checked(f.a.token,'/api/files')).items,[]);
 const restored=await mergePortable(f,saved);assert.equal(restored.state,'completed',JSON.stringify(restored));await f.checked(f.a.token,'/api/sources/same-source','PATCH',{enabled:true});await verify();
 const db=new DatabaseSync(join(f.directory,'mote.sqlite'),{readOnly:true});try{
  assert.equal(db.prepare("SELECT id FROM pd_captures WHERE user_id=? AND source_id=? AND external_id=? AND COALESCE(json_extract(json,'$.provenance.deleted'),0)=0 ORDER BY rowid DESC LIMIT 1").get(f.a.userId,'same-source',external)!.id,first.id,'the old rowid fallback would choose the wrong restored version');
  assert.equal(db.prepare('SELECT capture_id FROM ig_file_heads WHERE user_id=? AND source_id=? AND external_id=?').get(f.a.userId,'same-source',external)!.capture_id,second.id);
 }finally{db.close();}
 await f.restart();await verify();
});

test('same-time file revisions and a tombstone retain the exact accepted file across personal restore',async t=>{
 const f=await scopedFilesFixture(t);await noAutomaticMemory(f);
 await f.checked(f.a.token,'/api/ingress/sources','POST',{id:'same-time',name:'Generated same-time reference files',kind:'local-files',deviceId:'same-device',platform:'import',retention:'reference'});
 const item=(revision:string,deleted=false)=>({externalId:'same-path',revision,observedAt:'2026-10-14T00:00:00Z',title:revision,text:'',kind:'file',layer:'reference',mimeType:'text/plain',deleted,document:{path:'projects/same-time.txt'},metadata:{version:1,file:{sizeBytes:37}}});
 const receive=async(revision:string,deleted=false)=>(await f.checked(f.a.token,'/api/ingress/sources/same-time/items','POST',{batchId:revision,items:[item(revision,deleted)]})).captures[0];
 await receive('earlier');const latest=await receive('latest');await receive('deleted',true);const saved=await exportPortable(f);
 const before=await f.checked(f.a.token,'/api/files?sourceId=same-time');assert.equal(before.items[0].captureId,latest.id);assert.equal(before.items[0].originMissing,true);assert.equal(before.items[0].hasOriginal,false);
 await f.checked(f.a.token,'/api/sources/same-time','DELETE');const restored=await mergePortable(f,saved);assert.equal(restored.state,'completed',JSON.stringify(restored));await f.checked(f.a.token,'/api/sources/same-time','PATCH',{enabled:true});
 const after=await f.checked(f.a.token,'/api/files?sourceId=same-time');assert.equal(after.items.length,1);assert.equal(after.items[0].captureId,latest.id);assert.equal(after.items[0].originMissing,true);assert.equal(after.items[0].hasOriginal,false);
 await f.restart();assert.equal((await f.checked(f.a.token,'/api/files?sourceId=same-time')).items[0].captureId,latest.id);
});

test('stopped native backup preserves the canonical file pointer and rejects a pointer to a deleted observation',async t=>{
 const {backupScopedInstance,restoreScopedInstance}=await import('../../../scripts/scoped-backup.mjs'),{buildApp}=await import('../src/app.js'),f=await scopedFilesFixture(t),snapshot=f.directory+'-heads-backup',target=f.directory+'-heads-restore',invalid=f.directory+'-heads-invalid';
 t.after(()=>{for(const path of [snapshot,target,invalid])rmSync(path,{recursive:true,force:true});});
 await noAutomaticMemory(f);await f.checked(f.a.token,'/api/sources/same-source','PATCH',{retention:'reference'});
 const receive=async(revision:string,deleted=false)=>(await f.checked(f.a.token,'/api/ingress/sources/same-source/items','POST',{batchId:revision,items:[{externalId:'backup-reference',revision,observedAt:deleted?'2026-10-15T00:00:00Z':'2026-10-14T00:00:00Z',title:'Generated native reference',text:'',kind:'file',layer:'reference',mimeType:'text/plain',deleted,document:{path:'backup/reference.txt'}}]})).captures[0];
 const retained=await receive('retained'),tombstone=await receive('deleted',true);await f.host.app.close();await backupScopedInstance({source:f.directory,out:snapshot});await restoreScopedInstance({from:snapshot,target});
 const restored=await buildApp({dataDir:target});try{
  const headers={'x-mote-protocol-version':'2'},login=await restored.app.inject({method:'POST',url:'/api/auth/login',headers,payload:{username:'generated-a',password:'Generated-joint-files-password',mode:'client'}});assert.equal(login.statusCode,200,login.body);
  const result=await restored.app.inject({method:'GET',url:'/api/files',headers:{...headers,authorization:'Bearer '+login.json().token}});assert.equal(result.statusCode,200,result.body);assert.equal(result.json().items[0].captureId,retained.id);assert.equal(result.json().items[0].originMissing,true);assert.equal(result.json().items[0].hasOriginal,false);
 }finally{await restored.app.close();}
 const db=new DatabaseSync(join(f.directory,'mote.sqlite'));try{db.prepare('UPDATE ig_file_heads SET capture_id=? WHERE user_id=? AND source_id=? AND external_id=?').run(tombstone.id,f.a.userId,'same-source','backup-reference');}finally{db.close();}
 await assert.rejects(backupScopedInstance({source:f.directory,out:invalid}),/file head projection/);
});
