import {afterEach,expect,it,vi} from 'vitest';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {tsImport} from 'tsx/esm/api';
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
afterEach(async()=>{for(const close of cleanup.splice(0).reverse())await close();vi.unstubAllGlobals();});
async function fixture(){
 const {buildApp}=await tsImport('../../server/src/app.ts',import.meta.url) as typeof import('../../server/src/app');
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
