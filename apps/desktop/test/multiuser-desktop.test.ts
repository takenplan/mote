import {afterEach,expect,it,vi,beforeAll} from 'vitest';
import {mkdtemp,readFile,rm,writeFile,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fork,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {DesktopAccountStorage} from '../src/account-storage';
import {LocalSourceManager} from '../src/source-manager';
import {DEFAULT_SOURCE_OPTIONS} from '../src/source-types';
import {browseCaptures,captureDetail,captureImage} from '../src/capture-browser';
import {centralContentPage} from '../src/content-library';
import {readCentralContent} from '../src/sync-content';
import {uploadCapture,uploadCaptureBatch} from '../src/transport';
import {ensureStorageFormat} from '../src/storage-format';
import sharp from 'sharp';
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';
const repository=fileURLToPath(new URL('../../../',import.meta.url));
const nativeImport=createRequire(import.meta.url)('./native-backend.cjs') as (url:string)=>Promise<any>;
import {defaultConfig} from '../src/config';
import {testConnection} from '../src/connection';
import {DurableQueue} from '../src/queue';
import {sourceConnectionBinding} from '../src/login-session';
import {event,image} from './fixtures';

vi.mock('electron',async()=>{
 const {EventEmitter}=await import('node:events');
 return {powerMonitor:Object.assign(new EventEmitter(),{getSystemIdleTime:()=>0}),systemPreferences:{getMediaAccessStatus:()=> 'granted'},desktopCapturer:{getSources:vi.fn()},screen:{},nativeImage:{}};
});
import {Collector} from '../src/collector';

const cleanup:(()=>Promise<unknown>)[]=[];
beforeAll(async()=>{await promisify(execFile)(process.execPath,[resolve(repository,'node_modules/typescript/bin/tsc'),'-p',resolve(repository,'apps/desktop/tsconfig.json')]);},60000);
afterEach(async()=>{for(const close of cleanup.splice(0).reverse())await close();vi.unstubAllGlobals();});
async function fixture(){
 const {buildApp}=await nativeImport(pathToFileURL(resolve(repository,'apps/server/src/app.ts')).href) as typeof import('../../server/src/app');
 const directory=await mkdtemp(join(tmpdir(),'mote-m14-generated-'));cleanup.push(()=>rm(directory,{recursive:true,force:true}));
 const node=await buildApp({dataDir:join(directory,'central')});cleanup.push(()=>node.app.close());
 const password='Generated-desktop-only-01';await node.accounts!.initialize('generated-admin',password);
 const headers={'x-mote-protocol-version':'2','x-mote-ingress-version':'3'};
 const request=(token:string|undefined,url:string,method:any='GET',payload?:unknown)=>node.app.inject({url,method,headers:{...headers,...(token?{authorization:'Bearer '+token}:{})},...(payload===undefined?{}:{payload})});
 const login=async(username:string)=>{const r=await request(undefined,'/api/auth/login','POST',{username,password,mode:'client'});expect(r.statusCode,r.body).toBe(200);return r.json();};
 const admin=await login('generated-admin');
 for(const username of ['generated-a','generated-b'])expect((await request(admin.token,'/api/admin/accounts','POST',{username,password})).statusCode).toBe(200);
 const a=await login('generated-a'),b=await login('generated-b');
 const base=defaultConfig(),config=(grant:typeof a)=>({...base,token:grant.token,syncMode:'manual' as const,packedUpload:false,account:{origin:base.serverUrl,deploymentId:grant.deploymentId,userId:grant.userId,username:grant===a?'generated-a':'generated-b'}});
 const calls:{url:string;authorization:string|null;body:any}[]=[];
 const fetcher=vi.fn(async(input:RequestInfo|URL,init:RequestInit={})=>{const url=new URL(String(input)),body=init.body?await new Response(init.body).text():undefined;const h=new Headers(init.headers);calls.push({url:url.pathname,authorization:h.get('authorization'),body:body?JSON.parse(body):undefined});const response=await node.app.inject({url:url.pathname+url.search,method:(init.method??'GET') as any,headers:Object.fromEntries(h),...(body?{payload:body}:{})});return new Response(response.rawPayload,{status:response.statusCode,headers:response.headers as Record<string,string>});});
 vi.stubGlobal('fetch',fetcher);
 return {directory,node,a,b,config,request,login,fetcher,calls};
}
it('characterizes the actual durable input/blob journal and same-owner retry before transport changes',async()=>{
 const f=await fixture(),config=f.config(f.a),path=join(f.directory,'queue');
 let queue=new DurableQueue(path,config);await queue.initialize();await queue.enqueue(event(),image);await queue.failed(event().id,100,()=>0.5);
 const before=await readFile(join(path,'events',event().id+'.json'));queue=new DurableQueue(path,config);await queue.initialize();
 expect(queue.stats().depth).toBe(1);expect((await queue.next(1_000_000))!.image).toEqual(image);expect(await readFile(join(path,'events',event().id+'.json'))).toEqual(before);
});
it('keeps real original spools, source cursors and drafts separated while A and B share device and input bytes',async()=>{
 const f=await fixture(),secrets={available:()=>true,encrypt:(v:string)=>Buffer.from(v),decrypt:(v:Buffer)=>v.toString()},storage=new DesktopAccountStorage(join(f.directory,'desktop'),secrets);
 const input=join(f.directory,'generated.md');await writeFile(input,'Generated equal file bytes; no personal data.');
 for(const grant of [f.a,f.b]){
  const config=f.config(grant),directory=await storage.open(config),sources=new LocalSourceManager(join(directory,'sources'),config,'/generated/no-helper',true);cleanup.push(()=>sources.close());
  await sources.initialize();await sources.addFiles(input,{...DEFAULT_SOURCE_OPTIONS,retention:'archive'});await sources.sync(true);
  expect(sources.pendingContent(),JSON.stringify(sources.status())).toHaveLength(1);await sources.flushPending(new AbortController().signal);expect(sources.pendingContent()).toHaveLength(0);
  const context=await f.node.authority.authenticate(grant.token),originals=f.node.ingress.forUser(context).pageOriginals(sources.status()[0].source.id);
  expect(originals.items).toHaveLength(1);
 }
 expect(storage.directory(f.config(f.a))).not.toBe(storage.directory(f.config(f.b)));
 expect(f.calls.filter(v=>v.url.includes('file-sync'))).toHaveLength(0);
});

async function productionDesktop(f:Awaited<ReturnType<typeof fixture>>,profile=join(f.directory,'profile')){
 const child=fork(resolve(repository,'apps/desktop/test/main-process-fixture.cjs'),[profile],{cwd:repository,env:{...process.env,MOTE_PROFILE:'default',MOTE_URL:'',MOTE_TOKEN:''},stdio:['ignore','pipe','pipe','ipc']});
 let nextId=0,generation=0,ready=false,exited=false,error='',latest:any;const results=new Map<number,{resolve:(v:any)=>void;reject:(e:Error)=>void}>();
 child.stderr!.on('data',chunk=>{error+=chunk.toString();});child.on('exit',()=>{exited=true;});
 let intercept:((message:any,reply:()=>Promise<void>)=>Promise<boolean>)|undefined;
 child.on('message',async(raw:any)=>{
  if(raw.type==='ready')ready=true;
  if(raw.type==='startup-error')error+=raw.error;
  if(raw.type==='status'){latest=raw.status;generation=raw.status.authorizationGeneration;}
  if(raw.type==='result'){const result=results.get(raw.id);results.delete(raw.id);if(raw.error)result?.reject(Error(raw.error));else result?.resolve(raw.value);}
  if(raw.type==='fetch'){
   const reply=async()=>{try{const r=await f.node.app.inject({url:new URL(raw.url).pathname+new URL(raw.url).search,method:raw.method,headers:raw.headers,...(raw.body?{payload:Buffer.from(raw.body,'base64')}:{})});if(!exited)child.send({type:'fetch-response',id:raw.id,status:r.statusCode,headers:r.headers,body:r.rawPayload.toString('base64')});}catch(e){if(!exited)child.send({type:'fetch-response',id:raw.id,error:String(e)});}};
   if(!await intercept?.(raw,reply))await reply();
  }
 });
 cleanup.push(async()=>{if(!exited){child.kill('SIGKILL');await new Promise(r=>child.once('exit',r));}});
 await vi.waitFor(()=>{expect(error).toBe('');expect(ready).toBe(true);},{timeout:15000});
 const call=(channel:string,args:any[]=[],expected=generation,paths?:string[])=>new Promise<any>((resolve,reject)=>{const id=++nextId;results.set(id,{resolve,reject});child.send({type:'invoke',id,channel,args,generation:expected,paths});});
 const status=await call('mote:get-status');generation=status.authorizationGeneration;
 const document=(name:string)=>new Promise<any>((resolve,reject)=>{const id=++nextId;results.set(id,{resolve,reject});child.send({type:'document',id,document:name});});
 const documentCall=(name:string,method:string,args:any[]=[])=>new Promise<any>((resolve,reject)=>{const id=++nextId;results.set(id,{resolve,reject});child.send({type:'document-invoke',id,document:name,method,args});});
 return {child,call,document,documentCall,get generation(){return generation;},get latest(){return latest;},profile,set intercept(fn:typeof intercept){intercept=fn;},async kill(){child.kill('SIGKILL');await new Promise(r=>child.once('exit',r));}};
}
it('runs actual emitted main IPC: offline A queue/draft → B explicit capture → SIGKILL/restart → A resumes; retired document rejects',async()=>{
 const f=await fixture();let app=await productionDesktop(f);await app.call('mote:ask',['login',{token:f.a.token}]);
 let status=await app.call('mote:get-status');await app.call('mote:configure',[{...status.config,syncMode:'manual',metadataEnabled:false,defaultCollection:'activity'}]);
 const draft=await app.call('mote:note-draft');await app.call('mote:note',[{...draft,text:'Generated A pending note',revision:1}]);
 const authored=await app.call('mote:note-draft');await app.call('mote:note-draft-update',[{...authored,text:'Generated A private draft',revision:1}]);
 const oldGeneration=app.generation,aDirectory=(await app.call('mote:get-status')).storage.directory;
 await app.call('mote:ask',['login',{token:f.b.token}]);status=await app.call('mote:get-status');expect(status.queueDepth).toBe(0);expect(status.running).toBe(false);expect((await app.call('mote:note-draft')).text).toBe('');
 await expect(app.call('mote:note',[{...authored,text:'late A submit',revision:2}],oldGeneration)).rejects.toThrow('account changed');
 const bDirectory=status.storage.directory;expect(bDirectory).not.toBe(aDirectory);
 await app.call('mote:configure',[{...status.config,syncMode:'manual',metadataEnabled:false,defaultCollection:'activity'}]);await app.call('mote:start');await app.call('mote:stop');
 expect((await app.call('mote:get-status')).running).toBe(false);
 await app.kill();app=await productionDesktop(f,app.profile);status=await app.call('mote:get-status');expect(status.config.account.userId).toBe(f.b.userId);expect(status.running).toBe(false);expect((await app.call('mote:note-draft')).text).toBe('');
 const rotated=await f.login('generated-a');await app.call('mote:ask',['login',{token:rotated.token}]);status=await app.call('mote:get-status');expect(status.queueDepth).toBe(1);expect(status.storage.directory).toBe(aDirectory);expect((await app.call('mote:note-draft')).text).toBe('Generated A private draft');
 await app.call('mote:retry');expect((await app.call('mote:get-status')).queueDepth).toBe(0);
 expect((await f.request(rotated.token,'/api/captures/'+draft.id)).statusCode).toBe(200);expect((await f.request((await f.login('generated-b')).token,'/api/captures/'+draft.id)).statusCode).toBe(404);
},60000);
it('consumes the real M01 connection identity instead of assuming a global owner credential',async()=>{
 const f=await fixture(),identity=await testConnection(f.config(f.a));
 expect(identity).toMatchObject({account:{deploymentId:f.a.deploymentId,userId:f.a.userId,username:'generated-a'},credential:{kind:'client'},protocol:{min:2,max:2}});
});
it('keeps actual pending queue and source checkpoints owned by A across credential rotation; same-origin B cannot rebind them',async()=>{
 const f=await fixture(),a=f.config(f.a),b=f.config(f.b),queue=new DurableQueue(join(f.directory,'queue'),a);await queue.initialize();await queue.enqueue(event(),image);
 const rotated={...a,token:(await f.login('generated-a')).token};
 expect(queue.binding.matches(rotated)).toBe(true);expect(sourceConnectionBinding(rotated)).toBe(sourceConnectionBinding(a));
 await expect(queue.binding.commit(b,true,false,true)).rejects.toThrow();expect(queue.binding.matches(a)).toBe(true);
});
it('uploads through the real Collector and M03 production application and only removes the exact durable ACK',async()=>{
 const f=await fixture(),config=f.config(f.a),queue=new DurableQueue(join(f.directory,'queue'),config);await queue.initialize();await queue.enqueue({...event(),deviceId:config.deviceId},image);
 const collector=new Collector(config,queue,'/generated/no-native-io',()=>true,()=>{});cleanup.push(async()=>{collector.shutdown();const release=await collector.holdConnection();release();});
 await collector.upload(true);
 expect(queue.stats().depth).toBe(0);
 expect((await f.request(f.a.token,'/api/captures/'+event().id)).statusCode).toBe(200);expect((await f.request(f.b.token,'/api/captures/'+event().id)).statusCode).toBe(404);
 expect(f.calls.filter(v=>v.url.includes('/captures')).every(v=>v.url.startsWith('/api/ingress/'))).toBe(true);
});
it('reads the original capture/content/session capabilities from actual scoped APIs for equal A/B IDs',async()=>{
 const f=await fixture(),pixels=await sharp({create:{width:8,height:8,channels:3,background:'#428758'}}).jpeg().toBuffer();
 for(const [grant,body] of [[f.a,'Generated A private'],[f.b,'Generated B private']] as const){const config=f.config(grant),input={...event(),deviceId:config.deviceId,ocrText:body};await uploadCapture(config,input,pixels);}
 const config=f.config(f.a),queue=new DurableQueue(join(f.directory,'reader-queue'),config);await queue.initialize();
 const page=await browseCaptures(queue,config,{location:'central',day:'2026-09-13',grouping:'records'});expect(page.totalCount).toBe(1);expect(page.items[0].textPreview).toBe('Generated A private');
 const sessions=await browseCaptures(queue,config,{location:'central',day:'2026-09-13',grouping:'sessions'});expect(sessions.sessions).toHaveLength(1);expect(sessions.sessions![0].count).toBe(1);
 expect((await captureDetail(queue,config,'central',event().id)).ocrText).toBe('Generated A private');expect(await captureImage(queue,config,'central',event().id,false)).toMatch(/^data:image\/jpeg;base64,/);
 expect((await centralContentPage(config)).items[0].preview).toBe('Generated A private');
 expect((await readCentralContent(config,{key:event().id,source:'screen',title:'',observedAt:event().capturedAt,outcome:'received',firstReceipt:true,captureId:event().id})).text).toBe('Generated A private');
 expect((await captureDetail(queue,f.config(f.b),'central',event().id)).ocrText).toBe('Generated B private');
});
it('checks actual server identity before any personal upload bytes after token/account or deployment mismatch',async()=>{
 const f=await fixture(),a=f.config(f.a);for(const config of [{...a,token:f.b.token},{...a,account:{...a.account,deploymentId:'changed-deployment'}}]){
  const before=f.calls.length;await expect(uploadCapture(config,{...event(),deviceId:a.deviceId},image)).rejects.toThrow('changed');expect(f.calls.slice(before).every(call=>call.url==='/api/connections/self'&&call.body===undefined)).toBe(true);
 }
});
it('settles a real late A ACK into A before activating B and never sends queued A bytes with B credentials',async()=>{
 const f=await fixture(),app=await productionDesktop(f);await app.call('mote:ask',['login',{token:f.a.token}]);let status=await app.call('mote:get-status');await app.call('mote:configure',[{...status.config,syncMode:'manual',metadataEnabled:false}]);
 const draft=await app.call('mote:note-draft');await app.call('mote:note',[{...draft,text:'Generated late A ACK',revision:1}]);
 let entered=false,release!:()=>void;app.intercept=async(message)=>{
  if(!message.url.includes('/captures')||message.method!=='POST')return false;
  const response=await f.node.app.inject({url:new URL(message.url).pathname,method:'POST',headers:message.headers,payload:Buffer.from(message.body,'base64')});expect(response.statusCode).toBe(200);entered=true;
  release=()=>app.child.send({type:'fetch-response',id:message.id,status:response.statusCode,headers:response.headers,body:response.rawPayload.toString('base64')});return true;
 };
 const retry=app.call('mote:retry');await vi.waitFor(()=>expect(entered).toBe(true));
 const switching=app.call('mote:ask',['login',{token:f.b.token}]);await vi.waitFor(()=>expect(app.latest.running).toBe(false));expect(app.latest.config.account.userId).toBe(f.a.userId);
 release();await retry.catch(()=>{});await switching;status=await app.call('mote:get-status');expect(status.config.account.userId).toBe(f.b.userId);expect(status.queueDepth).toBe(0);expect(status.running).toBe(false);
 const a=await f.login('generated-a');app.intercept=undefined;await app.call('mote:ask',['login',{token:a.token}]);expect((await app.call('mote:get-status')).queueDepth).toBe(0);
 expect((await f.request((await f.login('generated-b')).token,'/api/captures/'+draft.id)).statusCode).toBe(404);
});
it('logout during an actual capture retires its input and does not resume collection or expose its draft',async()=>{
 const f=await fixture(),app=await productionDesktop(f);await app.call('mote:ask',['login',{token:f.a.token}]);const status=await app.call('mote:get-status');await app.call('mote:configure',[{...status.config,syncMode:'manual',metadataEnabled:false,defaultCollection:'activity'}]);
 let entered=false;app.child.on('message',(message:any)=>{if(message.type==='capture-entered')entered=true;});app.child.send({type:'hold-capture'});await app.call('mote:start');await vi.waitFor(()=>expect(entered).toBe(true));
 const logout=app.call('mote:ask',['logout']);await vi.waitFor(()=>expect(app.latest.running).toBe(false));app.child.send({type:'release-capture'});await logout;
 expect((await app.call('mote:get-status')).queueDepth).toBe(0);expect((await app.call('mote:note-draft')).text).toBe('');await expect(app.call('mote:start')).rejects.toThrow('Sign in');
});
it('rejects old unbound storage before mutation and refuses to import another account archive with equal IDs',async()=>{
 const f=await fixture(),directory=join(f.directory,'old');await import('node:fs/promises').then(fs=>fs.mkdir(directory));const marker=JSON.stringify({version:3});await writeFile(join(directory,'storage-format.json'),marker);await writeFile(join(directory,'config.json'),'generated old unbound bytes');
 await expect(ensureStorageFormat(directory,['config.json'])).rejects.toThrow('Unsupported');expect(await readFile(join(directory,'storage-format.json'),'utf8')).toBe(marker);expect(await readdir(directory)).toEqual(['config.json','storage-format.json']);
 const a=new DurableQueue(join(f.directory,'a'),f.config(f.a)),b=new DurableQueue(join(f.directory,'b'),f.config(f.b));await a.initialize();await b.initialize();await a.enqueue(event(),image);await b.enqueue(event(),image);
 await expect(b.importArchive(await a.exportArchive())).rejects.toThrow('another account');expect((await b.next())!.image).toEqual(image);expect(a.stats().depth).toBe(1);expect(b.stats().depth).toBe(1);
});
it('preserves source policy/name edits and central pause through the actual Desktop source and M03 contract',async()=>{
 const f=await fixture(),config=f.config(f.a),input=join(f.directory,'generated-secret.md');await writeFile(input,'Generated content must remain local after reference selection');
 const sources=new LocalSourceManager(join(f.directory,'sources-policy'),config,'/generated/no-helper',true);cleanup.push(()=>sources.close());await sources.initialize();await sources.addFiles(input,{...DEFAULT_SOURCE_OPTIONS,retention:'archive'});await sources.sync(true);await sources.flushPending(new AbortController().signal);
 const id=sources.status()[0].source.id,options={...DEFAULT_SOURCE_OPTIONS,retention:'reference' as const,enabled:true,redactLiterals:['secret']};await sources.update(id,options);await sources.sync(true);await sources.flushPending(new AbortController().signal);
 const actual=await f.request(f.a.token,'/api/sources/'+id);expect(actual.json()).toMatchObject({retention:'reference'});expect(actual.json().name).not.toContain('secret');
 expect((await f.request(f.a.token,'/api/sources/'+id,'PATCH',{enabled:false})).statusCode).toBe(200);await sources.update(id,{...options,retention:'snapshot'});await sources.sync(true);
 await expect(sources.flushPending(new AbortController().signal)).rejects.toThrow();expect((await f.request(f.a.token,'/api/sources/'+id)).json().enabled).toBe(false);
});
it.each(['mote:export-queue','mote:export-metadata'])('an old A save dialog cannot export B bytes through actual production IPC: %s',async channel=>{
 const f=await fixture(),app=await productionDesktop(f);await app.call('mote:ask',['login',{token:f.a.token}]);let status=await app.call('mote:get-status');await app.call('mote:configure',[{...status.config,syncMode:'manual',metadataEnabled:false}]);
 let entered=false;app.child.on('message',(message:any)=>{if(message.type==='save-dialog-entered')entered=true;});app.child.send({type:'hold-save-dialog'});
 const exporting=app.call(channel).catch(error=>error);await vi.waitFor(()=>expect(entered).toBe(true));
 await app.call('mote:ask',['login',{token:f.b.token}]);status=await app.call('mote:get-status');await app.call('mote:configure',[{...status.config,syncMode:'manual',metadataEnabled:false}]);
 const draft=await app.call('mote:note-draft');await app.call('mote:note',[{...draft,text:'Generated B must never reach A export',revision:1}]);
 const target=join(f.directory,'generated-A-selected-export.json');app.child.send({type:'release-save-dialog',path:target});await exporting;
 await expect(readFile(target)).rejects.toMatchObject({code:'ENOENT'});expect((await app.call('mote:get-status')).queueDepth).toBe(1);
});

it('retires the actual preload document including status bootstrap after account replacement',async()=>{
 const f=await fixture(),app=await productionDesktop(f);await app.call('mote:ask',['login',{token:f.a.token}]);await app.document('A');
 expect((await app.documentCall('A','status')).config.account.userId).toBe(f.a.userId);
 await app.call('mote:ask',['login',{token:f.b.token}]);await expect(app.documentCall('A','status')).rejects.toThrow();
 await expect(app.documentCall('A','noteDraft')).rejects.toThrow();await app.document('B');expect((await app.documentCall('B','status')).config.account.userId).toBe(f.b.userId);
});

it('preserves packed production uploads and rejects a foreign batch ACK before queue deletion',async()=>{
 const f=await fixture(),config={...f.config(f.a),packedUpload:true},queue=new DurableQueue(join(f.directory,'packed'),config);await queue.initialize();
 for(const id of ['00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002'])await queue.enqueue({...event(id),deviceId:config.deviceId},image);
 const collector=new Collector(config,queue,'/generated/no-helper',()=>true,()=>{});cleanup.push(async()=>{collector.shutdown();const release=await collector.holdConnection();release();});await collector.upload(true);
 expect(queue.stats().depth).toBe(0);const posts=f.calls.filter(v=>v.url.endsWith('/captures')&&v.body);expect(posts).toHaveLength(1);expect(posts[0].body.items).toHaveLength(2);
});
it('retains state-series observations appended during a real ACK and extends only the same account record',async()=>{
 const f=await fixture(),config=f.config(f.a),queue=new DurableQueue(join(f.directory,'series'),config);await queue.initialize();
 const {imageMime,ocrText,...base}=event(),first={...base,deviceId:config.deviceId,source:'activity' as const,durationMs:0,privacy:{excluded:false as const,redacted:false,mode:'none' as const,collection:'activity' as const}};await queue.enqueue(first);
 const original=f.fetcher.getMockImplementation()!;let entered=false,release!:()=>void;f.fetcher.mockImplementation(async(input,init)=>{const response=await original(input,init);if(String(input).endsWith('/captures')&&!entered){entered=true;await new Promise<void>(r=>{release=r;});}return response;});
 const collector=new Collector(config,queue,'/generated/no-helper',()=>true,()=>{});cleanup.push(async()=>{collector.shutdown();const release=await collector.holdConnection();release();});const uploading=collector.upload(true);await vi.waitFor(()=>expect(entered).toBe(true));
 await queue.enqueue({...first,id:'00000000-0000-4000-8000-000000000099',capturedAt:new Date(Date.parse(first.capturedAt)+5000).toISOString(),durationMs:5000});release();await uploading;expect(queue.stats().depth).toBe(1);
 await collector.upload(true);expect(queue.stats().depth).toBe(0);expect((await f.request(f.a.token,'/api/captures/'+first.id)).json().stateSeries.samples).toHaveLength(2);expect((await f.request(f.b.token,'/api/captures/'+first.id)).statusCode).toBe(404);
 await uploadCapture(f.config(f.b),{...first,stateSeries:{version:1,samples:[{at:first.capturedAt,durationMs:0}]}});expect((await f.request(f.b.token,'/api/captures/'+first.id)).json().stateSeries.samples).toHaveLength(1);
});
