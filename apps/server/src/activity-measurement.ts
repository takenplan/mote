import {samples as stateSamples} from '@mote/shared/state-series';
import type {Activity,CaptureRecord} from '@mote/shared';
import type {Range} from './store.js';
import {moteText} from './i18n.js';
/** Existing observed-interval union algorithm, shared by legacy and scoped repositories. */
export function measureActivity(records:Iterable<CaptureRecord>,range:Range={},onContributor?:(id:string)=>void):Activity{
    type Counts={durationMs:number;captures:number;activityEvents:number;contentCaptures:number};
    const apps=new Map<string,Counts&{appId:string;appName:string}>(),devices=new Map<string,Counts&{deviceId:string;deviceName:string}>(),ends=new Map<string,number>();
    const lower=range.after?Date.parse(range.after):-Infinity,upper=range.before?Date.parse(range.before):Infinity;
    let totalDurationMs=0,captures=0,activityEvents=0,contentCaptures=0;
    const observations=[...records].flatMap(c=>stateSamples(c).map(s=>({...c,capturedAt:s.at,durationMs:s.durationMs}))).sort((a,b)=>a.capturedAt.localeCompare(b.capturedAt)||a.id.localeCompare(b.id));
    for(const c of observations) {
      if(c.source!=='screen'&&c.source!=='activity')continue;
      const t=Date.parse(c.capturedAt),end=Math.min(t,upper),start=Math.max(t-c.durationMs,lower,ends.get(c.deviceId)??-Infinity),durationMs=Math.max(0,end-start);
      if((t<lower||t>=upper)&&!durationMs)continue;
      if(durationMs>0){
        ends.set(c.deviceId,Math.max(ends.get(c.deviceId)??-Infinity,end));
        // Earlier samples can clip a later selected app even when this sample
        // is excluded by the requested app/source/collection filter.
        onContributor?.(c.id);
      }
      const activity=c.source==='activity';
      if(range.source&&c.source!==range.source||range.appId!==undefined&&c.appId!==range.appId||range.collection==='activity'&&!activity||range.collection==='content'&&(activity||c.privacy.collection==='activity'))continue;
      onContributor?.(c.id);
      const appKey=JSON.stringify(c.appId?['id',c.appId]:['name',c.appName]);
      const app=apps.get(appKey)??{appId:c.appId,appName:c.appName||moteText("未识别应用"),durationMs:0,captures:0,activityEvents:0,contentCaptures:0};
      const d=devices.get(c.deviceId)??{deviceId:c.deviceId,deviceName:c.deviceName,durationMs:0,captures:0,activityEvents:0,contentCaptures:0};
      for(const bucket of [app,d]){bucket.durationMs+=durationMs;bucket.captures++;if(activity)bucket.activityEvents++;else bucket.contentCaptures++;}
      apps.set(appKey,app);devices.set(c.deviceId,d);totalDurationMs+=durationMs;captures++;if(activity)activityEvents++;else contentCaptures++;
    }
    return {apps:[...apps.values()].sort((a,b)=>b.durationMs-a.durationMs),devices:[...devices.values()],totalDurationMs,captures,activityEvents,contentCaptures};
}
