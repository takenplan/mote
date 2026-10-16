import {useEffect,useRef,useState} from 'react';
import type {ScopedPluginCenterView} from '@mote/shared';
import {moteText} from '@mote/shared/i18n';
import {type Api,errorMessage} from './api';
import {resources} from './resource-cache';
import {useResource} from './useResource';
import {PluginModal} from './PluginModal';

type Binding={kind:'builtin'|'plugin';revision:number;instanceId?:string};
type MemoryView={revision:number;generation:number;desired:boolean;binding:Binding;pendingExternal:number;bindingPreparation?:string};
type Preparation={id:string;state:string;source:Binding;target:Binding;task?:{id:string;state:string;error?:string}};

/** Original memory-control entry, backed by M07 receipts rather than a fabricated
 * legacy MemoryBindingView. Mounting/polling never admits or activates work. */
export function ScopedMemoryControl({api,plugins}:{api:Api;plugins?:ScopedPluginCenterView}){
 const read=useResource<MemoryView>(api,'/api/memory',2000),[target,setTarget]=useState(''),[acknowledged,setAcknowledged]=useState(false),[confirm,setConfirm]=useState<'stop'|'prepare'>(),[preparationId,setPreparationId]=useState<string>(),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const controller=useRef<AbortController|undefined>(undefined),alive=useRef(true),opener=useRef<HTMLElement|null>(null);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;controller.current?.abort();};},[api]);
 const currentId=read.data?.bindingPreparation??preparationId,preparation=useResource<Preparation>(api,currentId?'/api/memory/bindings/'+encodeURIComponent(currentId):null,1000),view=read.data,prepared=preparation.data;
 function refresh(){resources(api).invalidate(path=>path==='/api/memory'||path.startsWith('/api/memory/bindings/')||path.startsWith('/api/memory/jobs')||path.startsWith('/api/operations'));}
 async function request(path:string,body:Record<string,unknown>,accept?:(value:any)=>void){
  if(controller.current)return;const signal=new AbortController();controller.current=signal;setBusy(true);setError('');
  try{const result=await api.request(path,{method:'POST',body:JSON.stringify(body),signal:signal.signal});if(alive.current&&!signal.signal.aborted){accept?.(result);setConfirm(undefined);refresh();}}
  catch(cause){if(alive.current&&!signal.signal.aborted){setError(errorMessage(cause));refresh();}}
  finally{if(controller.current===signal)controller.current=undefined;if(alive.current&&!signal.signal.aborted)setBusy(false);}
 }
 function control(kind:'pause'|'resume'|'stop'){if(view)void request('/api/memory/'+kind,{expectedRevision:view.revision,operationId:crypto.randomUUID()});}
 const eligible=(plugins?.instances??[]).filter(instance=>instance.desired&&instance.checked&&instance.grants.capabilities.some(capability=>capability==='repository'||capability==='engine'));
 const name=(binding:Binding)=>binding.kind==='builtin'?moteText('内置记忆方案'):plugins?.instances.find(instance=>instance.id===binding.instanceId)?.name??binding.instanceId;
 return <>
  {(error||read.error||preparation.error)&&<p className="notice error" role="alert">{error||errorMessage(read.error??preparation.error)}</p>}
  {!view&&read.loading&&<p role="status">{moteText('正在读取…')}</p>}
  {view&&<><section className="panel plugin-memory-control"><div className="section-heading"><div><h2>{moteText('自动记忆')}</h2><p>{moteText('控制自动提取与整合；原件、已有记忆与只读查询保留。独立回顾按自己的设置运行。')}</p></div><button type="button" role="switch" aria-checked={view.desired} aria-label={moteText('自动记忆')} className={'plugin-memory-switch '+(view.desired?'is-on':'')} disabled={busy} onClick={()=>control(view.desired?'pause':'resume')}>{view.desired?moteText('已选择启用'):moteText('已选择暂停')}</button></div>
   <p>{moteText('当前准入代次 {0}',view.generation)}</p><p>{moteText('外部结果待确认 {0}',view.pendingExternal)}</p><button className="button subtle" disabled={busy} onClick={event=>{opener.current=event.currentTarget;setConfirm('stop');}}>{moteText('立即停止自动记忆')}</button>
  </section><section className="panel"><div className="section-heading"><div><h2>{moteText('当前记忆方案')}</h2><p>{name(view.binding)} · {moteText('绑定版本')} {view.binding.revision}</p></div><span className="badge green">{moteText('当前')}</span></div><p>{moteText('准备与生效分开执行。只有范围、正文与索引核验通过后，才能切换写入与查询绑定。')}</p>
   <label className="preference-field">{moteText('记忆方案')}<select value={target} disabled={busy||Boolean(read.data?.bindingPreparation)} onChange={event=>{setTarget(event.target.value);setAcknowledged(false);}}><option value="">{moteText('内置记忆方案')}</option>{eligible.map(instance=><option key={instance.id} value={instance.id}>{instance.name}</option>)}</select></label><button className="button subtle" disabled={busy||Boolean(read.data?.bindingPreparation)||(view.binding.kind==='builtin'?!target:view.binding.instanceId===target)} onClick={event=>{opener.current=event.currentTarget;setConfirm('prepare');}}>{moteText('预览更换')}</button>
  </section></>}
  {confirm==='stop'&&<PluginModal title={moteText('立即停止自动记忆')} opener={opener.current} busy={busy} close={()=>setConfirm(undefined)}><p>{moteText('撤销旧任务继续写入的权限，并请求取消运行中的自动记忆任务。外部工作可能无法立刻停止，未确认结果会单独保留。')}</p><p>{moteText('原件、已有记忆和只读查询继续保留；恢复后只处理新资料。')}</p><div className="plugin-footer"><button className="button primary" disabled={busy} onClick={()=>control('stop')}>{moteText('确认立即停止')}</button><button className="button subtle" disabled={busy} onClick={()=>setConfirm(undefined)}>{moteText('取消')}</button></div></PluginModal>}
  {confirm==='prepare'&&view&&<PluginModal title={moteText('更换方案预览')} opener={opener.current} busy={busy} close={()=>setConfirm(undefined)}><h3>{name(view.binding)} → {target?eligible.find(instance=>instance.id===target)?.name:moteText('内置记忆方案')}</h3><p>{moteText('迁移全部 Mote 保留记忆正文及更正/替代状态。外部原生审计历史和引擎图保留在旧实例及运行备份中，不承诺跨引擎迁移。')}</p><label className="plugin-confirm"><input type="checkbox" checked={acknowledged} disabled={busy} onChange={event=>setAcknowledged(event.target.checked)}/>{moteText('已确认范围。真实接入可能产生模型与 Embedding 费用，费用以实际服务用量为准。')}</label><div className="plugin-footer"><button className="button primary" disabled={busy||!acknowledged} onClick={()=>void request('/api/memory/bindings',{operationId:crypto.randomUUID(),...(target?{instanceId:target}:{})},value=>setPreparationId(value.id))}>{moteText('开始准备')}</button><button className="button subtle" disabled={busy} onClick={()=>setConfirm(undefined)}>{moteText('取消')}</button></div></PluginModal>}
  {prepared&&<section className="panel plugin-preparation"><h2>{moteText('方案准备')}</h2><p>{name(prepared.source)} → {name(prepared.target)}</p><p role="status">{prepared.state==='verified'?moteText('核验通过 · 尚未生效'):prepared.state==='activated'?moteText('已生效'):prepared.state==='cancelled'?moteText('准备已取消'):moteText('当前阶段：{0}',prepared.task?.state??prepared.state)}</p>{prepared.task?.error&&<p role="alert">{prepared.task.error}</p>}<div className="plugin-actions">
   {prepared.state==='verified'&&<button className="button primary" disabled={busy||!view} onClick={()=>void request('/api/memory/bindings/'+encodeURIComponent(prepared.id)+'/activate',{expectedRevision:view!.revision})}>{moteText('设为当前方案')}</button>}
   {!['activated','cancelled'].includes(prepared.state)&&<button className="button subtle" disabled={busy} onClick={()=>void request('/api/memory/bindings/'+encodeURIComponent(prepared.id)+'/cancel',{})}>{moteText('取消准备')}</button>}
   {prepared.task&&['blocked','failed'].includes(prepared.task.state)&&<button className="button subtle" disabled={busy} onClick={()=>void request('/api/tasks/'+encodeURIComponent(prepared.task!.id)+'/retry',{})}>{moteText('重试准备')}</button>}
  </div></section>}
 </>;
}
