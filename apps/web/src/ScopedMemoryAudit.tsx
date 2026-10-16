import {useState} from 'react';
import {moteText} from '@mote/shared/i18n';
import {type Api,errorMessage} from './api';
import {useResource} from './useResource';
import {AnswerMarkdown} from './AnswerMarkdown';
import type {Memory} from './Memories';

/** Owner review is a separate M07 capability. Never present retained bodies as
 * current Memory/context references or send them to model/plugin surfaces. */
export function ScopedMemoryAudit({api,refreshVersion}:{api:Api;refreshVersion?:number}){
 const [cursor,setCursor]=useState<string>(),[selected,setSelected]=useState<{id:string;version:number}>();
 const page=useResource<{items:{id:string;version:number;kind:'stale';usableAsMemory:false}[];nextCursor:string|null}>(api,'/api/memory/audit?kind=stale&limit=30'+(cursor?'&cursor='+encodeURIComponent(cursor):''),undefined,refreshVersion);
 const detail=useResource<{usableAsMemory:false;memory:Memory;evidence:{id:string;ocrText:string;capturedAt:string}[]}>(api,selected?'/api/memory/audit/'+encodeURIComponent(selected.id)+'?version='+selected.version:null,undefined,refreshVersion);
 const value=detail.error===undefined&&detail.data?.usableAsMemory===false&&detail.data.memory.id===selected?.id&&detail.data.memory.version===selected?.version?detail.data:undefined;
 return <section className="memory-audit"><p className="notice" role="status">{moteText('这些记录仅供本人审阅，不参与问答。审阅列表暂不使用时间、搜索和分类筛选。')}</p>
 {(page.error!==undefined||detail.error!==undefined)&&<p role="alert">{errorMessage(page.error??detail.error)}</p>}
 <div className="workspace-layout"><aside className="workspace-list" aria-label={moteText('记忆列表')}><div className="workspace-list-heading"><h2>{moteText('需要重验')}</h2><button className="button subtle" onClick={()=>{page.refresh();detail.refresh();}}>{moteText('刷新记忆')}</button></div>
 {page.loading&&!page.data&&<p role="status">{moteText('正在读取…')}</p>}{page.error===undefined&&page.data?.items.map(item=><button className="workspace-select" key={item.id} onClick={()=>setSelected({id:item.id,version:item.version})}><strong>{moteText('需要重验')} · {moteText('版本 {0}',item.version)}</strong><small>{item.id}</small></button>)}
 {page.data?.items.length===0&&<p>{moteText('当前筛选没有记录。')}</p>}<div className="memory-actions">{cursor&&<button className="button subtle" onClick={()=>{setCursor(undefined);setSelected(undefined);}}>{moteText('返回第一页')}</button>}{page.data?.nextCursor&&<button className="button subtle" onClick={()=>{setCursor(page.data!.nextCursor!);setSelected(undefined);}}>{moteText('下一页')}</button>}</div></aside>
 <div className="workspace-content">{detail.loading&&!value&&<p role="status">{moteText('正在读取…')}</p>}{value&&<article className="panel memory-detail memory-audit-detail"><h2>{value.memory.title}</h2><p className="notice">{moteText('这些记录仅供本人审阅，不参与问答。审阅列表暂不使用时间、搜索和分类筛选。')}</p><AnswerMarkdown answer={{answer:value.memory.statement??'',runId:value.memory.id,trace:[],citations:value.evidence.map(item=>({id:item.id,capturedAt:item.capturedAt,appName:moteText('原始证据'),excerpt:item.ocrText}))}} onOpen={ref=>document.getElementById('audit-evidence-'+ref.replace(/^capture:/,''))?.scrollIntoView?.({behavior:'smooth'})}/><h3>{moteText('判断的边界')}</h3><p>{value.memory.uncertainty}</p><h3>{moteText('支持这条记忆的证据')}</h3>{value.evidence.map(item=><article className="memory-evidence-item" id={'audit-evidence-'+item.id} key={item.id}><p className="file-text">{item.ocrText}</p></article>)}</article>}</div></div></section>;
}
