import {Context} from '@deepseek-ai/cordis';
import {FeatureRegistry,type FeatureManifest,type FeatureSurface} from '@mote/shared';
import type {FastifyInstance} from 'fastify';
import {collectorIngressWrite} from './ingress.js';

export class ServerFeatureScope {
  private disposers:Array<()=>unknown|Promise<unknown>>=[];
  private retiring:Array<()=>unknown|Promise<unknown>>=[];
  private timers=new Set<ReturnType<typeof setInterval>>();
  private pending=new Set<Promise<unknown>>();
  private closing?:Promise<void>;
  active=true;
  constructor(private onError:(error:unknown)=>void=()=>{}){}
  run(work:()=>unknown|Promise<unknown>){
    if(!this.active)return Promise.resolve();
    const task=Promise.resolve().then(()=>this.active?work():undefined);this.pending.add(task);
    void task.catch(error=>this.onError(error)).finally(()=>this.pending.delete(task));return task;
  }
  defer(dispose:()=>unknown|Promise<unknown>){if(!this.active)throw Error('Feature is closed');this.disposers.push(dispose);}
  /** Retire capabilities only after runtime disposal and scheduled work settle. */
  retire(dispose:()=>unknown|Promise<unknown>){if(!this.active)throw Error('Feature is closed');this.retiring.push(dispose);}
  every(ms:number,work:()=>unknown|Promise<unknown>){
    let running=false;
    const timer=setInterval(()=>{if(!this.active||running)return;running=true;void this.run(work).catch(()=>{}).finally(()=>{running=false;});},ms);
    timer.unref();this.timers.add(timer);
  }
  /** Stop admission and timers before the executor drains; keep resources alive. */
  stop(){this.active=false;for(const timer of this.timers)clearInterval(timer);this.timers.clear();}
  close(){return this.closing??=(async()=>{this.stop();
    const errors:unknown[]=[];
    for(const dispose of this.disposers.reverse())try{await dispose();}catch(error){errors.push(error);}
    await Promise.allSettled([...this.pending]);
    for(const dispose of this.retiring.reverse())try{await dispose();}catch(error){errors.push(error);}
    if(errors.length)throw new AggregateError(errors,'Feature disposal failed');
  })();}
}

/** Trusted, build-time server entries. HTTP topology changes require restart.
 * Cordis disposal revokes dispatch and registrations, never stored materials. */
export class ServerFeatureHost {
  readonly registry=new FeatureRegistry<unknown>();
  private installed=new Map<string,{fiber:{dispose():Promise<void>};closeScope:()=>Promise<void>|undefined}>();
  private disposals=new Map<string,Promise<void>>();
  private scopes=new Set<ServerFeatureScope>();
  private closing?:Promise<void>;
  constructor(private root:Context,private app:FastifyInstance,private onError:(error:unknown)=>void=()=>{}){}
  async install(manifest:FeatureManifest,entry:(app:FastifyInstance,scope:ServerFeatureScope)=>void){
    if(this.closing)throw Error('Feature host is closed');
    await this.disposals.get(manifest.id);this.disposals.delete(manifest.id);
    if(this.closing)throw Error('Feature host is closed');
    const registry=this.registry,app=this.app,onError=this.onError;
    let installedScope:ServerFeatureScope|undefined;
    const fiber=this.root.plugin((ctx:Context)=>{
      ctx.effect(()=>registry.install(manifest,{completeTrustedTopology:manifest.components.length===0}));
      const scope=new ServerFeatureScope(onError);installedScope=scope;ctx.effect(()=>{this.scopes.add(scope);return()=>{this.scopes.delete(scope);return scope.close();};});
      app.register(async child=>{
        child.addHook('onRequest',async(_req,reply)=>{if(!scope.active)return reply.code(503).send({error:'feature_unavailable'});});
        child.addHook('onRoute',route=>{
          for(const method of [route.method].flat()){
            const surface:FeatureSurface=collectorIngressWrite(method,route.url)?(route.url.startsWith('/api/file-sync/')?'upload':'ingress'):method==='GET'||method==='HEAD'?'data':'command';
            ctx.effect(()=>registry.register(manifest.id,{id:`http:${method}:${route.url}`,version:'1',surface},{method,path:route.url}));
          }
        });
        entry(child,scope);
      });
    });
    this.installed.set(manifest.id,{fiber,closeScope:()=>installedScope?.close()});
    try{await fiber;return fiber;}catch(error){try{await this.dispose(manifest.id);}catch(cleanup){throw new AggregateError([error,cleanup],'Feature initialization and disposal failed',{cause:error});}throw error;}
  }
  dispose(id:string){
    const previous=this.disposals.get(id);if(previous)return previous;
    const installed=this.installed.get(id);if(!installed)return Promise.resolve();this.installed.delete(id);
    const task=(async()=>{
      const errors:unknown[]=[];
      // Cordis logs effect cleanup errors. Join our owned scope explicitly so
      // callers receive disposal failures as well as revoked registrations.
      try{await installed.closeScope();}catch(error){errors.push(error);}
      try{await installed.fiber.dispose();}catch(error){errors.push(error);}
      if(errors.length)throw new AggregateError(errors,'Feature disposal failed');
    })();
    this.disposals.set(id,task);return task;
  }
  stop(){for(const scope of this.scopes)scope.stop();}
  close(){return this.closing??=(async()=>{this.stop();const results=await Promise.allSettled([...new Set([...this.installed.keys(),...this.disposals.keys()])].map(id=>this.dispose(id)));const errors=results.flatMap(result=>result.status==='rejected'?[result.reason]:[]);if(errors.length)throw new AggregateError(errors,'Feature host disposal failed');})();}

}
