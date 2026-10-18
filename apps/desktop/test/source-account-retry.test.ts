import {afterEach,expect,it,vi} from 'vitest';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {defaultConfig} from '../src/config';
import {DesktopAccountStorage} from '../src/account-storage';
import {SourceSync} from '../src/source-sync';
import {SyncHistory} from '../src/sync-history';
import {ingressRequest} from '../src/ingress-client';
import {LocalSourceManager} from '../src/source-manager';
import {DEFAULT_SOURCE_OPTIONS,type ScannedItem,type SourceDefinition,type SourceRequest} from '../src/source-types';

const nativeImport=createRequire(import.meta.url)('./native-backend.cjs') as (url:string)=>Promise<any>;
const cleanup:(()=>Promise<unknown>)[]=[];
afterEach(async()=>{for(const close of cleanup.splice(0).reverse())await close();vi.unstubAllGlobals();});
async function fixture(){
 const {buildApp}=await nativeImport(pathToFileURL(resolve('../../apps/server/src/app.ts')).href) as typeof import('../../server/src/app');
 const directory=await mkdtemp(join(tmpdir(),'mote-desktop-account-retry-')),dataDir=join(directory,'central');cleanup.push(()=>rm(directory,{recursive:true,force:true}));
 let node=await buildApp({dataDir});cleanup.push(()=>node.app.close());
 const password='Generated-queue-only-01';await node.accounts!.initialize('generated-admin',password);
 const admin=await node.accounts!.login('generated-admin',password,'fixture','client',0),adminContext=await node.authority.authenticate(admin.token);
 for(const username of ['generated-a','generated-b'])await node.accounts!.createAccount(adminContext,node.authority,{username,password,administrator:false});
 const a=await node.accounts!.login('generated-a',password,'fixture','client',0),b=await node.accounts!.login('generated-b',password,'fixture','client',0);
 const base=defaultConfig(),config=(owner:typeof a)=>({...base,syncMode:'manual' as const,deviceId:'generated-same-device',token:owner.token,account:{origin:base.serverUrl,deploymentId:owner.deploymentId,userId:owner.userId,username:owner===a?'generated-a':'generated-b'}});
 const request=(owner:typeof a,path:string,method:any='GET',payload?:unknown)=>node.app.inject({url:path,method,headers:{'x-mote-protocol-version':'2','x-mote-ingress-version':'3',authorization:'Bearer '+owner.token},...(payload===undefined?{}:{payload})});
 const fetcher=async(input:RequestInfo|URL,init:RequestInit={})=>{const url=new URL(String(input)),body=init.body?await new Response(init.body).text():undefined,response=await node.app.inject({url:url.pathname+url.search,method:(init.method??'GET') as any,headers:Object.fromEntries(new Headers(init.headers)),...(body?{payload:body}:{})});return new Response(response.rawPayload,{status:response.statusCode,headers:response.headers as Record<string,string>});};vi.stubGlobal('fetch',fetcher);
 const sql=<T>(work:(db:DatabaseSync)=>T)=>{const db=new DatabaseSync(join(dataDir,'mote.sqlite'));try{return work(db);}finally{db.close();}};
 const restart=async()=>{await node.app.close();node=await buildApp({dataDir});};
 const storage=new DesktopAccountStorage(join(directory,'desktop'),{available:()=>true,encrypt:value=>Buffer.from(value),decrypt:value=>value.toString()});
 const source:SourceDefinition={id:'generated-same-source',name:'Generated references',kind:'local-files',deviceId:base.deviceId,platform:'macos',retention:'reference',enabled:true};
 const engine=async(owner= a)=>{const path=join(await storage.open(config(owner)),'source-state.json'),queue=new SourceSync(path,{batchSize:2});await queue.initialize();return {queue,path};};
 const transport=(owner=a)=>{const bound=config(owner),send:SourceRequest=(path,body,method,signal)=>ingressRequest(bound,path,body,method,signal);send.account=bound.account;return send;};
 return {directory,get node(){return node;},a,b,config,source,engine,transport,request,fetcher,sql,restart};
}
const reference=(index:number):ScannedItem=>({externalId:'generated-'+index,title:'Generated file '+index,text:'',kind:'file',layer:'reference',metadata:{version:1,file:{sizeBytes:23}},document:{fileIndex:{version:1,fileId:'generated-'+index,contentVersion:'a'.repeat(64),mode:'catalog',coverage:'none',parser:'none',status:'ready',totalCharacters:0,offset:0,length:0,allowRead:false}}});
async function inspect(init:RequestInit){const body=await new Response(init.body).text();init.body=body;return JSON.parse(body);}
const stage=(queue:SourceSync)=>queue.stage({items:[reference(0),reference(1),reference(2)],seen:[],complete:false,skipped:0},false);

