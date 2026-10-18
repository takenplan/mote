import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {historyAskFixture,deferred} from './fixtures/history-ask-fixture.js';
import {materialId} from '../src/materials.js';

async function imageArchive(t:import('node:test').TestContext){
 const f=await historyAskFixture(t),images=new Map<string,{ref:string;id:string;hash:string}>();
 for(const [user,owner,color]of [[f.a,'A','#cc2200'],[f.b,'B','#0022cc']] as const){
  const bytes=await sharp({create:{width:2,height:2,channels:3,background:color}}).png().toBuffer(),hash=createHash('sha256').update(bytes).digest('hex'),sourceId='same-images';
  await f.checked(user.token,'/api/ingress/sources','POST',{id:sourceId,name:'Generated image archive',kind:'upload',deviceId:'same-device',platform:'import',retention:'archive'});
  const upload=await f.checked(user.token,'/api/ingress/sources/'+sourceId+'/uploads','POST',{batchId:'same-image',revision:{sourceId,item:{externalId:'same-image',revision:'v1',observedAt:'2026-01-01T00:00:00Z',title:'Generated image '+owner,text:'',kind:'file',layer:'original',mimeType:'image/png'},sizeBytes:bytes.length,sha256:hash,relativePath:'generated.png'}});
  await f.checked(user.token,'/api/ingress/uploads/'+upload.id+'/parts/0','PUT',{bytes:bytes.toString('base64'),checksum:hash});const receipt=await f.checked(user.token,'/api/ingress/uploads/'+upload.id+'/commit','POST',{}),context=await f.node.authority.authenticate(user.token),material=f.node.ingress.bindSource(context,[sourceId],()=>{}).publishMaterial({id:materialId(sourceId,'same-image'),kind:'document',schemaVersion:1,title:'Generated image '+owner,origin:{sourceId,externalId:'same-image',deviceId:'same-device'},blocks:[{id:'caption',kind:'text',format:'plain',text:'GENERATED_EXISTING_CAPTION_'+owner,memberIds:['original']}],members:[{id:'original',kind:'capture',ref:'capture:'+receipt.captures[0].id}],coverage:{state:'complete'},fidelity:{state:'lossless'},retention:{original:'retained',policy:'keep'}});
  const reader=f.node.ask!.bind(context,{sourceIds:[sourceId],assertCurrent:()=>f.node.authority.assert(context)}).reader();await reader.agent.materialRead!({ref:material.ref});const records=await reader.agent.sourceItems!({sourceId,limit:100}),image=records.items.find(record=>record.ocrText.includes('authorized-original-image'));assert.ok(image);images.set(owner,{ref:material.ref,id:image.id,hash});
 }
 const permission=async(user:any,allowQueryImages:boolean)=>{const view=await f.checked(user.token,'/api/configuration'),value=view.domains.find((domain:any)=>domain.id==='perception').effective;await f.checked(user.token,'/api/configuration/perception','PUT',{revision:view.revision,value:{...value,allowQueryImages}});};
 const reader=async(user:any)=>{const context=await f.node.authority.authenticate(user.token);return f.node.ask!.bind(context,{sourceIds:['same-images'],assertCurrent:()=>f.node.authority.assert(context)}).reader();};
 return {...f,images,permission,reader};
}

test('archive query image permission defaults off, isolates owners and changes immediately without hiding existing text',async t=>{
 const f=await imageArchive(t),image=f.images.get('A')!,reader=await f.reader(f.a),page=await reader.agent.materialRead!({ref:image.ref});assert.match(page.text,/GENERATED_EXISTING_CAPTION_A/);
 await assert.rejects(reader.agent.readImage!({id:image.id,view:'image'}),(error:any)=>error.code==='image_disclosure_disabled');
 await f.permission(f.a,true);const result=await reader.agent.readImage!({id:image.id,view:'image'});assert.equal(result.imageView!.original.sha256,image.hash);assert.ok(result.data);
 const other=await f.reader(f.b);await other.agent.materialRead!({ref:f.images.get('B')!.ref});await assert.rejects(other.agent.readImage!({id:f.images.get('B')!.id,view:'image'}),(error:any)=>error.code==='image_disclosure_disabled');
 await f.permission(f.b,true);await assert.rejects(other.agent.readImage!({id:image.id,view:'image'}));assert.equal((await other.agent.readImage!({id:f.images.get('B')!.id,view:'image'})).imageView!.original.sha256,f.images.get('B')!.hash);
 await f.permission(f.a,false);await assert.rejects(reader.agent.readImage!({id:image.id,view:'image'}),(error:any)=>error.code==='image_disclosure_disabled');assert.match((await reader.agent.materialRead!({ref:image.ref})).text,/GENERATED_EXISTING_CAPTION_A/);
});

test('archive query image permission is rechecked after actual original pixels await before disclosure',async t=>{
 const f=await imageArchive(t),image=f.images.get('A')!;await f.permission(f.a,true);const entered=deferred(),gate=deferred();t.after(()=>gate.resolve());
 const memory=f.node.memory!,bind=memory.bindRead.bind(memory);t.mock.method(memory,'bindRead',(...args:Parameters<typeof bind>)=>{const port=bind(...args);return {...port,readImage:async(input:Parameters<typeof port.readImage>[0])=>{const value=await port.readImage(input);entered.resolve();await gate.promise;return value;}};});
 const reader=await f.reader(f.a);await reader.agent.materialRead!({ref:image.ref});const pending=reader.agent.readImage!({id:image.id,view:'image'}).then(value=>({value}),error=>({error}));await entered.promise;await f.permission(f.a,false);gate.resolve();const outcome=await pending;assert.ok('error' in outcome);assert.equal((outcome.error as any).code,'image_disclosure_disabled');assert.ok(!('value' in outcome));
});
