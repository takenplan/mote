import {afterEach,expect,it,vi} from 'vitest';
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {join,resolve} from 'node:path';
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
afterEach(async()=>{for(const close of cleanup.splice(0).reverse())await close();vi.unstubAllGlobals();native.call.mockClear();});
async function fixture(model=false){
 const module=await nativeImport(pathToFileURL(resolve(repository,'apps/server/test/fixtures/scoped-actions.ts')).href);
 const f=await (model?module.modelFixture:module.fixture)({after:(close:()=>Promise<unknown>)=>cleanup.push(close)});
 const calls:{user:string;path:string;body:unknown}[]=[];
 vi.stubGlobal('fetch',async(input:RequestInfo|URL,init:RequestInit={})=>{const url=new URL(String(input)),headers=new Headers(init.headers),body=init.body?await new Response(init.body).text():undefined;calls.push({user:headers.get('authorization')??'',path:url.pathname,body:body?JSON.parse(body):undefined});const response=await f.node.app.inject({url:url.pathname+url.search,method:init.method??'GET',headers:Object.fromEntries(headers),...(body?{payload:body}:{})});return new Response(response.rawPayload,{status:response.statusCode,headers:response.headers as Record<string,string>});});
 const config=(user:typeof f.a)=>({...defaultConfig(),deviceId:'same-device',deviceName:'Generated native Desktop',token:user.token,account:{origin:defaultConfig().serverUrl,deploymentId:user.deploymentId,userId:user.userId,username:user.username}});
 const directory=join(f.directory,'generated-native-ledgers');
 return {...f,get node(){return f.node;},calls,config,directory,adapter:(user:typeof f.a)=>nativeCalendarActions(config(user),'/generated/no-real-calendar-helper',directory)};
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