it('settles a reference ACK before network loss, then quarantines only the real 409 and continues the next batch after restart',async()=>{
 const f=await fixture(),{queue,path}=await f.engine();await stage(queue);
 let failed=false;vi.stubGlobal('fetch',async(input:RequestInfo|URL,init:RequestInit={})=>{
  if(new URL(String(input)).pathname.endsWith('/uploads')&&!failed){const payload=await inspect(init);if(payload.revision.item.externalId==='generated-1'){failed=true;throw Error('Generated network disconnect before admission');}}
  return f.fetcher(input,init);
 });
 await expect(queue.flush(f.source,f.transport())).rejects.toThrow('network disconnect');expect(queue.status()).toMatchObject({pending:2,blocked:0});
 const originalPending=queue.pendingContent(),competing={...originalPending[0],revision:'competing-generated-revision'};
 expect((await f.request(f.a,'/api/ingress/sources/'+f.source.id+'/items','POST',{batchId:'competing',items:[competing]})).statusCode).toBe(200);
 await f.restart();vi.stubGlobal('fetch',f.fetcher);const restored=new SourceSync(path,{batchSize:1});await restored.initialize();expect(restored.pendingContent()).toEqual(originalPending);
 await restored.flush(f.source,f.transport());expect(restored.status()).toMatchObject({pending:0,blocked:1,failures:[{externalId:'generated-1',status:409}]});
 const final=new SourceSync(path);await final.initialize();expect(final.status()).toMatchObject({pending:0,blocked:1});
 const captures=(await f.request(f.a,'/api/captures')).json().items;expect(captures.map((value:any)=>value.provenance.externalId).sort()).toEqual(['generated-0','generated-1','generated-2']);
});

it('quarantines a genuinely forgotten reference without replaying earlier ACKs or blocking the later batch or same-ID B',async()=>{
 const f=await fixture(),{queue,path}=await f.engine();await stage(queue);const removed=queue.pendingContent()[1];
 expect((await f.request(f.a,'/api/ingress/sources','POST',f.source)).statusCode).toBe(200);
 const seeded=await f.request(f.a,'/api/ingress/sources/'+f.source.id+'/items','POST',{batchId:'before-forget',items:[{...removed,revision:'before-forget'}]});expect(seeded.statusCode,seeded.body).toBe(200);
 const context=await f.node.authority.authenticate(f.a.token);f.node.ingress.forUser(context).forgetFile(seeded.json().captures[0].id,{operationId:randomUUID(),originalGeneration:0});
 const requests:string[]=[];vi.stubGlobal('fetch',async(input:RequestInfo|URL,init:RequestInit={})=>{if(new URL(String(input)).pathname.endsWith('/uploads'))requests.push((await inspect(init)).revision.item.externalId);return f.fetcher(input,init);});
 await queue.flush(f.source,f.transport());expect(queue.status()).toMatchObject({pending:0,blocked:1,failures:[{externalId:'generated-1',status:410}]});expect(requests).toEqual(['generated-0','generated-1','generated-2']);
 const restored=new SourceSync(path);await restored.initialize();await restored.flush(f.source,f.transport());expect(requests).toHaveLength(3);
 const other=await f.engine(f.b);await stage(other.queue);await other.queue.flush(f.source,f.transport(f.b));expect(other.queue.status()).toMatchObject({pending:0,blocked:0});expect((await f.request(f.b,'/api/captures')).json().items).toHaveLength(3);
 expect((await f.request(f.a,'/api/captures/'+seeded.json().captures[0].id)).statusCode).toBe(404);
});

it.each([429,503,507])('retains only a transient HTTP%s reference while accepted siblings and the next batch settle',async status=>{
 const f=await fixture(),{queue}=await f.engine();await stage(queue);let failed=false;
 vi.stubGlobal('fetch',async(input:RequestInfo|URL,init:RequestInit={})=>{if(new URL(String(input)).pathname.endsWith('/uploads')){const item=(await inspect(init)).revision.item;if(item.externalId==='generated-1'&&!failed){failed=true;return new Response('{"error":"generated_transient"}',{status});}}return f.fetcher(input,init);});
 await expect(queue.flush(f.source,f.transport())).rejects.toMatchObject({httpStatus:status});expect(queue.status()).toMatchObject({pending:1,blocked:0});expect(queue.pendingContent()[0].externalId).toBe('generated-1');
 vi.stubGlobal('fetch',f.fetcher);await queue.flush(f.source,f.transport());expect(queue.status()).toMatchObject({pending:0,blocked:0});expect((await f.request(f.a,'/api/captures')).json().items).toHaveLength(3);
});

