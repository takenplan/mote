import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import sharp from 'sharp';
import {bytesHash,identityHash} from '../src/scope/originals.js';
import {scopedFilesFixture} from './fixtures/scoped-files.js';
import {waitForScopedState} from './fixtures/scoped-process.js';
import {defaultModelSettings} from '../src/model-settings.js';
import {writeMessagesResponse} from '../../../scripts/fixtures/messages-provider.js';

test('HTTP processed files retain authoritative device and content time in the real Ask catalog across restart',async t=>{
 const f=await scopedFilesFixture(t);
 for(const actor of [f.a,f.b]){
  const configuration=await f.checked(actor.token,'/api/configuration');
  await f.checked(actor.token,'/api/configuration/processing','PUT',{revision:configuration.revision,value:{...(await f.checked(actor.token,'/api/file-processing')).settings,automatic:true}});
 }
 const examples=[
  {id:'same-recorded-file',document:{recordedAt:'2025-06-04T13:30:00+08:00',timeBasis:'recorded'},expected:'2025-06-04T05:30:00.000Z'},
  {id:'occurred-file',document:{recordedAt:'2025-07-05T00:00:00Z',occurredAt:'2025-03-02T18:20:00+08:00',timeBasis:'occurred'},expected:'2025-03-02T10:20:00.000Z'},
  {id:'observed-file',document:undefined,expected:'2026-10-16T00:00:00.000Z'},
 ];
 const published:{actor:typeof f.a;captureId:string;materialId:string;expected:string;text:string}[]=[];
 for(const [actor,label]of [[f.a,'A'],[f.b,'B']] as const)for(const example of actor===f.a?examples:examples.slice(0,1)){
  const text='GENERATED_'+label+'_'+example.id,bytes=Buffer.from(text),hash=bytesHash(bytes);
  const upload=await f.checked(actor.token,'/api/ingress/sources/same-source/uploads','POST',{batchId:example.id,revision:{sourceId:'same-source',previousRevision:null,sizeBytes:bytes.length,sha256:hash,relativePath:example.id+'.txt',item:{externalId:example.id,revision:'same-r1',observedAt:'2026-10-16T00:00:00Z',title:example.id,text:'',kind:'file',layer:'original',mimeType:'text/plain',...(example.document?{document:example.document}:{})}}});
  await f.checked(actor.token,'/api/ingress/uploads/'+upload.id+'/parts/0','PUT',{bytes:bytes.toString('base64'),checksum:hash});
  const capture=(await f.checked(actor.token,'/api/ingress/uploads/'+upload.id+'/commit','POST',{})).captures[0];
  let detail:any;await waitForScopedState(async()=>{detail=await f.checked(actor.token,'/api/files/'+capture.id);return detail.processing.indexed;},()=>JSON.stringify(detail),10000);
  const manifest=await f.checked(actor.token,'/api/materials/'+detail.processing.materialId);
  assert.equal(manifest.origin.deviceId,'same-device');assert.equal(manifest.origin.firstAt,example.expected);assert.equal(manifest.origin.lastAt,example.expected);
  assert.equal((await f.checked(actor.token,'/api/materials/'+manifest.id+'/read')).text,text);
  published.push({actor,captureId:capture.id,materialId:manifest.id,expected:example.expected,text});
 }
 assert.equal(published[0].captureId,published.at(-1)!.captureId);
 const verify=async()=>{for(const row of published){
  const after=new Date(Date.parse(row.expected)-1).toISOString(),before=new Date(Date.parse(row.expected)+1).toISOString();
  const page=await f.checked(row.actor.token,'/api/agent-view/materials?deviceId=same-device&after='+encodeURIComponent(after)+'&before='+encodeURIComponent(before));
  assert.ok(page.items.some((item:any)=>item.id===row.materialId),JSON.stringify(page));
  const wrong=await f.checked(row.actor.token,'/api/agent-view/materials?deviceId=another-device&after='+encodeURIComponent(after)+'&before='+encodeURIComponent(before));assert.equal(wrong.items.length,0);
  const read=await f.checked(row.actor.token,'/api/materials/'+row.materialId+'/read');assert.equal(read.text,row.text);assert.ok(!read.text.includes('GENERATED_'+(row.actor===f.a?'B':'A')+'_'));
 }};
 await verify();await f.restart();await verify();
});

