import {afterEach,beforeEach,describe,expect,it} from 'vitest';
import {mkdtemp,writeFile,readFile,chmod,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn,type ChildProcessWithoutNullStreams} from 'node:child_process';
import {ChromeCaptureBridge} from '../src/chrome-bridge';
import {CHROME_EXTENSION_ID} from '../src/chrome-constants';
import {readBridgeDescriptor} from '../src/chrome-native-host';
import {registerChromeNativeHost} from '../src/chrome-registration';
const context={status:'ok',appId:'com.google.Chrome',pid:123,visibleBrowserWindows:1,url:'https://fixture.example/article',window:{x:0,y:0,width:900,height:700},viewport:{x:0,y:80,width:900,height:620},screen:{x:0,y:0,width:1440,height:900}};
const binding={url:context.url,windowId:3,tabId:4,documentId:'generated-document-1',window:context.window,viewport:context.viewport,scroll:{x:0,y:0}};
let directory:string,bridge:ChromeCaptureBridge,children:ChildProcessWithoutNullStreams[];
beforeEach(async()=>{directory=await mkdtemp(join(tmpdir(),'mote-bridge-fixture-'));children=[];const helper=join(directory,'helper');await writeFile(join(directory,'context.json'),JSON.stringify(context));await writeFile(helper,`#!${process.execPath}\nprocess.stdout.write(require('node:fs').readFileSync(${JSON.stringify(join(directory,'context.json'))},'utf8'));\n`,{mode:0o700});bridge=new ChromeCaptureBridge({profileDirectory:directory,helperPath:helper});await bridge.start();});
afterEach(async()=>{for(const child of children)child.kill();await bridge.close();await rm(directory,{recursive:true,force:true});});
const request=(structured=true)=>({observationId:'d70b6b4c-3d83-483d-a52d-0806b781a131',appId:'com.google.Chrome',pid:123,origins:['https://fixture.example'],masks:[],observedAt:new Date().toISOString(),structured});
async function connectHost(reply:(message:any)=>any){
 const child=spawn(process.execPath,['--import','tsx',resolve('src/chrome-native-host.ts'),`chrome-extension://${CHROME_EXTENSION_ID}/`],{env:{...process.env,MOTE_CHROME_BRIDGE_DESCRIPTOR:join(directory,'chrome-bridge.json')},stdio:['pipe','pipe','pipe']});children.push(child);let pending=Buffer.alloc(0);let messages:any[]=[];let errors='';child.stderr.on('data',c=>errors+=c);child.stdout.on('data',(chunk:Buffer)=>{pending=Buffer.concat([pending,chunk]);while(pending.length>=4&&pending.length>=pending.readUInt32LE(0)+4){const size=pending.readUInt32LE(0),m=JSON.parse(pending.subarray(4,size+4).toString());pending=pending.subarray(size+4);messages.push(m);void Promise.resolve(reply(m)).then(response=>{if(response){const b=Buffer.from(JSON.stringify(response)),h=Buffer.alloc(4);h.writeUInt32LE(b.length);child.stdin.write(Buffer.concat([h,b]));}});}});
 for(let i=0;i<100;i++){if((bridge as any).peers.size&&[...(bridge as any).peers][children.length-1]?.ready)return {child,messages};if(child.exitCode!==null)throw Error(`Relay exited ${errors}`);await new Promise(r=>setTimeout(r,20));}throw Error(`Relay failed to connect ${errors}`);
}
describe('Chrome capture private process relay',()=>{
 it('sends explicit observations through the real native host and invalidates a lease when the document changes',async()=>{
  let documentId=binding.documentId;const host=await connectHost(m=>({id:m.id,status:'ok',binding:{...binding,documentId},...(m.structured?{pages:[{version:3,scope:'visible_window',adapterId:'fixture.visible',adapterVersion:'1',appVersion:'',activity:'',status:'partial',truncated:true,observations:{firstAt:m.observedAt,lastAt:m.observedAt,count:1},objects:[{kind:'article',fields:[{name:'body',values:[{text:'Generated visible article',source:'text'}]}]}]}]}:{})}));
  const result=await bridge.sample(request(),new AbortController().signal);expect(result.status).toBe('ok');expect(result.screenshotSafe).toBe(true);expect(result.pages[0].objects[0].fields[0].values[0].text).toBe('Generated visible article');expect(await bridge.validate(result.identity!,new AbortController().signal)).toBe(true);documentId='navigated-document';expect(await bridge.validate(result.identity!,new AbortController().signal)).toBe(false);expect(host.messages.map(m=>m.structured)).toEqual([true,false,false]);
 });
 it('blocks screenshot-only content leakage, ungranted origins, and ambiguous Chrome profiles',async()=>{
  const host=await connectHost(m=>({id:m.id,status:'ok',binding,pages:[]}));const result=await bridge.sample(request(false),new AbortController().signal);expect(result.status).toBe('ok');expect(result.pages).toEqual([]);expect(host.messages[0].structured).toBe(false);
  expect((await bridge.sample({...request(),origins:[]},new AbortController().signal)).status).toBe('blocked');expect(host.messages).toHaveLength(1);
  await connectHost(m=>({id:m.id,status:'ok',binding,pages:[]}));expect((await bridge.sample(request(),new AbortController().signal)).status).toBe('blocked');expect(await bridge.validate(result.identity!,new AbortController().signal)).toBe(false);
 });
 it('preserves DOM capture with two Chrome windows while refusing screenshot proof and invalidating earlier leases',async()=>{
  await connectHost(m=>({id:m.id,status:'ok',binding,pages:m.structured?[{version:3,scope:'visible_window',adapterId:'fixture.visible',adapterVersion:'1',appVersion:'',activity:'',status:'partial',truncated:true,observations:{firstAt:m.observedAt,lastAt:m.observedAt,count:1},objects:[{kind:'article',fields:[{name:'body',values:[{text:'Allowed foreground fixture',source:'text'}]}]}]}]:[]}));
  const first=await bridge.sample(request(),new AbortController().signal);expect(first.screenshotSafe).toBe(true);await writeFile(join(directory,'context.json'),JSON.stringify({...context,visibleBrowserWindows:2}));expect(await bridge.validate(first.identity!,new AbortController().signal)).toBe(false);
  const second=await bridge.sample(request(),new AbortController().signal);expect(second.status).toBe('ok');expect(second.pages).toHaveLength(1);expect(second.screenshotSafe).toBe(false);
 });
 it('converts normalized privacy masks into verified primary-screen coordinates and rejects invalid input before dispatch',async()=>{
  const host=await connectHost(m=>({id:m.id,status:'ok',binding,pages:[]}));const result=await bridge.sample({...request(),masks:[{x:0.1,y:0.2,width:0.3,height:0.4}]},new AbortController().signal);expect(result.status).toBe('ok');expect(host.messages[0].masks).toEqual([{x:144,y:180,width:432,height:360}]);
  for(const mask of [{x:0.9,y:0,width:0.2,height:0.1},{x:0,y:0,width:NaN,height:0.1},{x:-0.1,y:0,width:0.2,height:0.1}])expect((await bridge.sample({...request(),masks:[mask]},new AbortController().signal)).status).toBe('blocked');expect(host.messages).toHaveLength(1);
 });
 it('rejects a private descriptor made readable by other users and registers only the fixed extension origin',async()=>{
  const descriptor=join(directory,'chrome-bridge.json');await chmod(descriptor,0o644);await expect(readBridgeDescriptor(descriptor)).rejects.toThrow('ownership');await chmod(descriptor,0o600);
  const installed=await registerChromeNativeHost({profileDirectory:directory,extensionDirectory:resolve('chrome-extension'),electronExecutable:process.execPath,nativeHostScript:resolve('src/chrome-native-host.ts'),homeDirectory:join(directory,'home')});const manifest=JSON.parse(await readFile(installed.manifestPath,'utf8'));expect(manifest.allowed_origins).toEqual([`chrome-extension://${CHROME_EXTENSION_ID}/`]);expect(await readFile(manifest.path,'utf8')).toContain('ELECTRON_RUN_AS_NODE=1');
 });
});

