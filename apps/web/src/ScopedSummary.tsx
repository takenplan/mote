import {moteText} from '@mote/shared/i18n';
import {type Api,type Device,type Answer,type Capture,type Range,ApiError,errorMessage,queryString} from './api';
import {useResource} from './useResource';
import {TurnUsage} from './Usage';
import type {UsageReceipt} from '@mote/shared';
import type {Page} from './navigation';
import {heartbeatSchema} from '@mote/shared';
import {Overview} from './Overview';
import {DeviceOverview} from './DeviceOverview';
/** The original home composition reads only the active account's resources. */
export function ScopedOverview({api,onPage,onOpen,range={},rangeSelectionKey}:{api:Api;onPage:(page:Page)=>void;onOpen:(id:string)=>void;range?:Range;rangeSelectionKey?:string}){
 const statistics=useResource<{captures:number}>(api,'/api/data/statistics',30_000);
 const devices=useResource<{items:{id:string}[]}>(api,'/api/ingress/devices',30_000);
 const recent=useResource<{items:Capture[]}>(api,'/api/captures'+queryString(range,{limit:4}),30_000,undefined,rangeSelectionKey);
 const insights=useResource<{items:Answer[]}>(api,'/api/insights',30_000);
 const models=useResource<{provider:string;model:string}>(api,'/api/models/selection/chat',30_000);
 const unconfigured=models.error instanceof ApiError&&models.error.status===503&&models.error.code==='scope_unavailable';
 return <>
  {[statistics,devices,recent,insights,...(unconfigured?[]:[models])].map((read,index)=>read.error!==undefined&&<p key={index} role="alert">{errorMessage(read.error)}</p>)}
  <Overview api={api} status={statistics.data?{storage:statistics.data,agent:{configured:unconfigured?false:models.data?true:undefined}}:undefined} devices={devices.data?.items.map(row=>({deviceId:row.id}))} recent={recent.data?.items} insights={insights.data?.items??[]} onPage={onPage} onOpen={onOpen}/>
 </>;
}
export function ScopedDevices({api,onConnect}:{api:Api;onConnect?:()=>void}){
 const read=useResource<{items:({id:string;name:string;platform:string}&Record<string,unknown>)[]}>(api,'/api/ingress/devices',30_000),reported:Device[]=[],registered:{id:string;name:string;platform:string}[]=[];
 for(const row of read.data?.items??[]){const {id,name,lastSeenAt,...input}=row,heartbeat=heartbeatSchema.safeParse(input);if(!heartbeat.success||typeof lastSeenAt!=='string'||!Number.isFinite(Date.parse(lastSeenAt))){registered.push(row);continue;}const {lastCaptureAt,error,...value}=heartbeat.data;reported.push({...value,lastSeenAt,...lastCaptureAt?{lastCaptureAt}:{},...error?{error}:{}});}
 const navigate=(path:string)=>{window.location.hash=path;},connect=()=>onConnect?.();
 return <section>{read.error!==undefined&&<p role="alert">{errorMessage(read.error)}</p>}{read.data&&(reported.length>0||!registered.length)&&<DeviceOverview key={JSON.stringify(api.connection)} devices={reported} onConnect={connect} onAdd={()=>navigate('#/connections/add')} onSources={()=>navigate('#/connections')}/>}{registered.length>0&&<section className="panel panel-pad"><h2>{moteText('已知设备')}</h2><p>{moteText('尚未上报采集与同步状态。')}</p><ul className="connection-list">{registered.map(device=><li key={device.id}><strong>{device.name}</strong><p>{device.platform}</p></li>)}</ul>{onConnect&&<button className="button" onClick={connect}>{moteText('生成设备二维码')}</button>}</section>}</section>;
}
export function ScopedUsage({api}:{api:Api}){
 const read=useResource<{items:UsageReceipt[]}>(api,'/api/usage');
 return <section className="panel panel-pad"><h1>{moteText('用量与费用')}</h1>{read.error!==undefined&&<p role="alert">{errorMessage(read.error)}</p>}{read.data?.items.map((item,index)=><TurnUsage key={index} usage={item}/>)}</section>;
}
