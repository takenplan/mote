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

for(const entry of ['derivation','recipe'] as const)for(const invalid of ['nested-json','shape','pixels'] as const)test(entry+' image rejects '+invalid+' within its failed usage fragment without a repair request',async t=>{
 let captureId='',calls=0,release!:()=>void;const captured=new Promise<void>(resolve=>release=resolve),secret='GENERATED_PRIVATE_IMAGE_RESPONSE',png=await sharp({create:{width:2,height:2,channels:3,background:'#538217'}}).png().toBuffer();
 const language=(await media(t,async(_req,res,bytes)=>{
  calls++;await captured;const body=JSON.parse(bytes.toString()),read=body.messages.some((message:any)=>Array.isArray(message.content)&&message.content.some((part:any)=>part.type==='tool_use'&&part.name==='read_image'));
  if(invalid!=='pixels'&&!read){writeMessagesResponse(res,{stage:calls,tool:{name:'read_image',args:{id:captureId,view:'image'}}});return;}
  const answer=invalid==='nested-json'?secret+'{':JSON.stringify(invalid==='shape'?{text:secret,regions:[{x:secret}]}:{text:'Generated unsupported interpretation',regions:[]});
  writeMessagesResponse(res,{stage:calls,text:JSON.stringify({answer,citationIds:invalid==='pixels'?[]:[captureId]})});
 })).replace('/transcribe','/v1');
 const settings={...defaultModelSettings(),provider:'custom',protocol:'anthropic-messages',model:'generated-image',baseUrl:language,apiKey:'GENERATED_IMAGE_MODEL_KEY'};
 let f:any,actor:any,ref:string,taskKind:string;
 if(entry==='derivation'){
  const worker=await media(t,(_req,res)=>respond(res,'GENERATED_IMAGE_OCR'));f=await processingFixture(t);actor=f.alice;await f.models(actor.token,worker,'GENERATED_OCR_KEY');const capture=(await f.upload(actor.token,png,'image/png')).captures[0];captureId=capture.id;ref=capture.original.ref;release();const core=await f.submit(actor.token,ref);await f.wait(actor.token,core.id);
  await f.configure(actor.token,'models',{profiles:[{id:'image-language',name:'Generated image language model',settings}],selections:{file:{kind:'personal',id:'image-language'}}});await f.checked(actor.token,'/api/processing/derivations','POST',{originalRef:ref,operationId:'generated-image-invalid',modes:['image']});taskKind='processing.analysis';
 }else{
  f=await scopedFilesFixture(t,node=>node.processing!.processors.imageRecipes.registerRecipe({id:'generated.acceptance-image-only',version:'1',steps:[{name:'understanding',stage:{id:'mote.image-understanding',version:'1'},dependsOn:[]}]}));
  f.read=(work:(db:DatabaseSync)=>unknown)=>{const db=new DatabaseSync(join(f.directory,'mote.sqlite'),{readOnly:true});try{return work(db);}finally{db.close();}};actor=f.a;const page=await f.checked(actor.token,'/api/file-processing');
  await f.checked(actor.token,'/api/file-processing','PUT',{revision:page.revision,settings:{...page.settings,automatic:true,understandingEnabled:true},policy:{version:1,services:[],profiles:[{id:'image',name:'Generated image-only',processorId:'image.http',parameters:{},summarize:false,imageRecipe:{id:'generated.acceptance-image-only',version:'1'}},{id:'archive',name:'Generated archive',processorId:'archive',parameters:{},summarize:false}],rules:[{type:'image/*',profileId:'image'},{type:'*/*',profileId:'archive'}]},models:{profiles:[{id:'image-language',name:'Generated image language model',settings}],selections:{file:{kind:'personal',id:'image-language'}}}});
  const file=await f.uploadBytes(actor.token,'generated-image-only-invalid',png,'image/png');captureId=file.id;ref=f.read((db:any)=>'original:'+db.prepare('SELECT id FROM ig_originals WHERE user_id=? AND capture_id=?').get(actor.userId,captureId).id);release();taskKind='processing.image-understanding';
 }
 t.after(release);const end=Date.now()+15000;let task:any;
 for(;;){task=f.read((db:any)=>db.prepare("SELECT id,state,error FROM execution_steps WHERE user_id=? AND kind=? AND json_extract(input,'$.originalRef')=? ORDER BY user_position DESC LIMIT 1").get(actor.userId,taskKind,ref));if(task?.state==='failed')break;assert.ok(Date.now()<end,JSON.stringify(task));await delay(10);}
 const failed=await f.checked(actor.token,'/api/tasks/'+task.id),code=invalid==='nested-json'?'agent_invalid_json':invalid==='shape'?'agent_invalid_shape':'agent_tools_unverified';
 assert.equal(failed.state,'failed');assert.equal(failed.error,code);assert.equal(failed.attempts,1);assert.ok(!JSON.stringify(failed).includes(secret));assert.equal(calls,invalid==='pixels'?1:2,'local acceptance rejection cannot trigger model repair or another processing attempt');
 const usage=(await f.checked(actor.token,'/api/usage')).items.filter((item:any)=>item.operation==='file');assert.equal(usage.length,1);assert.equal(usage[0].status,'failed');assert.equal(usage[0].issuance.state,'settled');assert.equal(usage[0].tokens.totalTokens,invalid==='pixels'?120:240);
 assert.equal(f.read((db:any)=>db.prepare('SELECT count(*) n FROM mp_artifact_usage WHERE user_id=? AND task_id=?').get(actor.userId,task.id).n),0,'an unaccepted result has no successful artifact sample');
 await f.restart();await delay(30);assert.equal(calls,invalid==='pixels'?1:2);assert.equal((await f.checked(actor.token,'/api/usage')).items.filter((item:any)=>item.operation==='file')[0].status,'failed');
});
