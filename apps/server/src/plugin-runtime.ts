import {spawn,type ChildProcessWithoutNullStreams} from 'node:child_process';
import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';
import {StoreError} from './store.js';

export interface PluginRuntime {
  call(method:'health'|'put'|'read'|'remove'|'search'|'export',params:unknown,signal?:AbortSignal):Promise<unknown>;
  close():Promise<void>;
}
/** JSON RPC transport. Neither credentials nor provider prose are emitted into
 * diagnostics, and query agents never receive this control/write interface. */
export class WorkerPluginRuntime implements PluginRuntime {
  private process:ChildProcessWithoutNullStreams;
  private sequence=0;
  private pending=new Map<number,{resolve:(value:unknown)=>void;reject:(error:unknown)=>void;dispose:()=>void}>();
  private closed=false;
  private initialized:Promise<unknown>;
  private exited:Promise<void>;
  private closing?:Promise<void>;
  constructor(entry:string,configuration:Record<string,unknown>,cwd:string){
    this.process=spawn(process.execPath,[fileURLToPath(new URL('./plugin-worker.mjs',import.meta.url))],{cwd,env:{PATH:process.env.PATH,LANG:process.env.LANG,TMPDIR:process.env.TMPDIR},stdio:['pipe','pipe','pipe']});
    this.exited=new Promise(resolve=>this.process.once('close',()=>resolve()));
    this.process.stderr.resume();
    const reader=createInterface({input:this.process.stdout,crlfDelay:Infinity});
    reader.on('line',line=>{let result:{id:number;result?:unknown;error?:unknown};try{result=JSON.parse(line);}catch{return;}
      const pending=this.pending.get(result.id);if(!pending)return;this.pending.delete(result.id);pending.dispose();result.error?pending.reject(new StoreError('Plugin worker reported an operation failure',502)):pending.resolve(result.result);
    });
    reader.on('close',()=>this.fail());
    this.process.stdin.on('error',()=>this.fail());
    this.process.on('error',()=>this.fail());this.process.on('exit',()=>this.fail());
    this.initialized=this.request('initialize',{entry,configuration});
    // Initialization can fail before the first caller has awaited it.
    void this.initialized.catch(()=>{});
  }
  private fail(){this.closed=true;for(const pending of this.pending.values()){pending.dispose();pending.reject(new StoreError('Plugin worker is unavailable; recover its pending operation before retrying',503));}this.pending.clear();}
  private request(method:string,params:unknown,signal?:AbortSignal){
    if(this.closed)return Promise.reject(new StoreError('Plugin worker is closed',503));
    if(signal?.aborted)return Promise.reject(new StoreError('Plugin operation was revoked',409));
    const id=++this.sequence;return new Promise<unknown>((resolve,reject)=>{
      const abort=()=>{
        const pending=this.pending.get(id);if(!pending)return;
        this.pending.delete(id);pending.dispose();
        // The plugin can stop cooperative work. A mutation already submitted
        // still needs reconciliation; cancellation does not prove rollback.
        reject(new StoreError('Plugin operation was revoked; reconciliation is required before retrying a submitted mutation',409));
        try{this.process.stdin.write(JSON.stringify({id,method:'cancel'})+'\n',error=>{if(error)this.fail();});}catch{this.fail();}
      };
      this.pending.set(id,{resolve,reject,dispose:()=>signal?.removeEventListener('abort',abort)});
      signal?.addEventListener('abort',abort,{once:true});
      try{this.process.stdin.write(JSON.stringify({id,method,params})+'\n',error=>{if(error)this.fail();});}catch{this.fail();}
    });
  }
  private waitUntilInitialized(signal?:AbortSignal):Promise<unknown>{
    if(signal?.aborted)return Promise.reject(new StoreError('Plugin operation was revoked',409));
    if(!signal)return this.initialized;
    return new Promise((resolve,reject)=>{
      const abort=()=>{signal.removeEventListener('abort',abort);reject(new StoreError('Plugin operation was revoked',409));};
      signal.addEventListener('abort',abort,{once:true});
      void this.initialized.then(value=>{signal.removeEventListener('abort',abort);resolve(value);},error=>{signal.removeEventListener('abort',abort);reject(error);});
    });
  }
  async call(method:'health'|'put'|'read'|'remove'|'search'|'export',params:unknown,signal?:AbortSignal){
    if(this.closed)throw new StoreError('Plugin worker is closed',503);
    await this.waitUntilInitialized(signal);if(signal?.aborted)throw new StoreError('Plugin operation was revoked',409);
    // Cancellation fences local publication. A submitted remote mutation still
    // needs reconciliation; closing a transport never proves remote rollback.
    const result=await this.request(method,params,signal);if(signal?.aborted)throw new StoreError('Plugin result arrived after revocation; reconciliation is required',409);return result;
  }
  async close(){if(this.closing)return this.closing;this.fail();this.closing=(async()=>{
    const deadline=setTimeout(()=>this.process.kill('SIGKILL'),5000);deadline.unref();
    this.process.stdin.end();
    try{await this.exited;}finally{clearTimeout(deadline);}
  })();return this.closing;}
}
