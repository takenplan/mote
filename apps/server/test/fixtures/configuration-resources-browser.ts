import type {TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {createServer,request as forward} from 'node:http';
import {writeFileSync} from 'node:fs';
import sharp from 'sharp';
// This is an explicit combined-tree journey. The Files owner supplies this real
// startup fixture, generated installer bundles and generated worker transport.
import {scopedMediaFixture} from './scoped-media.js';
import {bytesHash} from '../../src/scope/originals.js';
import {defaultProcessingSettings} from '../../src/scope/processing-schema.js';

const cleanup:Array<()=>unknown>=[],f=await scopedMediaFixture({after:(work:()=>unknown)=>cleanup.push(work)} as unknown as TestContext);
const requests:Array<{method:string;path:string}>=[];
let holdImage=false,imageEntered=false,releaseImage:()=>void=()=>{},imageGate=Promise.resolve();
const registry=f.host.processing!.processors.imageRecipes;
registry.registerStage({id:'generated.configuration-image',version:'1',kind:'ocr',run:async input=>{await input.readImage({view:'metadata'});return {durationMs:0,engine:'generated',segments:[{startMs:0,endMs:0,text:'GENERATED_CONFIGURATION_IMAGE'}]};}});
registry.registerRecipe({id:'generated.configuration-image',version:'1',steps:[{name:'scan',stage:{id:'generated.configuration-image',version:'1'},dependsOn:[]}]});
const image=await sharp({create:{width:3,height:3,channels:3,background:'#234567'}}).png().toBuffer(),hash=bytesHash(image);
for(const actor of [f.a,f.b]){
 let view=await f.checked(actor.token,'/api/configuration');const memory=view.domains.find((domain:any)=>domain.id==='memory').effective;
 await f.checked(actor.token,'/api/configuration/memory','PUT',{revision:view.revision,value:{...memory,automatic:false,integration:false,lifecycle:{...memory.lifecycle,insights:{...memory.lifecycle.insights,enabled:false},working:{...memory.lifecycle.working,enabled:false},consolidation:{...memory.lifecycle.consolidation,enabled:false}}}});
 view=await f.checked(actor.token,'/api/configuration');await f.checked(actor.token,'/api/configuration/processing','PUT',{revision:view.revision,value:{...defaultProcessingSettings(),automatic:false,summarize:false,semanticTurns:false}});
 await f.checked(actor.token,'/api/ingress/sources','POST',{id:'generated-image',name:'Generated images',kind:'local-files',deviceId:'generated-device',platform:'import',retention:'archive'});
 let page=await f.checked(actor.token,'/api/file-processing');
 const policy={version:1,services:[],profiles:[{id:'image',name:'Generated image recipe',processorId:'image.http',parameters:{},summarize:false,imageRecipe:{id:'generated.configuration-image',version:'1'}},{id:'archive',name:'Generated archive',processorId:'archive',parameters:{},summarize:false}],rules:[{type:'image/*',profileId:'archive'},{type:'*/*',profileId:'archive'}]};
 await f.checked(actor.token,'/api/file-processing','PUT',{revision:page.revision,settings:page.settings,policy});
 for(let index=0;index<2;index++){
  const id='generated-image-'+index,opened=await f.checked(actor.token,'/api/ingress/sources/generated-image/uploads','POST',{batchId:id,revision:{sourceId:'generated-image',previousRevision:null,sizeBytes:image.length,sha256:hash,relativePath:id+'.png',item:{externalId:id,revision:'r1',observedAt:'2026-10-16T12:00:00Z',title:id,text:'',kind:'file',layer:'original',mimeType:'image/png'}}});
  await f.checked(actor.token,'/api/ingress/uploads/'+opened.id+'/parts/0','PUT',{bytes:image.toString('base64'),checksum:hash});await f.checked(actor.token,'/api/ingress/uploads/'+opened.id+'/commit','POST',{});
 }
 const perception=await f.checked(actor.token,'/api/perception');await f.checked(actor.token,'/api/perception','PUT',{revision:perception.revision,settings:{...perception.settings,enabled:false,understandingEnabled:false,profileId:'image'}});
}
assert.equal(f.requests.length,0,'startup must never authorize a model download');
const control=createServer((request,response)=>{void(async()=>{
 if(request.method!=='POST'){response.statusCode=405;response.end();return;}
 const path=request.url;
 if(path==='/generated/hold-media')f.hold();else if(path==='/generated/release-media')f.release();
 else if(path==='/generated/corrupt-media')f.corrupt(true);else if(path==='/generated/valid-media')f.corrupt(false);
 else if(path==='/generated/worker-offline')f.worker(false);else if(path==='/generated/worker-online')f.worker(true);
 else if(path==='/generated/hold-image-save'){holdImage=true;imageEntered=false;imageGate=new Promise<void>(resolve=>{releaseImage=resolve;});}
 else if(path==='/generated/release-image-save'){holdImage=false;releaseImage();}
 else if(path!=='/generated/resource-state'){response.statusCode=404;response.end();return;}
 response.setHeader('content-type','application/json');response.end(JSON.stringify({requests,downloads:f.requests,imageEntered}));
 })().catch(error=>{response.statusCode=500;response.end(String(error));});});
await new Promise<void>(resolve=>control.listen(0,'127.0.0.1',resolve));const controlAddress=control.address();assert.ok(controlAddress&&typeof controlAddress!=='string');
const upstream=await f.host.app.listen({host:'127.0.0.1',port:0});
// Loopback transport fault gates preserve the producer's exact HTTP response.
// Account validation, configuration CAS and all product work remain upstream.
const proxy=createServer((request,response)=>{
 requests.push({method:request.method!,path:request.url!});
 const remote=forward(upstream+request.url,{method:request.method,headers:request.headers},reply=>{void(async()=>{
  if(holdImage&&request.method==='PUT'&&request.url==='/api/perception'){imageEntered=true;await imageGate;}
  response.writeHead(reply.statusCode!,reply.headers);reply.pipe(response);
 })().catch(()=>response.destroy());});
 remote.on('error',()=>response.destroy());request.pipe(remote);
});
await new Promise<void>(resolve=>proxy.listen(0,'127.0.0.1',resolve));const proxyAddress=proxy.address();assert.ok(proxyAddress&&typeof proxyAddress!=='string');
const port=proxyAddress.port,address='http://127.0.0.1:'+port,controlPort=controlAddress.port;
const metadata={address,controlAddress:'http://127.0.0.1:'+controlPort,androidAddress:'http://127.0.0.1:'+port,androidControlAddress:'http://127.0.0.1:'+controlPort,port:Number(port),controlPort,a:f.a,b:f.b,admin:f.admin,password:'Generated-only-password',resourceFixture:true,pid:process.pid};
const output=process.argv.indexOf('--output');if(output!==-1){assert.ok(process.argv[output+1]);writeFileSync(process.argv[output+1],JSON.stringify(metadata,null,2));}
process.stdout.write(JSON.stringify(metadata)+'\n');
let closing=false;async function close(){if(closing)return;closing=true;holdImage=false;releaseImage();f.release();proxy.closeAllConnections();await new Promise<void>(resolve=>proxy.close(()=>resolve()));control.closeAllConnections();await new Promise<void>(resolve=>control.close(()=>resolve()));for(const work of cleanup.reverse())await work();process.exit(0);}
process.on('SIGTERM',()=>void close());process.on('SIGINT',()=>void close());
