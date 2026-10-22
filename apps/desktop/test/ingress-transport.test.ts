import {afterEach,expect,it,vi} from 'vitest';
import {createHash} from 'node:crypto';
import {defaultConfig} from '../src/config';
import {event,image} from './fixtures';
import {ingressKey} from '../src/ingress-client';
import {uploadCaptureBatch} from '../src/transport';
vi.mock('../src/connection',()=>({testConnection:async(config:any)=>({account:config.account})}));
afterEach(()=>vi.unstubAllGlobals());
const config={...defaultConfig(),token:'generated',packedUpload:true,account:{origin:defaultConfig().serverUrl,userId:'generated-a',deploymentId:'generated-deployment',username:'generated-a'}};
const entries=[0,1].map(i=>({event:event(`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`)}));
function receipt(body:any,sourceId:string){return {version:3,state:'received',deploymentId:config.account.deploymentId,userId:config.account.userId,sourceId,batchId:body.batchId,id:ingressKey([config.account.deploymentId,config.account.userId,sourceId,body.batchId]),captures:body.items.map((item:any)=>{const bytes=item.imageBase64?Buffer.from(item.imageBase64,'base64'):undefined,hash=bytes?createHash('sha256').update(bytes).digest('hex'):undefined;return {id:item.id,duplicate:false,...(bytes?{original:{sourceId,captureId:item.id,hash,bytes:bytes.length,mime:item.imageMime,retention:'archive',ref:'original:'+ingressKey([config.account.userId,sourceId,item.id,hash,item.imageMime,'archive'])}}:{})};})};}
function fixture(reply:(body:any,sourceId:string)=>Response|Promise<Response>,enabled:()=>boolean=()=>true){
 const requests:any[]=[];
 vi.stubGlobal('fetch',vi.fn(async(url:string,init:RequestInit)=>{
  const path=new URL(url).pathname,body=JSON.parse(await new Response(init.body).text());requests.push({path,body});
  if(path.endsWith('/devices'))return Response.json(body);
  if(path.endsWith('/sources'))return Response.json({...body,enabled:enabled()});
  return reply(body,path.split('/')[4]);
 }));return requests;
}
it('pauses before bytes and confirms a raced 409 before splitting',async()=>{
 const settled=vi.fn();let active=false;
 const calls=fixture(()=>Response.json({}, {status:409}),()=>active);
 await expect(uploadCaptureBatch(config,entries,undefined,undefined,settled)).rejects.toMatchObject({paused:true});
 expect(calls.filter(c=>c.path.endsWith('/captures'))).toHaveLength(0);
 active=true;fixture(()=>{active=false;return Response.json({}, {status:409});},()=>active);
 await expect(uploadCaptureBatch(config,entries,undefined,undefined,settled)).rejects.toMatchObject({paused:true});
 expect(vi.mocked(fetch)).toHaveBeenCalledTimes(4);expect(settled).not.toHaveBeenCalled();
});
it('awaits each accepted split receipt before a later network failure',async()=>{
 const settled:string[]=[];let durable=false;
 const calls=fixture(async(body,source)=>{if(body.items.length>1)return Response.json({}, {status:413});if(body.items[0].id===entries[1].event.id){expect(durable).toBe(true);throw Error('generated offline');}return Response.json(receipt(body,source));});
 await expect(uploadCaptureBatch(config,entries,undefined,undefined,async id=>{await Promise.resolve();settled.push(id);durable=true;})).rejects.toThrow('offline');
 expect(settled).toEqual([entries[0].event.id]);expect(calls.filter(c=>c.path.endsWith('/captures'))).toHaveLength(3);
});
it.each(['id','original','bytes'] as const)('validates the complete response before any callback (%s)',async malformed=>{
 const settled=vi.fn(),withImages=entries.map(entry=>({...entry,image}));
 fixture((body,source)=>{const result=receipt(body,source);if(malformed==='id')result.captures[1].id='invalid';else if(malformed==='original')result.captures[1].original={hash:'invalid'};else result.captures[1].original.bytes++;return Response.json(result);});
 await expect(uploadCaptureBatch(config,withImages,undefined,undefined,settled)).rejects.toThrow();expect(settled).not.toHaveBeenCalled();
});
it('local callback failure preserves earlier settlement and cannot split even a 409-shaped exception',async()=>{
 const settled:string[]=[],calls=fixture((body,source)=>Response.json(receipt(body,source)));
 const {TransportFailure}=await import('../src/support');
 await expect(uploadCaptureBatch(config,entries,undefined,undefined,async id=>{if(id===entries[1].event.id)throw new TransportFailure('generated storage','STORAGE',409);settled.push(id);})).rejects.toThrow('storage');
 expect(settled).toEqual([entries[0].event.id]);expect(calls.filter(c=>c.path.endsWith('/captures'))).toHaveLength(1);
});
it.each([409,410])('isolates true record rejection %s and still delivers another accepted receipt',async status=>{
 const calls=fixture((body,source)=>body.items.length>1||body.items[0].id===entries[0].event.id?Response.json({}, {status}):Response.json(receipt(body,source))),settled=vi.fn();
 const result=await uploadCaptureBatch(config,entries,undefined,undefined,settled);expect([...result.values()]).toEqual([status,200]);expect(settled).toHaveBeenCalledTimes(2);expect(calls.filter(c=>c.path.endsWith('/captures'))).toHaveLength(3);
});
it('never treats an expired upload as a record conflict',async()=>{
 const settled=vi.fn(),calls=fixture(()=>Response.json({error:'upload_expired'}, {status:409}));
 await expect(uploadCaptureBatch(config,entries,undefined,undefined,settled)).rejects.toMatchObject({uploadExpired:true});expect(settled).not.toHaveBeenCalled();expect(calls.filter(c=>c.path.endsWith('/captures'))).toHaveLength(1);
});
it('abort after HTTP receipt prevents local settlement',async()=>{
 const abort=new AbortController(),settled=vi.fn();fixture((body,source)=>{abort.abort();return Response.json(receipt(body,source));});
 await expect(uploadCaptureBatch(config,entries,abort.signal,undefined,settled)).rejects.toThrow();expect(settled).not.toHaveBeenCalled();
});
