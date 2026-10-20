import test from 'node:test';
import {createServer} from 'node:http';
import {writeMessagesResponse} from '../../../scripts/fixtures/messages-provider.js';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {scopedFilesFixture} from './fixtures/scoped-files.js';
import {waitForScopedState} from './fixtures/scoped-process.js';
import {bytesHash} from '../src/scope/originals.js';
import {defaultModelSettings} from '../src/model-settings.js';
import {Fixture,png,settings,policy,generated,upload,read,done} from './fixtures/multiuser-perception-history-suite.js';

for(const limit of [8])test(`image declared kinds physically execute ${limit} held stages each without sharing another owner's capacity`,async t=>{
 const held=new Map<string,()=>void>(),active=new Set<string>(),started:string[]=[],f=await scopedFilesFixture(t,node=>{
  const registry=node.processing!.processors.imageRecipes;
  for(const kind of ['ocr','understanding','derived'] as const){
   registry.registerStage({id:'generated.capacity-'+kind,version:'1',kind,run:async input=>{
    const id=input.record.provenance!.externalId;await input.readImage({view:'metadata'});started.push(id);active.add(id);
    try{await new Promise<void>((resolve,reject)=>{held.set(id,resolve);input.signal.addEventListener('abort',()=>reject(Error('generated-stop')),{once:true});});}
    finally{active.delete(id);}
    return kind==='ocr'?{durationMs:0,segments:[{startMs:0,endMs:0,text:'GENERATED_CAPACITY'}]}:{text:'GENERATED_CAPACITY',regions:[]};
   }});
   registry.registerRecipe({id:'generated.capacity-'+kind,version:'1',steps:[{name:'hold',stage:{id:'generated.capacity-'+kind,version:'1'},dependsOn:[]}]});
  }
 });
 const kinds=['ocr','understanding','derived'],files:{token:string;id:string}[]=[],count=(owner:string,kind:string)=>[...active].filter(id=>id.startsWith(owner+'-'+kind+'-')).length;
 for(const [owner,actor,capacity] of [['a',f.a,limit],['b',f.b,1]] as const){
  const page=await f.checked(actor.token,'/api/file-processing');await f.checked(actor.token,'/api/file-processing','PUT',{revision:page.revision,settings:page.settings,policy:{version:1,services:[],profiles:[...kinds.map(kind=>({id:kind,name:'Generated '+kind,processorId:'image.http',parameters:{},summarize:false,imageRecipe:{id:'generated.capacity-'+kind,version:'1'}})),{id:'archive',name:'Generated archive',processorId:'archive',parameters:{},summarize:false}],rules:[{type:'image/*',profileId:'ocr'},{type:'*/*',profileId:'archive'}]}});
  await settings(f,actor.token,{concurrency:capacity});
  for(const kind of kinds)for(let index=0;index<capacity+1;index++){
   const externalId=owner+'-'+kind+'-'+index,bytes=await png(),hash=bytesHash(bytes),opened=await f.checked(actor.token,'/api/ingress/sources/same-source/uploads','POST',{batchId:externalId,revision:{sourceId:'same-source',sizeBytes:bytes.length,sha256:hash,processingProfileId:kind,item:{externalId,revision:'1',observedAt:'2026-10-16T00:00:00Z',title:externalId,text:'',kind:'file',layer:'original',mimeType:'image/png'}}});
   await f.checked(actor.token,'/api/ingress/uploads/'+opened.id+'/parts/0','PUT',{bytes:bytes.toString('base64'),checksum:hash});const receipt=await f.checked(actor.token,'/api/ingress/uploads/'+opened.id+'/commit','POST',{});files.push({token:actor.token,id:receipt.captures[0].id});
  }
 }
 await waitForScopedState(()=>kinds.every(kind=>count('a',kind)===limit&&count('b',kind)===1),()=>JSON.stringify({active:[...active],started}),6000);
 await delay(150);assert.equal(active.size,limit*3+3,'actual held stage executions, not waiting/admitted task counts');
 await settings(f,f.a.token,{concurrency:1});assert.equal(active.size,limit*3+3,'lowering the limit preserves already executing work');
 for(const kind of kinds){const ids=[...active].filter(id=>id.startsWith('a-'+kind+'-'));for(const id of ids.slice(1))held.get(id)!();}
 await waitForScopedState(()=>kinds.every(kind=>count('a',kind)===1),()=>JSON.stringify([...active]),6000);await delay(200);
 for(const kind of kinds)assert.equal(started.filter(id=>id.startsWith('a-'+kind+'-')).length,limit,'lowering waits for occupied capacity instead of admitting another stage');
 for(const release of held.values())release();await waitForScopedState(()=>started.length===files.length,()=>JSON.stringify(started),6000);for(const release of held.values())release();
 for(const file of files)await done(f,file.token,file.id);assert.equal((await f.request(f.b.token,'/api/files/'+files[0].id)).statusCode,404);
});
