import {createServer} from 'node:http';
import {defaultProcessingSettings} from '../src/scope/processing-schema.js';
import {defaultModelSettings} from '../src/model-settings.js';
import {LifecycleAuthority} from '../src/scope/lifecycle.js';
import {ExecutionFailure} from '../src/execution-engine.js';
import {DatabaseSync} from 'node:sqlite';
import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {buildApp} from '../src/app.js';
import type {LarkRunner} from '../src/connectors/lark-cli.js';
import type {DwsRunner} from '../src/connectors/dingtalk-recordings.js';
import {gmailScope} from '../src/connectors/gmail-adapter.js';
import type {ConnectorTransports} from '../src/scope/connector-contract.js';
import type {ConnectorSourceStatusReader} from '../src/scope/connectors.js';
import {ConnectorVault} from '../src/scope/connector-vault.js';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {password,protocol,scopes,deferred,fixture,assertNoOperationSecret,larkConfigurationTransport,secretPayload,prepareLark,jointLarkTransports,jointRecordingTransports,jointConfiguration,jointProcessing,jointMaterials,jointMedia,jointModels,jointRecordingConnect,socketConnectorSync,connectorOriginalBytes} from './fixtures/multiuser-connectors-suite.js';

test('stop after token exchange admission rejects late credentials while B remains usable',async t=>{const held=deferred(),f=await fixture(t,{holdToken:held});await f.install();await f.configure(f.alice.token);await f.action(f.alice.token,'enable');const auth=await f.start(f.alice.token);await f.callback(auth.state,'A-delayed');await f.tokenEntered.promise;await f.action(f.alice.token,'stop');held.resolve();await f.wait(f.alice.token,auth.taskId,'stale');const r=await f.request(f.alice.token,'/api/connectors/same-connection');assert.equal(r.statusCode,200,r.body);assert.equal(r.json().connected,false);await f.connect(f.bob.token);await f.sync(f.bob.token);});

test('M03 archive replay with a new observation preserves its first original, and one revision cannot replace original bytes',async t=>{
 const f=await fixture(t),context=await f.node.authority.authenticate(f.alice.token),ingress=f.node.ingress.forUser(context);
 ingress.registerSource({id:'archive-regression',name:'Generated',kind:'custom',deviceId:'same',platform:'import',retention:'archive'});
 const item={externalId:'same',revision:'same',observedAt:'2026-10-15T00:00:00Z',title:'Generated',text:'same bytes',kind:'event',layer:'snapshot',deleted:false};
 const first=ingress.receiveSourceItems('archive-regression','first',[item]),second=ingress.receiveSourceItems('archive-regression','second',[{...item,observedAt:'2026-10-15T00:01:00Z'}]);assert.equal(second.captures[0].duplicate,true);assert.equal(second.captures[0].original!.ref,first.captures[0].original!.ref);
 assert.throws(()=>ingress.receiveSourceItemsWithOriginals('archive-regression','altered',[item],[{bytes:Buffer.from('different original'),mime:'text/plain'}]));assert.equal(ingress.pageOriginals('archive-regression').items.length,1);ingress.registerSource({id:'reference-regression',name:'Generated reference',kind:'custom',deviceId:'same',platform:'import',retention:'reference'});assert.throws(()=>ingress.receiveSourceItemsWithOriginals('reference-regression','body-forbidden',[{...item,text:'',layer:'reference'}],[{bytes:Buffer.from('forbidden body'),mime:'text/plain'}]));assert.equal(ingress.pageOriginals('reference-regression').items.length,0);
});

test('invalid provider operation payloads reject before task admission and never persist or reflect supplied secrets',async t=>{
 const secret='GENERATED_INVALID_OPERATION_SECRET',f=await fixture(t,{extra:{lark:()=>larkConfigurationTransport(async()=>{})}});await prepareLark(f);
 const before=(await f.request(f.alice.token,'/api/tasks')).json();assert.equal(before.items.length,1);assert.equal(before.items[0].kind,'plugin.check');assert.equal(before.items[0].state,'succeeded');
 for(const [operation,payload] of [['unknown-operation',{secret}],['configure',{appId:secret,secret,brand:'feishu'}],['login',{secret}],['select',{secret}]]){const response=await f.request(f.alice.token,'/api/connectors/same-connection/operations','POST',{operation,payload,operationId:randomUUID()});assert.equal(response.statusCode,400,response.body);assert.equal(response.body.includes(secret),false);}
 assert.deepEqual((await f.request(f.alice.token,'/api/tasks')).json(),before,'invalid operations cannot admit or change any task, including the completed enable check');assertNoOperationSecret(f,[secret]);
});

for(const provider of ['feishu-recordings','dingtalk-recordings'] as const)test('real M06 pipeline decodes '+provider+' vendor originals while retaining independent backup bytes without automatic ASR',async t=>{
 const io=jointRecordingTransports(),media=await jointMedia(t,async key=>key.endsWith('A')?'JOINT_ASR_A':'JOINT_ASR_B'),f=await fixture(t,{extra:{lark:io.lark,dingtalk:io.dingtalk}});await f.install(provider);
 for(const [token,key] of [[f.alice.token,'GENERATED_JOINT_A'],[f.bob.token,'GENERATED_JOINT_B']]){await jointModels(f,token,media.url,key);await jointRecordingConnect(f,token,provider);await f.sync(token);}
 for(const [token,user,other,engine] of [[f.alice.token,f.a.userId,f.b.userId,provider==='feishu-recordings'?'feishu-export@1':'dingtalk-paragraph-text@2'],[f.bob.token,f.b.userId,f.a.userId,provider==='feishu-recordings'?'feishu-export@1':'dingtalk-paragraph-text@2']]){
  const materials=await jointMaterials(f,token,2);assert.equal(materials.filter((m:any)=>m.text.includes('generated transcript PRIVATE-'+user)).length,2);assert.equal(materials.some((m:any)=>m.text.includes('JOINT_ASR_')||m.text.includes('paragraphList')),false);assert.equal(JSON.stringify(materials).includes(other),false);
  const source=(await f.request(token,'/api/sources')).json().items[0],originals=(await f.request(token,'/api/ingress/sources/'+source.id+'/originals')).json().items,context=await f.node.authority.authenticate(token);assert.equal(originals.length,4);let vendor=0,backups=0;
  for(const original of originals){
   const status=(await f.request(token,'/api/processing/originals/'+original.ref.slice(9))).json();
   if(original.mime==='audio/wav'){backups++;assert.equal(status.indexed,false);assert.deepEqual(f.node.ingress.forUser(context).readOriginal(original.ref).bytes,io.media);continue;}
   assert.equal(status.indexed,true);const artifact=(await f.request(token,'/api/processing/artifacts/'+status.artifactId)).json();if(artifact.payload.engine===engine){vendor++;assert.equal(artifact.payload.segments[0].speaker,'Speaker');if(provider==='dingtalk-recordings'){assert.equal(artifact.payload.segments[0].untimed,true);assert.equal(original.mime,'application/json');}else assert.equal(artifact.payload.segments[0].endMs,5000);}
  }
  assert.equal(vendor,2);assert.equal(backups,2);
 }
 assert.equal(media.calls.length,0,'a saved recording backup is not automatic ASR admission');await f.restart();await f.sync(f.alice.token);await f.sync(f.bob.token);await jointMaterials(f,f.alice.token,2);await jointMaterials(f,f.bob.token,2);assert.equal(media.calls.length,0,'restart and ordinary sync retain the same backup-only disposition');
});