describe('Chrome origin permission recheck',()=>{
 it('reports only the exact requested origin grants through the native relay without a capture lease',async()=>{
  const calls:string[]=[];const permissionStatus=new Function((await readFile(resolve('chrome-extension/permissions.js'),'utf8')).replace('export async function permissionStatus','return async function permissionStatus'))();
  const host=await connectHost(message=>permissionStatus(message,{contains:async(value:any)=>{calls.push(value.origins[0]);return value.origins[0]==='https://fixture.example/*';}}));
  const origins=['https://fixture.example','http://localhost:4123'];const result=await bridge.permissionStatus(origins,new AbortController().signal);
  expect(result.state).toBe('checked');expect(result.origins).toEqual([{origin:origins[0],allowed:true},{origin:origins[1],allowed:false}]);
  expect(calls).toEqual(origins.map(origin=>origin+'/*'));expect(host.messages).toHaveLength(1);expect(Object.keys(host.messages[0]).sort()).toEqual(['id','origins','type']);expect(host.messages[0].type).toBe('permission-status');expect((bridge as any).leases.size).toBe(0);
 });
 it('leaves disconnected, ambiguous, and timed-out checks unconfirmed',async()=>{
  const origins=['https://fixture.example'];expect((await bridge.permissionStatus(origins,new AbortController().signal)).state).toBe('disconnected');
  await connectHost(()=>undefined);expect(await bridge.permissionStatus(origins,new AbortController().signal)).toEqual({state:'unavailable',origins:[]});
  await connectHost(()=>undefined);expect(await bridge.permissionStatus(origins,new AbortController().signal)).toEqual({state:'ambiguous',origins:[]});
 });
 it('invalidates permission replies after cancellation or a peer epoch change',async()=>{
  let finish!:(value:any)=>void;let message:any;await connectHost(value=>{message=value;return new Promise(resolve=>{finish=resolve;});});
  const controller=new AbortController(),first=bridge.permissionStatus(['https://fixture.example'],controller.signal);for(let i=0;!message&&i<50;i++)await new Promise(r=>setTimeout(r,10));controller.abort();expect(await first).toEqual({state:'canceled',origins:[]});finish({type:'permission-status',id:message.id,status:'ok',origins:[{origin:'https://fixture.example',allowed:true}]});
  message=undefined;const second=bridge.permissionStatus(['https://fixture.example'],new AbortController().signal);for(let i=0;!message&&i<50;i++)await new Promise(r=>setTimeout(r,10));await connectHost(()=>undefined);finish({type:'permission-status',id:message.id,status:'ok',origins:[{origin:'https://fixture.example',allowed:true}]});expect(await second).toEqual({state:'stale',origins:[]});
 });
 it.each([{origins:[]},{origins:[{origin:'https://another.example',allowed:true}]},{origins:[{origin:'https://fixture.example',allowed:true},{origin:'https://extra.example',allowed:true}]}])('rejects an incomplete or different permission scope %j',async ({origins})=>{
  await connectHost(message=>({type:'permission-status',id:message.id,status:'ok',origins}));expect(await bridge.permissionStatus(['https://fixture.example'],new AbortController().signal)).toEqual({state:'unavailable',origins:[]});
 });
});

it('keeps a concurrent origin check busy and rejects a valid capture reply as permission proof',async()=>{
 let finish!:(value:any)=>void,message:any;await connectHost(value=>{message=value;return new Promise(resolve=>{finish=resolve;});});
 const first=bridge.permissionStatus(['https://fixture.example'],new AbortController().signal);
 for(let i=0;!message&&i<50;i++)await new Promise(resolve=>setTimeout(resolve,10));
 expect(await bridge.permissionStatus(['https://fixture.example'],new AbortController().signal)).toEqual({state:'busy',origins:[]});
 finish({id:message.id,status:'ok',binding,pages:[]});expect(await first).toEqual({state:'unavailable',origins:[]});
});
