import type {TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {buildApp} from '../../src/app.js';
import type {MediaCatalog} from '../../src/media-assets.js';

export async function scopedMediaFixture(t:TestContext){
 const directory=mkdtempSync(join(tmpdir(),'mote-scoped-media-')),weights=new Map<string,Buffer>(),catalog={} as MediaCatalog;
 const hash=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
 for(const role of ['ocr','dialogue','speaker-wespeaker'] as const){
  const names=role==='ocr'?['det','rec']:role==='dialogue'?['model.bin','config.json','tokenizer.json','vocabulary.txt','segmentation.onnx','speaker.onnx']:['speaker.onnx'];
  catalog[role]={version:'generated-'+role,files:names.map(name=>{
   let bytes:Buffer;if(role==='ocr'){const root=join(directory,'bundles',name);mkdirSync(root,{recursive:true});for(const file of ['inference.onnx','inference.yml'])writeFileSync(join(root,file),'GENERATED_'+name+'_'+file);const path=join(directory,name+'.tar');execFileSync('tar',['-cf',path,'-C',join(directory,'bundles'),name]);bytes=readFileSync(path);}else bytes=Buffer.from('GENERATED_'+role+'_'+name);
   const filename=role+'-'+name+(role==='ocr'?'.tar':'');weights.set('/'+filename,bytes);return {name:role==='ocr'?name+'.tar':name,size:bytes.length,sha256:hash(bytes),official:'https://generated-weights.invalid/'+filename,...(role==='ocr'?{extract:{entry:name+'/inference.onnx',destination:name+'/inference.onnx',kind:'tar' as const}}:{})};
  })};
 }
 const requests:{path:string;range?:string}[]=[],calls:{path:string;authorization?:string;bytes:number}[]=[];let workerReady=true;let hold=false,release!:()=>void,entered=false,bad=false;let barrier=Promise.resolve();
 const server=createServer((req,res)=>{void(async()=>{
  const path=new URL(req.url!,'http://fixture').pathname;
  if(path.startsWith('/weights/')){const key=decodeURIComponent(path.slice('/weights'.length)),bytes=weights.get(key);assert.ok(bytes,key);requests.push({path:key,range:req.headers.range});const start=Number(/^bytes=(\d+)-$/.exec(req.headers.range??'')?.[1]??0),part=bad?Buffer.alloc(bytes.length,0):bytes.subarray(start);res.writeHead(start?206:200,{'content-length':part.length,...(start?{'content-range':`bytes ${start}-${bytes.length-1}/${bytes.length}`}:{})});
   if(hold){entered=true;const split=Math.max(1,Math.floor(part.length/2));res.write(part.subarray(0,split));await barrier;if(!res.destroyed)res.end(part.subarray(split));}else res.end(part);return;
  }
  const parts:Buffer[]=[];for await(const part of req)parts.push(part);calls.push({path,authorization:req.headers.authorization,bytes:Buffer.concat(parts).length});
  assert.equal(req.headers.authorization,'Bearer generated-instance-worker');res.setHeader('content-type','application/json');
  if(path==='/health'){if(!workerReady){res.statusCode=503;res.end('{}');return;}res.end(JSON.stringify({version:1,execution:'local',ocr:true,asr:true,diarization:true,wespeaker:true,missingDependencies:[]}));}
  else{res.setHeader('X-Mote-Execution','local');res.end(JSON.stringify({durationMs:path==='/ocr'?0:1000,segments:[{startMs:0,endMs:path==='/ocr'?0:1000,text:'GENERATED_MANAGED_'+(path==='/ocr'?'OCR':'ASR')}]}));}
 })().catch(()=>{res.statusCode=500;res.end('{}');});});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();assert.ok(address&&typeof address!=='string');const endpoint='http://127.0.0.1:'+address.port;
 let host=await buildApp({dataDir:join(directory,'vault'),media:{modelDirectory:join(directory,'models'),workerToken:'generated-instance-worker',ocrEndpoint:endpoint+'/ocr',asrEndpoint:endpoint+'/transcribe'}},{mediaAssets:{catalog,fetch:(url,options)=>fetch(endpoint+'/weights'+new URL(String(url)).pathname,options)}});
 t.after(async()=>{release?.();await host.app.close();await new Promise<void>(resolve=>server.close(()=>resolve()));rmSync(directory,{recursive:true,force:true});});
 const headers={'x-mote-protocol-version':'2','x-mote-ingress-version':'3'},password='Generated-only-password';
 const request=(token:string|undefined,url:string,method:any='GET',payload?:unknown)=>host.app.inject({url,method,headers:{...headers,...(token?{authorization:'Bearer '+token}:{})},...(payload===undefined?{}:{payload:payload as any})});
 const checked=async(...args:Parameters<typeof request>)=>{const response=await request(...args);assert.equal(response.statusCode,200,response.body);return response.json();};
 await host.accounts!.initialize('generated-admin',password);const admin=await checked(undefined,'/api/auth/login','POST',{username:'generated-admin',password,mode:'client'});for(const username of ['generated-a','generated-b'])await checked(admin.token,'/api/admin/accounts','POST',{username,password});
 const a=await checked(undefined,'/api/auth/login','POST',{username:'generated-a',password,mode:'client'}),b=await checked(undefined,'/api/auth/login','POST',{username:'generated-b',password,mode:'client'});
 const restart=async()=>{await host.app.close();host=await buildApp({dataDir:join(directory,'vault'),media:{modelDirectory:join(directory,'models'),workerToken:'generated-instance-worker',ocrEndpoint:endpoint+'/ocr',asrEndpoint:endpoint+'/transcribe'}},{mediaAssets:{catalog,fetch:(url,options)=>fetch(endpoint+'/weights'+new URL(String(url)).pathname,options)}});};
 const bundle=(role:keyof MediaCatalog)=>{const path=join(directory,'local',role);mkdirSync(path,{recursive:true});for(const item of catalog[role].files)writeFileSync(join(path,item.name),weights.get(new URL(item.official).pathname)!);return path;};
 return {directory,catalog,endpoint,bundle,worker:(value:boolean)=>{workerReady=value;},get host(){return host;},admin,a,b,request,checked,requests,calls,restart,hold:()=>{hold=true;entered=false;barrier=new Promise<void>(resolve=>{release=resolve});},entered:()=>entered,release:()=>{hold=false;release?.();},corrupt:(value:boolean)=>{bad=value;}};
}