for(const ocrName of ['ocr','scan',undefined])test('HTTP archived attachment uses its '+(ocrName?ocrName+' OCR plus named interpretation':'interpretation-only')+' plan in the parent Material',async t=>{
 const withOcr=ocrName!==undefined;
 let entered!:()=>void,release!:()=>void,calls=0;
 const started=new Promise<void>(resolve=>entered=resolve),held=new Promise<void>(resolve=>release=resolve);t.after(()=>release());
 const f=await scopedFilesFixture(t,node=>{
  const registry=node.processing!.processors.imageRecipes;
  registry.registerStage({id:'generated.parity-ocr',version:'1',kind:'ocr',run:async()=>({durationMs:0,segments:[{startMs:0,endMs:0,text:'GENERATED_EXACT_OCR'}],coverage:'full',engine:'generated-file-parity'})});
  registry.registerStage({id:'generated.parity-look',version:'1',kind:'derived',run:async input=>{calls++;await input.readImage({view:'metadata'});if(calls===1){entered();await held;}return {text:'GENERATED_NAMED_IMAGE_INTERPRETATION',regions:[{x:0,y:0,width:1,height:1,description:''}]};}});
  registry.registerRecipe({id:'generated.parity-image',version:'1',steps:[...(withOcr?[{name:ocrName!,stage:{id:'generated.parity-ocr',version:'1'},dependsOn:[]}]:[]),{name:'look',stage:{id:'generated.parity-look',version:'1'},dependsOn:ocrName?[ocrName]:[]}]});
 });
 const png=await sharp({create:{width:2,height:2,channels:3,background:'#425678'}}).png().toBuffer(),owners=[];
 for(const [actor,label]of [[f.a,'A'],[f.b,'B']] as const){
  const page=await f.checked(actor.token,'/api/file-processing');
  await f.checked(actor.token,'/api/file-processing','PUT',{revision:page.revision,settings:{...page.settings,automatic:true,understandingEnabled:false},policy:{version:1,services:[],profiles:[{id:'image',name:'Generated actual image plan',processorId:'image.http',parameters:{},summarize:false,imageRecipe:{id:'generated.parity-image',version:'1'}},{id:'archive',name:'Generated archive only',processorId:'archive',parameters:{},summarize:false}],rules:[{type:'image/*',profileId:'image'},{type:'*/*',profileId:'archive'}]}});
  const uploadId=randomUUID();await f.checked(actor.token,'/api/import-uploads','POST',{id:uploadId,name:'generated.png',mimeType:'image/png',sizeBytes:png.length});
  assert.equal((await f.request(actor.token,'/api/import-uploads/'+uploadId+'/parts/0','PUT',png,{'content-type':'application/octet-stream'})).statusCode,200);
  const file=await f.checked(actor.token,'/api/import-uploads/'+uploadId+'/commit','POST',{});
  const parent=(await f.checked(actor.token,'/api/ingress/sources/same-source/items','POST',{batchId:'same-parent',items:[{externalId:'same-parent',revision:'same-r1',observedAt:'2026-10-16T00:00:00Z',title:'Generated parent',text:'GENERATED_'+label+'_CAPTION',kind:'message',layer:'original',document:{contentRole:'authored',timeBasis:'unknown',attachments:[{id:file.id,name:file.name,mimeType:file.mimeType}]}}]})).captures[0];
  // The connector-owned archive association has no public mutation route. Set
  // this existing production association; admission and reads use HTTP below.
  f.host.ingress.forUser(await f.host.authority.authenticate(actor.token)).attachArchivedFiles(parent.id,[file.id]);
  const child=await f.checked(actor.token,'/api/records/'+parent.id+'/attachments/'+file.id+'/processing','POST',{});
  owners.push({actor,file,parent,child,materialId:'mat_'+identityHash(['same-source','same-parent'])});
  if(actor===f.a){
   await started;
   if(withOcr){let pending:any;await waitForScopedState(async()=>{const result=await f.request(actor.token,'/api/materials/'+owners[0].materialId);if(result.statusCode!==200)return false;pending=result.json();return pending.artifacts?.some((artifact:any)=>artifact.key==='attachment/'+file.id+'/look'&&artifact.state==='pending');},()=>JSON.stringify(pending),10000);}
   release();
  }
  let parentMaterial:any;await waitForScopedState(async()=>{const result=await f.request(actor.token,'/api/materials/'+owners.at(-1)!.materialId);if(result.statusCode!==200)return false;parentMaterial=result.json();return parentMaterial.artifacts?.some((artifact:any)=>artifact.key==='attachment/'+file.id+'/look'&&artifact.state==='ready');},()=>JSON.stringify(parentMaterial),10000);
  const text=(await f.checked(actor.token,'/api/materials/'+owners.at(-1)!.materialId+'/read')).text;
  assert.ok(text.includes('GENERATED_'+label+'_CAPTION'));assert.ok(!text.includes('GENERATED_'+(label==='A'?'B':'A')+'_CAPTION'));assert.ok(text.includes('GENERATED_NAMED_IMAGE_INTERPRETATION'));assert.ok(text.includes('original_image_reference'));assert.equal(text.includes('GENERATED_EXACT_OCR'),withOcr);assert.ok(!text.includes('imageInterpretation\":\"GENERATED_EXACT_OCR'),'named OCR stays original extracted evidence');
  const detail=await f.checked(actor.token,'/api/files/'+child.captureId);assert.equal(detail.processing.original.retention,'archive');assert.equal(detail.processing.appliedPolicy.archiveOnly,false);assert.equal(Boolean(detail.processing.artifactId),withOcr);
 }
 assert.equal(owners[0].parent.id,owners[1].parent.id);for(const [owner,other]of [[owners[0],owners[1]],[owners[1],owners[0]]])assert.equal((await f.request(owner.actor.token,'/api/files/'+other.child.captureId)).statusCode,404);assert.equal(calls,2);
 await f.restart();for(const owner of owners){const text=(await f.checked(owner.actor.token,'/api/materials/'+owner.materialId+'/read')).text;assert.ok(text.includes('GENERATED_NAMED_IMAGE_INTERPRETATION'));}assert.equal(calls,2);
});

