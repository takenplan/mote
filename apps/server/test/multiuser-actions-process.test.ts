import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,readFileSync,rmSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {serializeConfigDocument} from '@mote/shared/config-file';
import {defaultModelSettings} from '../src/model-settings.js';
import {defaultProcessingSettings} from '../src/scope/processing-schema.js';
import {defaultMemorySettings} from '../src/scope/memory-schema.js';
import {respond} from './fixtures/scoped-actions.js';
import {source,item} from './fixtures/scoped-query-accounts.js';
import {launchScopedProcess,scopedHttpClient,waitForScopedState} from './fixtures/scoped-process.js';

const entry=process.env.MOTE_ACTIONS_PROCESS_ENTRY??fileURLToPath(new URL('../src/index.ts',import.meta.url));
test('real host and native executor SIGKILL recover an issued successful write without native or model replay',{timeout:120000},async t=>{
 const root=mkdtempSync(join(realpathSync(tmpdir()),'mote-m12-process-')),directory=join(root,'vault'),file=join(root,'generated.yaml'),password='Generated-actions-process-01',calls:{owner:string;raw:string}[]=[],processes:ReturnType<typeof launchScopedProcess>[]=[];
 const provider=createServer((req,res)=>{void(async()=>{let raw='';for await(const chunk of req)raw+=chunk;const owner=String(req.headers['x-api-key']).includes('_A_')?'A':'B';calls.push({owner,raw});respond(JSON.parse(raw),raw,res,owner);})().catch(()=>res.destroy());});await new Promise<void>(resolve=>provider.listen(0,'127.0.0.1',resolve));
 writeFileSync(file,serializeConfigDocument({version:1,revision:0,storage:{dataDir:directory},server:{host:'127.0.0.1',port:0}}));const env={MOTE_CONFIG_FILE:file},initialize=join(dirname(entry),'scope','initialize-admin'+(entry.endsWith('.ts')?'.ts':'.js'));
 execFileSync(process.execPath,entry.endsWith('.ts')?['--import','tsx',initialize]:[initialize],{env:{...process.env,...env},input:JSON.stringify({username:'generated-admin',password}),stdio:['pipe','pipe','pipe'],timeout:15000});
 const db=new DatabaseSync(join(directory,'mote.sqlite'));db.exec('PRAGMA busy_timeout=5000');
 t.after(async()=>{for(const process of processes){if(process.child.exitCode===null&&process.child.signalCode===null)process.child.kill('SIGKILL');await process.closed;}db.close();provider.closeAllConnections();await new Promise<void>(resolve=>provider.close(()=>resolve()));rmSync(root,{recursive:true,force:true});});
 async function start(){const process=launchScopedProcess(entry,env,{loader:entry.endsWith('.ts')});processes.push(process);const value=await process.waitForPhase('listening'),base='http://127.0.0.1:'+value.port;return {...process,base,...scopedHttpClient(base)};}
 let host=await start();const request=(...args:Parameters<typeof host.request>)=>host.request(...args),configure=(...args:Parameters<typeof host.configure>)=>host.configure(...args),admin=await request(undefined,'/api/auth/login','POST',{username:'generated-admin',password,mode:'client'}),users:any[]=[];
 for(const owner of ['A','B']){const user=await request(admin.token,'/api/admin/accounts','POST',{username:'generated-'+owner.toLowerCase(),password}),login=await request(undefined,'/api/auth/login','POST',{username:user.username,password,mode:'client'}),token=login.token;
  await configure(token,'processing',{...defaultProcessingSettings(),automatic:false,understandingEnabled:false});await configure(token,'memory',{...defaultMemorySettings(),automatic:false,integration:false});await configure(token,'models',{profiles:[{id:'same-model',name:'Generated model',settings:{...defaultModelSettings(),provider:'custom',protocol:'anthropic-messages',model:'admitted-actions-model',baseUrl:'http://127.0.0.1:'+(provider.address() as any).port+'/v1',apiKey:'GENERATED_'+owner+'_KEY'}}],selections:{chat:{kind:'personal',id:'same-model'}}});
  await request(token,'/api/ingress/sources','POST',source());const receipt=await request(token,'/api/ingress/sources/same-source/items','POST',{batchId:'same-batch',items:[item('GENERATED_'+owner+'_PRIVATE_APPOINTMENT')]});
  await waitForScopedState(()=>Boolean(db.prepare('SELECT 1 FROM pd_materials h JOIN pd_material_captures c ON c.user_id=h.user_id AND c.material_id=h.id AND c.revision=h.revision WHERE h.user_id=? AND c.capture_id=? AND h.sequence>=h.min_visible_sequence').get(user.userId,receipt.captures[0].id)),()=>owner+' exact formal projection');
  const view=await request(token,'/api/actions');await request(token,'/api/actions/settings','PUT',{revision:view.revision,authorizationRevision:view.authorizationRevision,settings:{enabled:true,timeZone:'UTC',reviewDeviceIds:['same-device']}});await request(token,'/api/actions/targets','POST',{deviceId:'same-device',deviceName:'Generated '+owner,calendars:[{id:'same-calendar',title:'Generated existing '+owner}]});
  let proposal:any;await waitForScopedState(async()=>{proposal=(await request(token,'/api/actions')).items[0];return proposal?.status==='proposed';},()=>owner+' actual Harness proposal');const approved=await request(token,'/api/actions/'+proposal.id+'/confirm','POST',{version:proposal.version,event:proposal.event,target:{deviceId:'same-device',calendarId:'same-calendar'}});users.push({owner,token,userId:user.userId,action:approved});
 }
 const native=(user:any,phase:string)=>{const process=launchScopedProcess(fileURLToPath(new URL('./fixtures/scoped-actions-native.mjs',import.meta.url)),{GENERATED_NATIVE_ENTRY:fileURLToPath(new URL('../../desktop/src/calendar-actions.ts',import.meta.url)),GENERATED_ACTION_ROOT:root,GENERATED_ACTION_OWNER:user.owner,GENERATED_ACTION_PHASE:phase,GENERATED_ACTION_URL:host.base,GENERATED_ACTION_TOKEN:user.token,GENERATED_ACTION_ID:user.action.id});processes.push(process);return process;};
 const [a,b]=users,bWorker=native(b,'complete');await bWorker.waitForPhase('completed');assert.equal((await bWorker.closed).code,0);const beforeB=await request(b.token,'/api/actions'),bCalendar=readFileSync(join(root,'calendar-B.json'),'utf8');
 const aWorker=native(a,'issued');await aWorker.waitForPhase('ack-ready');const beforeNative=JSON.parse(readFileSync(join(root,'calendar-A.json'),'utf8'));assert.equal(beforeNative.mutations,1);assert.equal(readFileSync(join(root,'ledger-A',a.action.operationId),'utf8'),'generated-native-A');
 await waitForScopedState(()=>users.every(user=>db.prepare('SELECT state FROM execution_steps WHERE id=(SELECT policy_task FROM ac_state WHERE user_id=?)').get(user.userId)?.state==='waiting'),()=> 'actual durable parent waiting');
 const completed=db.prepare("SELECT t.task_id,e.attempts,t.user_id FROM user_tasks t JOIN execution_steps e ON e.id=t.task_id WHERE e.kind='actions.extract' AND e.state='succeeded' ORDER BY t.task_id").all(),modelCalls=calls.length;assert.equal(completed.length,2);
 aWorker.child.kill('SIGKILL');assert.equal((await aWorker.closed).signal,'SIGKILL');host.child.kill('SIGKILL');assert.equal((await host.closed).signal,'SIGKILL');
 host=await start();const unknown=await request(a.token,'/api/actions');assert.equal(unknown.items[0].status,'executing');const operation=db.prepare('SELECT task_id,issuance_id FROM ac_operations WHERE user_id=? AND id=?').get(a.userId,a.action.operationId)!;
 assert.equal((await request(a.token,'/api/tasks/'+operation.task_id)).externalState,'issued');assert.deepEqual(await request(b.token,'/api/actions'),beforeB);assert.equal(calls.length,modelCalls);
 rmSync(join(root,'ledger-A',a.action.operationId));const recovered=native(a,'recover');await recovered.waitForPhase('completed');assert.equal((await recovered.closed).code,0);
 const saved=(await request(a.token,'/api/actions')).items[0];assert.equal(saved.status,'succeeded');assert.equal(saved.externalId,'generated-native-A');assert.deepEqual(JSON.parse(readFileSync(join(root,'calendar-A.json'),'utf8')),beforeNative);assert.equal(readFileSync(join(root,'calendar-B.json'),'utf8'),bCalendar);assert.deepEqual(await request(b.token,'/api/actions'),beforeB);
 assert.deepEqual(db.prepare("SELECT t.task_id,e.attempts,t.user_id FROM user_tasks t JOIN execution_steps e ON e.id=t.task_id WHERE e.kind='actions.extract' AND e.state='succeeded' ORDER BY t.task_id").all(),completed);assert.equal(calls.length,modelCalls);assert.equal(db.prepare('SELECT count(*) n FROM task_external_calls WHERE user_id=?').get(a.userId)!.n,1);assert.equal(db.prepare('SELECT state FROM task_external_calls WHERE issuance_id=?').get(operation.issuance_id)!.state,'succeeded');
 for(const call of calls)assert.ok(!call.raw.includes(call.owner==='A'?'GENERATED_B_PRIVATE':'GENERATED_A_PRIVATE'));assert.ok(!JSON.stringify(await request(a.token,'/api/tasks')).includes('GENERATED_A_KEY'));
 host.child.kill('SIGTERM');assert.equal((await host.closed).code,0);
});
