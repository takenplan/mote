import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {buildScopedApp} from '../src/scope/app.js';
// External entry and generated case data; no legacy app or private plugin hooks.
// @ts-ignore External example intentionally has no build dependency on the host.
import {generatedFinanceRelease} from '../../../plugins/extension-benchmark/finance/release.mjs';
// @ts-ignore Generated input and independent expected case outcomes.
import {sources} from '../../../plugins/extension-benchmark/finance/fixtures.mjs';
// @ts-ignore The independent oracle is never bundled in the plugin ZIP.
import {expected} from '../../../plugins/extension-benchmark/finance/oracle.mjs';
// @ts-ignore Pure observation validation supports the E01.3 negative cases.
import {monthlyTotals} from '../../../plugins/extension-benchmark/finance/plugin.mjs';

const protocol={'x-mote-protocol-version':'2','x-mote-ingress-version':'3'};
test('E01 frozen production host: external worker reads finance evidence, semantic extension remains unavailable',async t=>{
  const startedAt=new Date().toISOString(),directory=mkdtempSync(join(tmpdir(),'mote-finance-r1-')),release=generatedFinanceRelease();
  const node=await buildScopedApp({dataDir:directory},{pluginReleaseTransport:release.transport});
  t.after(async()=>{await node.app.close();rmSync(directory,{recursive:true,force:true});});
  const request=(token:string|undefined,url:string,method:any='GET',payload?:unknown)=>node.app.inject({url,method,headers:{...protocol,...(token?{authorization:'Bearer '+token}:{})},...(payload===undefined?{}:{payload})});
  const checked=async(token:string|undefined,url:string,method:any='GET',payload?:unknown)=>{const response=await request(token,url,method,payload);assert.equal(response.statusCode,200,`${url}: ${response.body}`);return response.json();};
  const waitTask=async(token:string,id:string)=>{const end=Date.now()+15000;for(;;){const task=await checked(token,'/api/tasks/'+id);if(['succeeded','failed','blocked','stale','cancelled'].includes(task.state))return task;if(Date.now()>end)assert.fail(JSON.stringify(task));await delay(10);}};
  const password='Generated-finance-password-01';
  await node.accounts!.initialize('finance-admin',password);
  const login=(username:string)=>checked(undefined,'/api/auth/login','POST',{username,password,mode:'client'}),admin=await login('finance-admin');
  for(const username of ['finance-a','finance-b'])await checked(admin.token,'/api/admin/accounts','POST',{username,password});
  const a=await login('finance-a'),b=await login('finance-b');
  const preview=await checked(admin.token,'/api/plugins/resolve','POST',{repository:release.repository,tag:release.tag}),catalog=await checked(admin.token,'/api/admin/plugins');
  await checked(admin.token,'/api/plugins/install','POST',{previewId:preview.id,expectedRevision:catalog.revision,operationId:randomUUID()});
  let packageId:string|undefined;
  for(let attempt=0;attempt<1500;attempt++){const current=await checked(admin.token,'/api/admin/plugins');const pkg=current.packages.find((pkg:any)=>pkg.state==='installed');if(pkg){packageId=pkg.id;break;}await delay(10);}
  assert.ok(packageId,'Generated release installation did not finish');
  const sourceIds=Object.keys(sources),captures:string[]=[];
  for(const [sourceId,items] of Object.entries(sources)){
    await checked(a.token,'/api/ingress/sources','POST',{id:sourceId,name:'Generated '+sourceId,kind:'custom',deviceId:'finance-generated',platform:'import',retention:'archive'});
    const receipt=await checked(a.token,'/api/ingress/sources/'+sourceId+'/items','POST',{batchId:'generated-'+sourceId,items});
    captures.push(...receipt.captures.map((row:any)=>row.id));
  }
  assert.equal(captures.length,expected.originals);
  const view=()=>checked(a.token,'/api/plugins');
  const instance={id:'finance',packageId,name:'Finance trial',configuration:{},desired:false,grants:{capabilities:['source','model'],sourceIds,history:false}};
  await checked(a.token,'/api/plugin-instances','POST',{expectedRevision:(await view()).revision,instance});
  await checked(a.token,'/api/plugin-instances/finance/check','POST',{});
  await checked(a.token,'/api/plugin-instances/finance/enable','POST',{expectedRevision:(await view()).revision});
  const inventory=await view(),unsupported=inventory.instances[0].capabilities.find((cap:any)=>cap.id==='benchmark.finance.model');
  assert.equal(unsupported.state,'unsupported');
  assert.equal(unsupported.reason,'scoped_domain_unavailable');
  const snapshot=await checked(a.token,'/api/plugin-instances/finance/snapshots','POST',{});
  const invoke=(componentId:string,payload:unknown)=>checked(a.token,'/api/plugin-snapshots/'+snapshot.id+'/invoke','POST',{componentId,payload,operationId:randomUUID()});
  const scan=await waitTask(a.token,(await invoke('benchmark.finance.source',{action:'scan',sourceIds})).id);
  assert.equal(scan.state,'succeeded',JSON.stringify(scan));
  assert.equal(scan.result.originals,expected.originals);
  assert.equal(new Set(scan.result.refs).size,expected.originals);
  const firstRunAt=new Date().toISOString();
  const foreign=await request(b.token,'/api/plugin-snapshots/'+snapshot.id+'/invoke','POST',{componentId:'benchmark.finance.source',payload:{action:'scan',sourceIds},operationId:randomUUID()});
  assert.equal(foreign.statusCode,404);
  const outside=await waitTask(a.token,(await invoke('benchmark.finance.source',{action:'scan',sourceIds:['not-granted']})).id);
  assert.equal(outside.state,'blocked');
  const model=await request(a.token,'/api/plugin-snapshots/'+snapshot.id+'/invoke','POST',{componentId:'benchmark.finance.model',payload:{},operationId:randomUUID()});
  assert.equal(model.statusCode,503);
  const analysis=await waitTask(a.token,(await invoke('benchmark.finance.source',{action:'analyze',sourceIds})).id);
  assert.equal(analysis.state,'blocked',JSON.stringify(analysis));
  assert.equal(analysis.failure.code,'plugin_operation_requires_attention');
  const events=await checked(a.token,'/api/plugin-events');
  assert.equal(events.items.length,2,'Both actual worker runs must emit their evidence read receipt');
  assert.equal((await checked(b.token,'/api/plugin-events')).items.length,0);

  // Explicit benchmark-only semantic output replacement; real plugin worker,
  // source grants, dedup/arithmetic, M03 publication and M02 retrieval persist.
  const fixtureInstance={...instance,configuration:{semanticFixture:true},desired:false};
  await checked(a.token,'/api/plugin-instances','POST',{expectedRevision:(await view()).revision,instance:fixtureInstance});
  await checked(a.token,'/api/plugin-instances/finance/check','POST',{});
  await checked(a.token,'/api/plugin-instances/finance/enable','POST',{expectedRevision:(await view()).revision});
  const fixtureSnapshot=await checked(a.token,'/api/plugin-instances/finance/snapshots','POST',{});
  const fixtureTask=await checked(a.token,'/api/plugin-snapshots/'+fixtureSnapshot.id+'/invoke','POST',{componentId:'benchmark.finance.source',payload:{action:'analyze',sourceIds},operationId:'finance-fixture-publication'});
  const finance=await waitTask(a.token,fixtureTask.id);
  assert.equal(finance.state,'succeeded',JSON.stringify(finance));
  assert.deepEqual(Object.fromEntries(finance.result.months.map((month:any)=>[month.month,month.netMinor])),expected.months);
  assert.equal(finance.result.months.flatMap((month:any)=>month.transactions).length,expected.uniqueTransactions);
  const knownRefs=new Set(scan.result.refs);
  for(const month of finance.result.months)for(const row of month.transactions){assert.ok(row.evidence.length);for(const ref of row.evidence)assert.ok(knownRefs.has(ref));}
  const p001=finance.result.months.flatMap((month:any)=>month.transactions).find((row:any)=>row.transactionId==='P01');
  assert.equal(p001.evidence.length,2,'Cross-source duplicate must preserve both original references');
  const published=finance.result.published;
  assert.equal(published.length,Object.keys(expected.months).length);
  const persistedTransactions:any[]=[];
  for(const material of published){
    const read=await checked(a.token,'/api/materials/'+material.id);
    assert.equal(read.revision,material.revision);
    assert.ok(read.memberCount>0,'Published result must retain host-validated original members');
    const body=await checked(a.token,'/api/materials/'+material.id+'/read');
    const month=JSON.parse(body.text);
    assert.equal(month.netMinor,expected.months[month.month]);
    persistedTransactions.push(...month.transactions);
    const members=await checked(a.token,'/api/materials/'+material.id+'/members');
    assert.ok(members.items.length>0);
    for(const member of members.items)assert.ok(captures.includes(member.ref.slice(8)));
    assert.equal((await request(b.token,'/api/materials/'+material.id)).statusCode,404);
  }
  const refunds=persistedTransactions.filter(row=>row.kind==='refund');
  assert.deepEqual(Object.fromEntries(refunds.map(row=>[row.transactionId,row.refundOf])),{R01:'P13',R02:'P08'},'Persisted refunds must retain their original charge identities');
  for(const refund of refunds)assert.ok(persistedTransactions.some(charge=>charge.transactionId===refund.refundOf&&charge.kind==='payment'&&charge.currency===refund.currency));
  const search=await checked(a.token,'/api/data/search?query=83335');
  assert.ok(search.items.some((row:any)=>row.kind==='material'&&published.some((material:any)=>material.id===row.id)),'Existing owner query must retrieve the published September insight');
  assert.equal((await checked(b.token,'/api/data/search?query=83335')).items.length,0);
  await checked(a.token,'/api/plugin-instances/finance/disable','POST',{expectedRevision:(await view()).revision});
  const disabled=await request(a.token,'/api/plugin-instances/finance/snapshots','POST',{});
  assert.equal(disabled.statusCode,409);
  const historical=await checked(a.token,'/api/captures/'+captures[0]);
  assert.equal(historical.id,captures[0]);
  for(const material of published)assert.equal((await checked(a.token,'/api/materials/'+material.id)).revision,material.revision);
  await checked(a.token,'/api/plugin-instances','POST',{expectedRevision:(await view()).revision,instance:{...fixtureInstance,grants:{...fixtureInstance.grants,sourceIds:sourceIds.slice(0,2)}}});
  const revoked=await request(a.token,'/api/plugin-snapshots/'+fixtureSnapshot.id+'/invoke','POST',{componentId:'benchmark.finance.source',payload:{action:'scan',sourceIds},operationId:randomUUID()});
  assert.equal(revoked.statusCode,401,'Grant withdrawal must invalidate the retained source receipt');
  const report={trial:'E01-round-1',base:'2c78ca8d52a7d17fae20962cf68d09a717ffc73a',startedAt,firstRunAt,finishedAt:new Date().toISOString(),status:'PARTIAL',failureCode:'NO_EXTENSION_POINT',workerExecuted:true,originalsRead:scan.result.originals,semanticCalls:0,semanticFixtureCalls:1,modelComponent:unsupported,modelHttpStatus:model.statusCode,analysisState:analysis.state,analysisFailure:analysis.failure,fixtureFinanceState:finance.state,months:finance.result.months.map(({month,netMinor}:any)=>({month,netMinor})),published,ownerSearchFound:true,foreignSnapshotHttpStatus:foreign.statusCode,ungrantedSourceState:outside.state,disableAdmissionHttpStatus:disabled.statusCode,revokedSnapshotHttpStatus:revoked.statusCode,historicalCaptureReadable:true,historicalInsightReadable:true,expected,notRun:['automatic finance trigger','restart','upgrade','live GitHub download','live model'],coreEdits:0,privatePluginImports:0};
  if(process.env.MOTE_FINANCE_REPORT)writeFileSync(process.env.MOTE_FINANCE_REPORT,JSON.stringify(report,null,2)+'\n');
  t.diagnostic(JSON.stringify(report));
  if(process.env.MOTE_FINANCE_REQUIRE_COMPLETE==='1')assert.fail('NO_EXTENSION_POINT: current scoped host has no authorized semantic model callback or external automatic finance consumer entrypoint. The production model path produced no insight; explicitly enabled fixture semantics succeeded separately.');
});

