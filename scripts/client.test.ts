import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdtemp,mkdir,rm,writeFile,readFile,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';
import {SourceSync} from '../apps/desktop/src/source-sync.js';
import type {SourceDefinition,ScannedItem} from '../apps/desktop/src/source-types.js';
import {initializeCliIngressState,cliAccountDirectory} from './cli-ingress-state.js';
import {defaultConfig} from '../apps/desktop/src/config.js';
const connection={...defaultConfig(),serverUrl:'http://127.0.0.1:47832',token:'generated-cli-token',account:{origin:'http://127.0.0.1:47832',deploymentId:'generated-deployment',userId:'generated-user',username:'generated-user'}};

process.env.MOTE_URL='http://127.0.0.1:47832';
process.env.MOTE_TOKEN='generated-cli-token';
const {apiClient}=await import('./client.js');

test('CLI confirms M01 identity before providing an account-bound Ingress 3 request',async t=>{
  const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original;});
  let calls=0;
  globalThis.fetch=async(url,init)=>{
    calls++;assert.equal(new Headers(init?.headers).get('X-Mote-Protocol-Version'),'2');
    if(new URL(String(url)).pathname==='/api/connections/self')return Response.json({account:{...connection.account,origin:undefined,credentialId:'generated-credential',administrator:false,disabled:false,authorizationEpoch:0,createdAt:1},credential:{kind:'client',expiresAt:Date.now()+60000},protocol:{min:2,max:2},capabilities:{authentication:true,ingest:true,ingressVersion:3,archiveRead:true}});
    assert.equal(new Headers(init?.headers).get('X-Mote-Ingress-Version'),'3');return Response.json({generated:true});
  };
  const client=await apiClient({url:connection.serverUrl,token:connection.token});
  assert.equal(client.account.userId,connection.account.userId);
  assert.deepEqual(await client('/api/ingress/devices'),{generated:true});
  await assert.rejects(client('/api/captures',{},'POST'),/Ingress 3/);assert.equal(calls,2);
});

test('legacy SourceSync algorithm fixture keeps a file revision pending until its v2 receipt validates',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'mote-cli-v2-receipt-')),original=globalThis.fetch;
  t.after(async()=>{globalThis.fetch=original;await rm(directory,{recursive:true,force:true});});
  const source:SourceDefinition={id:'generated-cli-source',deviceId:'generated-device',name:'Generated files',kind:'local-files',platform:'import',retention:'snapshot',enabled:true};
  const item:ScannedItem={externalId:'file:generated',title:'Generated.txt',text:'Synthetic evidence only.',kind:'file',layer:'snapshot',deleted:false};
  const engine=new SourceSync(join(directory,'outbox.json'));
  await engine.initialize();
  await engine.stage({items:[item],seen:[item.externalId],skipped:0,complete:true},false);
  let valid=false,headerChecks=0;
  const client=async(path:string,body?:unknown,method='POST')=>(await fetch('http://127.0.0.1:47832'+path,{method,headers:{'X-Mote-Ingress-Version':'2'},body:JSON.stringify(body)})).json();
  globalThis.fetch=async (url,init)=>{
    assert.equal(new Headers(init?.headers).get('X-Mote-Ingress-Version'),'2');headerChecks++;
    const path=new URL(String(url)).pathname;
    if(path==='/api/sources')return Response.json(source);
    assert.equal(path,'/api/sources/generated-cli-source/items');
    const sent=JSON.parse(String(init?.body)) as {externalId:string;revision:string};
    const id=randomUUID(),ack={id,sourceId:source.id,externalId:sent.externalId,revision:sent.revision,duplicate:false};
    return Response.json({...ack,receipt:valid?{version:2,id,kind:'source-item',state:'received',duplicate:false,sourceId:source.id,externalId:sent.externalId,revision:sent.revision}:undefined});
  };
  await assert.rejects(engine.flush(source,client),/确认不匹配/);
  assert.equal(engine.status().pending,1);
  valid=true;
  assert.equal(await engine.flush(source,client),'ready');
  assert.equal(engine.status().pending,0);
  assert.ok(headerChecks>=4);
});

test('CLI rejects old outboxes without deleting generated state or private original spools',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'mote-cli-strict-spool-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  const statePath=join(directory,'outbox.json'),spool=statePath+'.atime.json.originals',old=JSON.stringify({version:2,known:{},pendingRealtime:[],pendingHistory:[]});
  await writeFile(statePath,old);await mkdir(spool,{recursive:true});await writeFile(join(spool,'generated.bin'),'Generated staged bytes');
  await assert.rejects(initializeCliIngressState(statePath,new SourceSync(statePath),connection),/Unsupported desktop storage format/);
  assert.equal(existsSync(join(spool,'generated.bin')),true);
  assert.equal(await (await import('node:fs/promises')).readFile(statePath,'utf8'),old);
  await assert.rejects(cliAccountDirectory(directory,connection),/Unsupported desktop storage format/);
  const freshPath=join(directory,'fresh.json');await initializeCliIngressState(freshPath,new SourceSync(freshPath),connection);
  await initializeCliIngressState(freshPath,new SourceSync(freshPath),connection);
});

test('CLI binding rejects symlink spools and another owner without changing generated state',async t=>{
 const root=await mkdtemp(join(tmpdir(),'mote-cli-binding-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const owned=await cliAccountDirectory(join(root,'state'),connection),state=join(owned,'outbox.json');
 const engine=new SourceSync(state);await initializeCliIngressState(state,engine,connection);await engine.ensurePolicy('generated-policy');
 const before=await readFile(state+'.sqlite'),other={...connection,account:{...connection.account,userId:'generated-other'}};
 await assert.rejects(initializeCliIngressState(state,new SourceSync(state),other),/another account/);
 assert.deepEqual(await readFile(state+'.sqlite'),before);
 const sentinel=join(root,'generated-sentinel');await writeFile(sentinel,'Generated private sentinel');
 await symlink(sentinel,state+'.originals');await assert.rejects(initializeCliIngressState(state,new SourceSync(state),connection),/links and special/);
 assert.equal(await readFile(sentinel,'utf8'),'Generated private sentinel');
});

test('import-files dry run scans a generated file without contacting a node',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'mote-cli-v2-dry-run-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  const file=join(directory,'generated.txt');await writeFile(file,'Generated CLI source text.');
  const script=fileURLToPath(new URL('./import-files.ts',import.meta.url));
  const {stdout}=await promisify(execFile)(process.execPath,['--import','tsx',script,'--root',file,'--dry-run'],{cwd:fileURLToPath(new URL('../',import.meta.url))});
  assert.match(stdout,/Would send 1 changed files/);
});
