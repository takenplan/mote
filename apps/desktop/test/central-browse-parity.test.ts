import {afterEach,expect,it,vi} from 'vitest';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import sharp from 'sharp';
import {browseCaptures,captureDayRange} from '../src/capture-browser';
import {centralContentPage} from '../src/content-library';
import {defaultConfig} from '../src/config';
import {DurableQueue} from '../src/queue';
import {event,image} from './fixtures';

const nativeImport=createRequire(import.meta.url)('./native-backend.cjs') as (url:string)=>Promise<any>;
const cleanup:(()=>Promise<unknown>)[]=[];
afterEach(async()=>{for(const close of cleanup.splice(0).reverse())await close();vi.unstubAllGlobals();});

/** Generated data crosses the production M01/M03 routes and the actual Desktop
 * reader. There is no personal capture, native UI or legacy Store fixture. */
async function fixture(){
 const {buildApp}=await nativeImport(new URL('../../server/src/app.ts',import.meta.url).href) as typeof import('../../server/src/app');
 const directory=await mkdtemp(join(tmpdir(),'mote-desktop-browse-parity-'));cleanup.push(()=>rm(directory,{recursive:true,force:true}));
 const host=await buildApp({dataDir:join(directory,'central')});cleanup.push(()=>host.app.close());
 const password='Generated-browse-only-01';await host.accounts!.initialize('generated-admin',password);
 const request=(token:string|undefined,url:string,method:any='GET',payload?:unknown)=>host.app.inject({url,method,headers:{'x-mote-protocol-version':'2','x-mote-ingress-version':'3',...(token?{authorization:'Bearer '+token}:{})},...(payload===undefined?{}:{payload})});
 const login=async(username:string)=>{const response=await request(undefined,'/api/auth/login','POST',{username,password,mode:'client'});expect(response.statusCode,response.body).toBe(200);return response.json();};
 const admin=await login('generated-admin');
 for(const username of ['generated-a','generated-b'])expect((await request(admin.token,'/api/admin/accounts','POST',{username,password})).statusCode).toBe(200);
 const a=await login('generated-a'),b=await login('generated-b'),base=defaultConfig();
 const config=(grant:typeof a)=>({...base,token:grant.token,account:{origin:base.serverUrl,deploymentId:grant.deploymentId,userId:grant.userId,username:grant===a?'generated-a':'generated-b'}});
 const calls:URL[]=[];
 const fetcher=vi.fn(async(input:RequestInfo|URL,init:RequestInit={})=>{
  const url=new URL(String(input));calls.push(url);const body=init.body?await new Response(init.body).text():undefined;
  const response=await host.app.inject({url:url.pathname+url.search,method:(init.method??'GET') as any,headers:Object.fromEntries(new Headers(init.headers)),...(body?{payload:body}:{})});
  return new Response(response.rawPayload,{status:response.statusCode,headers:response.headers as Record<string,string>});
 });vi.stubGlobal('fetch',fetcher);
 const receive=async(grant:typeof a,items:unknown[],batchId='generated')=>{
  const source=await request(grant.token,'/api/ingress/sources','POST',{id:'generated-browse-source',name:'Generated browse source',kind:'mote.desktop',deviceId:base.deviceId,platform:'macos',retention:'archive'});expect(source.statusCode,source.body).toBe(200);
  const response=await request(grant.token,'/api/ingress/sources/generated-browse-source/captures','POST',{batchId,items});expect(response.statusCode,response.body).toBe(200);return response.json();
 };
 const queue=new DurableQueue(join(directory,'desktop-queue'),config(a));await queue.initialize();
 return {a,b,config,request,receive,queue,calls,fetcher};
}
const capture=(index:number,deviceId:string)=>({...event('00000000-0000-4000-8000-'+String(index+1).padStart(12,'0')),deviceId,capturedAt:new Date(Date.parse('2026-09-13T00:00:00Z')+index*1000).toISOString(),ocrText:'Generated A record '+index,imageBase64:image.toString('base64')});
const browserCalls=(calls:URL[])=>calls.filter(url=>url.pathname.startsWith('/api/capture-browser'));

it('fetches one scoped records/content page and forwards the server cursor without offset drift after a leading insert',async()=>{
 const f=await fixture(),config=f.config(f.a),rows=Array.from({length:65},(_,i)=>capture(i,config.deviceId));await f.receive(f.a,rows);
 await f.receive(f.b,[{...rows[64],ocrText:'Generated B same-ID record'}]);
 const input={location:'central' as const,day:'2026-09-13',grouping:'records' as const};
 const before=f.calls.length,first=await browseCaptures(f.queue,config,input);
 expect(first.totalCount).toBe(65);expect(first.items).toHaveLength(30);expect(first.nextCursor).toBeTypeOf('string');
 expect(browserCalls(f.calls.slice(before))).toHaveLength(1);expect(browserCalls(f.calls.slice(before))[0].searchParams.get('limit')).toBe('30');
 expect(f.calls.slice(before).filter(url=>url.pathname==='/api/connections/self')).toHaveLength(1);
 const contentStart=f.calls.length,content=await centralContentPage(config);
 expect(content.items.map(row=>row.key)).toEqual(first.items.map(row=>'capture:'+row.id));expect(content.total).toBe(65);
 expect(browserCalls(f.calls.slice(contentStart))).toHaveLength(1);expect(browserCalls(f.calls.slice(contentStart))[0].searchParams.get('limit')).toBe('30');
 expect(f.calls.slice(contentStart).some(url=>url.pathname==='/api/captures')).toBe(false);
 await f.receive(f.a,[{...capture(65,config.deviceId),capturedAt:'2026-09-13T01:00:00Z'}],'generated-leading-insert');
 const secondStart=f.calls.length,second=await browseCaptures(f.queue,config,{...input,cursor:first.nextCursor});
 expect(second.items.map(row=>row.id)).toEqual(rows.slice(5,35).reverse().map(row=>row.id));
 expect(second.items.some(row=>first.items.some(previous=>previous.id===row.id))).toBe(false);
 expect(browserCalls(f.calls.slice(secondStart))).toHaveLength(1);expect(browserCalls(f.calls.slice(secondStart))[0].searchParams.get('cursor')).toBe(first.nextCursor);
 const nextContent=await centralContentPage(config,content.nextCursor);expect(nextContent.items.map(row=>row.key)).toEqual(second.items.map(row=>'capture:'+row.id));
 await expect(browseCaptures(f.queue,f.config(f.b),{...input,cursor:first.nextCursor})).rejects.toThrow();
 await expect(browseCaptures(f.queue,config,{...input,source:'ui_page',cursor:first.nextCursor})).rejects.toThrow();
 await expect(centralContentPage(f.config(f.b),content.nextCursor)).rejects.toThrow();
 expect((await centralContentPage(f.config(f.b))).items[0].preview).toBe('Generated B same-ID record');
});

