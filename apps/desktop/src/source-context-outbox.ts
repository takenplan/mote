import {sourceContextSnapshotSchema, sourceContextUpdateSchema, type SourceContextSnapshot} from '@mote/shared';
import {readLocalContent} from './local-content';
import {atomicSourceJson} from './source-sync';
import type {SourceRequest} from './source-types';

export interface SourceContextState {
  snapshot: SourceContextSnapshot;
  pending?: {expectedVersion:number;description:string};
  conflict?: boolean;
  error?: 'denied'|'unavailable';
}

/** Private, connection-scoped owner declarations. Never part of source content or public metadata. */
export class SourceContextOutbox {
  private operation:Promise<unknown>=Promise.resolve();
  private serial<T>(action:()=>Promise<T>):Promise<T>{const task=this.operation.then(action,action);this.operation=task.catch(()=>{});return task;}
  private values:Record<string,SourceContextState>=Object.create(null);
  constructor(private readonly path:string){}
  async initialize():Promise<void>{
    try{
      const raw=JSON.parse((await readLocalContent(this.path)).toString('utf8'));
      if(raw.version!==1||!raw.values||typeof raw.values!=='object'||Array.isArray(raw.values))throw Error('Invalid source context journal');
      for(const [id,item] of Object.entries(raw.values)){
        const value=item as SourceContextState,snapshot=sourceContextSnapshotSchema.parse(value.snapshot);
        if(snapshot.sourceId!==id)throw Error('Invalid source context identity');
        this.values[id]={snapshot,...(value.pending?{pending:sourceContextUpdateSchema.parse(value.pending)}:{}),...(value.conflict?{conflict:true}:{})};
      }
    }catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  }
  get(id:string):SourceContextState{return structuredClone(this.values[id]??{snapshot:{sourceId:id,version:0,description:''}});}
  pending(id:string):boolean{return Boolean(this.values[id]?.pending);}
  async checkpointTo(path:string):Promise<void>{await atomicSourceJson(path,{version:1,values:this.values});}
  private async commit(id:string,value:SourceContextState):Promise<void>{const values={...this.values,[id]:value};await atomicSourceJson(this.path,{version:1,values});this.values=values;}
  stage(id:string,input:unknown):Promise<SourceContextState>{return this.serial(()=>this.stageCurrent(id,input));}
  private async stageCurrent(id:string,input:unknown):Promise<SourceContextState>{
    const pending=sourceContextUpdateSchema.parse(input),value=this.get(id);
    if(value.snapshot.version!==pending.expectedVersion)throw Error('Source context version changed; refresh and retry');
    await this.commit(id,{snapshot:value.snapshot,pending});return this.get(id);
  }
  read(id:string,request:SourceRequest,signal:AbortSignal):Promise<SourceContextState>{return this.serial(()=>this.readCurrent(id,request,signal));}
  private async readCurrent(id:string,request:SourceRequest,signal:AbortSignal):Promise<SourceContextState>{
    signal.throwIfAborted();
    try{
      const snapshot=sourceContextSnapshotSchema.parse(await request('/api/sources/'+encodeURIComponent(id)+'/context',undefined,'GET',signal));
      signal.throwIfAborted();if(snapshot.sourceId!==id)throw Error('Invalid source context identity');
      const prior=this.values[id],ack=prior?.pending&&snapshot.description===prior.pending.description&&snapshot.version===prior.pending.expectedVersion+1;
      await this.commit(id,{snapshot,...(prior?.pending&&!ack?{pending:prior.pending,conflict:prior.conflict||prior.pending.expectedVersion!==snapshot.version}:{})});return this.get(id);
    }catch(error){signal.throwIfAborted();const value=this.get(id);return {...value,error:[401,403].includes((error as {httpStatus?:number}).httpStatus??0)?'denied':'unavailable'};}
  }
  flush(id:string,request:SourceRequest,signal:AbortSignal):Promise<void>{return this.serial(()=>this.flushCurrent(id,request,signal));}
  private async flushCurrent(id:string,request:SourceRequest,signal:AbortSignal):Promise<void>{
    signal.throwIfAborted();
    const value=this.values[id];if(!value?.pending)return;
    if(value.conflict)throw Error('Source context version changed; refresh and retry');
    try{
      const snapshot=sourceContextSnapshotSchema.parse(await request('/api/sources/'+encodeURIComponent(id)+'/context',value.pending,'PATCH',signal));
      signal.throwIfAborted();if(snapshot.sourceId!==id||snapshot.description!==value.pending.description||(snapshot.version!==value.pending.expectedVersion&&snapshot.version!==value.pending.expectedVersion+1))throw Error('Invalid source context acknowledgement');
      await this.commit(id,{snapshot});
    }catch(error){
      signal.throwIfAborted();
      if((error as {httpStatus?:number}).httpStatus===409){
        await this.commit(id,{...value,conflict:true});await this.readCurrent(id,request,signal);
      }
      throw error;
    }
  }
}
