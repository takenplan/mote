import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {defaultModelSettings} from '../src/model-settings.js';
import {fixture,media} from './fixtures/scoped-processing.js';
import {scopedFilesFixture} from './fixtures/scoped-files.js';
import {waitForScopedState} from './fixtures/scoped-process.js';
import {writeMessagesResponse} from '../../../scripts/fixtures/messages-provider.js';

const fileAttribution={agentId:'file-analysis',moduleId:'files',skillId:null};
const importAttribution={agentId:'document-import',moduleId:'imports',skillId:'document-import'};
const dimensions=(item:any)=>({agentId:item.attribution.agentId,moduleId:item.attribution.moduleId,skillId:item.attribution.skillId});

test('public file summary and term review entries retain explicit usage dimensions for each account after restart',async t=>{
 const f=await fixture(t),evidence=new Map<string,string>();let mode:'summary'|'review'='summary',calls=0;
 const language=(await media(t,(req,res)=>{
  const id=evidence.get(String(req.headers['x-api-key']));assert.ok(id);calls++;
  writeMessagesResponse(res,{stage:calls,text:JSON.stringify({answer:mode==='summary'?'Generated file usage summary':JSON.stringify({suggestions:[]}),citationIds:[id]})});
 })).replace('/transcribe','/v1');
 const originals=[];
 for(const [token,key] of [[f.alice.token,'GENERATED_FILE_USAGE_A'],[f.bob.token,'GENERATED_FILE_USAGE_B']] as const){
  const ref=(await f.upload(token,Buffer.from('Generated same original for isolated usage receipts'))).captures[0].original.ref;
  await f.wait(token,(await f.submit(token,ref)).id);
  const status=await f.status(token,ref),fileId=status.original.captureId;
  evidence.set(key,(await f.checked(token,'/api/files/'+fileId+'/chunks')).items[0].id);
  await f.configure(token,'models',{profiles:[{id:'file-usage',name:'Generated file usage',settings:{...defaultModelSettings(),provider:'custom',protocol:'anthropic-messages',model:'generated-file-usage',baseUrl:language,apiKey:key}}],selections:{file:{kind:'personal',id:'file-usage'}}});
  originals.push({token,ref,fileId});
 }
 for(const {token,ref}of originals){const job=await f.checked(token,'/api/processing/derivations','POST',{originalRef:ref,operationId:'same-usage-summary',modes:['summary']});await f.wait(token,job.id);}
 mode='review';
 for(const {token,fileId}of originals){const job=await f.checked(token,'/api/files/'+fileId+'/reviews','POST',{operationId:'same-usage-review',kind:'terms'});await f.wait(token,job.taskId);assert.equal((await f.checked(token,'/api/files/'+fileId+'/reviews')).items[0].status,'proposed');}
 assert.equal(calls,4);
 const receiptIds=new Set<string>();
 for(const {token}of originals){
  const usage=await f.checked(token,'/api/usage');assert.equal(usage.items.length,2);assert.equal(usage.total.totalTokens,240);
  for(const item of usage.items){assert.deepEqual(dimensions(item),fileAttribution);assert.equal(item.status,'completed');assert.ok(item.attribution.operationId);assert.equal(receiptIds.has(item.id),false);receiptIds.add(item.id);}
 }
 await f.restart();
 for(const {token}of originals){const usage=await f.checked(token,'/api/usage');assert.equal(usage.items.length,2);assert.ok(usage.items.every((item:any)=>receiptIds.has(item.id)));assert.deepEqual(usage.items.map(dimensions),[fileAttribution,fileAttribution]);}
 assert.equal(calls,4,'restart must preserve receipts without replaying settled file analysis');
});

test('public mapped import preview records document-import usage before publication and retains account isolation',async t=>{
 const f=await scopedFilesFixture(t),fileId=randomUUID(),bytes=Buffer.from('Generated mapped import usage original');let calls=0;
 await f.checked(f.a.token,'/api/import-uploads','POST',{id:fileId,name:'usage.txt',sizeBytes:bytes.length,mimeType:'text/plain'});
 assert.equal((await f.request(f.a.token,'/api/import-uploads/'+fileId+'/parts/0','PUT',bytes,{'content-type':'application/octet-stream'})).statusCode,200);
 const file=await f.checked(f.a.token,'/api/import-uploads/'+fileId+'/commit','POST',{});
 const language=(await media(t,(_req,res)=>{
  calls++;
  if(calls===1){writeMessagesResponse(res,{stage:calls,tool:{name:'timeline',args:{limit:100}}});return;}
  writeMessagesResponse(res,{stage:calls,text:JSON.stringify({answer:JSON.stringify({summary:'Generated import usage mapping',warnings:[],reviewDecision:{confidence:'high',ambiguous:false,reason:'Retained exact generated original.'},preserveAll:true,dispositions:[{fileId:file.id,status:'parsed',reason:'Generated original retained verbatim.'}]}),citationIds:[]})});
 })).replace('/transcribe','/v1');
 const view=await f.checked(f.a.token,'/api/configuration');
 await f.checked(f.a.token,'/api/configuration/models','PUT',{revision:view.revision,value:{profiles:[{id:'import-usage',name:'Generated import usage',settings:{...defaultModelSettings(),provider:'custom',protocol:'anthropic-messages',model:'generated-import-usage',baseUrl:language,apiKey:'GENERATED_IMPORT_USAGE_A'}}],selections:{import:{kind:'personal',id:'import-usage'}}}});
 const id=randomUUID(),created=await f.request(f.a.token,'/api/imports','POST',{requestId:id,archivedFileIds:[file.id],processing:'preview',instruction:'Retain the exact supplied original.'});assert.equal(created.statusCode,202,created.body);
 await waitForScopedState(async()=>{const job=await f.checked(f.a.token,'/api/imports/'+id);if(['failed','needs_configuration'].includes(job.status))assert.fail(JSON.stringify(job));return job.status==='awaiting_confirmation';},()=> 'Generated import usage preview did not finish',15000);
 const preview=await f.checked(f.a.token,'/api/imports/'+id);assert.equal(preview.preview.count,1);assert.deepEqual(preview.captureIds,[]);assert.equal(calls,2);
 const usage=await f.checked(f.a.token,'/api/usage');assert.equal(usage.items.length,1);assert.deepEqual(dimensions(usage.items[0]),importAttribution);assert.equal(usage.items[0].status,'completed');assert.equal(usage.total.totalTokens,240);assert.equal((await f.checked(f.b.token,'/api/usage')).items.length,0);
 await f.restart();
 const restored=await f.checked(f.a.token,'/api/usage');assert.equal(restored.items[0].id,usage.items[0].id);assert.deepEqual(dimensions(restored.items[0]),importAttribution);assert.equal((await f.checked(f.a.token,'/api/imports/'+id)).status,'awaiting_confirmation');assert.equal(calls,2);
});