type FilesFixture=Awaited<ReturnType<typeof scopedFilesFixture>>;
async function saveImagePlan(f:FilesFixture,version='1'){
 const page=await f.checked(f.a.token,'/api/file-processing');
 return f.checked(f.a.token,'/api/file-processing','PUT',{revision:page.revision,settings:{...page.settings,automatic:true,understandingEnabled:false},policy:{version:1,services:[],profiles:[{id:'image',name:'Generated transition image',processorId:'image.http',parameters:{},summarize:false,imageRecipe:{id:'generated.transition-image',version}},{id:'archive',name:'Generated archive',processorId:'archive',parameters:{},summarize:false}],rules:[{type:'image/*',profileId:'image'},{type:'*/*',profileId:'archive'}]}});
}
async function attachTransitionImage(f:FilesFixture){
 const png=await sharp({create:{width:2,height:2,channels:3,background:'#345678'}}).png().toBuffer(),id=randomUUID();
 await f.checked(f.a.token,'/api/import-uploads','POST',{id,name:'transition.png',mimeType:'image/png',sizeBytes:png.length});
 assert.equal((await f.request(f.a.token,'/api/import-uploads/'+id+'/parts/0','PUT',png,{'content-type':'application/octet-stream'})).statusCode,200);
 const file=await f.checked(f.a.token,'/api/import-uploads/'+id+'/commit','POST',{}),parent=(await f.checked(f.a.token,'/api/ingress/sources/same-source/items','POST',{batchId:'transition-parent',items:[{externalId:'transition-parent',revision:'r1',observedAt:'2026-10-16T00:00:00Z',title:'Generated transition parent',text:'GENERATED_TRANSITION_CAPTION',kind:'message',layer:'original',document:{contentRole:'authored',timeBasis:'unknown',attachments:[{id:file.id,name:file.name,mimeType:file.mimeType}]}}]})).captures[0];
 f.host.ingress.forUser(await f.host.authority.authenticate(f.a.token)).attachArchivedFiles(parent.id,[file.id]);
 const child=await f.checked(f.a.token,'/api/records/'+parent.id+'/attachments/'+file.id+'/processing','POST',{});
 const materialId='mat_'+identityHash(['same-source','transition-parent']),artifactKey='attachment/'+file.id+'/look';
 const wait=async(state:string)=>{let manifest:any;await waitForScopedState(async()=>{const response=await f.request(f.a.token,'/api/materials/'+materialId);if(response.statusCode!==200)return false;manifest=response.json();return manifest.artifacts?.some((artifact:any)=>artifact.key===artifactKey&&artifact.state===state);},()=>JSON.stringify(manifest),12000);return manifest;};
 const text=async()=>(await f.checked(f.a.token,'/api/materials/'+materialId+'/read')).text as string;
 return {child,file,parent,materialId,artifactKey,wait,text};
}

