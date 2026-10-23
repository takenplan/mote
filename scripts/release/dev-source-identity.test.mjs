import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {sourceCheckout} from '../dev-server.mjs';
const exec=promisify(execFile);

test('source identity distinguishes clean, modified and unavailable metadata without inheriting a parent repository',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'mote-source-identity-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 const unknown={revision:null,modified:null};assert.deepEqual(sourceCheckout(directory),unknown);
 await exec('git',['init','--quiet'],{cwd:directory});
 assert.deepEqual(sourceCheckout(directory),unknown,'an unborn HEAD is unknown');
 const file=join(directory,'source.txt');await writeFile(file,'generated source\n');await exec('git',['add','source.txt'],{cwd:directory});
 await exec('git',['-c','user.name=Generated Fixture','-c','user.email=fixture@example.invalid','-c','commit.gpgsign=false','commit','--quiet','-m','generated fixture'],{cwd:directory});
 const {stdout}=await exec('git',['rev-parse','HEAD'],{cwd:directory}),revision=stdout.trim();assert.deepEqual(sourceCheckout(directory),{revision,modified:false});
 await writeFile(file,'generated source changed\n');assert.deepEqual(sourceCheckout(directory),{revision,modified:true});
 await exec('git',['checkout','--','source.txt'],{cwd:directory});await writeFile(join(directory,'untracked.txt'),'generated untracked\n');assert.deepEqual(sourceCheckout(directory),{revision,modified:true});
 await rm(join(directory,'untracked.txt'));const archive=join(directory,'archive');await mkdir(archive);assert.deepEqual(sourceCheckout(archive),unknown,'a nested source archive must not claim its parent identity');
 const priorPath=process.env.PATH;try{process.env.PATH=archive;assert.deepEqual(sourceCheckout(directory),unknown,'missing Git does not block source startup');}finally{if(priorPath===undefined)delete process.env.PATH;else process.env.PATH=priorPath;}
});

