import {moteText} from '@mote/shared/i18n';
import {type Api,errorMessage} from './api';
import {useResource} from './useResource';
import {TurnUsage} from './Usage';
import type {UsageReceipt} from '@mote/shared';
import type {Page} from './navigation';
export function ScopedOverview({api,onPage}:{api:Api;onPage:(page:Page)=>void}){
 const statistics=useResource<{captures:number;materials:number;sources:number}>(api,'/api/data/statistics');
 return <section><div className="page-heading"><h1>{moteText('今天')}</h1><p>{api.connection?.mode==='web'?api.connection.username:''}</p></div>{statistics.error!==undefined&&<p role="alert">{errorMessage(statistics.error)}</p>}
  {statistics.data&&<div className="feature-cards">{(['captures','materials','sources'] as const).map(key=><button className="panel panel-pad" key={key} onClick={()=>onPage(key==='sources'?'sources':'archive')}><h2>{key==='captures'?moteText('原始采集记录'):key==='materials'?moteText('正式资料'):moteText('来源与连接')}</h2><strong>{statistics.data![key]}</strong></button>)}</div>}
  <div className="processing-actions"><button className="button" onClick={()=>onPage('notes')}>{moteText('随手记')}</button><button className="button" onClick={()=>onPage('ask')}>{moteText('问一问')}</button><button className="button" onClick={()=>onPage('activity')}>{moteText('处理任务')}</button></div>
 </section>;
}
export function ScopedDevices({api,onConnect}:{api:Api;onConnect?:()=>void}){
 const read=useResource<{items:{id:string;name:string;platform:string}[]}>(api,'/api/ingress/devices');
 return <section className="panel panel-pad"><div className="section-heading"><h1>{moteText('采集与设备')}</h1>{onConnect&&<button className="button" onClick={onConnect}>{moteText('生成设备二维码')}</button>}</div>{read.error!==undefined&&<p role="alert">{errorMessage(read.error)}</p>}<ul className="connection-list">{read.data?.items.map(device=><li key={device.id}><strong>{device.name}</strong><p>{device.platform}</p></li>)}</ul></section>;
}
export function ScopedUsage({api}:{api:Api}){
 const read=useResource<{items:UsageReceipt[]}>(api,'/api/usage');
 return <section className="panel panel-pad"><h1>{moteText('用量与费用')}</h1>{read.error!==undefined&&<p role="alert">{errorMessage(read.error)}</p>}{read.data?.items.map((item,index)=><TurnUsage key={index} usage={item}/>)}</section>;
}