it('preserves the current version and prior ACK when a source is paused during a real upload',async()=>{
 const f=await fixture(),{queue}=await f.engine();await stage(queue);let paused=false;
 vi.stubGlobal('fetch',async(input:RequestInfo|URL,init:RequestInit={})=>{if(new URL(String(input)).pathname.endsWith('/uploads')&&!paused){const item=(await inspect(init)).revision.item;if(item.externalId==='generated-1'){paused=true;expect((await f.request(f.a,'/api/sources/'+f.source.id,'PATCH',{enabled:false})).statusCode).toBe(200);}}return f.fetcher(input,init);});
 await expect(queue.flush(f.source,f.transport())).rejects.toMatchObject({httpStatus:409});expect(queue.status()).toMatchObject({pending:2,blocked:0});
 vi.stubGlobal('fetch',f.fetcher);expect((await f.request(f.a,'/api/sources/'+f.source.id,'PATCH',{enabled:true})).statusCode).toBe(200);await queue.flush(f.source,f.transport());expect(queue.status()).toMatchObject({pending:0,blocked:0});
});

it('persists accepted reference progress before the real transport slice yields and resumes only the remainder',async()=>{
 const f=await fixture(),{queue,path}=await f.engine(),references=Array.from({length:25},(_,index)=>reference(index));await queue.stage({items:references,seen:[],complete:false,skipped:0},false);
 const history=new SyncHistory(join(f.directory,'slice-history.sqlite'));await history.initialize();cleanup.push(async()=>history.close());const run=history.begin(f.config(f.a),'manual');const first=await queue.flushSlice(f.source,f.transport(),undefined,history.observer(run));history.finish(run);expect(first.state).toBe('yielded');expect(queue.status().pending).toBeGreaterThan(0);expect(queue.status().pending).toBeLessThan(25);expect(queue.status().blocked).toBe(0);expect(history.contents(f.config(f.a),{runId:run,outcome:'unconfirmed'}).items.some(item=>item.outcome==='interrupted')).toBe(true);
 const remaining=queue.pendingContent(),accepted=25-remaining.length,restored=new SourceSync(path);await restored.initialize();expect(restored.pendingContent()).toEqual(remaining);expect((await f.request(f.a,'/api/captures')).json().items).toHaveLength(accepted);
 await restored.flush(f.source,f.transport());expect(restored.status()).toMatchObject({pending:0,blocked:0});expect((await f.request(f.a,'/api/captures')).json().items).toHaveLength(25);
});

it.each([401,403,'abort'] as const)('keeps the accepted ACK and the original %s history outcome when the following transport fails',async failure=>{
 const f=await fixture(),{queue}=await f.engine();await stage(queue);const history=new SyncHistory(join(f.directory,'history.sqlite'));await history.initialize();cleanup.push(async()=>history.close());const run=history.begin(f.config(f.a),'manual');let failed=false;
 vi.stubGlobal('fetch',async(input:RequestInfo|URL,init:RequestInit={})=>{if(new URL(String(input)).pathname.endsWith('/uploads')&&!failed){const payload=await inspect(init);if(payload.revision.item.externalId==='generated-1'){failed=true;if(failure==='abort')throw new DOMException('Generated cancelled upload','AbortError');return new Response('{}',{status:failure});}}return f.fetcher(input,init);});
 await expect(queue.flush(f.source,f.transport(),undefined,history.observer(run))).rejects.toThrow();history.finish(run,failure==='abort');expect(queue.status()).toMatchObject({pending:2,blocked:0});
 const items=history.contents(f.config(f.a),{runId:run}).items;expect(items.filter(item=>item.outcome==='received')).toHaveLength(1);expect(items.find(item=>item.outcome!=='received')).toMatchObject(failure==='abort'?{outcome:'interrupted'}:{outcome:'unconfirmed',code:failure});
});

