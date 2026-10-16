import {afterEach,expect,it,vi} from 'vitest';
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {defaultConfig} from '../src/config';

const native=vi.hoisted(()=>({call:vi.fn(async(command:string,_input?:unknown)=>{
 if(command==='calendar-permission')return {permission:'granted',calendars:[{id:'same-calendar',title:'Generated existing calendar',writable:true}]};
 throw Error('Unexpected generated calendar mutation');
})}));
vi.mock('../src/source-calendar',()=>({calendarHelper:async(_path:string,command:string,input?:unknown)=>native.call(command,input)}));
import {nativeCalendarActions} from '../src/calendar-actions';

const repository=fileURLToPath(new URL('../../../',import.meta.url));
const nativeImport=createRequire(import.meta.url)('./native-backend.cjs') as (url:string)=>Promise<any>;
const cleanup:(()=>Promise<unknown>)[]=[];
const networkFetch=globalThis.fetch;
afterEach(async()=>{for(const close of cleanup.splice(0).reverse())await close();vi.unstubAllGlobals();native.call.mockReset();native.call.mockImplementation(async command=>{if(command==='calendar-permission')return {permission:'granted',calendars:[{id:'same-calendar',title:'Generated existing calendar',writable:true}]};throw Error('Unexpected generated calendar mutation');});});
async function fixture(model=false){
 const module=await nativeImport(pathToFileURL(resolve(repository,'apps/server/test/fixtures/scoped-actions.ts')).href);
 const f=await (model?module.modelFixture:module.fixture)({after:(close:()=>Promise<unknown>)=>cleanup.push(close)});
 const calls:{user:string;path:string;body:unknown}[]=[];let dropReceipt=false;
 vi.stubGlobal('fetch',async(input:RequestInfo|URL,init:RequestInit={})=>{const url=new URL(String(input));if(url.origin!==defaultConfig().serverUrl)return networkFetch(input,init);const headers=new Headers(init.headers),body=init.body?await new Response(init.body).text():undefined;calls.push({user:headers.get('authorization')==='Bearer '+f.a.token?'A':headers.get('authorization')==='Bearer '+f.b.token?'B':'rotated',path:url.pathname,body:body?JSON.parse(body):undefined});const response=await f.node.app.inject({url:url.pathname+url.search,method:init.method??'GET',headers:Object.fromEntries(headers),...(body?{payload:body}:{})});if(dropReceipt&&url.pathname.endsWith('/receipt')&&response.statusCode===200){dropReceipt=false;throw Error('Generated lost receipt ACK');}return new Response(response.rawPayload,{status:response.statusCode,headers:response.headers as Record<string,string>});});
 const config=(user:typeof f.a)=>({...defaultConfig(),deviceId:'same-device',deviceName:'Generated native Desktop',token:user.token,account:{origin:defaultConfig().serverUrl,deploymentId:user.deploymentId,userId:user.userId,username:user.username}});
 const directory=join(f.directory,'generated-native-ledgers');
 return {...f,get node(){return f.node;},calls,config,directory,dropReceipt:()=>{dropReceipt=true;},adapter:(user:typeof f.a,assertCurrent?:()=>void)=>nativeCalendarActions(config(user),'/generated/no-real-calendar-helper',directory,assertCurrent)};
}

async function approved(f:Awaited<ReturnType<typeof fixture>>){
 await f.adapter(f.a).connect();await f.ingest(f.a,'A');await f.enable(f.a);
 const a=(await f.proposal(f.a)).items[0],q=await f.ok(f.a.token,'/api/actions/'+a.id+'/review','POST',{version:a.version,event:a.event,target:{deviceId:'same-device',calendarId:'same-calendar'}});
 expect((await f.request(f.b.token,'/api/actions/'+a.id+'/reviews/'+q.id)).statusCode).toBe(404);
 const fixed=await f.ok(f.a.token,'/api/actions/'+a.id+'/reviews/'+q.id);expect(fixed.reviewedAction.event).toEqual(a.event);
 await f.ok(f.a.token,'/api/owner-questions/'+q.id+'/reply','POST',{requestId:randomUUID(),expectedRevision:q.revision,action:'answer',choiceId:'approve'});return a;
}