it('uses the scoped Session and member cursors without reconstructing a day from capture pages',async()=>{
 const f=await fixture(),config=f.config(f.a),rows=Array.from({length:65},(_,i)=>({...capture(i,config.deviceId),appId:i<35?'generated-group':'generated-app-'+i}));await f.receive(f.a,rows);
 const input={location:'central' as const,day:'2026-09-13',grouping:'sessions' as const},before=f.calls.length;
 const first=await browseCaptures(f.queue,config,input);expect(first.sessions).toHaveLength(30);expect(first.sessionCount).toBe(31);expect(first.totalCount).toBe(65);
 const next=await browseCaptures(f.queue,config,{...input,cursor:first.nextCursor});expect(next.sessions).toHaveLength(1);expect(next.sessions![0].count).toBe(35);
 const sessionId=next.sessions![0].id,members=await browseCaptures(f.queue,config,{...input,sessionId});expect(members.items).toHaveLength(30);expect(members.totalCount).toBe(35);
 const tail=await browseCaptures(f.queue,config,{...input,sessionId,cursor:members.nextCursor});expect(tail.items).toHaveLength(5);expect(tail.nextCursor).toBeUndefined();
 expect([...members.items,...tail.items].map(row=>row.id)).toEqual(rows.slice(0,35).reverse().map(row=>row.id));
 const requests=browserCalls(f.calls.slice(before));expect(requests).toHaveLength(4);expect(requests.every(url=>url.pathname==='/api/capture-browser/sessions'&&url.searchParams.get('limit')==='30')).toBe(true);
 expect(requests[1].searchParams.get('cursor')).toBe(first.nextCursor);expect(requests[3].searchParams.get('cursor')).toBe(members.nextCursor);
 await expect(browseCaptures(f.queue,f.config(f.b),{...input,cursor:first.nextCursor})).rejects.toThrow();
 await expect(browseCaptures(f.queue,config,{...input,sessionId:rows[35].id,cursor:members.nextCursor})).rejects.toThrow();
});

it('preserves exact central original bytes for screenshots without preview text and keeps equal IDs account scoped',async()=>{
 const f=await fixture(),config=f.config(f.a),pixels=await sharp({create:{width:32,height:32,channels:3,background:'#428758'}}).jpeg().toBuffer(),other=await sharp({create:{width:8,height:8,channels:3,background:'#875842'}}).jpeg().toBuffer();
 const row={...capture(0,config.deviceId),ocrText:'',ocr:{status:'disabled' as const},imageBase64:pixels.toString('base64')};
 await f.receive(f.a,[row]);await f.receive(f.b,[{...row,ocrText:'Generated B text',imageBase64:other.toString('base64')}]);
 const input={location:'central' as const,day:'2026-09-13',grouping:'records' as const},a=await browseCaptures(f.queue,config,input),b=await browseCaptures(f.queue,f.config(f.b),input);
 expect(a.items[0]).toMatchObject({id:row.id,textPreview:'',sizeBytes:pixels.length,hasImage:true,ocr:{status:'disabled'}});
 expect(b.items[0]).toMatchObject({id:row.id,textPreview:'Generated B text',sizeBytes:other.length+Buffer.byteLength('Generated B text'),hasImage:true});
 const range=captureDayRange(input.day),authoritative=await f.request(f.a.token,'/api/capture-browser?'+new URLSearchParams({...range,deviceId:config.deviceId,source:'screen',limit:'30'}));
 expect(authoritative.statusCode,authoritative.body).toBe(200);expect(a.items[0].sizeBytes).toBe(authoritative.json().items[0].sizeBytes);
});

it('returns the existing authorizationDenied contract for scoped archive 403 and identity-confirmation 401',async()=>{
 const f=await fixture(),config=f.config(f.a);await f.receive(f.a,[capture(0,config.deviceId)]);
 expect((await centralContentPage(config)).items).toHaveLength(1);
 const issued=await f.request(f.a.token,'/api/login/session','POST',{serverUrl:config.serverUrl,deviceId:config.deviceId,deviceName:'Generated browse device',platform:'macos'});expect(issued.statusCode,issued.body).toBe(200);
 expect(await centralContentPage({...config,token:issued.json().token})).toEqual({items:[],total:0,authorizationDenied:true});
 expect((await f.request(f.a.token,'/api/connections/'+f.a.credentialId,'DELETE')).statusCode).toBe(200);
 const before=f.calls.length;expect(await centralContentPage(config)).toEqual({items:[],total:0,authorizationDenied:true});
 expect(browserCalls(f.calls.slice(before))).toHaveLength(0);
});