it.each(['reference','archive'] as const)('retains an unchanged %s revision when its session expires after begin, then resumes on ordinary retry',async retention=>{
 const f=await fixture(),directory=join(f.directory,'mid-upload'),input=join(f.directory,'generated-mid-upload.txt');await writeFile(input,'Generated bytes remain bound to the same immutable revision');let sources=new LocalSourceManager(directory,f.config(f.a),'/generated/no-helper',true);cleanup.push(()=>sources.close());await sources.initialize();await sources.addFiles(input,{...DEFAULT_SOURCE_OPTIONS,retention,syncContinuously:false});await sources.sync(true);const pending=sources.pendingContent().map(value=>value.item);let expired=false;
 vi.stubGlobal('fetch',async(input:RequestInfo|URL,init:RequestInit={})=>{const response=await f.fetcher(input,init);if(!expired&&new URL(String(input)).pathname.endsWith('/uploads')){expect(response.status).toBe(200);f.sql(db=>db.prepare('UPDATE ig_uploads SET expires=expires-? WHERE user_id=?').run(25*3600000,f.a.userId));expired=true;}return response;});
 await expect(sources.flushPending(new AbortController().signal)).rejects.toMatchObject({httpStatus:409});expect(expired).toBe(true);expect(sources.status()[0]).toMatchObject({pending:1,blocked:0});expect(sources.pendingContent().map(value=>value.item)).toEqual(pending);
 await sources.close();await f.restart();vi.stubGlobal('fetch',f.fetcher);sources=new LocalSourceManager(directory,f.config(f.a),'/generated/no-helper',true);cleanup.push(()=>sources.close());await sources.initialize();await sources.sync(true);await sources.flushPending(new AbortController().signal);expect(sources.status()[0]).toMatchObject({pending:0,blocked:0});expect((await f.request(f.a,'/api/captures')).json().items).toHaveLength(1);
});

it.each(['part','commit'] as const)('restores an ordinary archive after a lost %s response, >24h and actual source/backend restart without duplicate intake',async point=>{
 const f=await fixture(),config=f.config(f.a),directory=join(f.directory,'local-sources'),input=join(f.directory,'generated-archive.txt');await writeFile(input,Buffer.alloc(4*1024*1024+19,65));
 let sources=new LocalSourceManager(directory,config,'/generated/no-helper',true);cleanup.push(()=>sources.close());await sources.initialize();await sources.addFiles(input,{...DEFAULT_SOURCE_OPTIONS,retention:'archive',syncContinuously:false});await sources.sync(true);
 const pending=sources.pendingContent();expect(pending).toHaveLength(1);let failed=false;
 vi.stubGlobal('fetch',async(input:RequestInfo|URL,init:RequestInit={})=>{const path=new URL(String(input)).pathname;if(!failed&&(point==='part'?path.endsWith('/parts/1'):path.endsWith('/commit'))){failed=true;if(point==='commit'){const response=await f.fetcher(input,init);expect(response.status).toBe(200);}throw Error('Generated dropped '+point+' response');}return f.fetcher(input,init);});
 await expect(sources.flushPending(new AbortController().signal)).rejects.toThrow('dropped');expect(failed).toBe(true);expect(sources.pendingContent().map(value=>value.item)).toEqual(pending.map(value=>value.item));
 const old=f.sql(db=>db.prepare('SELECT id,request_key FROM ig_uploads WHERE user_id=?').get(f.a.userId)!);f.sql(db=>db.prepare('UPDATE ig_uploads SET expires=expires-? WHERE user_id=?').run(25*3600000,f.a.userId));
 await sources.close();await f.restart();vi.stubGlobal('fetch',f.fetcher);sources=new LocalSourceManager(directory,config,'/generated/no-helper',true);cleanup.push(()=>sources.close());await sources.initialize();await sources.sync(true);expect(sources.pendingContent().map(value=>value.item)).toEqual(pending.map(value=>value.item));await sources.flushPending(new AbortController().signal);expect(sources.pendingContent()).toHaveLength(0);
 const current=f.sql(db=>db.prepare('SELECT id,request_key FROM ig_uploads WHERE user_id=?').get(f.a.userId)!);expect(current.request_key).toBe(old.request_key);expect(current.id===old.id).toBe(point==='commit');expect((await f.request(f.a,'/api/captures')).json().items).toHaveLength(1);expect((await f.request(f.b,'/api/captures')).json().items).toHaveLength(0);
 await sources.sync(true);await sources.flushPending(new AbortController().signal);expect((await f.request(f.a,'/api/captures')).json().items).toHaveLength(1);
},20000);
