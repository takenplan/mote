import {AsyncLocalStorage} from 'node:async_hooks';
import {createHash} from 'node:crypto';

type Witness={read:()=>unknown;hash:string};
const active=new AsyncLocalStorage<{userId:string;reads:Witness[]}|undefined>();
const fingerprint=(value:unknown)=>createHash('sha256').update(JSON.stringify(value,(_key,item)=>typeof item==='bigint'?{bigint:String(item)}:item)??'undefined').digest('hex');

/** Internal selection only; expose no archive rows or reusable authority. */
export function archiveReadSetActive(userId:string):boolean{return active.getStore()?.userId===userId;}

/** Record only the synchronous, owner-qualified reads actually used to build
 * an archive. Other accounts and non-exported progress are not dependencies.
 * The closures stay in memory; neither SQL nor private row bodies are saved. */
export function archiveRead<T>(userId:string,read:()=>T):T{
 const value=read(),scope=active.getStore();
 if(scope?.userId===userId)scope.reads.push({read,hash:fingerprint(value)});
 return value;
}

/** Provider I/O runs outside SQLite. Recheck the exact observed results inside
 * the final publication transaction, after authority and cancellation checks. */
export async function archiveReadSet<T>(userId:string,work:()=>Promise<T>){
 const scope={userId,reads:[] as Witness[]},value=await active.run(scope,work);
 return {value,current:()=>active.run(undefined,()=>scope.reads.every(witness=>fingerprint(witness.read())===witness.hash))};
}
