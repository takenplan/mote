import test from 'node:test';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {scopedFilesFixture} from '../../server/test/fixtures/scoped-files.js';
import {waitForScopedState} from '../../server/test/fixtures/scoped-process.js';

// Consumer boundary probe: only a held HTTP publication is substituted. The
// original intake, processing, export stream and source mutation are real.
test('a native Files export must recheck its source after the response barrier while equal-ID B stays readable',async t=>{
 let entered!:()=>void,release!:()=>void,exportOwner='',exportId='';
 const barrier=new Promise<void>(resolve=>{entered=resolve}),resume=new Promise<void>(resolve=>{release=resolve});
 const f=await scopedFilesFixture(t,host=>host.app.addHook('onSend',async(request,reply,payload)=>{
  if(exportId&&request.url==='/api/files/'+exportId+'/export'&&request.headers.authorization==='Bearer '+exportOwner&&reply.statusCode===200){entered();await resume;}
  return payload;
 })),a=await f.upload(f.a.token,'same-native-stream','GENERATED_A_HELD_EXPORT'),b=await f.upload(f.b.token,'same-native-stream','GENERATED_B_OWN_EXPORT');
 for(const [actor,receipt] of [[f.a,a],[f.b,b]]){
  const task=await f.checked(actor.token,'/api/processing','POST',{originalRef:receipt.original.ref,operationId:'same-native-stream-processing'});
  await waitForScopedState(async()=>(await f.checked(actor.token,'/api/tasks/'+task.id)).state==='succeeded',()=>'Generated native stream input not processed');
 }
 exportOwner=f.a.token;exportId=a.id;
 const pending=f.request(f.a.token,'/api/files/'+a.id+'/export');await barrier;
 try{await f.checked(f.a.token,'/api/sources/same-source','PATCH',{enabled:false});}finally{release();}
 const response=await pending;
 const own=await f.request(f.b.token,'/api/files/'+b.id+'/export');assert.equal(own.statusCode,200,own.body);assert.ok(gunzipSync(own.rawPayload).includes(Buffer.from('GENERATED_B_OWN_EXPORT')));
 assert.ok(response.statusCode!==200||!gunzipSync(response.rawPayload).includes(Buffer.from('GENERATED_A_HELD_EXPORT')),'a source retired before any archive bytes are sent cannot publish the captured private export');
});
