import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const entry=process.env.MOTE_CONNECTORS_PROCESS_ENTRY??fileURLToPath(new URL('../src/app.ts',import.meta.url));
test('distinct real HTTP processes restore pending OAuth and publish scoped Gmail originals through the production composition',async t=>{
 const directory=mkdtempSync(join(tmpdir(),'mote-m10-process-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));const script=fileURLToPath(new URL('./fixtures/scoped-connectors-process.mjs',import.meta.url));
 const run=(phase:string)=>new Promise<unknown>((resolve,reject)=>{const child=spawn(process.execPath,['--import','tsx',script],{env:{...process.env,MOTE_CONNECTORS_PROCESS_ENTRY:entry,GENERATED_CONNECTOR_ROOT:directory,GENERATED_CONNECTOR_PHASE:phase},stdio:['ignore','pipe','pipe']});let out='',err='';const deadline=setTimeout(()=>{child.kill('SIGKILL');reject(Error('Generated connector process timeout'));},25000);child.stdout.on('data',value=>out+=value);child.stderr.on('data',value=>err+=value);child.once('error',reject);child.once('close',code=>{clearTimeout(deadline);code===0?resolve(JSON.parse(out.trim().split('\n').at(-1)!)):reject(Error(err));});});
 assert.deepEqual(await run('first'),{phase:'first',ok:true,users:2});assert.deepEqual(await run('second'),{phase:'second',ok:true,users:2});
});
