import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFileSync,readFileSync,mkdirSync,realpathSync} from 'node:fs';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {fixture} from './fixtures/scoped-actions.js';
import {waitForState} from './fixtures/scoped-query-accounts.js';
import {defaultModelSettings} from '../src/model-settings.js';

// Generated external CLI only; the production startup, model selection, probe,
// task executor, query adapter, compaction and ledger remain real.
test('configured Codex executable/home serve catalog, probe, both accounts and durable Ask compaction',async t=>{
 const f=await fixture(t),home=join(f.directory,'generated-codex-home'),log=join(f.directory,'generated-codex-rpc.jsonl'),executable=join(f.directory,'generated-codex.cjs');
 mkdirSync(home,{mode:0o700});writeFileSync(join(home,'auth.json'),JSON.stringify({OPENAI_API_KEY:'GENERATED_UNUSED_CODEX_LOGIN'}),{mode:0o600});
 writeFileSync(executable,'#!'+process.execPath+'\n'+String.raw`
const fs=require('node:fs'),readline=require('node:readline');
const log=${JSON.stringify(log)},send=value=>process.stdout.write(JSON.stringify(value)+'\n');
let probe=false;
function finish(){
 send({method:'thread/tokenUsage/updated',params:{threadId:'generated-thread',turnId:'generated-turn',tokenUsage:{total:{inputTokens:100,outputTokens:10,totalTokens:110,cachedInputTokens:0,cacheWriteInputTokens:0,reasoningOutputTokens:0}}}});
 send({method:'item/completed',params:{threadId:'generated-thread',item:{id:'generated-answer',type:'agentMessage',text:JSON.stringify({answer:probe?'Generated connection confirmed [7a8f56d1-45de-47b7-90bb-5e84d411c3d6]':'Generated Codex answer',citationIds:probe?['7a8f56d1-45de-47b7-90bb-5e84d411c3d6']:[]})}}});
 send({method:'turn/completed',params:{threadId:'generated-thread',turn:{status:'completed'}}});
}
readline.createInterface({input:process.stdin}).on('line',line=>{
 const m=JSON.parse(line);fs.appendFileSync(log,JSON.stringify({method:m.method,home:process.env.CODEX_HOME,auth:fs.realpathSync(process.env.CODEX_HOME+'/auth.json'),model:m.params?.model,result:m.result})+'\n');
 if(m.method==='initialize')send({id:m.id,result:{}});
 else if(m.method==='model/list')send({id:m.id,result:{data:[{model:'generated-native',displayName:'Generated native'}]}});
 else if(m.method==='account/read')send({id:m.id,result:{account:{type:'apiKey'}}});
 else if(m.method==='thread/start')send({id:m.id,result:{thread:{id:'generated-thread',model:m.params.model},model:m.params.model,serviceTier:m.params.serviceTier,approvalPolicy:'never',sandbox:{type:'readOnly'}}});
 else if(m.method==='turn/start'){
  send({id:m.id,result:{turn:{id:'generated-turn'}}});probe=m.params.input.some(item=>item.text?.includes('Run a connection test'));
  if(probe)send({id:999,method:'item/tool/call',params:{threadId:'generated-thread',tool:'timeline',namespace:null,arguments:{}}});else finish();
 }else if(m.id===999){if(!m.result?.success)process.exit(4);send({id:1000,method:'item/tool/call',params:{threadId:'generated-thread',tool:'evidence',namespace:null,arguments:{ids:['7a8f56d1-45de-47b7-90bb-5e84d411c3d6']}}});}else if(m.id===1000){if(!m.result?.success)process.exit(5);finish();}
});
`,{mode:0o700});
 const admin=await f.ok(f.admin.token,'/api/admin/configuration/models'),models=admin.domains.find((d:any)=>d.id==='models').saved;
 models.codex={executable,home};models.profiles.push({id:'generated-native',name:'Generated Codex',settings:{...defaultModelSettings(),provider:'codex',protocol:'codex-app-server',baseUrl:'',model:'generated-native',apiKey:'',headers:{},extraBody:{},serviceTier:'default',modelRequestTimeoutMs:null,agentTimeoutMs:null}});
 await f.ok(f.admin.token,'/api/admin/configuration/models','PUT',{revision:admin.revision,value:models,preserveRedactedSecrets:true});await f.restart();
 for(const user of [f.a,f.b]){
  const view=await f.ok(user.token,'/api/configuration'),settings=view.domains.find((d:any)=>d.id==='models').saved;
  settings.selections.chat={kind:'shared',id:'generated-native'};
  await f.ok(user.token,'/api/configuration/models','PUT',{revision:view.revision,value:settings,preserveRedactedSecrets:true});
 }
 const view=await f.ok(f.a.token,'/api/configuration'),input={revision:view.revision,reference:{kind:'shared',id:'generated-native'}};
 assert.deepEqual((await f.ok(f.a.token,'/api/models/catalog','POST',input)).items,[{id:'generated-native',name:'Generated native'}]);
 const probe=await f.ok(f.a.token,'/api/models/probe','POST',input);assert.equal(probe.ok,true,JSON.stringify({probe,calls:readFileSync(log,'utf8')}));
 const id=randomUUID();
 for(const user of [f.a,f.b]){
  await f.ok(user.token,'/api/query-runs','POST',{id,input:{question:'Generated greeting'}});
  const done=await waitForState(()=>f.ok(user.token,'/api/query-runs/'+id),run=>run.status!=='running','generated actual native Ask');assert.equal(done.status,'completed',JSON.stringify(done));assert.equal(done.result.answer,'Generated Codex answer');
 }
 assert.equal((await f.ok(f.a.token,'/api/conversations/'+id+'/compact','POST',{})).answer,'Generated Codex answer');
 await f.restart();
 const follow=randomUUID();await f.ok(f.a.token,'/api/query-runs','POST',{id:follow,input:{question:'Generated continuation',conversationId:id}});
 assert.equal((await waitForState(()=>f.ok(f.a.token,'/api/query-runs/'+follow),run=>run.status!=='running','native post-restart Ask')).status,'completed');
 const calls=readFileSync(log,'utf8').trim().split('\n').map(line=>JSON.parse(line));
 assert.ok(calls.some(call=>call.method==='model/list'));assert.ok(calls.filter(call=>call.method==='thread/start').length>=5);
 assert.ok(calls.every(call=>call.auth===realpathSync(join(home,'auth.json'))),'every actual CLI must use the configured generated login home');
 assert.ok(calls.filter(call=>call.method==='thread/start').every(call=>call.model==='generated-native'));
 const a=await f.ok(f.a.token,'/api/usage'),b=await f.ok(f.b.token,'/api/usage');assert.equal(a.total.runs,3);assert.equal(b.total.runs,1);assert.ok(a.items.every((item:any)=>item.provider==='codex'&&item.model==='generated-native'));
});

