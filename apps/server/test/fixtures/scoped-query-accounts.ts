/** Shared genuine account/HTTP setup for Ask-reader and MCP consumers.
 * Domain data, SDK transports and app lifecycle stay in the existing fixtures. */
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import type {buildApp} from '../../src/app.js';

type Host=Awaited<ReturnType<typeof buildApp>>;
export const password='Generated-M11-account-password-01';
export const protocol={'x-mote-protocol-version':'2','x-mote-ingress-version':'3'};
export const source=(id='same-source')=>({id,name:'Generated '+id,kind:'mcp',deviceId:'same-device',platform:'import',retention:'snapshot'});
export const item=(text:string,externalId='same-item',revision='same-revision')=>({externalId,revision,observedAt:'2026-10-16T00:00:00Z',kind:'message',layer:'snapshot',title:'Generated',text});
export const deferred=()=>{let resolve!:()=>void;return {promise:new Promise<void>(r=>resolve=r),resolve};};
export function queryHttp(current:()=>Host){
 const request=(token:string|undefined,url:string,method:any='GET',payload?:unknown,extra:Record<string,string>={})=>current().app.inject({url,method,headers:{...protocol,...(token?{authorization:'Bearer '+token}:{}),...extra},...(payload===undefined?{}:{payload})});
 const ok=async(token:string|undefined,url:string,method:any='GET',payload?:unknown)=>{const response=await request(token,url,method,payload);assert.equal(response.statusCode,200,response.body);return response.json();};
 return {request,ok};
}
export async function queryAccounts(node:Host,ok:ReturnType<typeof queryHttp>['ok']){
 await node.accounts.initialize('generated-admin',password);
 const admin=await ok(undefined,'/api/auth/login','POST',{username:'generated-admin',password,mode:'client'}),users=[];
 for(const label of ['a','b']){const user=await ok(admin.token,'/api/admin/accounts','POST',{username:'generated-'+label,password}),login=await ok(undefined,'/api/auth/login','POST',{username:user.username,password,mode:'client'});users.push({...user,...login});await ok(login.token,'/api/ingress/sources','POST',source());await ok(login.token,'/api/ingress/sources','POST',source('other-source'));}
 const [a,b]=users;return {admin,a,b};
}
/** Wait on a production state, with its last observation as timeout evidence. */
export async function waitForState<T>(read:()=>Promise<T>,ready:(value:T)=>boolean,label:string,timeoutMs=15000):Promise<T>{
 const deadline=Date.now()+timeoutMs;for(;;){const value=await read();if(ready(value))return value;assert.ok(Date.now()<deadline,label+': '+JSON.stringify(value));await delay(10);}
}
