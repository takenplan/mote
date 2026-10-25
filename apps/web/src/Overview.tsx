import { moteText } from '@mote/shared/i18n';
import { ArrowRight, Database, Link2, Bot, Activity as ActivityIcon, Sparkles } from 'lucide-react';
import { answerPreview } from './AnswerMarkdown';
import { type Activity, type Answer, type Api, type Capture, type Device, type Range, type Status } from './api';
import { type Page } from './navigation';
import { CaptureCard } from './shell-components';
import { FeatureHome } from './features/home';
import { useResource } from './useResource';
export function Overview({ api, status, devices, recent, insights, onPage, onOpen }: {
 api:Api;status:Status;devices:Device[];activity:Activity;recent:Capture[];insights:Answer[];
 onPage:(page:Page)=>void;onOpen:(id:string)=>void;range:Range;onMedia:()=>void;
}) {
 const sources=useResource<{items:{id:string;status?:{state:string}}[]}>(api,'/api/sources');
 const connections=useResource<{items:{scope:string;revokedAt?:string;expiresAt?:string;lastUsedAt?:string}[]}>(api,'/api/connections');
 const materials=useResource<{items:unknown[]}>(api,'/api/library/catalog?limit=1');
 const sourceReady=devices.length>0||!!sources.data?.items.length;
 const collected=!!materials.data?.items.length;
 const discovery=insights.find(item=>item.citations.length>0);
 const aiReady=connections.data?.items.some(item=>item.scope==='mcp-read'&&!item.revokedAt&&(!item.expiresAt||Date.parse(item.expiresAt)>Date.now()));
 const loaded=!!sources.data&&!!connections.data&&!!materials.data;
 const complete=sourceReady&&collected&&aiReady;
 const issues=sources.data?.items.filter(item=>['error','permission_required'].includes(item.status?.state??''))??[];
 return <div className="home-page central-overview">
  <div className="page-heading"><div className="eyebrow">Mote</div><h1>{moteText('总览')}</h1></div>
  {loaded&&!complete&&<section className="panel central-first-steps" aria-label={moteText('开始使用')}>
   {[{ready:sourceReady,label:moteText('新增数据源'),page:'sourceCatalog',icon:Link2},{ready:collected,label:moteText('我的资料'),page:'archive',icon:Database},{ready:!!aiReady,label:moteText('AI 接入'),page:'connections',icon:Bot}].map((step,index)=><button key={step.page} className={step.ready?'completed':''} onClick={()=>onPage(step.page)}><span className="step-number">{step.ready?'✓':index+1}</span><step.icon size={20}/><strong>{step.label}</strong><ArrowRight size={16}/></button>)}
  </section>}
  <section className="central-status-grid" aria-label={moteText('运行状态')}>
   <button className="panel" onClick={()=>onPage('sources')}><Link2 size={20}/><strong>{moteText('数据来源')}</strong><span>{sources.data?(sources.data.items.length+devices.length):'—'}</span>{issues.length>0&&<small className="attention">{moteText('需要处理')} · {issues.length}</small>}</button>
   <button className="panel" onClick={()=>onPage('activity')}><ActivityIcon size={20}/><strong>{moteText('Mote 后台工作')}</strong><span>{moteText('查看进展')}<ArrowRight size={15}/></span></button>
   <button className="panel" onClick={()=>onPage('connections')}><Bot size={20}/><strong>{moteText('AI 接入')}</strong><span>{connections.data?(aiReady?moteText('已授权'):moteText('未连接')):'—'}</span></button>
  </section>
  {issues.length>0&&<button className="notice central-issue" onClick={()=>onPage('sources')}>{moteText('来源需要处理')}<ArrowRight size={16}/></button>}
  {discovery&&<button className="home-insight" onClick={()=>onPage('insights')}><Sparkles size={21}/><div><strong>{moteText('你最近的洞察')}</strong><p>{answerPreview(discovery,125)}</p><small>{moteText('{0} 条证据',discovery.citations.length)}</small></div><ArrowRight size={18}/></button>}
  <section className="recent-section"><div className="section-heading"><h2>{moteText('最近同步的记录')}</h2><button className="text-button" onClick={()=>onPage('archive')}>{moteText('查看全部')}<ArrowRight size={15}/></button></div><div className="home-record-list">{recent.slice(0,4).map(capture=><CaptureCard compact key={capture.id} capture={capture} api={api} onOpen={onOpen}/>)}</div>{!recent.length&&<button className="button subtle" onClick={()=>onPage(collected?'archive':'imports')}>{moteText(collected?'打开资料库':'导入资料')}<ArrowRight size={15}/></button>}</section>
  <details className="home-extensions"><summary>{moteText('更多上下文视图')}</summary><FeatureHome api={api} onPage={onPage}/></details>
 </div>;
}
