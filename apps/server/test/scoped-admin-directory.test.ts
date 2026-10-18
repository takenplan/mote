import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdirSync,mkdtempSync,rmSync,symlinkSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {writeMessagesResponse} from '../../../scripts/fixtures/messages-provider.js';
import {defaultModelSettings} from '../src/model-settings.js';
import {defaultMemorySettings} from '../src/scope/memory-schema.js';
import {scopedFilesFixture} from './fixtures/scoped-files.js';
import {waitForScopedState} from './fixtures/scoped-process.js';

type Fixture=Awaited<ReturnType<typeof scopedFilesFixture>>;
function generatedDirectory(t:TestContext){const directory=mkdtempSync(join(tmpdir(),'mote-admin-import-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));return directory;}
async function previewModel(t:TestContext,f:Fixture,tokens:string[]){
 const server=createServer((req,res)=>{void(async()=>{
  const parts:Buffer[]=[];for await(const part of req)parts.push(part);const input=JSON.parse(Buffer.concat(parts).toString());
  const read=input.messages.some((message:any)=>Array.isArray(message.content)&&message.content.some((part:any)=>part.type==='tool_result'));
  if(!read){writeMessagesResponse(res,{stage:1,tool:{name:'timeline',args:{limit:100}}});return;}
  writeMessagesResponse(res,{stage:2,text:JSON.stringify({answer:JSON.stringify({summary:'Generated directory preview preserves supplied original text.',warnings:[],reviewDecision:{confidence:'high',ambiguous:false,reason:'Generated fixture accounts for the decoded originals.'},preserveAll:true}),citationIds:[]})});
 })().catch(()=>res.destroy());});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise<void>(resolve=>server.close(()=>resolve())));
 const address=server.address();assert.ok(address&&typeof address!=='string');
 for(const token of tokens){
  let view=await f.checked(token,'/api/configuration');await f.checked(token,'/api/configuration/models','PUT',{revision:view.revision,value:{profiles:[{id:'directory-fixture',name:'Generated directory preview',settings:{...defaultModelSettings(),provider:'custom',protocol:'anthropic-messages',model:'directory-fixture',baseUrl:'http://127.0.0.1:'+address.port+'/v1',apiKey:'GENERATED_DIRECTORY_ONLY'}}],selections:{import:{kind:'personal',id:'directory-fixture'}}}});
  view=await f.checked(token,'/api/configuration');await f.checked(token,'/api/configuration/memory','PUT',{revision:view.revision,value:{...defaultMemorySettings(),automatic:false}});
 }
}
async function waitPreview(f:Fixture,token:string,id:string){await waitForScopedState(async()=>{const current=await f.checked(token,'/api/imports/'+id);if(['failed','needs_configuration'].includes(current.status))assert.fail(JSON.stringify(current));return current.status==='awaiting_confirmation';},()=>'generated directory preview missing',15000);return f.checked(token,'/api/imports/'+id);}

test('administrator host directory uses private preview, confirmation, cancellation and restart through production HTTP',async t=>{
 const f=await scopedFilesFixture(t),directory=generatedDirectory(t),id=randomUUID(),password='Generated-directory-admin-password';
 mkdirSync(join(directory,'projects'));const bodies=new Map([['first.txt','Generated root original.'],['projects/second.md','Generated nested original, preserved exactly.']]);
 for(const [name,body] of bodies)writeFileSync(join(directory,name),body);
 await f.checked(f.admin.token,'/api/admin/accounts','POST',{username:'directory-admin-b',password,administrator:true});
 const b=await f.checked(undefined,'/api/auth/login','POST',{username:'directory-admin-b',password,mode:'client'});await previewModel(t,f,[f.admin.token,b.token]);
 const request={requestId:id,directory,processing:'preview'};
 for(const token of [f.admin.token,b.token]){
  const created=await f.request(token,'/api/imports','POST',request);assert.equal(created.statusCode,202,created.body);
 }
 const aPreview=await waitPreview(f,f.admin.token,id),bPreview=await waitPreview(f,b.token,id);
 assert.deepEqual(aPreview.files.map((file:any)=>file.relativePath),[...bodies.keys()]);assert.equal(aPreview.preview.count,2);assert.equal(aPreview.progress.imported,0);assert.equal(aPreview.captureIds.length,0);
 assert.equal((await f.checked(f.admin.token,'/api/captures')).items.length,0,'unconfirmed directory contents remain outside query evidence');
 assert.equal((await f.request(f.a.token,'/api/imports/'+id)).statusCode,404);
 assert.equal((await f.request(f.a.token,'/api/imports/'+id+'/confirm','POST',{})).statusCode,404);
 for(const [index,file] of aPreview.files.entries()){
  assert.notEqual(file.id,bPreview.files[index].id,'equal host path/hash remains an account-owned original');
  assert.equal((await f.request(b.token,'/api/archived-files/'+file.id+'/content')).statusCode,404);
  assert.equal((await f.request(f.admin.token,'/api/archived-files/'+file.id+'/content')).rawPayload.toString(),bodies.get(file.relativePath));
 }
 assert.equal((await f.request(f.admin.token,'/api/imports','POST',{...request,name:'Changed request'})).statusCode,409);
 assert.equal((await f.request(b.token,'/api/imports/'+id+'/cancel','POST',{})).statusCode,200);
 assert.equal((await f.request(b.token,'/api/imports/'+id+'/confirm','POST',{})).statusCode,409);
 // A reviewed preview and its originals are independent of the host source
 // after intake. Neither confirmation nor restart revisits this directory.
 rmSync(directory,{recursive:true,force:true});await f.restart();
 assert.equal((await f.checked(b.token,'/api/imports/'+id)).status,'cancelled');
 assert.equal((await f.request(b.token,'/api/imports/'+id+'/confirm','POST',{})).statusCode,409);
 assert.equal((await f.request(f.admin.token,'/api/imports','POST',request)).json().id,id,'same-ID replay observes the retained job without reopening a missing directory');
 assert.equal((await f.request(f.admin.token,'/api/imports/'+id+'/confirm','POST',{})).statusCode,202);
 await waitForScopedState(async()=>(await f.checked(f.admin.token,'/api/imports/'+id)).status==='completed',()=>'directory confirmation did not publish',15000);
 const complete=await f.checked(f.admin.token,'/api/imports/'+id);assert.equal(complete.progress.imported,2);assert.equal(complete.captureIds.length,2);
 const links=await f.checked(f.admin.token,'/api/captures/'+complete.captureIds[0]+'/archived-files');assert.equal(links.items.length,1);
 const deleted=await f.checked(b.token,'/api/imports/'+id,'DELETE');assert.equal(deleted.deleted,true);
 assert.equal((await f.request(b.token,'/api/imports/'+id)).statusCode,404);
 for(const [index,file] of aPreview.files.entries()){
  assert.equal((await f.request(b.token,'/api/archived-files/'+bPreview.files[index].id+'/content')).statusCode,404,'cancelled job deletion retires its private originals');
  assert.equal((await f.request(f.admin.token,'/api/archived-files/'+file.id+'/content')).rawPayload.toString(),bodies.get(file.relativePath),'another admin deletion cannot remove the confirmed owner archive');
 }
});

test('directory authority and structural boundaries reject before creating an import',async t=>{
 const f=await scopedFilesFixture(t),directory=generatedDirectory(t),file=join(directory,'plain.txt');writeFileSync(file,'Generated structural boundary fixture.');
 for(const candidate of [directory,join(directory,'missing'),f.directory]){
  const denied=await f.request(f.a.token,'/api/imports','POST',{directory:candidate});assert.equal(denied.statusCode,403,denied.body);assert.equal(denied.body.includes(candidate),false);
 }
 for(const [candidate,code] of [[join(directory,'missing'),'import_directory_missing'],[file,'import_directory_required']] as const){
  const result=await f.request(f.admin.token,'/api/imports','POST',{directory:candidate});assert.equal(result.statusCode,422,result.body);assert.equal(result.json().error,code);assert.equal(result.body.includes(candidate),false);
 }
 for(const [candidate,status] of [[f.directory,400],[join(f.directory,'originals'),400],[dirname(f.directory),400]] as const){
  const result=await f.request(f.admin.token,'/api/imports','POST',{directory:candidate});assert.equal(result.statusCode,status,result.body);assert.equal(result.body.includes(candidate),false);
 }
 symlinkSync(file,join(directory,'linked.txt'));
 const linked=await f.request(f.admin.token,'/api/imports','POST',{directory});assert.equal(linked.statusCode,400,linked.body);
 assert.equal((await f.checked(f.admin.token,'/api/imports')).items.length,0);assert.equal((await f.checked(f.a.token,'/api/imports')).items.length,0);
});