test('HTTP default OCR and actual pixel understanding compose with archive retention and keep the parent pending until acceptance',async t=>{
 let captureId='',calls=0,ready!:()=>void,entered!:()=>void,release!:()=>void;
 const prepared=new Promise<void>(resolve=>ready=resolve),started=new Promise<void>(resolve=>entered=resolve),held=new Promise<void>(resolve=>release=resolve);t.after(()=>{ready();release();});
 const provider=createServer(async(req,res)=>{let body='';for await(const chunk of req)body+=chunk;
  if(req.url==='/transcribe'){res.setHeader('Content-Type','application/json');res.setHeader('X-Mote-Execution','local');res.end(JSON.stringify({durationMs:0,segments:[{startMs:0,endMs:0,text:'GENERATED_DEFAULT_OCR'}],coverage:'full',engine:'generated-default'}));return;}
  await prepared;if(++calls===1){writeMessagesResponse(res,{stage:calls,tool:{name:'read_image',args:{id:captureId,view:'image'}}});return;}
  assert.ok(body.includes('image/png'));entered();await held;writeMessagesResponse(res,{stage:calls,text:JSON.stringify({answer:JSON.stringify({text:'GENERATED_DEFAULT_PIXEL_INTERPRETATION',regions:[]}),citationIds:[captureId]})});
 });
 await new Promise<void>(resolve=>provider.listen(0,'127.0.0.1',resolve));t.after(async()=>{provider.closeAllConnections();await new Promise<void>(resolve=>provider.close(()=>resolve()));});const address=provider.address();assert.ok(address&&typeof address!=='string');
 const f=await scopedFilesFixture(t),page=await f.checked(f.a.token,'/api/file-processing');
 await f.checked(f.a.token,'/api/file-processing','PUT',{revision:page.revision,settings:{...page.settings,automatic:true,understandingEnabled:true},policy:{version:1,services:[{id:'ocr',name:'Generated OCR',kind:'image',reference:{kind:'personal',id:'ocr'}},{id:'language',name:'Generated pixel model',kind:'model',reference:{kind:'personal',id:'language'}}],profiles:[{id:'image',name:'Generated default image',processorId:'image.http',serviceId:'ocr',modelServiceId:'language',parameters:{},summarize:false},{id:'archive',name:'Generated archive',processorId:'archive',parameters:{},summarize:false}],rules:[{type:'image/*',profileId:'image'},{type:'*/*',profileId:'archive'}]},models:{profiles:[{id:'ocr',name:'Generated OCR',settings:{...defaultModelSettings(),provider:'custom',protocol:'mote-media',baseUrl:'http://127.0.0.1:'+address.port+'/transcribe',apiKey:'GENERATED_OCR_ONLY'}},{id:'language',name:'Generated pixel model',settings:{...defaultModelSettings(),provider:'custom',protocol:'anthropic-messages',baseUrl:'http://127.0.0.1:'+address.port+'/v1',model:'generated-pixels',apiKey:'GENERATED_PIXELS_ONLY'}}],selections:{}}});
 const image=await attachTransitionImage(f);captureId=image.child.captureId;ready();await started;
 const wait=async(state:string)=>{let manifest:any;await waitForScopedState(async()=>{const response=await f.request(f.a.token,'/api/materials/'+image.materialId);if(response.statusCode!==200)return false;manifest=response.json();return manifest.artifacts?.some((artifact:any)=>artifact.key==='attachment/'+image.file.id+'/understanding'&&artifact.state===state);},()=>JSON.stringify(manifest),10000);};
 await wait('pending');assert.ok((await image.text()).includes('GENERATED_DEFAULT_OCR'));release();await wait('ready');const text=await image.text();assert.ok(text.includes('GENERATED_DEFAULT_PIXEL_INTERPRETATION'));assert.ok(text.includes('original_image_reference'));assert.equal(calls,2);assert.equal((await f.checked(f.a.token,'/api/files/'+captureId)).processing.original.retention,'archive');
});