test('E01.3 refund validation retains cross-month charge identity across duplicate observations',()=>{
  const evidence=[{ref:'charge-input'},{ref:'refund-input'},{ref:'duplicate-input'}];
  const charge={transactionId:'charge-fixture',occurredOn:'2026-08-31',amountMinor:1000,currency:'USD',kind:'payment',evidenceId:'charge-input'};
  const refund={transactionId:'refund-fixture',occurredOn:'2026-09-01',amountMinor:500,currency:'USD',kind:'refund',refundOf:'charge-fixture',evidenceId:'refund-input'};
  const duplicate={...refund,evidenceId:'duplicate-input'};
  const months=monthlyTotals([refund,duplicate,charge],evidence);
  assert.equal(months[1].transactions[0].refundOf,charge.transactionId);
  assert.equal(months[1].transactions[0].evidence.length,2);
  assert.equal(months[1].netMinor,-500);
  assert.throws(()=>monthlyTotals([charge,{...refund,refundOf:undefined}],evidence),/Refund must identify/);
  assert.throws(()=>monthlyTotals([charge,{...refund,refundOf:'missing-charge'}],evidence),/original charge is not/);
  assert.throws(()=>monthlyTotals([charge,{...refund,refundOf:refund.transactionId}],evidence),/original charge is not/);
  assert.throws(()=>monthlyTotals([charge,refund,{...duplicate,refundOf:'different-charge'}],evidence),/Conflicting transaction observations/);
});

test('E01 documented local backend module configuration is not loaded by the production composition',async t=>{
  const directory=mkdtempSync(join(tmpdir(),'mote-finance-local-loader-')),marker=join(directory,'loaded'),module=join(directory,'backend.mjs');
  writeFileSync(module,`import {writeFileSync} from 'node:fs';writeFileSync(${JSON.stringify(marker)},'imported');export default {name:'benchmark-finance-loader',apply(){}};`);
  const node=await buildScopedApp({dataDir:join(directory,'vault'),backendPluginModules:[module]} as Parameters<typeof buildScopedApp>[0]);
  t.after(async()=>{await node.app.close();rmSync(directory,{recursive:true,force:true});});
  assert.equal((await node.app.inject('/api/health')).statusCode,200);
  assert.equal(existsSync(marker),false,'The frozen scoped host currently ignores backendPluginModules');
});