test('real Memory provider binding passes the effective host Codex options into each owned Hindsight runtime',async t=>{
 const {scopedMemoryFixture}=await import('./fixtures/scoped-memory-host.js'),{generatedHindsightRelease}=await import('./fixtures/scoped-memory-release.js'),{hindsightHttpFixture}=await import('./fixtures/hindsight-http.js');
 const native=await hindsightHttpFixture();t.after(()=>native.close());const opened:string[]=[],expected={executable:'/generated/fixture-codex',home:'/generated/fixture-codex-home'};
 const f=await scopedMemoryFixture(t,generatedHindsightRelease(),options=>{assert.deepEqual(options.codex,expected);opened.push(options.userId);return native.runtimeFactory(options);});
 const response=await f.request(f.admin.token,'/api/admin/configuration/models'),view=response.json(),models=view.domains.find((d:any)=>d.id==='models').saved;models.codex=expected;
 const saved=await f.request(f.admin.token,'/api/admin/configuration/models','PUT',{revision:view.revision,value:models,preserveRedactedSecrets:true});assert.equal(saved.statusCode,200,saved.body);await f.restart();
 const packageId=await f.install();
 for(const user of [f.a,f.b]){await f.plugin(user,packageId,['same-source'],{modelProfileId:'personal:same-model'},['engine']);await f.bind(user,'same-instance');}
 assert.ok(opened.includes(f.a.userId));assert.ok(opened.includes(f.b.userId));
 // The scripted external Hindsight service substitutes the external worker;
 // actual Codex execution is covered by the prior generated CLI journey.
});
