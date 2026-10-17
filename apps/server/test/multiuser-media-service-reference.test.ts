import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import sharp from 'sharp';
import {scopedFilesFixture} from './fixtures/scoped-files.js';
import {waitForScopedState} from './fixtures/scoped-process.js';
import {defaultProcessingSettings} from '../src/scope/processing-schema.js';
import {defaultModelSettings} from '../src/model-settings.js';

test('an original media service with no language-model name resolves only for OCR or ASR',async t=>{
 let calls=0;const server=createServer(async(req,res)=>{for await(const _ of req){}assert.equal(req.headers.authorization,'Bearer GENERATED_MEDIA_CONNECTION');calls++;res.setHeader('X-Mote-Execution','local');res.end(JSON.stringify({durationMs:0,engine:'generated-named-service',segments:[{startMs:0,endMs:0,text:'GENERATED_MEDIA_WITHOUT_MODEL_NAME'}]}));});await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise<void>(resolve=>server.close(()=>resolve())));const address=server.address();assert.ok(address&&typeof address!=='string');const f=await scopedFilesFixture(t),view=await f.checked(f.a.token,'/api/configuration'),reference={kind:'personal',id:'media-service'};
 await f.checked(f.a.token,'/api/configuration/models','PUT',{revision:view.revision,value:{profiles:[{id:'media-service',name:'Generated original media connection',settings:{...defaultModelSettings(),provider:'custom',protocol:'mote-media',baseUrl:'http://127.0.0.1:'+address.port+'/ocr',apiKey:'GENERATED_MEDIA_CONNECTION',model:''}}],selections:{ocr:reference,asr:reference,chat:reference,memory:reference}}});
 await f.checked(f.a.token,'/api/configuration/processing','PUT',{revision:(await f.checked(f.a.token,'/api/configuration')).revision,value:{...defaultProcessingSettings(),automatic:false,understandingEnabled:false,summarize:false}});
 const context=await f.host.authority.authenticate(f.a.token),configuration=f.host.configuration!.forUser(context);await assert.rejects(configuration.lease('chat','generated-media-cannot-be-chat'),{code:'scope_unavailable'});await assert.rejects(configuration.lease('memory','generated-media-cannot-be-memory'),{code:'scope_unavailable'});
 const admitted=await configuration.lease('ocr','generated-empty-model-ocr-reference');assert.equal(admitted.model,'');
 const png=await sharp({create:{width:2,height:2,channels:3,background:'#527aac'}}).png().toBuffer(),capture=await f.uploadBytes(f.a.token,'generated-empty-model-media',png,'image/png'),task=await f.checked(f.a.token,'/api/processing','POST',{originalRef:capture.original.ref,operationId:'generated-empty-model-media'});let state:any;await waitForScopedState(async()=>{state=await f.checked(f.a.token,'/api/tasks/'+task.id);return ['succeeded','blocked','failed','stale'].includes(state.state);},()=>JSON.stringify(state),12000);assert.equal(state.state,'succeeded',JSON.stringify(state));assert.equal(calls,1);assert.ok((await f.checked(f.a.token,'/api/files/'+capture.id)).processing.indexed);const usage=await f.checked(f.a.token,'/api/usage');assert.equal(usage.items[0].model,'','do not invent a language-model name in the processing receipt');
 const asr=await configuration.lease('asr','generated-empty-model-asr-reference');assert.equal(asr.model,'');assert.equal(asr.reference.id,'media-service');assert.equal(calls,1,'resolving a connection does not execute a provider');
});