it('connects the real Desktop native calendar factory to current M01/M12 without accessing a real calendar',async()=>{
 const f=await fixture();await f.adapter(f.a).connect();
 const view=await f.ok(f.a.token,'/api/actions');expect(view.targets).toHaveLength(1);expect(view.targets[0]).toMatchObject({deviceId:'same-device',calendars:[{id:'same-calendar',title:'Generated existing calendar'}]});expect((await f.ok(f.b.token,'/api/actions')).targets).toEqual([]);expect(native.call).toHaveBeenCalledTimes(1);
});

it('does not let B inherit A native calendar consent when the device and ledger directory are reused',async()=>{
 const f=await fixture();await f.adapter(f.a).connect();
 f.calls.length=0;native.call.mockClear();
 await f.adapter(f.b).deliver();
 expect(f.calls).toEqual([]);expect(native.call).not.toHaveBeenCalled();
 // Restarting the original account still retains its explicit connection.
 await f.adapter(f.a).deliver();expect(f.calls.some(call=>call.path==='/api/actions/deliveries')).toBe(true);
});

it('retires an old account intent while its native permission response is held',async()=>{
 const f=await fixture();let release!:(value:unknown)=>void,entered!:()=>void;
 const waiting=new Promise<void>(resolve=>{entered=resolve;}),permission=new Promise(resolve=>{release=resolve;});
 native.call.mockImplementationOnce(async()=>{entered();return permission;});
 let current=true;
 const adapter=nativeCalendarActions(f.config(f.a),'/generated/no-real-calendar-helper',f.directory,()=>{if(!current)throw Error('Account retired');});
 const connect=adapter.connect();await waiting;current=false;
 release({permission:'granted',calendars:[{id:'same-calendar',title:'Generated existing calendar',writable:true}]});
 await expect(connect).rejects.toThrow('Account retired');
 expect(f.calls.filter(call=>call.path==='/api/actions/targets')).toEqual([]);
 expect((await f.ok(f.a.token,'/api/actions')).targets).toEqual([]);
});

it('confirms the current deployment before requesting native permission or sending a private target',async()=>{
 const old=await fixture(),adapter=old.adapter(old.a);
 const replacement=await fixture();native.call.mockClear();
 await expect(adapter.connect()).rejects.toThrow();
 expect(native.call).not.toHaveBeenCalled();
 expect(replacement.calls.map(call=>call.path)).toEqual(['/api/connections/self']);
 expect((await replacement.ok(replacement.a.token,'/api/actions')).targets).toEqual([]);
});

it('uses real fixed review, native disk ledger and M05 receipt across a lost ACK, backend restart and credential rotation',async()=>{
 const f=await fixture(true),a=await approved(f);let mutations=0;
 native.call.mockImplementation(async(command,input:any)=>{expect(command).toBe('calendar-create');expect(input.createAllowed).toBe(true);expect(input.title).toBe('Generated A');mutations++;return {externalId:'generated-native-event'};});
 f.dropReceipt();await expect(f.adapter(f.a).deliver()).rejects.toThrow('不会重复插入');expect(mutations).toBe(1);
 expect((await f.ok(f.a.token,'/api/actions')).items[0].status).toBe('succeeded');
 await f.restart();
 const rotated=await f.ok(undefined,'/api/auth/login','POST',{username:'generated-a',password:'Generated-M11-account-password-01',mode:'client'});
 await f.adapter({...f.a,...rotated}).execute(a.id);await f.adapter(f.b).deliver();expect(mutations).toBe(1);
 expect((await f.ok(f.b.token,'/api/actions')).items).toEqual([]);
},30000);

it('preserves a late native fact only in A ledger and resumes reconciliation without a second calendar mutation',async()=>{
 const f=await fixture(true),a=await approved(f);let entered!:()=>void,release!:()=>void,current=true,mutations=0;
 const waiting=new Promise<void>(resolve=>{entered=resolve;}),held=new Promise<void>(resolve=>{release=resolve;});
 native.call.mockImplementation(async(command)=>{expect(command).toBe('calendar-create');mutations++;entered();await held;return {externalId:'generated-late-A-event'};});
 const pending=f.adapter(f.a,()=>{if(!current)throw Error('Account retired');}).execute(a.id);await waiting;current=false;f.calls.length=0;release();
 await expect(pending).rejects.toThrow('不会重复插入');expect(f.calls).toEqual([]);
 await f.adapter(f.b).deliver();expect(mutations).toBe(1);
 await f.adapter(f.a).deliver();expect(mutations).toBe(1);expect((await f.ok(f.a.token,'/api/actions')).items[0].status).toBe('succeeded');
},30000);
