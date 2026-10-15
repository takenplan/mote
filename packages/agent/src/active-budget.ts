import {AgentTimeoutError} from './types.js';

/** Actual admitted Agent work can span multiple model requests and repairs.
 * Products may select their own limit or null; queueing is never charged. */
export const DEFAULT_AGENT_EXECUTION_TIMEOUT_MS=3600000;

export class ActiveExecutionBudget {
 private remaining:number|null;
 constructor(timeoutMs:number|null,private now=()=>performance.now()){this.remaining=timeoutMs;}
 async run<T>(task:()=>Promise<T>):Promise<T>{
  if(this.remaining===null)return task();
  if(this.remaining<=0)throw new AgentTimeoutError();
  const started=this.now();let timer:ReturnType<typeof setTimeout>|undefined;
  try{
   return await Promise.race([task(),new Promise<never>((_resolve,reject)=>{timer=setTimeout(()=>reject(new AgentTimeoutError()),this.remaining!);})]);
  }finally{
   clearTimeout(timer);this.remaining=Math.max(0,this.remaining-(this.now()-started));
  }
 }
}
