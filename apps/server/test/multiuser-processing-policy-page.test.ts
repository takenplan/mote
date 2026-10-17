import test from 'node:test';
import assert from 'node:assert/strict';
import {scopedFilesFixture} from './fixtures/scoped-files.js';
import {waitForScopedState} from './fixtures/scoped-process.js';
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import {createServer} from 'node:http';
import sharp from 'sharp';
import {defaultModelSettings} from '../src/model-settings.js';
import {randomUUID} from 'node:crypto';

// This is the original settings page route and field order, with M04 reference
// values in services instead of a second endpoint/credential store.
test('the original file processing page retains owned named source and MIME rules',async t=>{
 const f=await scopedFilesFixture(t),page=await f.request(f.a.token,'/api/file-processing');assert.equal(page.statusCode,200,page.body);const view=page.json();assert.ok(view.capabilities.recipes.some((recipe:any)=>recipe.id==='mote.audio-dialogue'));assert.ok(view.capabilities.image.recipes.some((recipe:any)=>recipe.id==='mote.image'),'image recipes do not replace the existing file recipe capability list');
 const policy={version:1,services:[],profiles:[{id:'text',name:'Generated text processing',processorId:'text.utf8',parameters:{},diarizationProcessor:'audio.diarize',summarize:false},{id:'archive',name:'Generated original only',processorId:'archive',parameters:{},diarizationProcessor:'audio.diarize',summarize:false}],rules:[{sourceId:'same-source',type:'text/plain',profileId:'archive'},{type:'text/*',profileId:'text'},{type:'*/*',profileId:'archive'}]};
 const saved=await f.checked(f.a.token,'/api/file-processing','PUT',{revision:view.revision,settings:view.settings,policy});assert.equal(saved.policyConfigured,true);
 assert.equal((await f.checked(f.a.token,'/api/file-processing/match','POST',{sourceId:'same-source',mimeType:'text/plain'})).profile.id,'archive');
 assert.equal((await f.checked(f.a.token,'/api/file-processing/match','POST',{sourceId:'other-source',mimeType:'text/plain'})).profile.id,'text');
 assert.equal((await f.checked(f.a.token,'/api/file-processing/match','POST',{sourceId:'other-source',mimeType:'application/octet-stream'})).profile.id,'archive');
 const b=await f.checked(f.b.token,'/api/file-processing');assert.equal(b.policyConfigured,false,'same source/profile IDs do not import A settings into B');
 assert.equal((await f.request(f.a.token,'/api/file-processing','PUT',{revision:view.revision,settings:view.settings,policy})).statusCode,409,'the original page save remains configuration-CAS qualified');
});

test('invalid profile parameters and embedded credentials cannot partially publish the processing transaction',async t=>{
 const f=await scopedFilesFixture(t),before=await f.checked(f.a.token,'/api/file-processing'),policy={version:1,services:[],profiles:[{id:'text',name:'Generated invalid profile',processorId:'text.utf8',parameters:{unsupported:'GENERATED_VALUE'},summarize:false},{id:'archive',name:'Generated archive',processorId:'archive',parameters:{},summarize:false}],rules:[{type:'text/*',profileId:'text'},{type:'*/*',profileId:'archive'}]};
 const rejected=await f.request(f.a.token,'/api/file-processing','PUT',{revision:before.revision,settings:{...before.settings,automatic:true},policy});assert.equal(rejected.statusCode,400,rejected.body);assert.deepEqual(await f.checked(f.a.token,'/api/file-processing'),before);
 const config=await f.checked(f.a.token,'/api/configuration'),patch=await f.request(f.a.token,'/api/configuration','PATCH',{revision:config.revision,patches:{processing:{...before.settings,automatic:true},filePolicy:{policy}}});assert.equal(patch.statusCode,400,patch.body);assert.deepEqual(await f.checked(f.a.token,'/api/file-processing'),before);
 const credentials=await f.request(f.a.token,'/api/file-processing','PUT',{revision:before.revision,settings:before.settings,policy:{...policy,profiles:policy.profiles.map(profile=>({...profile,parameters:{}})),services:[{id:'media',name:'Generated forbidden copy',kind:'image',reference:{kind:'personal',id:'saved'},endpoint:'http://127.0.0.1:1',apiKey:'GENERATED_MUST_NOT_BE_STORED'}]}});assert.equal(credentials.statusCode,400,credentials.body);assert.deepEqual(await f.checked(f.a.token,'/api/file-processing'),before);
});

