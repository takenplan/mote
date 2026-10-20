import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import type {UsageReceipt,UsageSummary} from '@mote/shared';
import {defaultModelSettings} from '../src/model-settings.js';
import {fixture} from './fixtures/scoped-actions.js';

const price={provider:'custom',model:'generated-usage',currency:'USD' as const,input:2,output:8,cacheRead:.5,cacheWrite:3};
const tokens={requests:2,reportedRequests:2,inputTokens:100,outputTokens:10,totalTokens:110,cacheReadTokens:20,cacheWriteTokens:0};
const attributions=[{agentId:'context-query',moduleId:'conversations',skillId:null},{agentId:'file-analysis',moduleId:'files',skillId:null},{agentId:'document-import',moduleId:'imports',skillId:'document-import'}];

test('authenticated usage preserves timezone, complete aggregation, intersected drilldowns, pages and private price snapshots',async t=>{
 const f=await fixture(t),contextA=await f.node.authority.authenticate(f.a.token),contextB=await f.node.authority.authenticate(f.b.token),a=f.node.configuration.forUser(contextA),b=f.node.configuration.forUser(contextB);
 for(const service of [a,b])await service.replace('models',{profiles:[{id:'same-connection',name:'Generated usage connection',settings:{...defaultModelSettings(),provider:price.provider,model:price.model,apiKey:'GENERATED_USAGE_KEY'}}],selections:{chat:{kind:'personal',id:'same-connection'}}},0);
 const before=await a.view();assert.equal((await f.ok(f.a.token,'/api/usage/prices','PUT',price)).input,2);assert.equal((await a.view()).revision,before.revision+1);
 await f.ok(f.b.token,'/api/usage/prices','PUT',{...price,currency:'CNY',input:99});
 const lease=await a.lease('chat','generated-usage-summary'),other=await b.lease('chat','generated-usage-summary'),db=new DatabaseSync(join(f.directory,'mote.sqlite'));t.after(()=>db.close());
 const backdate=(userId:string,id:string,index:number)=>{const row=db.prepare('SELECT json FROM user_model_usage WHERE user_id=? AND id=?').get(userId,id)!;const receipt=JSON.parse(String(row.json)) as UsageReceipt;receipt.createdAt='2026-09-15T16:30:'+String(index%60).padStart(2,'0')+'.000Z';receipt.durationMs=(index+1)*100;db.prepare('UPDATE user_model_usage SET json=? WHERE user_id=? AND id=?').run(JSON.stringify(receipt),userId,id);};
 for(let i=0;i<45;i++){const meter=f.node.configuration.startUsage(lease,{attribution:attributions[i%3]});meter.issued();if(i!==2)meter.update(tokens);if(i!==0)meter.finish(i%3===1?'failed':'completed');backdate(f.a.userId,meter.id,i);}
 const unissued=f.node.configuration.startUsage(lease);backdate(f.a.userId,unissued.id,46);
 const nonexecuted=f.node.configuration.startUsage(lease);nonexecuted.issued();nonexecuted.finish('failed',{executionStarted:false});backdate(f.a.userId,nonexecuted.id,47);
 const otherMeter=f.node.configuration.startUsage(other,{attribution:{agentId:'other-user',moduleId:'other-private-module'}});otherMeter.issued();otherMeter.update({...tokens,inputTokens:100000,totalTokens:100010});otherMeter.finish('completed');backdate(f.b.userId,otherMeter.id,0);
 await f.ok(f.a.token,'/api/usage/prices','PUT',{...price,input:222});
 const endpoint='/api/usage?from=2026-09-16&to=2026-09-16&timeZone=Asia%2FShanghai',summary=await f.ok(f.a.token,endpoint) as UsageSummary;
 assert.equal(summary.itemsTotal,45);assert.equal(summary.items.length,20);assert.equal(summary.total.runs,45);assert.equal(summary.total.running,1);assert.equal(summary.total.failed,15);assert.equal(summary.total.completed,29);assert.equal(summary.total.totalTokens,44*110);assert.equal(summary.total.unknownUsage,1);assert.equal(summary.total.unpriced,1);assert.equal(summary.total.cacheHitRate,.2);assert.ok(Math.abs(summary.total.costs.USD!-.011)<1e-12);assert.equal(summary.total.costs.CNY,null);assert.equal(summary.prices[0].input,222);assert.ok(summary.items.filter(item=>item.tokens).every(item=>item.price?.input===2&&item.estimatedCost===.00025));assert.deepEqual(summary.days.map(day=>day.date),['2026-09-16']);
 assert.equal((await f.ok(f.a.token,endpoint.replace('Asia%2FShanghai','UTC'))).total.runs,0);
 for(const groupBy of ['agent','module','skill','model','provider']){const grouped=await f.ok(f.a.token,endpoint+'&groupBy='+groupBy) as UsageSummary;assert.deepEqual(grouped.total,summary.total);assert.equal(grouped.groups.reduce((sum,item)=>sum+item.runs,0),45);for(const group of grouped.groups){const selected=await f.ok(f.a.token,endpoint+'&'+new URLSearchParams(group.filter as Record<string,string>));assert.equal(selected.total.runs,group.runs);}}
 const selected=await f.ok(f.a.token,endpoint+'&groupBy=module&agentId=file-analysis&moduleId=files&skillId=__none__&provider=custom&model=generated-usage&status=failed') as UsageSummary;assert.equal(selected.total.runs,15);assert.equal(selected.facets.agentId.length,3);assert.equal(selected.groups.length,1);assert.equal(selected.groups[0].filter.moduleId,'files');
 const pages=await Promise.all([1,2,3].map(page=>f.ok(f.a.token,endpoint+'&page='+page+'&pageSize=20'))) as UsageSummary[];assert.deepEqual(pages.map(page=>page.items.length),[20,20,5]);assert.equal(new Set(pages.flatMap(page=>page.items.map(item=>item.id))).size,45);assert.ok(pages.every(page=>page.total.runs===45));
 assert.doesNotMatch(JSON.stringify(summary),/other-user|other-private-module|GENERATED_USAGE_KEY/);const bSummary=await f.ok(f.b.token,endpoint) as UsageSummary;assert.equal(bSummary.total.runs,1);assert.equal(bSummary.prices[0].input,99);assert.equal(bSummary.prices[0].currency,'CNY');
 for(const suffix of ['&pageSize=101','&timeZone=bad-zone','&from=2026-02-30','&to=2028-10-01'])assert.equal((await f.request(f.a.token,endpoint+suffix)).statusCode,400);
 assert.equal((await f.request(f.a.token,endpoint+'&userId='+f.b.userId)).statusCode,401);
 assert.equal((await f.request(undefined,endpoint)).statusCode,401);assert.equal((await f.request(f.a.token,'/api/usage/prices','PUT',{...price,input:-1})).statusCode,400);
 const response=await f.request(f.a.token,endpoint);assert.match(String(response.headers['cache-control']),/no-store/);
});
