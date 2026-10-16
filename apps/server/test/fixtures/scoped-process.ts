import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';

/** Test orchestration only: real listener/accounts, real child death and state
 * waits. Domain assertions, grants and providers stay in each production host. */
export function scopedHttpClient(base:string){
 const protocol={'x-mote-protocol-version':'2','x-mote-ingress-version':'3'};
 const request=async(token:string|undefined,url:string,method='GET',payload?:unknown)=>{const response=await fetch(base+url,{method,headers:{...protocol,...(token?{authorization:'Bearer '+token}:{}),...(payload===undefined?{}:{'content-type':'application/json'})},...(payload===undefined?{}:{body:JSON.stringify(payload)})});if(response.status!==200)throw Error(url+' '+response.status+' '+await response.text());return response.json();};
 return {request,configure:async(token:string,domain:string,value:unknown)=>request(token,'/api/configuration/'+domain,'PUT',{revision:(await request(token,'/api/configuration')).revision,value})};
}
export async function waitForScopedState(check:()=>unknown|Promise<unknown>,diagnostic:()=>string,timeoutMs=65000){const end=Date.now()+timeoutMs;while(!await check()){if(Date.now()>end)throw Error(diagnostic());await delay(10);}}
export function launchScopedProcess(script:string,environment:Record<string,string>,options:{loader?:boolean}={}){
 const child=spawn(process.execPath,options.loader===false?[script]:['--import','tsx',script],{env:{...process.env,...environment},stdio:['ignore','pipe','pipe']}),seen=new Map<string,any>(),pending=new Map<string,{resolve:(value:any)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}>();let output='',errors='';
 child.stderr.on('data',part=>{errors=(errors+String(part)).slice(-12000);});
 const closed=new Promise<{code:number|null;signal:NodeJS.Signals|null}>(resolve=>child.once('close',(code,signal)=>{for(const item of pending.values()){clearTimeout(item.timer);item.reject(Error('Generated scoped host exited '+code+'/'+signal+' '+errors));}pending.clear();resolve({code,signal});}));
 child.stdout.on('data',part=>{output+=String(part);for(;;){const end=output.indexOf('\n');if(end<0)break;const line=output.slice(0,end);output=output.slice(end+1);try{const event=JSON.parse(line),value=event.event==='server.listening'?{...event,phase:'listening'}:event;if(typeof value.phase!=='string')continue;seen.set(value.phase,value);const item=pending.get(value.phase);if(item){clearTimeout(item.timer);pending.delete(value.phase);item.resolve(value);}}catch{}}});
 return {child,closed,waitForPhase:(phase:string)=>seen.has(phase)?Promise.resolve(seen.get(phase)):new Promise<any>((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(phase);child.kill('SIGKILL');reject(Error('Generated scoped host '+phase+' deadline '+errors));},75000);pending.set(phase,{resolve,reject,timer});})};
}
