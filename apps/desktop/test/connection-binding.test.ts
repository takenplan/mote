import { afterEach, beforeEach, expect, it } from 'vitest';
import { mkdtemp, rm, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DurableQueue } from '../src/queue';
import { defaultConfig } from '../src/config';
import { event, image } from './fixtures';
let directory: string;
beforeEach(async () => { directory = await mkdtemp(join(tmpdir(), 'mote-binding-fixture-')); });
afterEach(async () => { await rm(directory, { recursive: true, force: true }); });
it('retains the confirmed account after restart, rejects origin/user changes and accepts credential rotation',async()=>{
 const local={...defaultConfig(),serverUrl:'',token:undefined};
 const initial={...local,serverUrl:'https://first.example',token:'synthetic-token',account:{origin:'https://first.example',deploymentId:'generated-deployment',userId:'generated-a',username:'generated-a'}};
 let queue=new DurableQueue(directory,initial);await queue.initialize();await queue.enqueue(event(),image);
 queue=new DurableQueue(directory,local);await queue.initialize();expect(queue.binding.matches(initial)).toBe(true);expect(queue.binding.matches(local)).toBe(false);
 await expect(queue.binding.commit({...initial,serverUrl:'https://other.example',account:{...initial.account,origin:'https://other.example'}},true,true,true)).rejects.toThrow();
 await expect(queue.binding.commit({...initial,account:{...initial.account,userId:'generated-b'}},true,true,true)).rejects.toThrow();
 await queue.binding.commit({...initial,token:'replacement'},true);expect(await readFile(join(directory,'connection-binding.json'),'utf8')).not.toContain('replacement');
});
it('persists interval checkpoints and clears retry deadlines without changing pending contents', async () => {
  const config = defaultConfig(); let queue = new DurableQueue(directory, config); await queue.initialize(); await queue.enqueue(event(), image);
  const lastUploadAt = '2026-09-14T00:00:00.000Z', nextRetryAt = '2026-09-14T00:01:00.000Z';
  await queue.syncCheckpoint(lastUploadAt, nextRetryAt); queue = new DurableQueue(directory, config); await queue.initialize();
  expect(queue.stats()).toMatchObject({ depth: 1, oldestPendingAt: event().capturedAt, lastUploadAt, nextRetryAt });
  await queue.resetRetries(); expect(queue.stats()).toMatchObject({ depth: 1, lastUploadAt, nextRetryAt: undefined });
});

it('rejects a missing binding for an existing current backlog and never adopts its owner',async()=>{
 const config=defaultConfig(),queue=new DurableQueue(directory,config);await queue.initialize();await queue.enqueue(event(),image);await rm(join(directory,'connection-binding.json'));
 const reopened=new DurableQueue(directory,config);await expect(reopened.initialize()).rejects.toThrow('Unsupported desktop storage format');await expect(stat(join(directory,'connection-binding.json'))).rejects.toMatchObject({code:'ENOENT'});expect(await readFile(join(directory,'events',event().id+'.json'),'utf8')).toContain(event().id);
});
