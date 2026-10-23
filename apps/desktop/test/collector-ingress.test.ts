import {afterEach,expect,it,vi} from 'vitest';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {defaultConfig} from '../src/config';
import {DurableQueue} from '../src/queue';
import {SyncHistory} from '../src/sync-history';
import {ingressKey} from '../src/ingress-client';
import {event} from './fixtures';
import type {CaptureEvent,Config} from '../src/contracts';
vi.mock('electron',async()=>{const {EventEmitter}=await import('node:events');return {powerMonitor:new EventEmitter(),systemPreferences:{getMediaAccessStatus:()=> 'granted'},desktopCapturer:{getSources:vi.fn()},screen:{},nativeImage:{}};});
import {Collector} from '../src/collector';
const cleanup:(()=>Promise<unknown>)[]=[];
afterEach(async()=>{for(const close of cleanup.splice(0).reverse())await close();vi.restoreAllMocks();vi.unstubAllGlobals();});
function receipt(body:any,sourceId:string,config:any){return {version:3,state:'received',deploymentId:config.account.deploymentId,userId:config.account.userId,sourceId,batchId:body.batchId,id:ingressKey([config.account.deploymentId,config.account.userId,sourceId,body.batchId]),captures:body.items.map((item:any)=>({id:item.id,duplicate:false}))};}
async function fixture(packedUpload=true,count=2){
 const directory=await mkdtemp(join(tmpdir(),'mote-generated-ingress-'));cleanup.push(()=>rm(directory,{recursive:true,force:true}));
 const base={...defaultConfig(),token:'generated-a',syncMode:'manual' as const,packedUpload},config={...base,account:{origin:base.serverUrl,userId:'generated-a',deploymentId:'generated-deployment',username:'generated-a'}};
 const path=join(directory,'a'),queue=new DurableQueue(path,config);await queue.initialize();
 const records=Array.from({length:count},(_,i)=>({...event(`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`),source:'note' as const,imageMime:undefined,ocrText:'Generated note '+i,durationMs:0,privacy:{excluded:false as const,redacted:false,mode:'none' as const}}));
 for(const record of records)await queue.enqueue(record);
 const history=new SyncHistory(join(directory,'history.sqlite'));await history.initialize();cleanup.push(async()=>history.close());
 const collector=new Collector(config,queue,'/generated/no-helper',()=>true,()=>undefined,undefined,undefined,undefined,history);cleanup.push(async()=>collector.shutdown());
 let active=true,reply=(body:any,sourceId:string):Response|Promise<Response>=>Response.json(receipt(body,sourceId,config));
 const sends:any[]=[],registrations:any[]=[];
 const fetcher=vi.fn(async(input:RequestInfo|URL,init:RequestInit={})=>{
  const path=new URL(String(input)).pathname;
  if(path==='/api/connections/self')return Response.json({account:{deploymentId:config.account.deploymentId,userId:config.account.userId,username:config.account.username,administrator:false,disabled:false,authorizationEpoch:0,createdAt:0,credentialId:'generated-credential'},credential:{kind:'client',expiresAt:Date.now()+86400000},protocol:{min:2,max:2},capabilities:{authentication:true,ingest:true,ingressVersion:3,archiveRead:false}});
  const body=JSON.parse(await new Response(init.body).text());
  if(path.endsWith('/devices'))return Response.json(body);
  if(path.endsWith('/sources')){registrations.push(body);return Response.json({...body,enabled:active});}
  sends.push(body);return reply(body,path.split('/')[4]);
 });vi.stubGlobal('fetch',fetcher);
 const restart=async()=>{const restored=new DurableQueue(path,config);await restored.initialize();return restored;};
 const day=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
 const reopen=(restored:DurableQueue,settings:Config=config)=>{collector.shutdown();const next=new Collector(settings,restored,'/generated/no-helper',()=>true,()=>undefined,undefined,undefined,undefined,history);cleanup.push(async()=>next.shutdown());return next;};
 return {directory,path,config,queue,collector,records,history,sends,registrations,restart,reopen,day,reply:(fn:typeof reply)=>{reply=fn;},active:(value:boolean)=>{active=value;}};
}
it.each([false,true])('keeps paused queue eligible through restart and automatic resume (packed=%s)',async packed=>{
 const f=await fixture(packed);f.active(false);await f.collector.upload(true);
 expect(f.sends).toHaveLength(0);expect(f.queue.stats()).toMatchObject({depth:2,blocked:0,eligibleDepth:2});expect((await f.queue.exportArchive()).records.every(r=>r.attempts===0)).toBe(true);
 expect(f.collector.status().sync).toMatchObject({state:'waiting',message:'中央已暂停该来源；待上传版本保留在本机'});
 const restored=await f.restart();expect(restored.stats()).toMatchObject({depth:2,blocked:0,eligibleDepth:2});
 f.active(true);const resumed=f.reopen(restored,{...f.config,syncMode:'realtime'});await resumed.upload();expect(restored.stats().depth).toBe(0);expect(f.registrations.every(source=>source.enabled===undefined)).toBe(true);
});
it.each([false,true])('durably retains earlier ACK and history after a later request fails (packed=%s)',async packed=>{
 const f=await fixture(packed);f.reply((body,source)=>{if(body.items.length>1)return Response.json({}, {status:413});if(body.items[0].id===f.records[1].id)throw Error('generated offline');return Response.json(receipt(body,source,f.config));});
 await f.collector.upload(true);expect(f.queue.stats()).toMatchObject({depth:1,blocked:0});
 const restored=await f.restart(),remaining=await restored.exportArchive();expect(remaining.records.map(r=>r.event.id)).toEqual([f.records[1].id]);expect(f.history.page(f.config,{day:f.day()})).toMatchObject({received:1,total:1,items:[expect.objectContaining({outcome:'partial'})]});
 f.reply((body,source)=>Response.json(receipt(body,source,f.config)));const resumed=f.reopen(restored);await resumed.retry();expect(restored.stats().depth).toBe(0);expect(f.sends.slice(packed?3:2).flatMap(b=>b.items.map((r:any)=>r.id))).toEqual([f.records[1].id]);
});
it('settles prior ACK before a raced pause and keeps only the pending suffix after restart',async()=>{
 const f=await fixture();f.reply((body,source)=>{if(body.items.length>1)return Response.json({}, {status:413});if(body.items[0].id===f.records[1].id){f.active(false);return Response.json({}, {status:409});}return Response.json(receipt(body,source,f.config));});
 await f.collector.upload(true);const restored=await f.restart();expect(restored.stats()).toMatchObject({depth:1,blocked:0,eligibleDepth:1});expect(f.collector.status().sync.state).toBe('waiting');expect((await restored.exportArchive()).records[0]).toMatchObject({event:{id:f.records[1].id},attempts:0});
});
it('local settlement failure cannot resend or overwrite earlier durable ACK/history',async()=>{
 const f=await fixture(),ack=f.queue.acknowledge.bind(f.queue);vi.spyOn(f.queue,'acknowledge').mockImplementation(async(id,...args)=>{if(id===f.records[1].id)throw Error('generated storage failure');return ack(id,...args);});
 await f.collector.upload(true);expect(f.sends).toHaveLength(1);expect((await (await f.restart()).exportArchive()).records.map(r=>r.event.id)).toEqual([f.records[1].id]);expect(f.history.page(f.config,{day:f.day()})).toMatchObject({received:1,items:[expect.objectContaining({outcome:'partial'})]});
});
it('malformed later receipt preserves every queued record and records zero received history',async()=>{
 const f=await fixture();f.reply((body,source)=>{const value=receipt(body,source,f.config);value.captures[1].id='invalid';return Response.json(value);});await f.collector.upload(true);
 expect((await f.restart()).stats()).toMatchObject({depth:2,blocked:0});expect(f.history.page(f.config,{day:f.day()}).received).toBe(0);
});
it.each([[false,409],[false,410],[true,409],[true,410]] as const)('isolates only a genuine record rejection (packed=%s,status=%s)',async(packed,status)=>{
 const f=await fixture(packed);f.reply((body,source)=>body.items.length>1||body.items[0].id===f.records[0].id?Response.json({}, {status}):Response.json(receipt(body,source,f.config)));await f.collector.upload(true);
 expect((await f.restart()).stats()).toMatchObject({depth:1,blocked:1,eligibleDepth:0});expect(f.history.page(f.config,{day:f.day()}).received).toBe(1);
});
it.each([false,true])('source identity confirmation failure cannot quarantine captures (packed=%s)',async packed=>{
 const f=await fixture(packed);const transport=fetch;vi.stubGlobal('fetch',async(input:RequestInfo|URL,init?:RequestInit)=>new URL(String(input)).pathname==='/api/ingress/sources'?Response.json({}, {status:409}):transport(input,init));await f.collector.upload(true);expect((await f.restart()).stats()).toMatchObject({depth:2,blocked:0});
});
it('A→B→A during receipt aborts settlement and keeps each account queue unchanged',async()=>{
 const f=await fixture(),b={...f.config,token:'generated-b',account:{...f.config.account,userId:'generated-b',username:'generated-b'}},bq=new DurableQueue(join(f.directory,'b'),b);await bq.initialize();await bq.enqueue({...f.records[0],id:'00000000-0000-4000-8000-000000000099'});
 const beforeA=f.queue.binding.snapshot(),beforeB=bq.binding.snapshot();f.reply((body,source)=>{f.collector.updateConfig(b);f.collector.updateConfig(f.config);return Response.json(receipt(body,source,f.config));});await f.collector.upload(true);
 expect((await f.restart()).stats()).toMatchObject({depth:2,blocked:0});expect(bq.stats().depth).toBe(1);expect(f.queue.binding.snapshot()).toEqual(beforeA);expect(bq.binding.snapshot()).toEqual(beforeB);expect(f.history.page(f.config,{day:f.day()}).received).toBe(0);
 f.collector.updateConfig(b);const before=f.sends.length;await f.collector.upload(true);expect(f.sends).toHaveLength(before);
 f.collector.updateConfig(f.config);f.reply((body,source)=>Response.json(receipt(body,source,f.config)));await f.collector.upload(true);expect(f.queue.stats().depth).toBe(0);expect(bq.stats().depth).toBe(1);
});
it('passes uploaded observation count so an ACK cannot remove a concurrently extended state series',async()=>{
 const f=await fixture(true,0),base={...event(),source:'activity' as const,imageMime:undefined,ocrText:undefined,durationMs:0,capturedAt:'2026-09-17T00:00:00.000Z',privacy:{excluded:false as const,redacted:false,mode:'none' as const,collection:'activity' as const}} as CaptureEvent;
 delete base.imageMime;delete base.ocrText;delete base.ocr;
 await f.queue.enqueue(base);await f.queue.enqueue({...base,id:'00000000-0000-4000-8000-000000000010',capturedAt:'2026-09-17T00:00:05.000Z',durationMs:5000});
 let once=false;f.reply(async(body,source)=>{if(!once){once=true;expect(body.items[0].stateSeries.samples).toHaveLength(2);await f.queue.enqueue({...base,id:'00000000-0000-4000-8000-000000000011',capturedAt:'2026-09-17T00:00:10.000Z',durationMs:5000});return Response.json(receipt(body,source,f.config));}throw Error('generated offline');});
 await f.collector.upload(true);const restored=await f.restart();expect(restored.stats().depth).toBe(1);expect((await restored.next(Number.MAX_SAFE_INTEGER))!.record.event.stateSeries!.samples).toHaveLength(3);
});

it('expired capture transport keeps every record retryable through restart',async()=>{
 const f=await fixture();f.reply(()=>Response.json({error:'upload_expired'}, {status:409}));await f.collector.upload(true);expect((await f.restart()).stats()).toMatchObject({depth:2,blocked:0,eligibleDepth:2});expect(f.sends).toHaveLength(1);expect(f.history.page(f.config,{day:f.day()}).received).toBe(0);
});
