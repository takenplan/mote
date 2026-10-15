import {spawn,type ChildProcessWithoutNullStreams} from 'node:child_process';
import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';
import {StoreError} from './execution-storage.js';

export type PluginMethod='health'|'put'|'read'|'remove'|'search'|'export'|'describe'|'invoke'|'lifecycle';
export type PluginHostCall=(method:string,params:unknown)=>Promise<unknown>;
type PendingCall={resolve:(value:unknown)=>void;reject:(error:unknown)=>void;hostCall?:PluginHostCall;hostFailed?:boolean;hostFailure?:unknown;hostPending:Set<Promise<unknown>>;finishing?:boolean};

export interface PluginRuntime {
  call(method:PluginMethod,params:unknown,signal?:AbortSignal,hostCall?:PluginHostCall):Promise<unknown>;
  close():Promise<void>;
}
/** JSON RPC transport. Neither credentials nor provider prose are emitted into
 * diagnostics, and query agents never receive this control/write interface. */
export class WorkerPluginRuntime implements PluginRuntime {
  private process:ChildProcessWithoutNullStreams;
  private sequence=0;
  private pending=new Map<number,PendingCall>();
  private closed=false;
  private initialized:Promise<unknown>;
  private closing?:Promise<void>;
  private hostResponse(value:unknown){if(this.closed||this.process.stdin.destroyed||this.process.stdin.writableEnded)return;this.process.stdin.write(JSON.stringify(value)+'\n',()=>{});}
  constructor(entry:string,configuration:Record<string,unknown>,cwd:string){
    this.process=spawn(process.execPath,[fileURLToPath(new URL('./plugin-worker.mjs',import.meta.url))],{cwd,env:{PATH:process.env.PATH,LANG:process.env.LANG,TMPDIR:process.env.TMPDIR},stdio:['pipe','pipe','pipe']});
    this.process.stderr.resume();
    const reader=createInterface({input:this.process.stdout,crlfDelay:Infinity});
    reader.on('line',line=>{let result:{id:number;result?:unknown;error?:unknown;hostCall?:{id:number;method:string;params:unknown}};try{result=JSON.parse(line);}catch{return;}
      if(result.hostCall){const call=result.hostCall,pending=this.pending.get(result.id),host=pending&&!pending.finishing?pending.hostCall:undefined;
        // Keep genuine host failures private. Child prose cannot manufacture or
        // suppress their typed retry/unknown-outcome facts. Drain accepted host
        // callbacks before resolving even a fire-and-forget worker result.
        const work=Promise.resolve().then(()=>{if(!host||this.closed)throw Error('host_capability_unavailable');return host(call.method,call.params);}).then(value=>this.hostResponse({hostResult:call.id,result:value}),error=>{if(host&&pending&&!pending.hostFailed){pending.hostFailed=true;pending.hostFailure=error;}this.hostResponse({hostResult:call.id,error:true});});if(host)pending!.hostPending.add(work);return;
      }
      const pending=this.pending.get(result.id);if(!pending||pending.finishing)return;pending.finishing=true;
      void Promise.allSettled([...pending.hostPending]).then(()=>{if(this.pending.get(result.id)!==pending)return;this.pending.delete(result.id);pending.hostFailed?pending.reject(pending.hostFailure):result.error?pending.reject(new StoreError('Plugin worker reported an operation failure',502)):pending.resolve(result.result);});
    });
    this.process.on('error',()=>this.fail());this.process.on('exit',()=>this.fail());this.process.stdin.on('error',()=>this.fail());
    this.initialized=this.request('initialize',{entry,configuration});
  }
  private fail(){this.closed=true;for(const pending of this.pending.values())pending.reject(pending.hostFailed?pending.hostFailure:new StoreError('Plugin worker is unavailable; recover its pending operation before retrying',503));this.pending.clear();}
  private request(method:string,params:unknown,hostCall?:PluginHostCall){
    if(this.closed)return Promise.reject(new StoreError('Plugin worker is closed',503));
    const id=++this.sequence;return new Promise<unknown>((resolve,reject)=>{this.pending.set(id,{resolve,reject,hostCall,hostPending:new Set()});this.process.stdin.write(JSON.stringify({id,method,params})+'\n',error=>{if(error){this.pending.delete(id);reject(new StoreError('Plugin worker transport failed',503));}});});
  }
  async call(method:PluginMethod,params:unknown,signal?:AbortSignal,hostCall?:PluginHostCall){
    await this.initialized;if(signal?.aborted)throw new StoreError('Plugin operation was revoked',409);
    // Cancellation fences local publication. A submitted remote mutation still
    // needs reconciliation; closing a transport never proves remote rollback.
    const result=await this.request(method,params,hostCall);if(signal?.aborted)throw new StoreError('Plugin result arrived after revocation; reconciliation is required',409);return result;
  }
  async close(){if(this.closing)return this.closing;this.fail();if(this.process.exitCode!==null||this.process.signalCode!==null)return;this.process.stdin.end();this.closing=new Promise<void>(resolve=>{
    const deadline=setTimeout(()=>this.process.kill('SIGKILL'),5000);deadline.unref();
    this.process.once('exit',()=>{clearTimeout(deadline);resolve();});
  });return this.closing;}
}