for(const [withOcr,dependent]of [[true,true],[true,false],[false,false]])test('HTTP '+(withOcr?'same-name':'image-only')+' recipe replacement rejects the '+(dependent?'old dependency':'old independent')+' interpretation receipt while its replacement is pending',async t=>{
 let version='1',entered!:()=>void,release!:()=>void;
 const started=new Promise<void>(resolve=>entered=resolve),held=new Promise<void>(resolve=>release=resolve);t.after(()=>release());
 const f=await scopedFilesFixture(t,node=>{
  const registry=node.processing!.processors.imageRecipes;
  registry.registerStage({id:'generated.transition-ocr',version:'1',kind:'ocr',run:async()=>({durationMs:0,segments:[{startMs:0,endMs:0,text:'GENERATED_OCR_V'+version}],coverage:'full',engine:'generated-transition'})});
  registry.registerStage({id:'generated.transition-look',version:'1',kind:'derived',run:async input=>{const current=version;if(current==='2'){entered();await held;}if(dependent)assert.equal((input.dependencies.scan as any).segments[0].text,'GENERATED_OCR_V'+current);return {text:'GENERATED_LOOK_V'+current,regions:[]};}});
  for(const current of ['1','2'])registry.registerRecipe({id:'generated.transition-image',version:current,steps:[...(withOcr?[{name:'scan',stage:{id:'generated.transition-ocr',version:'1'},dependsOn:[]}]:[]),{name:'look',stage:{id:'generated.transition-look',version:'1'},dependsOn:dependent?['scan']:[]}]});
 });
 await saveImagePlan(f);const image=await attachTransitionImage(f);await image.wait('ready');assert.ok((await image.text()).includes('GENERATED_LOOK_V1'));
 version='2';const saved=await saveImagePlan(f,'2'),preview=await f.checked(f.a.token,'/api/file-processing/preview','POST',{revision:saved.revision,type:'image/*',profileId:'image'});assert.equal(preview.count,1);
 await f.checked(f.a.token,'/api/file-processing/reprocess','POST',{token:preview.token});await started;await image.wait('pending');
 const pending=await image.text();assert.equal(pending.includes('GENERATED_OCR_V2'),withOcr);assert.ok(!pending.includes('GENERATED_LOOK_V1'));assert.ok(!pending.includes('GENERATED_LOOK_V2'));
 release();await image.wait('ready');const completed=await image.text();assert.ok(completed.includes('GENERATED_LOOK_V2'));assert.ok(!completed.includes('GENERATED_LOOK_V1'));
});

