import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {buildApp} from '../src/app.js';
import {restoreProfile,verifiedBackup} from '../../../scripts/profile-lib.mjs';

const backupScript=fileURLToPath(new URL('../../../scripts/backup.ts',import.meta.url));
const password='Generated-M16-instance-password';
test('existing offline backup and profile restore entry round-trip epoch 5 identities, original bytes and task history without old execution grants',async t=>{
 const directory=mkdtempSync(join(tmpdir(),'mote-m16-backup-')),source=join(directory,'source'),snapshot=join(directory,'snapshot'),target=join(directory,'restored');let node=await buildApp({dataDir:source});
 t.after(async()=>{await node.app.close();rmSync(directory,{recursive:true,force:true});});
 await node.accounts!.initialize('generated-admin',password);
 const login=async(username:string)=>node.accounts!.login(username,password,'generated','client',0),admin=await login('generated-admin'),context=await node.authority.authenticate(admin.token);
 const a=await node.accounts!.createAccount(context,node.authority,{username:'generated-alice',password,administrator:false}),b=await node.accounts!.createAccount(context,node.authority,{username:'generated-bob',password,administrator:false});
 const original=Buffer.from('Generated exact instance original bytes');
 for(const account of [a,b]){
  const grant=await login(account.username),user=await node.authority.authenticate(grant.token),ingress=node.ingress.forUser(user);
  ingress.registerSource({id:'same-source',name:'Generated original',kind:'local-files',deviceId:'same-device',platform:'import',retention:'archive'});
  const captured=await node.app.inject({method:'POST',url:'/api/ingress/sources/same-source/captures',headers:{authorization:'Bearer '+grant.token,'x-mote-protocol-version':'2','x-mote-ingress-version':'3'},payload:{batchId:'same-batch',items:[{id:randomUUID(),deviceId:'same-device',deviceName:'Generated',platform:'import',capturedAt:'2026-01-01T00:00:00Z',durationMs:0,source:'screen',ocrText:'Generated '+account.username,imageBase64:original.toString('base64'),imageMime:'image/png'}]}});assert.equal(captured.statusCode,200,captured.body);
 }
 const deploymentId=node.deploymentId;await node.app.close();
 execFileSync(process.execPath,['--import','tsx',backupScript,'--data',source,'--out',snapshot],{stdio:'pipe',timeout:30000});
 const checked=await verifiedBackup(snapshot);assert.ok(checked.names.includes('mote.sqlite'));const manifest=JSON.parse(readFileSync(join(snapshot,'backup-manifest.json'),'utf8'));assert.equal(manifest.storageEpoch,5);assert.equal(manifest.deploymentId,deploymentId);assert.equal(manifest.kind,'mote-instance-backup');
 await restoreProfile({meta:{runtime:'native'},dataDir:target,processFile:join(directory,'absent-process.json')},snapshot);
 node=await buildApp({dataDir:target});assert.equal(node.deploymentId,deploymentId);
 assert.equal((await node.app.inject({url:'/api/auth/self',headers:{authorization:'Bearer '+admin.token,'x-mote-protocol-version':'2'}})).statusCode,401,'restore never renews an old login grant');
 const restoredAdmin=await login('generated-admin');assert.equal(restoredAdmin.userId,admin.userId);
 const db=new DatabaseSync(join(target,'mote.sqlite'),{readOnly:true});try{assert.equal(db.prepare('SELECT count(*) n FROM pd_captures').get()!.n,2);assert.equal(db.prepare('SELECT count(*) n FROM auth_credentials WHERE revoked_at IS NULL').get()!.n,1);assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);}finally{db.close();}
 const file=checked.names.find((name:string)=>name.startsWith('originals/')&&name.endsWith('.plain'));assert.ok(file);assert.deepEqual(readFileSync(join(target,file)),original);
 const bad=JSON.parse(readFileSync(join(snapshot,'backup-manifest.json'),'utf8'));bad.deploymentId=randomUUID();writeFileSync(join(snapshot,'backup-manifest.json'),JSON.stringify(bad));const rejected=join(directory,'must-not-exist');await assert.rejects(restoreProfile({meta:{runtime:'native'},dataDir:rejected,processFile:join(directory,'absent-process.json')},snapshot));assert.equal(existsSync(rejected),false);
});
