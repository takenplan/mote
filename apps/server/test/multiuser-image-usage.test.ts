import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {fixture as processingFixture,media,respond} from './fixtures/scoped-processing.js';
import {scopedFilesFixture} from './fixtures/scoped-files.js';
import {defaultModelSettings} from '../src/model-settings.js';
import {writeMessagesResponse} from '../../../scripts/fixtures/messages-provider.js';

for(const entry of ['derivation','recipe'] as const)for(const rejection of ['first-request','after-consumption'] as const)test(entry+' image '+rejection+' capacity wait meters only actual consumption and resumes through the user entry',async t=>{
 let captureId='',calls=0,ready=false,release!:()=>void;const captured=new Promise<void>(resolve=>release=resolve),png=await sharp({create:{width:2,height:2,channels:3,background:'#843721'}}).png().toBuffer();
 const language=(await media(t,async(_req,res,bytes)=>{
  calls++;const raw=bytes.toString(),body=JSON.parse(raw);await captured;
  if(!ready&&!(rejection==='after-consumption'&&calls===1)){res.writeHead(429,{'Content-Type':'application/json','Retry-After':'1'}).end(JSON.stringify({error:{message:'GENERATED_IMAGE_CAPACITY_SECRET'}}));return;}
  const read=body.messages.some((message:any)=>Array.isArray(message.content)&&message.content.some((part:any)=>part.type==='tool_use'&&part.name==='read_image'));
  if(!read){writeMessagesResponse(res,{stage:calls,tool:{name:'read_image',args:{id:captureId,view:'image'}}});return;}
  assert.ok(raw.includes(png.toString('base64')));writeMessagesResponse(res,{stage:calls,text:JSON.stringify({answer:JSON.stringify({text:'Generated resumed image interpretation',regions:[{x:0,y:0,width:1,height:1,description:'Generated patch'}]}),citationIds:[captureId]})});
 })).replace('/transcribe','/v1');
 const settings={...defaultModelSettings(),provider:'custom',protocol:'anthropic-messages',model:'generated-image',baseUrl:language,apiKey:'GENERATED_IMAGE_MODEL_KEY'};
 let f:any,actor:any,ref:string,taskKind:string;
 if(entry==='derivation'){
  const worker=await media(t,(_req,res)=>respond(res,'GENERATED_IMAGE_OCR'));f=await processingFixture(t);actor=f.alice;await f.models(actor.token,worker,'GENERATED_OCR_KEY');const capture=(await f.upload(actor.token,png,'image/png')).captures[0];captureId=capture.id;ref=capture.original.ref;release();const core=await f.submit(actor.token,ref);await f.wait(actor.token,core.id);
  await f.configure(actor.token,'models',{profiles:[{id:'image-language',name:'Generated image language model',settings}],selections:{file:{kind:'personal',id:'image-language'}}});await f.checked(actor.token,'/api/processing/derivations','POST',{originalRef:ref,operationId:'generated-image-busy',modes:['image']});taskKind='processing.analysis';
 }else{
  f=await scopedFilesFixture(t,node=>node.processing!.processors.imageRecipes.registerRecipe({id:'generated.metered-image-only',version:'1',steps:[{name:'understanding',stage:{id:'mote.image-understanding',version:'1'},dependsOn:[]}]}));f.read=(work:(db:DatabaseSync)=>unknown)=>{const db=new DatabaseSync(join(f.directory,'mote.sqlite'),{readOnly:true});try{return work(db);}finally{db.close();}};actor=f.a;const page=await f.checked(actor.token,'/api/file-processing');await f.checked(actor.token,'/api/file-processing','PUT',{revision:page.revision,settings:{...page.settings,automatic:true,understandingEnabled:true},policy:{version:1,services:[],profiles:[{id:'image',name:'Generated image-only',processorId:'image.http',parameters:{},summarize:false,imageRecipe:{id:'generated.metered-image-only',version:'1'}},{id:'archive',name:'Generated archive',processorId:'archive',parameters:{},summarize:false}],rules:[{type:'image/*',profileId:'image'},{type:'*/*',profileId:'archive'}]},models:{profiles:[{id:'image-language',name:'Generated image language model',settings}],selections:{file:{kind:'personal',id:'image-language'}}}});
  const file=await f.uploadBytes(actor.token,'generated-image-only-busy',png,'image/png');captureId=file.id;ref=f.read((db:any)=>'original:'+db.prepare('SELECT id FROM ig_originals WHERE user_id=? AND capture_id=?').get(actor.userId,captureId).id);release();taskKind='processing.image-understanding';
 }
 t.after(release);const end=Date.now()+15000;let task:any;
 for(;;){task=f.read((db:any)=>db.prepare("SELECT id,state,attempts,error FROM execution_steps WHERE user_id=? AND kind=? AND json_extract(input,'$.originalRef')=? ORDER BY user_position DESC LIMIT 1").get(actor.userId,taskKind,ref));if(task?.state==='waiting'&&task.error==='rate_limited')break;assert.ok(Date.now()<end,JSON.stringify(task));await delay(10);}
 const queued=await f.checked(actor.token,'/api/tasks/'+task.id);assert.equal(queued.state,'waiting');assert.equal(queued.attempts,0);assert.ok(queued.availableAt>Date.now());assert.ok(!JSON.stringify(queued).includes('GENERATED_IMAGE_CAPACITY_SECRET'));
 const during=(await f.checked(actor.token,'/api/usage')).items.filter((item:any)=>item.operation==='file');assert.equal(during.length,rejection==='after-consumption'?1:0,JSON.stringify(during));if(during.length){assert.equal(during[0].tokens.totalTokens,120);assert.equal(during[0].issuance.executionStarted,undefined);}
 ready=true;for(;;){const state=await f.checked(actor.token,'/api/tasks/'+task.id);if(state.state==='succeeded')break;assert.ok(!['failed','blocked','stale','cancelled'].includes(state.state),JSON.stringify(state));assert.ok(Date.now()<end,JSON.stringify(state));await delay(10);}
 const receipts=(await f.checked(actor.token,'/api/usage')).items.filter((item:any)=>item.operation==='file'),completed=receipts.filter((item:any)=>item.status==='completed');assert.equal(completed.length,1);assert.equal(completed[0].tokens.totalTokens,240);assert.equal(receipts.reduce((sum:number,item:any)=>sum+item.tokens.totalTokens,0),rejection==='after-consumption'?360:240);assert.equal(new Set(receipts.map((item:any)=>item.id)).size,receipts.length);assert.equal(new Set(receipts.map((item:any)=>item.issuance.leaseId)).size,1);
 const sample=f.read((db:any)=>db.prepare('SELECT json FROM mp_artifact_usage WHERE user_id=? AND task_id=?').get(actor.userId,task.id));assert.ok(sample);assert.equal(JSON.parse(sample.json).totalTokens,240,'the accepted artifact retains the successful query sample');
 const before=calls;await f.restart();await delay(30);assert.equal(calls,before,'a successful image checkpoint is not replayed after restart');
});
