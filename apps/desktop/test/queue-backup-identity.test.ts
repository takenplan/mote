import {expect,it} from 'vitest';
import {mkdtemp,writeFile,mkdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {describeBackupFile} from '../src/queue-backup-identity';
import {BackgroundJobs} from '../src/background-jobs';

it('describes the actually selected Unicode file without substituting another path or its content',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'mote-backup-identity-'));
  try {
    const path=join(directory,'generated-backup-测试.json'),bytes=Buffer.from('generated original backup bytes');
    await writeFile(path,bytes);
    expect(await describeBackupFile(path)).toEqual({name:'generated-backup-测试.json',path,sizeBytes:bytes.length});
  } finally {await rm(directory,{recursive:true,force:true});}
});
it('keeps absent and non-file size unknown rather than reporting a zero-byte backup',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'mote-backup-unknown-'));
  try {
    const absent=join(directory,'not-created.json'),folder=join(directory,'selected-folder');await mkdir(folder);
    for(const path of [absent,folder]){const file=await describeBackupFile(path);expect(file.path).toBe(path);expect(file).not.toHaveProperty('sizeBytes');}
  } finally {await rm(directory,{recursive:true,force:true});}
});
it('a new native backup attempt clears the previous selected identity before any new picker result',async()=>{
  const jobs=new BackgroundJobs(),first={name:'first.json',path:'/generated/first.json',sizeBytes:17};
  await jobs.run('import','Generated import',async()=>{jobs.progress('import',{message:'Generated selected',file:first});});
  expect(jobs.snapshot()[0].file).toEqual(first);
  let release!:()=>void;
  const next=jobs.run('import','Generated new picker',()=>new Promise<void>(resolve=>{release=resolve;}));
  await Promise.resolve();expect(jobs.snapshot()[0]).not.toHaveProperty('file');
  release();await next;expect(jobs.snapshot()[0]).not.toHaveProperty('file');
});