test('source-specific original-only policy skips automatic processing while the equal-ID other owner processes text',async t=>{
 const f=await scopedFilesFixture(t),profiles=[{id:'text',name:'Generated text',processorId:'text.utf8',parameters:{},summarize:false},{id:'archive',name:'Generated archive',processorId:'archive',parameters:{},summarize:false}];
 for(const [account,archive]of [[f.a,true],[f.b,false]] as const){const view=await f.checked(account.token,'/api/file-processing');await f.checked(account.token,'/api/file-processing','PUT',{revision:view.revision,settings:{...view.settings,automatic:true,understandingEnabled:false},policy:{version:1,services:[],profiles,rules:[{sourceId:'same-source',type:'text/plain',profileId:archive?'archive':'text'},{type:'*/*',profileId:'archive'}]}});}
 const a=await f.upload(f.a.token,'same-policy-file','GENERATED_POLICY_BYTES'),b=await f.upload(f.b.token,'same-policy-file','GENERATED_POLICY_BYTES');assert.equal(a.id,b.id);let result:any;
 await waitForScopedState(async()=>{result=await f.checked(f.b.token,'/api/files/'+b.id);return result.processing.indexed;},()=>JSON.stringify(result));
 const saved=await f.checked(f.a.token,'/api/files/'+a.id);assert.equal(saved.processing.processingRequired,false);assert.equal(saved.processing.processed,false);assert.equal(saved.processing.indexed,false);assert.equal(saved.job,null);assert.equal(saved.processing.appliedPolicy.profile.id,'archive');assert.equal(result.processing.appliedPolicy.profile.id,'text');
 assert.deepEqual(await f.checked(f.a.token,'/api/processing','POST',{originalRef:a.original.ref,operationId:'generated-original-only'}),{saved:true,processingRequired:false});
 const chunks=await f.checked(f.b.token,'/api/files/'+b.id+'/chunks');assert.equal(chunks.items.map((item:any)=>item.ocrText).join(''),'GENERATED_POLICY_BYTES');
 const db=new DatabaseSync(join(f.directory,'mote.sqlite'),{readOnly:true});try{assert.equal(db.prepare("SELECT count(*) n FROM user_tasks WHERE user_id=? AND json_extract(input,'$.originalRef')=?").get(f.a.userId,a.original.ref)!.n,0,'original-only is retention, not a fake successful OCR task');await f.checked(f.a.token,'/api/files/'+a.id,'DELETE',{operationId:randomUUID(),originalGeneration:saved.originalGeneration});assert.equal(db.prepare('SELECT count(*) n FROM mp_file_policy_bindings WHERE user_id=?').get(f.a.userId)!.n,0);assert.equal(db.prepare('SELECT count(*) n FROM mp_file_plans WHERE user_id=?').get(f.a.userId)!.n,0);assert.equal((await f.request(f.b.token,'/api/files/'+b.id+'/chunks')).statusCode,200);}finally{db.close();}
});

test('an explicit named image profile leases only its complete owned service without a global OCR fallback',async t=>{
 const calls:Array<{path:string;authorization:string}>=[],server=createServer(async(req,res)=>{for await(const _ of req){}const path=req.url!,authorization=String(req.headers.authorization);calls.push({path,authorization});res.setHeader('X-Mote-Execution','local');res.end(JSON.stringify({durationMs:0,engine:'generated-profile-ocr',segments:[{startMs:0,endMs:0,text:path==='/generated-a'?'GENERATED_NAMED_A':'GENERATED_NAMED_B'}]}));});await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise<void>(resolve=>server.close(()=>resolve())));const address=server.address();assert.ok(address&&typeof address!=='string');const f=await scopedFilesFixture(t);
 for(const [account,key]of [[f.a,'a'],[f.b,'b']] as const){const configuration=await f.checked(account.token,'/api/configuration');await f.checked(account.token,'/api/configuration/models','PUT',{revision:configuration.revision,value:{profiles:[{id:'same-media',name:'Generated complete connection',settings:{...defaultModelSettings(),provider:'custom',protocol:'mote-media',baseUrl:'http://127.0.0.1:'+address.port+'/generated-'+key,apiKey:'GENERATED_NAMED_KEY_'+key,model:''}}],selections:{}}});
  const page=await f.checked(account.token,'/api/file-processing');await f.checked(account.token,'/api/file-processing','PUT',{revision:page.revision,settings:{...page.settings,automatic:true,understandingEnabled:false},policy:{version:1,services:[{id:'media',name:'Generated profile reference',kind:'image',reference:{kind:'personal',id:'same-media'}}],profiles:[{id:'same-image',name:'Generated named OCR',processorId:'image.http',serviceId:'media',parameters:{},summarize:false},{id:'archive',name:'Original only',processorId:'archive',parameters:{},summarize:false}],rules:[{type:'image/*',profileId:'same-image'},{type:'*/*',profileId:'archive'}]}});
 }
 const png=await sharp({create:{width:2,height:2,channels:3,background:'#496ab5'}}).png().toBuffer(),a=await f.uploadBytes(f.a.token,'same-named-image',png,'image/png'),b=await f.uploadBytes(f.b.token,'same-named-image',png,'image/png');assert.equal(a.id,b.id);
 for(const [account,file,text]of [[f.a,a,'GENERATED_NAMED_A'],[f.b,b,'GENERATED_NAMED_B']] as const){let detail:any;await waitForScopedState(async()=>{detail=await f.checked(account.token,'/api/files/'+file.id);return detail.processing.indexed;},()=>JSON.stringify(detail));const chunks=await f.checked(account.token,'/api/files/'+file.id+'/chunks');assert.equal(chunks.items.map((item:any)=>item.ocrText).join(''),text);assert.doesNotMatch(JSON.stringify(detail),/GENERATED_NAMED_KEY_/);assert.equal((await f.checked(account.token,'/api/models')).selections.ocr,undefined);}
 assert.deepEqual(calls.sort((a,b)=>a.path.localeCompare(b.path)),[{path:'/generated-a',authorization:'Bearer GENERATED_NAMED_KEY_a'},{path:'/generated-b',authorization:'Bearer GENERATED_NAMED_KEY_b'}]);
});
