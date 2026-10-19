import {moteText} from './i18n.js';
import {usageIdentity,usageLabel,type UsageReceipt,type ModelPrice,type UsageSummary,type UsageFilters,type UsageGroupBy,type UsageGroup} from '@mote/shared';
import {usageTotals} from './usage-metrics.js';

/** The original usage aggregation, independent of storage ownership. Callers
 * supply only their authorized rows ordered by createdAt/id descending. */
export function summarizeUsage(candidates:UsageReceipt[],prices:ModelPrice[],from:string,to:string,timeZone:string,filters:UsageFilters={},groupBy:UsageGroupBy='agent',page=1,pageSize=20):UsageSummary {
    const day=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'});
    const scoped=candidates.filter(r=>{const d=day.format(new Date(r.createdAt));return d>=from&&d<=to;});
    const facets:UsageSummary['facets']={agentId:[],moduleId:[],skillId:[]};
    for(const [field,dimension] of [['agentId','agent'],['moduleId','module'],['skillId','skill']] as const){
      facets[field]=[...new Set(scoped.map(r=>usageIdentity(r)[field]))].map(id=>({id,label:usageLabel(dimension,id)})).sort((a,b)=>a.label.localeCompare(b.label));
    }
    const rows=scoped.filter(r=>{
      const values={...usageIdentity(r),provider:r.provider,model:r.model,status:r.status};
      return (Object.keys(filters) as (keyof UsageFilters)[]).every(k=>filters[k]===undefined||values[k]===filters[k]);
    });
    const days=new Map<string,UsageReceipt[]>(),groups=new Map<string,{label:string;filter:UsageFilters;items:UsageReceipt[]}>();
    for(const row of rows){
      const date=day.format(new Date(row.createdAt));
      const bucket=days.get(date)??[];bucket.push(row);days.set(date,bucket);
      const identity=usageIdentity(row);
      const field=groupBy==='agent'?'agentId':groupBy==='module'?'moduleId':'skillId';
      const id=groupBy==='provider'?row.provider:groupBy==='model'?JSON.stringify([row.provider,row.model]):identity[field];
      const group=groups.get(id)??{label:groupBy==='provider'?row.provider:groupBy==='model'?`${row.provider} · ${row.model||moteText("未知模型")}`:usageLabel(groupBy,id),filter:groupBy==='provider'?{provider:row.provider}:groupBy==='model'?{provider:row.provider,model:row.model}:{[field]:id},items:[]};
      group.items.push(row);groups.set(id,group);
    }
    const grouped:UsageGroup[]=[...groups].map(([id,g])=>({id,label:g.label,filter:g.filter,...usageTotals(g.items)}));
    grouped.sort((a,b)=>b.totalTokens-a.totalTokens||b.runs-a.runs||a.id.localeCompare(b.id));
    return {from,to,timeZone,groupBy,filters,total:usageTotals(rows),days:[...days].sort(([a],[b])=>b.localeCompare(a)).map(([date,items])=>({date,...usageTotals(items)})),groups:grouped,facets,items:rows.slice((page-1)*pageSize,page*pageSize),itemsTotal:rows.length,page,pageSize,prices:structuredClone(prices)};
}
