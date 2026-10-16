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
import {uploadCapture,uploadCaptureBatch,heartbeat} from '../src/transport';
import {ensureStorageFormat} from '../src/storage-format';
import sharp from 'sharp';
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';
const repository=fileURLToPath(new URL('../../../',import.meta.url));
const nativeImport=createRequire(import.meta.url)('./native-backend.cjs') as (url:string)=>Promise<any>;
import {createHash,randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
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
 let node=await buildApp({dataDir:join(directory,'central')});cleanup.push(()=>node.app.close());
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
 const replaceDeployment=async()=>{await node.app.close();const db=new DatabaseSync(join(directory,'central','mote.sqlite'));try{db.prepare('UPDATE scope_meta SET deployment_id=?').run('generated-replacement-deployment');}finally{db.close();}node=await buildApp({dataDir:join(directory,'central')});};
 return {directory,get node(){return node;},a,b,config,request,login,fetcher,calls,replaceDeployment};
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

async function productionDesktop(f:Awaited<ReturnType<typeof fixture>>,profile=join(f.directory,'profile'),bootstrap?:{url:string;token:string}){
 const child=fork(resolve(repository,'apps/desktop/test/main-process-fixture.cjs'),[profile],{cwd:repository,env:{...process.env,MOTE_PROFILE:'default',MOTE_URL:bootstrap?.url??'',MOTE_TOKEN:bootstrap?.token??''},stdio:['ignore','pipe','pipe','ipc']});
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

it('preserves packed production uploads and exact item ACKs',async()=>{
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

it('revokes the old actual document before replacing private stores or publishing the new collector',async()=>{
 const f=await fixture(),app=await productionDesktop(f);await app.call('mote:ask',['login',{token:f.a.token}]);await app.document('A');let entered=false;const statuses:any[]=[];app.child.on('message',(message:any)=>{if(message.type==='diagnostics-entered')entered=true;if(message.type==='document-status'&&message.document==='A')statuses.push(message.status);});app.child.send({type:'hold-diagnostics'});
 const switching=app.call('mote:ask',['login',{token:f.b.token}]);await vi.waitFor(()=>expect(entered).toBe(true));
 const oldStatus=await app.documentCall('A','status').catch(error=>error),oldDraft=await app.documentCall('A','noteDraft').catch(error=>error);app.child.send({type:'release-diagnostics'});await switching;
 expect(oldStatus).toBeInstanceOf(Error);expect(oldDraft).toBeInstanceOf(Error);expect(statuses.some(status=>status.config.account?.userId===f.b.userId)).toBe(false);await app.document('B');expect((await app.documentCall('B','status')).config.account.userId).toBe(f.b.userId);
});

it('reads complete generated material membership beyond the first 200 members with account-specific text paging',async()=>{
 const f=await fixture(),sourceId='reading-source',externalId='generated-material',materialId='mat_'+createHash('sha256').update(JSON.stringify([sourceId,externalId])).digest('hex');let selected:string='';
 for(const [grant,text] of [[f.a,'Generated A full material text '.repeat(600)],[f.b,'Generated B private text']] as const){
  const config=f.config(grant);expect((await f.request(grant.token,'/api/ingress/sources','POST',{id:sourceId,name:'Generated source',kind:'local-files',deviceId:config.deviceId,platform:'macos',retention:'snapshot'})).statusCode).toBe(200);
  const receipt=await f.request(grant.token,`/api/ingress/sources/${sourceId}/items`,'POST',{batchId:'generated',items:['prefix','selected'].map(externalId=>({externalId,revision:'r1',observedAt:'2026-01-01T00:00:00Z',title:'Generated item',text:'Generated raw',kind:'file',layer:'snapshot'}))});expect(receipt.statusCode,receipt.body).toBe(200);const [prefix,last]=receipt.json().captures;selected=last.id;
  const producer=f.node.ingress.bindSource(await f.node.authority.authenticate(grant.token),[sourceId],()=>{});producer.publishMaterial({id:materialId,kind:'document',schemaVersion:1,title:'Generated material',origin:{sourceId,externalId,deviceId:config.deviceId},blocks:[{id:'body',kind:'text',format:'plain',text,memberIds:['selected']}],members:[...Array.from({length:200},(_,i)=>({id:'prefix-'+i,kind:'capture',ref:'capture:'+prefix.id})),{id:'selected',kind:'capture',ref:'capture:'+last.id}],coverage:{state:'complete'},artifacts:[{key:'extraction',state:'ready'}],fidelity:{state:'lossless',limitations:[]},retention:{original:'retained',policy:'keep'}});
 }
 const item={key:selected,source:'file' as const,title:'',observedAt:'',outcome:'received' as const,firstReceipt:true,captureId:selected,sourceId};const page=await readCentralContent(f.config(f.a),item);expect(page.text).toBe('Generated A full material text '.repeat(600).slice(0,12000));expect(page.nextChunkOffset).toBe(12000);expect(page.readiness).toBe('ready');
 expect((await readCentralContent(f.config(f.a),item,12000)).text).toBe('Generated A full material text '.repeat(600).slice(12000));expect((await readCentralContent(f.config(f.b),{...item})).text).toBe('Generated B private text');
});
it('preserves capture browsing for a legitimate page whose full OCR body exceeds the reader budget',async()=>{
 const f=await fixture(),config=f.config(f.a),sourceId='large-reader-source';expect((await f.request(f.a.token,'/api/ingress/sources','POST',{id:sourceId,name:'Generated source',kind:'mote.desktop',deviceId:config.deviceId,platform:'macos',retention:'archive'})).statusCode).toBe(200);
 const items=Array.from({length:61},(_,i)=>({...event('00000000-0000-4000-8000-'+String(i+1).padStart(12,'0')),deviceId:config.deviceId,ocrText:'Generated content '.repeat(5555),imageBase64:image.toString('base64')}));const response=await f.request(f.a.token,`/api/ingress/sources/${sourceId}/captures`,'POST',{batchId:'generated-large',items});expect(response.statusCode,response.body).toBe(200);
 const queue=new DurableQueue(join(f.directory,'large-reader'),config);await queue.initialize();const page=await browseCaptures(queue,config,{location:'central',day:'2026-09-13',grouping:'records'});expect(page.totalCount).toBe(61);expect(page.items).toHaveLength(30);expect(page.items.every(v=>v.textPreview===items[0].ocrText.slice(0,160))).toBe(true);
 expect((await captureDetail(queue,config,'central',items[0].id)).ocrText).toBe(items[0].ocrText);expect((await f.request(f.b.token,'/api/captures')).json().items).toHaveLength(0);
},60000);

it('preserves the actual Collector heartbeat observation through the scoped device service',async()=>{
 const f=await fixture(),config={...f.config(f.a),metadataEnabled:false},queue=new DurableQueue(join(f.directory,'heartbeat'),config);await queue.initialize();const collector=new Collector(config,queue,'/generated/no-helper',()=>true,()=>{});cleanup.push(async()=>{collector.shutdown();const release=await collector.holdConnection();release();});await collector.retry();
 const a=(await f.request(f.a.token,'/api/ingress/devices')).json().items.find((v:any)=>v.deviceId===config.deviceId);expect(a).toMatchObject({deviceId:config.deviceId,status:'paused',queueDepth:0,sync:{mode:'manual',state:'idle',pendingRecords:0}});expect(a.lastSeenAt).toMatch(/^20/);expect((await f.request(f.b.token,'/api/ingress/devices')).json().items).toHaveLength(0);
 const before=f.calls.length;await heartbeat({...config,token:f.b.token},{deviceId:config.deviceId,deviceName:'Generated A private metadata',platform:'macos',status:'paused',queueDepth:0});expect(f.calls.slice(before).every(call=>call.url==='/api/connections/self'&&call.body===undefined)).toBe(true);
});
it.each(['id','original'])('retains real durable bytes when the actual M03 ACK has a corrupted %s binding',async field=>{
 const f=await fixture(),config=f.config(f.a),queue=new DurableQueue(join(f.directory,'bad-receipt'),config);await queue.initialize();await queue.enqueue({...event(),deviceId:config.deviceId},image);const original=f.fetcher.getMockImplementation()!;let corrupt=true;
 f.fetcher.mockImplementation(async(input,init)=>{const response=await original(input,init);if(corrupt&&String(input).endsWith('/captures')&&init?.method==='POST'&&response.ok){const body=await response.json();if(field==='id')body.id='wrong-receipt-id';else body.captures[0].original.sourceId='other-source';return new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json'}});}return response;});
 const collector=new Collector(config,queue,'/generated/no-helper',()=>true,()=>{});cleanup.push(async()=>{collector.shutdown();const release=await collector.holdConnection();release();});await collector.upload(true);expect(queue.stats().depth).toBe(1);expect((await queue.exportArchive()).blobs).toEqual({[createHash('sha256').update(image).digest('hex')]:image.toString('base64')});corrupt=false;await collector.retry();expect(queue.stats().depth).toBe(0);expect((await f.request(f.b.token,'/api/captures/'+event().id)).statusCode).toBe(404);
});

it('binds an environment credential to the actual M01 account before opening the first production Desktop store',async()=>{
 const f=await fixture(),config=f.config(f.a),app=await productionDesktop(f,join(f.directory,'bootstrap'),{url:config.serverUrl,token:config.token!});const status=await app.call('mote:get-status');expect(status.config.account).toMatchObject({origin:config.serverUrl,deploymentId:f.a.deploymentId,userId:f.a.userId});expect(status.storage.directory).not.toContain('signed-out');await app.call('mote:configure',[{...status.config,syncMode:'manual',metadataEnabled:false}]);const note=await app.call('mote:note-draft');await app.call('mote:note',[{...note,text:'Generated bootstrap account note',revision:1}]);await app.call('mote:retry');expect((await f.request(f.a.token,'/api/captures/'+note.id)).statusCode).toBe(200);expect((await f.request(f.b.token,'/api/captures/'+note.id)).statusCode).toBe(404);
 const rejected=await productionDesktop(f,join(f.directory,'bootstrap-rejected'),{url:config.serverUrl,token:'generated-unrecognized-credential-00000000'});expect((await rejected.call('mote:get-status')).config.tokenConfigured).toBe(false);await expect(rejected.call('mote:start')).rejects.toThrow('Sign in');
});

it('reads canonical central extraction for raw screen captures without provenance or Material device metadata',async()=>{
 const f=await fixture(),body='Generated A central OCR '.repeat(1000),sourceId='desktop-'+createHash('sha256').update(JSON.stringify([f.config(f.a).deviceId,'macos'])).digest('hex').slice(0,40);
 for(const [grant,text] of [[f.a,body],[f.b,'Generated B central OCR']] as const){
  const config=f.config(grant);await uploadCapture(config,{...event(),deviceId:config.deviceId,ocrText:'',ocr:{status:'pending'}},image);
  const producer=f.node.ingress.bindSource(await f.node.authority.authenticate(grant.token),[sourceId],()=>{});
  for(const mode of ['extraction','summary']){
   const externalId=(mode==='extraction'?'processed:':'processed-summary:')+event().id;
   producer.publishMaterial({id:'mat_'+createHash('sha256').update(JSON.stringify([sourceId,externalId])).digest('hex'),kind:mode==='extraction'?'document':'summary',schemaVersion:1,title:'Generated central output',origin:{sourceId,externalId},members:[{id:'original',kind:'capture',ref:'capture:'+event().id}],blocks:[{id:'text',kind:'text',format:'plain',text:mode==='extraction'?text:'Generated summary must not replace OCR',memberIds:['original']}],coverage:{state:'complete'},artifacts:[{key:mode,state:'ready'}],fidelity:{state:mode==='extraction'?'derived':'summary-only',limitations:[]},retention:{original:'retained',policy:'allow-expiry'}});
  }
 }
 const config=f.config(f.a),queue=new DurableQueue(join(f.directory,'derived-reader'),config);await queue.initialize();
 const detail=await captureDetail(queue,config,'central',event().id);expect(detail.ocrText).toBe(body);expect(detail.ocr.status).toBe('completed');
 const item={key:event().id,source:'screen' as const,title:'',observedAt:event().capturedAt,outcome:'received' as const,firstReceipt:true,captureId:event().id};
 const first=await readCentralContent(config,item);expect(first.text).toBe(body.slice(0,12000));expect(first.nextChunkOffset).toBe(12000);expect(first.readiness).toBe('ready');expect(first.retainsOriginal).toBe(true);expect(first.processing).toBe(false);
 expect((await readCentralContent(config,item,12000)).text).toBe(body.slice(12000));expect((await captureDetail(queue,f.config(f.b),'central',event().id)).ocrText).toBe('Generated B central OCR');
});

it('recovers an expired exact file snapshot through the production source scanner, durable spool and actual M03/M06',async()=>{
 const f=await fixture(),config=f.config(f.a),view=(await f.request(f.a.token,'/api/configuration')).json();expect((await f.request(f.a.token,'/api/configuration/processing','PUT',{revision:view.revision,value:{enabled:true,automatic:false,understandingEnabled:false,summarize:false}})).statusCode).toBe(200);
 const path=join(f.directory,'generated-recovery.txt'),body='Generated exact Desktop snapshot bytes';await writeFile(path,body);
 const sources=new LocalSourceManager(join(f.directory,'snapshot-sources'),config,'/generated/no-helper',true);cleanup.push(()=>sources.close());await sources.initialize();await sources.addFiles(path,{...DEFAULT_SOURCE_OPTIONS,retention:'snapshot',allowRead:true});await sources.sync(true);expect(sources.pendingContent()).toHaveLength(1);await sources.flushPending(new AbortController().signal);expect(sources.pendingContent()).toHaveLength(0);
 const sourceId=sources.status()[0].source.id,original=(await f.request(f.a.token,`/api/ingress/sources/${sourceId}/originals`)).json().items[0],db=new DatabaseSync(join(f.directory,'central','mote.sqlite'));try{db.prepare('UPDATE ig_snapshot_inputs SET expires=? WHERE user_id=? AND original_id=?').run(Date.now()-1,f.a.userId,original.ref.slice(9));}finally{db.close();}
 const started=await f.request(f.a.token,'/api/processing','POST',{originalRef:original.ref,operationId:'generated-desktop-recover'});expect(started.statusCode,started.body).toBe(200);await vi.waitFor(async()=>expect((await f.request(f.a.token,'/api/tasks/'+started.json().id)).json().failure?.code).toBe('snapshot_input_expired'));
 await sources.sync(true);await sources.flushPending(new AbortController().signal);expect(sources.pendingContent()).toHaveLength(0);
 await vi.waitFor(async()=>expect((await f.request(f.a.token,'/api/processing/originals/'+original.ref.slice(9))).json().indexed).toBe(true));
 const state=(await f.request(f.a.token,'/api/processing/originals/'+original.ref.slice(9))).json();expect((await f.request(f.a.token,'/api/materials/'+state.materialId+'/read')).json().text).toBe(body);expect((await f.request(f.b.token,'/api/captures/'+original.captureId)).statusCode).toBe(404);
 const app=await productionDesktop(f);await app.call('mote:ask',['login',{token:f.a.token}]);const page=await app.call('mote:work-activity',[{state:'completed'}]);expect(page.items.find((work:any)=>work.id==='file:'+original.ref.slice(9))).toMatchObject({kind:'file',progress:{unit:'records',total:1,completed:1}});await app.call('mote:ask',['login',{token:f.b.token}]);expect((await app.call('mote:work-activity',[{state:'completed'}])).items).toHaveLength(0);
});

it('shows an actual central OCR failure instead of the immutable received pending state',async()=>{
 const f=await fixture(),config=f.config(f.a),view=(await f.request(f.a.token,'/api/configuration')).json();expect((await f.request(f.a.token,'/api/configuration/processing','PUT',{revision:view.revision,value:{enabled:true,automatic:false,understandingEnabled:false,summarize:false}})).statusCode).toBe(200);
 const png=await sharp({create:{width:2,height:2,channels:3,background:'#334455'}}).png().toBuffer(),record={...event(),deviceId:config.deviceId,imageMime:'image/png' as const,ocrText:'',ocr:{status:'pending' as const}};await uploadCapture(config,record,png);
 const sourceId='desktop-'+createHash('sha256').update(JSON.stringify([config.deviceId,'macos'])).digest('hex').slice(0,40),original=(await f.request(f.a.token,`/api/ingress/sources/${sourceId}/originals`)).json().items[0],task=await f.request(f.a.token,'/api/processing','POST',{originalRef:original.ref,operationId:'generated-no-ocr-model'});expect(task.statusCode,task.body).toBe(200);
 await vi.waitFor(async()=>expect(['blocked','failed','stale']).toContain((await f.request(f.a.token,'/api/tasks/'+task.json().id)).json().state),{timeout:10000});
 const queue=new DurableQueue(join(f.directory,'ocr-browser'),config);await queue.initialize();expect((await captureDetail(queue,config,'central',record.id)).ocr.status).toBe('failed');const content=await readCentralContent(config,{key:record.id,source:'screen',title:'',observedAt:record.capturedAt,outcome:'received',firstReceipt:true,captureId:record.id});expect(content.readiness).toBe('failed');expect(content.processing).toBe(false);
 expect((await f.request(f.b.token,'/api/processing/originals/'+original.ref.slice(9))).statusCode).toBe(404);
},20000);

it('consumes real portable Activity through emitted main/preload, rejects A late reads after B and hands A work to the same browser account',async()=>{
 const f=await fixture(),receipt=await f.request(f.a.token,'/api/portable/exports','POST',{operationId:randomUUID()});expect(receipt.statusCode,receipt.body).toBe(200);const id=receipt.json().id,workId='export:'+id;
 await vi.waitFor(async()=>expect((await f.request(f.a.token,'/api/portable/exports/'+id)).json().state).toBe('completed'),{timeout:10000});
 let app=await productionDesktop(f);await app.call('mote:ask',['login',{token:f.a.token}]);await app.document('A');
 const first=await app.documentCall('A','workActivity',[{state:'completed'}]);expect(first.items.find((work:any)=>work.id===workId)).toMatchObject({kind:'export',state:'completed',progress:{mode:'semantic',stage:'finished'},artifacts:[{id,href:'#/system/storage?export='+id}]});
 let finish:(()=>Promise<void>)|undefined;app.intercept=async(raw)=>{const url=new URL(raw.url);if(url.pathname==='/api/work-activity'){const response=await f.node.app.inject({url:url.pathname+url.search,headers:raw.headers});expect(response.statusCode,response.body).toBe(200);const child=app.child;finish=async()=>{child.send({type:'fetch-response',id:raw.id,status:response.statusCode,headers:response.headers,body:response.rawPayload.toString('base64')});};return true;}return false;};
 const late=app.documentCall('A','workActivity',[{state:'completed'}]).then(()=>({error:''}),error=>({error:String(error)}));await vi.waitFor(()=>expect(finish).toBeTypeOf('function'));
 await app.call('mote:ask',['login',{token:f.b.token}]);app.intercept=undefined;await finish!();expect((await late).error).toContain('changed');
 await app.document('B');expect((await app.documentCall('B','workActivity',[{state:'completed'}])).items).toHaveLength(0);await expect(app.documentCall('A','workActivity',[{state:'completed'}])).rejects.toThrow();
 const profile=app.profile;await app.kill();app=await productionDesktop(f,profile);expect((await app.call('mote:get-status')).config.account.userId).toBe(f.b.userId);expect((await app.call('mote:work-activity',[{state:'completed'}])).items).toHaveLength(0);
 const returned=await f.login('generated-a');await app.call('mote:ask',['login',{token:returned.token}]);await app.document('A-returned');let opened:string|undefined;app.child.on('message',(message:any)=>{if(message.type==='external')opened=message.url;});
 await app.documentCall('A-returned','openWorkActivity',[workId]);expect(opened).toBeTypeOf('string');const query=new URLSearchParams(new URL(opened!).hash.split('?')[1]);expect(query.get('work')).toBe(workId);expect(opened).not.toContain(f.a.token);expect(opened).not.toContain(f.b.token);
 const exchanged=await f.node.app.inject({url:'/api/login/exchange',method:'POST',headers:{'content-type':'application/json','x-mote-protocol-version':'2'},payload:{code:query.get('loginTicket')}});expect(exchanged.statusCode,exchanged.body).toBe(200);expect(exchanged.json().userId).toBe(f.a.userId);
 const web=exchanged.json(),detail=await f.node.app.inject({url:'/api/work-activity/'+workId,headers:{'x-mote-protocol-version':'2',cookie:String(exchanged.headers['set-cookie']).split(';')[0],'x-mote-session-id':web.credentialId}});expect(detail.statusCode,detail.body).toBe(200);expect(detail.json().artifacts[0].id).toBe(id);
 expect((await f.request(returned.token,'/api/portable/exports/'+id+'/cancel','POST',{})).statusCode).toBe(200);expect((await app.documentCall('A-returned','workActivity',[{state:'completed'}])).items.find((work:any)=>work.id===workId).artifacts).toEqual([]);
},30000);

it('blocks actual main Ask private body when the same URL becomes a different deployment with still-valid credentials',async()=>{
 const f=await fixture(),app=await productionDesktop(f);await app.call('mote:ask',['login',{token:f.a.token}]);await f.replaceDeployment();
 const received:string[]=[];app.intercept=async raw=>{received.push(new URL(raw.url).pathname);return false;};
 await expect(app.call('mote:ask',['start',{id:randomUUID(),question:'Generated A private question must remain in its original deployment'}])).rejects.toThrow();
 expect(received).not.toContain('/api/query-runs');expect(received).toContain('/api/connections/self');
});

it('blocks later actual source parts when deployment changes after the old manifest ACK and preserves the original spool',async()=>{
 const f=await fixture(),config=f.config(f.a),sources=new LocalSourceManager(join(f.directory,'deployment-source'),config,'/generated/no-helper',true);cleanup.push(()=>sources.close());
 const input=join(f.directory,'generated-deployment-source.txt');await writeFile(input,'Generated private source bytes retained for the original deployment');await sources.initialize();await sources.addFiles(input,{...DEFAULT_SOURCE_OPTIONS,retention:'archive',syncContinuously:false});await sources.sync(true);
 expect(sources.pendingContent()).toHaveLength(1);const pending=sources.pendingContent()[0],replacementRequests:string[]=[];let swapped=false;
 vi.stubGlobal('fetch',async(input:RequestInfo|URL,init:RequestInit={})=>{const path=new URL(String(input)).pathname;if(swapped)replacementRequests.push(path);const response=await f.fetcher(input,init);if(!swapped&&init.method==='POST'&&/^\/api\/ingress\/sources\/[^/]+\/uploads$/.test(path)){expect(response.status).toBe(200);await f.replaceDeployment();swapped=true;}return response;});
 await sources.flushPending(new AbortController().signal).catch(()=>{});expect(swapped).toBe(true);expect(replacementRequests.some(path=>path.includes('/parts/')||path.endsWith('/commit'))).toBe(false);expect(replacementRequests).toContain('/api/connections/self');expect(sources.pendingContent()).toHaveLength(1);expect(sources.pendingContent()[0]).toEqual(pending);
});

it('blocks actual capture bytes when deployment changes between source registration and capture admission',async()=>{
 const f=await fixture(),config=f.config(f.a),replacementRequests:string[]=[];let swapped=false;
 vi.stubGlobal('fetch',async(input:RequestInfo|URL,init:RequestInit={})=>{const path=new URL(String(input)).pathname;if(swapped)replacementRequests.push(path);const response=await f.fetcher(input,init);if(!swapped&&init.method==='POST'&&path==='/api/ingress/sources'){expect(response.status).toBe(200);await f.replaceDeployment();swapped=true;}return response;});
 await uploadCapture(config,event(),image).catch(()=>{});expect(swapped).toBe(true);expect(replacementRequests.some(path=>path.endsWith('/captures'))).toBe(false);expect(replacementRequests).toContain('/api/connections/self');expect((await f.request(f.a.token,'/api/captures')).json().items).toHaveLength(0);
});