for(const withOcr of [true,false])for(const terminal of ['failed','cancelled'] as const)test('HTTP '+(withOcr?'OCR plus image':'image-only')+' attachment publishes its parent terminal '+terminal+' state after a held step',async t=>{
 let entered!:()=>void,release!:()=>void,retryEntered!:()=>void,retryRelease!:()=>void,retrying=false;
 const started=new Promise<void>(resolve=>entered=resolve),held=new Promise<void>(resolve=>release=resolve),retryStarted=new Promise<void>(resolve=>retryEntered=resolve),retryHeld=new Promise<void>(resolve=>retryRelease=resolve);t.after(()=>{release();retryRelease();});
 const f=await scopedFilesFixture(t,node=>{
  const registry=node.processing!.processors.imageRecipes;
  registry.registerStage({id:'generated.transition-ocr',version:'1',kind:'ocr',run:async()=>({durationMs:0,segments:[{startMs:0,endMs:0,text:'GENERATED_RETAINED_OCR'}],coverage:'full',engine:'generated-transition'})});
  registry.registerStage({id:'generated.transition-look',version:'1',kind:'derived',run:async()=>{if(retrying){retryEntered();await retryHeld;return {text:'GENERATED_RECOVERED_IMAGE',regions:[]};}entered();await held;if(terminal==='failed')throw Error('GENERATED_TERMINAL_IMAGE_FAILURE');return {text:'GENERATED_LATE_CANCELLED_IMAGE',regions:[]};}});
  registry.registerRecipe({id:'generated.transition-image',version:'1',steps:[...(withOcr?[{name:'scan',stage:{id:'generated.transition-ocr',version:'1'},dependsOn:[]}]:[]),{name:'look',stage:{id:'generated.transition-look',version:'1'},dependsOn:withOcr?['scan']:[]}]});
 });
 await saveImagePlan(f);const image=await attachTransitionImage(f);await started;await image.wait('pending');
 if(terminal==='cancelled')await f.checked(f.a.token,'/api/files/'+image.child.captureId+'/cancel','POST',{});
 release();await image.wait(terminal==='failed'?'failed':'unavailable');const text=await image.text();assert.ok(!text.includes('GENERATED_LATE_CANCELLED_IMAGE'));assert.equal(text.includes('GENERATED_RETAINED_OCR'),withOcr);
 const detail=await f.checked(f.a.token,'/api/files/'+image.child.captureId);assert.equal(detail.hasOriginal,true);assert.equal(detail.processing.derivations.length,0);
 await f.restart();await image.wait(terminal==='failed'?'failed':'unavailable');assert.ok(!(await image.text()).includes('GENERATED_LATE_CANCELLED_IMAGE'));
 if(terminal==='failed'){await waitForScopedState(async()=>(await f.checked(f.a.token,'/api/files/'+image.child.captureId)).job?.state==='failed',()=> 'terminal coordinator has not settled',10000);retrying=true;await f.checked(f.a.token,'/api/files/'+image.child.captureId+'/retry','POST',{operationId:'generated-terminal-retry',stage:'image-complete'});await retryStarted;await image.wait('pending');assert.ok(!(await image.text()).includes('GENERATED_RECOVERED_IMAGE'));retryRelease();await image.wait('ready');assert.ok((await image.text()).includes('GENERATED_RECOVERED_IMAGE'));}
});
