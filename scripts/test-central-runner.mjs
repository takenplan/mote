// Isolated supervisor fixtures only: generated output, no central node, model or profile startup.
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, readdir, stat, rm, mkdir, open } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { command } from './profile-fixtures.mjs';
import { repository } from './profile-lib.mjs';

const directory = await mkdtemp(join(tmpdir(), 'mote-central-runner-fixture-'));
const runner = join(repository, 'scripts/central-runner.mjs');
const settings = { MOTE_LOG_MAX_MB: '0.1', MOTE_LOG_MAX_FILES: '3' };
const launch = (entry, log) => [runner, entry, log, `--mote-instance=${randomUUID()}`];
try {
  const noisy = join(directory, 'noisy.mjs'), log = join(directory, 'bounded.log');
  await writeFile(noisy, "process.stdout.write('synthetic-private-body\\n'.repeat(60000)); process.stderr.write('synthetic-private-token'.repeat(100000));");
  const started = performance.now();
  for (let i = 0; i < 2; i++) assert.equal((await command(process.execPath, launch(noisy, log), { env: settings })).code, 0);
  const names = (await readdir(directory)).filter(name => name.startsWith('bounded.log'));
  assert.equal(names.length, 3);
  for (const name of names) {
    const path = join(directory, name), info = await stat(path);
    assert.ok(info.size <= Math.floor(0.1 * 1024 * 1024)); assert.equal(info.mode & 0o777, 0o600);
    assert.ok(!(await readFile(path, 'utf8')).includes('synthetic-private'));
  }
  const noisyMs = performance.now() - started;

  // Pre-existing generated files above the old 8 MiB ceiling must survive DEV startup.
  const once=join(directory,'once.mjs');await writeFile(once,"console.log('{\"event\":\"server.listening\",\"port\":12345}');");
  const expandedLog=join(directory,'expanded.log'),MiB=1024*1024;
  const prefill=async(path,bytes)=>{const file=await open(path,'w',0o600);try{await file.truncate(bytes);}finally{await file.close();}};
  await prefill(expandedLog,9*MiB);
  const expandedSettings={MOTE_PROFILE:'dev',MOTE_LOG_MAX_MB:'auto',MOTE_LOG_MAX_FILES:'3'};
  assert.equal((await command(process.execPath,launch(once,expandedLog),{env:expandedSettings})).code,0);
  assert.ok((await stat(expandedLog)).size>9*MiB);
  assert.equal((await readdir(directory)).includes('expanded.log.1'),false);
  // Sparse capacity fixtures exercise the real supervisor at the 100 MiB boundary.
  for(const suffix of ['', '.1', '.2'])await prefill(expandedLog+suffix,100*MiB);
  assert.equal((await command(process.execPath,launch(once,expandedLog),{env:expandedSettings})).code,0);
  const expandedFiles=(await readdir(directory)).filter(name=>name.startsWith('expanded.log'));
  assert.equal(expandedFiles.length,3);
  const sizes=await Promise.all(expandedFiles.map(async name=>(await stat(join(directory,name))).size));
  assert.ok(sizes.every(bytes=>bytes<=100*MiB));assert.ok(sizes.reduce((sum,bytes)=>sum+bytes,0)<=300*MiB);
  assert.equal((await readFile(expandedLog,'utf8')).trim(),'{"event":"server.listening","port":12345}');
  // Explicit 2 MiB remains an override even on DEV; other profiles keep the 8 MiB ceiling.
  const customLog=join(directory,'custom.log');await prefill(customLog,3*MiB);
  assert.equal((await command(process.execPath,launch(once,customLog),{env:{...expandedSettings,MOTE_LOG_MAX_MB:'2'}})).code,0);
  assert.equal((await stat(customLog+'.1')).size,3*MiB);
  const invalid=await command(process.execPath,launch(once,join(directory,'invalid.log')),{env:{MOTE_PROFILE:'test',MOTE_LOG_MAX_MB:'100'}});
  assert.notEqual(invalid.code,0);assert.match(invalid.stderr,/MOTE_LOG_MAX_MB/);

  const tail = join(directory, 'tail.mjs'), tailLog = join(directory, 'tail.log');
  await writeFile(tail, `process.stdout.write('synthetic-private-body\\n'); process.stdout.write('{"event":"server.'); setTimeout(() => { process.stdout.write('listening","port":12345,"tokenConfigured":true,"secret":"synthetic-private-token"}'); process.exitCode=7; },10);`);
  assert.equal((await command(process.execPath, launch(tail, tailLog), { env: settings })).code, 7);
  const tailEvents = (await readFile(tailLog, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(tailEvents, [{ event: 'process.output_suppressed', stream: 'stdout', bytes: 22 }, { event: 'server.listening', port: 12345, tokenConfigured: true }]);

  const shutdown = join(directory, 'shutdown.mjs'), shutdownLog = join(directory, 'shutdown.log');
  await writeFile(shutdown, `process.on('SIGTERM',()=>{process.stdout.write('{"event":"server.stopped","secret":"synthetic-private-token"}');process.exit(0);}); console.log('{"event":"server.listening","port":12345}');setInterval(()=>{},1000);`);
  const child = spawn(process.execPath, launch(shutdown, shutdownLog), { cwd: repository, env: { ...process.env, ...settings }, stdio: 'ignore' });
  const closed = new Promise(resolve => child.once('close', code => resolve(code)));
  try {
    const deadline = Date.now() + 10000;
    while (!(await readFile(shutdownLog, 'utf8').catch(() => '')).includes('server.listening')) { assert.ok(Date.now() < deadline, 'Supervisor must flush while child remains active'); await new Promise(resolve => setTimeout(resolve, 20)); }
    child.kill('SIGTERM');
    assert.equal(await Promise.race([closed, new Promise(resolve => { const timer = setTimeout(() => resolve('timeout'), 10000); timer.unref(); })]), 0);
    assert.deepEqual((await readFile(shutdownLog, 'utf8')).trim().split('\n').map(line => JSON.parse(line)), [{ event: 'server.listening', port: 12345 }, { event: 'server.stopped' }]);
  } finally { if (child.exitCode === null) child.kill('SIGKILL'); }

  const failedLog = join(directory, 'unwritable.log'); await mkdir(failedLog);
  assert.equal((await command(process.execPath, launch(shutdown, failedLog), { env: settings, timeoutMs: 10000 })).code, 1, 'Disk write failure must terminate the child and return failure');
  console.info(JSON.stringify({ status: 'passed', noisyRestarts: 2, stdoutLinesPerRestart: 60000, stderrBytesPerRestart: Buffer.byteLength('synthetic-private-token') * 100000, noisyMs: Math.round(noisyMs), boundedFiles: 3, devMaxFileMiB:100, devFamilyMaxMiB:300, explicitLimitsPreserved:true, fileMode: '0600', privateContentSuppressed: true, splitFinalLineFlushed: true, childExitCodePreserved: true, signalFlush: true, diskFailureStopsChild: true }));
} finally { await rm(directory, { recursive: true, force: true }); }
