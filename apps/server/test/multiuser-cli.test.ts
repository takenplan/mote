import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync,readdirSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {buildApp} from '../src/app.js';
import {serializeConfigDocument} from '@mote/shared/config-file';

const script=fileURLToPath(new URL('../../../scripts/import-files.ts',import.meta.url)),password='Generated-M16-CLI-password';
test('actual CLI scan/SourceSync uses M01 identity and M03 original upload for A/B and same-owner credential rotation',async t=>{
 const directory=mkdtempSync(join(tmpdir(),'mote-m16-cli-')),vault=join(directory,'vault'),file=join(directory,'generated.txt'),config=join(directory,'generated.yaml'),node=await buildApp({dataDir:vault});
 t.after(async()=>{await node.app.close();rmSync(directory,{recursive:true,force:true});});
 await node.accounts!.initialize('generated-admin',password);const admin=await node.accounts!.login('generated-admin',password,'generated','client',0),context=await node.authority.authenticate(admin.token);
 for(const username of ['generated-alice','generated-bob'])await node.accounts!.createAccount(context,node.authority,{username,password,administrator:false});
 const a=await node.accounts!.login('generated-alice',password,'generated','client',0),b=await node.accounts!.login('generated-bob',password,'generated','client',0);
 const url=await node.app.listen({host:'127.0.0.1',port:0});writeFileSync(config,serializeConfigDocument({version:1,revision:0}));writeFileSync(file,'Generated exact CLI original');
 const run=(token:string)=>{writeFileSync(config,serializeConfigDocument({version:1,revision:0,server:{host:'127.0.0.1',port:Number(new URL(url).port),token}}));return promisify(execFile)(process.execPath,['--import','tsx',script,'--root',file,'--retention','archive'],{env:{...process.env,MOTE_CONFIG_FILE:config},timeout:30000});};
 assert.match((await run(a.token)).stdout,/Received 1 changed files/);
 assert.match((await run(b.token)).stdout,/Received 1 changed files/);
 const db=new DatabaseSync(join(vault,'mote.sqlite'));t.after(()=>db.close());assert.equal(db.prepare('SELECT count(*) n FROM ig_originals WHERE user_id=?').get(a.userId)!.n,1);assert.equal(db.prepare('SELECT count(*) n FROM ig_originals WHERE user_id=?').get(b.userId)!.n,1);
 const aContext=await node.authority.authenticate(a.token);node.accounts!.revoke(aContext,node.authority,a.credentialId);const rotated=await node.accounts!.login('generated-alice',password,'generated','client',0);
 assert.match((await run(rotated.token)).stdout,/Received 0 changed files/,'credential rotation keeps the same durable owner checkpoint');
 const names=readdirSync(join(directory,'file-sync','accounts'));assert.equal(names.length,2);const markers=names.map(name=>JSON.parse(readFileSync(join(directory,'file-sync','accounts',name,'connection-binding.json'),'utf8')));assert.deepEqual(markers.map(marker=>marker.userId).sort(),[a.userId,b.userId].sort());assert.ok(markers.every(marker=>marker.deploymentId===node.deploymentId&&!('credentialHash' in marker)));
 assert.equal(db.prepare('SELECT count(*) n FROM pd_captures').get()!.n,2,'unchanged same-owner CLI replay does not import twice');
 const seed=fileURLToPath(new URL('../../../scripts/seed-demo.ts',import.meta.url));writeFileSync(config,serializeConfigDocument({version:1,revision:0,server:{host:'127.0.0.1',port:Number(new URL(url).port),token:rotated.token}}));
 assert.match((await promisify(execFile)(process.execPath,['--import','tsx',seed],{env:{...process.env,MOTE_CONFIG_FILE:config},timeout:30000})).stdout,/Imported 24/);
 assert.equal(db.prepare('SELECT count(*) n FROM pd_captures WHERE user_id=?').get(a.userId)!.n,25);assert.equal(db.prepare('SELECT count(*) n FROM pd_captures WHERE user_id=?').get(b.userId)!.n,1);
});

test('a held CLI client rechecks the same URL deployment before another private body is admitted',async t=>{
 const directory=mkdtempSync(join(tmpdir(),'mote-m16-cli-swap-'));let node=await buildApp({dataDir:directory});
 t.after(async()=>{await node.app.close();rmSync(directory,{recursive:true,force:true});});
 await node.accounts!.initialize('generated-admin',password);const session=await node.accounts!.login('generated-admin',password,'generated','client',0);
 const url=await node.app.listen({host:'127.0.0.1',port:0}),port=Number(new URL(url).port),{apiClient}=await import('../../../scripts/client.js'),client=await apiClient({url,token:session.token});
 await node.app.close();const db=new DatabaseSync(join(directory,'mote.sqlite'));db.prepare('UPDATE scope_meta SET deployment_id=?').run('generated-replacement-deployment');db.close();
 node=await buildApp({dataDir:directory});const requests:string[]=[];node.app.addHook('onRequest',async req=>{requests.push(req.url);});await node.app.listen({host:'127.0.0.1',port});
 await assert.rejects(client('/api/ingress/devices',{id:'generated-private-device',name:'Generated private body',platform:'import'},'POST'),/deployment|account|identity|中央|连接/i);
 assert.deepEqual(requests,['/api/connections/self'],'the replacement deployment receives identity admission only');
 const verify=new DatabaseSync(join(directory,'mote.sqlite'));try{assert.equal(verify.prepare('SELECT count(*) n FROM ig_devices').get()!.n,0);}finally{verify.close();}
});

for(const mode of ['missing','wrong'] as const)test('synthetic seed rejects '+mode+' original after real M03 publication',async t=>{
 const directory=mkdtempSync(join(tmpdir(),'mote-m16-cli-ack-')),node=await buildApp({dataDir:join(directory,'vault')});t.after(async()=>{await node.app.close();rmSync(directory,{recursive:true,force:true});});
 await node.accounts!.initialize('generated-admin',password);const session=await node.accounts!.login('generated-admin',password,'generated','client',0),url=await node.app.listen({host:'127.0.0.1',port:0}),config=join(directory,'generated.yaml'),transport=join(directory,'generated-response-only.mjs');
 writeFileSync(config,serializeConfigDocument({version:1,revision:0,server:{host:'127.0.0.1',port:Number(new URL(url).port),token:session.token}}));
 // Only the network response is faulted. Real authorization, ingest, bytes,
 // journals, SQLite and filesystem publication run in the actual Mote host.
 writeFileSync(transport,`import {createHash} from 'node:crypto';const original=globalThis.fetch;globalThis.fetch=async(...args)=>{const response=await original(...args);if(!String(args[0]).endsWith('/captures')||!response.ok)return response;const value=await response.json();for(const item of value.captures){if(${JSON.stringify(mode)}==='missing')delete item.original;else{item.original.hash='0'.repeat(64);item.original.ref='original:'+createHash('sha256').update(JSON.stringify([value.userId,value.sourceId,item.id,item.original.hash,item.original.mime,item.original.retention])).digest('hex');}}return Response.json(value,{status:response.status,headers:response.headers});};`);
 const seed=fileURLToPath(new URL('../../../scripts/seed-demo.ts',import.meta.url));await assert.rejects(promisify(execFile)(process.execPath,['--import',transport,'--import','tsx',seed],{env:{...process.env,MOTE_CONFIG_FILE:config},timeout:30000}),/original receipt mismatch/);
 const db=new DatabaseSync(join(directory,'vault','mote.sqlite'));try{assert.equal(db.prepare('SELECT count(*) n FROM pd_captures').get()!.n,1);}finally{db.close();}
});
