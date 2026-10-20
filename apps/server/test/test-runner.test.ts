import assert from 'node:assert/strict';
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import test, { type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkDriverPaths } from '../../../scripts/release/check-driver.mjs';
import { MAX_TEST_WORKERS, PERFORMANCE_REPORTER, testArguments, testWorkerCount, testInvocation } from './run.mjs';
import { testEmbeddingConfiguration } from './fixtures/test-embedding-config.mjs';

const launcher = fileURLToPath(new URL('./run.mjs', import.meta.url));
const driver = new URL('../../../scripts/release/check-driver.mjs', import.meta.url).href;
const dependencies = fileURLToPath(new URL('../../../node_modules', import.meta.url));

function nestedEnvironment() {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  return env;
}

function alive(pid: number) {
  try { process.kill(pid, 0); return true; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false; throw error; }
}

async function until(predicate: () => boolean, description: string) {
  const deadline = performance.now() + 15000;
  while (!predicate()) {
    assert.ok(performance.now() < deadline, description);
    await delay(20);
  }
}

function fixture(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), 'mote-server-test-runner-'));
  const directory = join(root, 'repository');
  mkdirSync(join(directory, 'test'), { recursive: true });
  symlinkSync(dependencies, join(directory, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  const runs: Array<{ child: ChildProcess; done: Promise<{ code: number | null; signal: NodeJS.Signals | null; output: string }> }> = [];
  const ownedPids: number[] = [];
  t.after(async () => {
    for (const { child } of runs) if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
    for (const pid of ownedPids) if (alive(pid)) process.kill(pid, 'SIGKILL');
    await Promise.allSettled(runs.map(run => run.done));
    rmSync(root, { recursive: true, force: true });
  });
  function start(entry: string, args: string[] = [], environment: NodeJS.ProcessEnv = {}) {
    const child = spawn(process.execPath, [entry, ...args], {
      cwd: directory, env: { ...nestedEnvironment(), ...environment }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    for (const stream of [child.stdout!, child.stderr!]) stream.on('data', part => { output += part; });
    const done = new Promise<{ code: number | null; signal: NodeJS.Signals | null; output: string }>((resolveExit, reject) => {
      child.once('error', reject);
      child.once('close', (code, signal) => resolveExit({ code, signal, output }));
    });
    const run = { child, done }; runs.push(run); return run;
  }
  return { root, directory, start, ownedPids };
}

test('Server launcher bounds its CPU default and leaves native CLI overrides after the defaults', () => {
  for (const parallelism of [1, 2, 4, 6, 18, 128]) {
    assert.equal(testWorkerCount(parallelism), Math.max(4, Math.min(parallelism, MAX_TEST_WORKERS)));
  }
  assert.deepEqual(testArguments({ parallelism: 18, nodeOptions: '', args: ['--test-concurrency=1', '--test-name-pattern=generated'] }),
    ['--import', 'tsx', '--test', `--test-concurrency=${testWorkerCount(18)}`, '--test-timeout=120000',
      `--test-reporter=${PERFORMANCE_REPORTER}`,
      '--test-concurrency=1', '--test-name-pattern=generated', 'test/*.test.ts']);
});

test('optional live entries are explicit and preserve the standalone live journey budget', async t => {
  const f = fixture(t), missing = join(f.root, 'absent-private-config.json');
  const ambient = { MOTE_TEST_LIVE_EMBEDDINGS: '1', MOTE_MEMORY_CONTEXT_LIVE: '1', MOTE_MEM0_TEST_EMBEDDING_CONFIG: missing };
  const normal = await testInvocation([], ambient);
  assert.equal(normal.env.MOTE_TEST_LIVE_EMBEDDINGS, undefined);
  assert.equal(normal.env.MOTE_MEMORY_CONTEXT_LIVE, undefined);
  assert.equal(await testEmbeddingConfiguration(normal.env), undefined, 'default does not read an ambient missing file');
  const live = await testInvocation(['--live'], ambient);
  assert.deepEqual(live.args, ['--import', 'tsx', 'test/live/memory-context-reading.ts']);
  assert.equal(live.env.MOTE_MEMORY_CONTEXT_LIVE, '1');
  assert.equal(live.env.MOTE_TEST_LIVE_EMBEDDINGS, undefined);
  assert.ok(!live.args.some(arg => arg.startsWith('--test-timeout')));
  await assert.rejects(testInvocation(['--live', '--performance']), /exactly one/);
  await assert.rejects(testInvocation(['--live-embeddings'], {}), /require MOTE_MEM0/);
  await assert.rejects(testInvocation(['--live-embeddings'], ambient), /unavailable or invalid/);
  const path = join(f.root, 'generated-config.json');
  writeFileSync(path, 'GENERATED_PRIVATE_MALFORMED_BODY');
  assert.equal(await testEmbeddingConfiguration({ MOTE_MEM0_TEST_EMBEDDING_CONFIG: path }), undefined);
  await assert.rejects(testInvocation(['--live-embeddings'], { MOTE_MEM0_TEST_EMBEDDING_CONFIG: path }), error => {
    assert.equal((error as Error).message, 'Live embedding configuration is unavailable or invalid'); return true;
  });
  writeFileSync(path, JSON.stringify({ baseUrl: 'http://127.0.0.1:1/v1', apiKey: 'generated-only', model: 'generated', dimension: 3 }));
  const embeddings = await testInvocation(['--live-embeddings'], { MOTE_MEM0_TEST_EMBEDDING_CONFIG: path });
  assert.equal(embeddings.env.MOTE_TEST_LIVE_EMBEDDINGS, '1');
  assert.deepEqual(embeddings.args.slice(-2), ['test/mem0-memory-provider.test.ts', 'test/memory-provider-consumers.test.ts']);
  assert.equal((await testEmbeddingConfiguration(embeddings.env))!.dimension, 3);
});

test('real launcher keeps performance files opt-in and clears ambient live guards in both fixture modes', async t => {
  const f = fixture(t);
  const assertion = "import test from 'node:test';import assert from 'node:assert/strict';test('MARKER',()=>{assert.equal(process.env.MOTE_TEST_LIVE_EMBEDDINGS,undefined);assert.equal(process.env.MOTE_MEMORY_CONTEXT_LIVE,undefined);});\n";
  writeFileSync(join(f.directory, 'test/generated.test.ts'), assertion.replace('MARKER', 'GENERATED_FUNCTIONAL'));
  mkdirSync(join(f.directory, 'test/performance'));
  writeFileSync(join(f.directory, 'test/performance/generated.test.ts'), assertion.replace('MARKER', 'GENERATED_PERFORMANCE'));
  const environment = { MOTE_TEST_LIVE_EMBEDDINGS: '1', MOTE_MEMORY_CONTEXT_LIVE: '1', MOTE_MEM0_TEST_EMBEDDING_CONFIG: join(f.root, 'missing.json') };
  const normal = await f.start(launcher, [], environment).done;
  assert.equal(normal.code, 0, normal.output); assert.match(normal.output, /GENERATED_FUNCTIONAL/);
  assert.doesNotMatch(normal.output, /GENERATED_PERFORMANCE/);
  const selected = await f.start(launcher, ['--performance', '--test-concurrency=1'], environment).done;
  assert.equal(selected.code, 0, selected.output); assert.match(selected.output, /GENERATED_PERFORMANCE/);
  assert.doesNotMatch(selected.output, /GENERATED_FUNCTIONAL/);
  const rejected = await f.start(launcher, ['--live-embeddings'], environment).done;
  assert.notEqual(rejected.code, 0, rejected.output); assert.match(rejected.output, /unavailable or invalid/);
  assert.doesNotMatch(rejected.output, /GENERATED_FUNCTIONAL/);
});

test('Server launcher leaves native reporter/destination arrays and NODE_OPTIONS aliases intact', () => {
  for (const flag of ['--test-reporter', '--test_reporter', '--test-reporter-destination', '--test_reporter_destination']) {
    for (const args of [[`${flag}=tap`], [flag, 'tap']]) {
      const result = testArguments({ args, nodeOptions: '' });
      assert.deepEqual(result.slice(-args.length - 1), [...args, 'test/*.test.ts']);
      assert.ok(!result.includes(`--test-reporter=${PERFORMANCE_REPORTER}`));
    }
    for (const nodeOptions of [`${flag}=tap`, `"${flag}" "tap"`, `"${flag}=tap"`]) {
      assert.ok(!testArguments({ nodeOptions }).includes(`--test-reporter=${PERFORMANCE_REPORTER}`));
    }
  }
  for (const nodeOptions of [
    '--import=/generated/--test-reporter=hook.mjs',
    '--import="/generated/ --test-reporter=hook.mjs"',
    '"--import=/generated/ --test_reporter=hook.mjs"',
    '--import="/generated/escaped\\\" --test-reporter=hook.mjs"',
  ]) assert.ok(testArguments({ nodeOptions }).includes(`--test-reporter=${PERFORMANCE_REPORTER}`));
});

test('real Server launcher emits advisory performance evidence with its default spec output', async t => {
  const f = fixture(t);
  writeFileSync(join(f.directory, 'test/generated.test.ts'), "import test from 'node:test';test('GENERATED_DEFAULT_REPORT',()=>{});\n");
  const result = await f.start(launcher, [], { NODE_OPTIONS: '' }).done;
  assert.equal(result.code, 0, result.output);
  assert.match(result.output, /GENERATED_DEFAULT_REPORT/);
  assert.match(result.output, /\[test-performance\] 1 observed file summaries/);
  assert.match(result.output, /0 files over budget; 0 cases over reminder/);
  assert.doesNotMatch(result.output, /No overall run summary/);
  const hook = join(f.root, 'generated --test-reporter=hook.mjs');
  writeFileSync(hook, '// Generated no-op import whose path is not a reporter option.\n');
  const imported = await f.start(launcher, [], { NODE_OPTIONS: `--import=${JSON.stringify(hook)}` }).done;
  assert.equal(imported.code, 0, imported.output);
  assert.match(imported.output, /\[test-performance\] 1 observed file summaries/);
});

test('real Server launcher preserves custom native reporter destinations and quoted NODE_OPTIONS', async t => {
  const f = fixture(t);
  writeFileSync(join(f.directory, 'test/generated.test.ts'), "import test from 'node:test';test('GENERATED_NATIVE_TAP',()=>{});\n");
  const destination = join(f.directory, 'generated.tap');
  const selected = await f.start(launcher, ['--test_reporter', 'tap', '--test_reporter_destination', destination], { NODE_OPTIONS: '' }).done;
  assert.equal(selected.code, 0, selected.output);
  assert.match(readFileSync(destination, 'utf8'), /TAP version 13[\s\S]*GENERATED_NATIVE_TAP/);
  assert.doesNotMatch(selected.output, /GENERATED_NATIVE_TAP|\[test-performance\]/);
  const inherited = await f.start(launcher, [], { NODE_OPTIONS: '"--test_reporter" "tap"' }).done;
  assert.equal(inherited.code, 0, inherited.output);
  assert.match(inherited.output, /TAP version 13[\s\S]*GENERATED_NATIVE_TAP/);
  assert.doesNotMatch(inherited.output, /\[test-performance\]/);
  const invalid = await f.start(launcher, ['--test-reporter=spec', '--test-reporter=tap'], { NODE_OPTIONS: '' }).done;
  assert.notEqual(invalid.code, 0, invalid.output);
  assert.match(invalid.output, /must match the number/);
});

test('Server launcher discovers all top-level suites and honors a native concurrency override', async t => {
  const f = fixture(t);
  for (const name of ['first', 'second']) writeFileSync(join(f.directory, 'test', `${name}.test.ts`), `
import test from 'node:test';import {openSync,closeSync,unlinkSync,writeFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
test('generated ${name}',async()=>{const lock=openSync('active-worker','wx');try{await delay(100);writeFileSync('${name}.ran','generated');}finally{closeSync(lock);unlinkSync('active-worker');}});
`);
  mkdirSync(join(f.directory, 'test/fixtures'));
  writeFileSync(join(f.directory, 'test/fixtures/nested.test.ts'), "throw Error('GENERATED_NESTED_SUITE_MUST_NOT_RUN');");
  writeFileSync(join(f.directory, 'test/helper.ts'), "throw Error('GENERATED_HELPER_MUST_NOT_RUN');");
  const result = await f.start(launcher, ['--test-concurrency=1', '--test-reporter=spec']).done;
  assert.equal(result.code, 0, result.output);
  for (const name of ['first', 'second']) assert.equal(readFileSync(join(f.directory, `${name}.ran`), 'utf8'), 'generated');
  assert.match(result.output, /generated first/); assert.match(result.output, /generated second/);
  assert.doesNotMatch(result.output, /MUST_NOT_RUN/);
});

test('Server launcher preserves native test failures and invalid CLI argument failures', async t => {
  const f = fixture(t);
  writeFileSync(join(f.directory, 'test/generated.test.ts'), "import test from 'node:test';test('generated failure',()=>{throw Error('GENERATED_LAUNCHER_FAILURE');});");
  const failed = await f.start(launcher).done;
  assert.equal(failed.code, 1, failed.output); assert.equal(failed.signal, null);
  assert.match(failed.output, /GENERATED_LAUNCHER_FAILURE/);
  assert.match(failed.output, /\[test-performance\]/);
  const invalid = await f.start(launcher, ['--generated-invalid-test-option']).done;
  assert.notEqual(invalid.code, 0); assert.match(invalid.output, /generated-invalid-test-option/);
  assert.doesNotMatch(invalid.output, /GENERATED_LAUNCHER_FAILURE/);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) test(`direct Server launcher forwards ${signal} and waits for its native test child`, {
  skip: process.platform === 'win32', timeout: 30000,
}, async t => {
  const f = fixture(t);
  writeFileSync(join(f.directory, 'test/generated.test.ts'), `
import test from 'node:test';import {writeFileSync} from 'node:fs';
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>process.exit(0));
writeFileSync('worker.pid',String(process.pid));
test('generated cooperative held worker',async()=>{await new Promise(()=>{});});setInterval(()=>{},1000);
`);
  const run = f.start(launcher, ['--test-concurrency=1']);
  await until(() => existsSync(join(f.directory, 'worker.pid')), 'direct native test worker must start');
  const worker = Number(readFileSync(join(f.directory, 'worker.pid'), 'utf8'));
  f.ownedPids.push(worker);
  run.child.kill(signal);
  const result = await run.done;
  assert.equal(result.signal, signal, result.output);
  await until(() => !alive(worker), 'cooperative native test worker must exit after launcher interruption');
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) test(`real check driver cleans resistant Server workers and grandchildren after ${signal}`, {
  skip: process.platform === 'win32', timeout: 30000,
}, async t => {
  const f = fixture(t);
  const git = (...args: string[]) => execFileSync('git', args, { cwd: f.directory, stdio: 'ignore' });
  git('init', '-b', 'main'); git('config', 'user.name', 'Generated fixture'); git('config', 'user.email', 'fixture@example.invalid');
  writeFileSync(join(f.directory, 'fixture.txt'), 'Generated launcher driver fixture\n');
  git('add', 'fixture.txt'); git('commit', '-m', 'generated fixture');
  const grandchild = join(f.root, 'grandchild.cjs');
  writeFileSync(grandchild, `const fs=require('node:fs');
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>fs.writeFileSync('grandchild.'+signal,'received'));
fs.writeFileSync('grandchild.pid',String(process.pid));setInterval(()=>{},1000);`);
  writeFileSync(join(f.directory, 'test/generated.test.ts'), `
import test from 'node:test';import {spawn} from 'node:child_process';import {writeFileSync} from 'node:fs';
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>writeFileSync('worker.'+signal,'received'));
spawn(process.execPath,[${JSON.stringify(grandchild)}],{stdio:'ignore'});
writeFileSync('worker.pid',String(process.pid));
test('generated resistant worker',async()=>{await new Promise(()=>{});});setInterval(()=>{},1000);
`);
  const sentinel = join(f.root, 'sentinel.cjs');
  writeFileSync(sentinel, "require('node:fs').writeFileSync('sentinel.pid',String(process.pid));setInterval(()=>{},1000);");
  const unrelated = f.start(sentinel);
  await until(() => existsSync(join(f.directory, 'sentinel.pid')), 'unrelated sentinel must start');
  const receiptPath = join(f.root, 'receipt.json'), entry = join(f.root, 'driver.mjs');
  writeFileSync(entry, `import {runChecks} from ${JSON.stringify(driver)};
process.exitCode=await runChecks([
{id:'server-launcher',phase:'test',command:process.execPath,args:[${JSON.stringify(launcher)},'--test-concurrency=1']},
{id:'unrun',phase:'test',command:process.execPath,args:['-e','process.exit(0)']}
],{directory:${JSON.stringify(f.directory)},receiptPath:${JSON.stringify(receiptPath)}});`);
  const run = f.start(entry);
  await until(() => existsSync(join(f.directory, 'worker.pid')) && existsSync(join(f.directory, 'grandchild.pid')),
    'native test worker and its resistant grandchild must start');
  const worker = Number(readFileSync(join(f.directory, 'worker.pid'), 'utf8'));
  const descendant = Number(readFileSync(join(f.directory, 'grandchild.pid'), 'utf8'));
  f.ownedPids.push(worker, descendant);
  run.child.kill(signal);
  const result = await run.done;
  assert.equal(result.code, signal === 'SIGINT' ? 130 : 143, result.output);
  for (const role of ['worker', 'grandchild']) assert.equal(readFileSync(join(f.directory, `${role}.${signal}`), 'utf8'), 'received');
  assert.equal(alive(worker), false, 'resistant worker must be cleaned');
  assert.equal(alive(descendant), false, 'resistant grandchild must be cleaned');
  assert.equal(alive(unrelated.child.pid!), true, 'unrelated sentinel must survive owned process-group cleanup');
  const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
  assert.equal(receipt.status, 'interrupted'); assert.equal(receipt.cleanupConfirmed, true);
  assert.equal(receipt.exitCode, result.code);
  assert.deepEqual(receipt.steps.map((step: { status: string }) => step.status), ['failed', 'unrun']);
  assert.equal(existsSync(checkDriverPaths(f.directory).lockDirectory), false, 'confirmed cleanup must release the fixture lock');
});
