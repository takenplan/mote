import test from 'node:test';
import {createServer} from 'node:http';
import {writeMessagesResponse} from '../../../../scripts/fixtures/messages-provider.js';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {scopedFilesFixture} from '../fixtures/scoped-files.js';
import {waitForScopedState} from '../fixtures/scoped-process.js';
import {bytesHash} from '../../src/scope/originals.js';
import {defaultModelSettings} from '../../src/model-settings.js';

type Fixture=Awaited<ReturnType<typeof scopedFilesFixture>>;

const png=()=>sharp({create:{width:2,height:2,channels:3,background:'#23578a'}}).png().toBuffer();

async function settings(f:Fixture,token:string,patch:Record<string,unknown>){const page=await f.checked(token,'/api/perception');return f.checked(token,'/api/perception','PUT',{revision:page.revision,settings:{...page.settings,...patch}});}

async function policy(f:Fixture,token:string,archive=false){const page=await f.checked(token,'/api/file-processing');return f.checked(token,'/api/file-processing','PUT',{revision:page.revision,settings:page.settings,policy:{version:1,services:[],profiles:[...['one','two'].map(id=>({id,name:'Generated '+id,processorId:'image.http',parameters:{},summarize:false,imageRecipe:{id:'generated.'+id,version:'1'}})),{id:'archive',name:'Generated archive',processorId:'archive',parameters:{},summarize:false}],rules:[{type:'image/*',profileId:archive?'archive':'one'},{type:'*/*',profileId:'archive'}]}});}

function generated(f:{processing:NonNullable<Fixture['host']['processing']>},runs:string[],pause?:(id:string,signal:AbortSignal)=>Promise<void>){const registry=f.processing.processors.imageRecipes;for(const id of ['one','two']){registry.registerStage({id:'generated.'+id,version:'1',kind:'ocr',run:async input=>{const pixels=await input.readImage({view:'metadata'});assert.equal(pixels.imageView?.original.width,2);runs.push(id+':'+input.record.provenance?.externalId);if(pause)await pause(input.record.provenance?.externalId??input.record.id,input.signal);return {durationMs:0,engine:'generated-'+id,segments:[{startMs:0,endMs:0,text:'GENERATED_'+id}]};}});registry.registerRecipe({id:'generated.'+id,version:'1',steps:[{name:'scan',stage:{id:'generated.'+id,version:'1'},dependsOn:[]}]});}}

async function upload(f:Fixture,token:string,id:string,at:string,sourceId='same-source'){
 const bytes=await png(),hash=bytesHash(bytes),opened=await f.checked(token,'/api/ingress/sources/'+sourceId+'/uploads','POST',{batchId:id,revision:{sourceId,previousRevision:null,sizeBytes:bytes.length,sha256:hash,relativePath:id+'.png',item:{externalId:id,revision:'r1',observedAt:at,title:id,text:'',kind:'file',layer:'original',mimeType:'image/png'}}});
 await f.checked(token,'/api/ingress/uploads/'+opened.id+'/parts/0','PUT',{bytes:bytes.toString('base64'),checksum:hash});return (await f.checked(token,'/api/ingress/uploads/'+opened.id+'/commit','POST',{})).captures[0];
}

const read=(f:Fixture,token:string,id:string)=>f.checked(token,'/api/files/'+id);

async function done(f:Fixture,token:string,id:string,timeoutMs=12000){let detail:any;await waitForScopedState(async()=>{detail=await read(f,token,id);return detail.job?.state==='succeeded';},()=>JSON.stringify(detail),timeoutMs);return detail;}

export {Fixture,png,settings,policy,generated,upload,read,done};
