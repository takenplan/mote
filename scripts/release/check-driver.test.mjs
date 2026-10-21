import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { checkDriverPaths, runChecks } from './check-driver.mjs';

const driverUrl = new URL('./check-driver.mjs', import.meta.url).href;
const exists = path => access(path).then(() => true, error => { if (error.code === 'ENOENT') return false; throw error; });
async function until(predicate, description) {
  const deadline = performance.now() + 10000;
  while (!await predicate()) { assert.ok(performance.now() < deadline, description); await delay(20); }
}
function alive(pid) { try { process.kill(pid, 0); return true; } catch (error) { if (error.code === 'ESRCH') return false; throw error; } }

async function repository(t) {
  const root = await mkdtemp(join(tmpdir(), 'mote-check-driver-')), directory = join(root, 'repository'), runs = [];
  await mkdir(directory);
  const git = (...args) => execFileSync('git', args, { cwd: directory, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-b', 'main'); git('config', 'user.name', 'Generated fixture'); git('config', 'user.email', 'fixture@example.invalid');
  await writeFile(join(directory, 'fixture.txt'), 'Generated check driver fixture\n');
  git('add', '.'); git('commit', '-m', 'generated fixture');
  const entry = join(root, 'entry.mjs');
  await writeFile(entry, `import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';import {join} from 'node:path';import {runChecks} from ${JSON.stringify(driverUrl)};const options={directory:process.argv[3]};if(process.argv[4]!=='default')options.receiptPath=process.argv[4];if(process.argv[5]==='identity')options.inputIdentity=()=>createHash('sha256').update(readFileSync(join(options.directory,'fixture.txt'))).digest('hex');process.exitCode=await runChecks(JSON.parse(readFileSync(process.argv[2],'utf8')),options);`);
  t.after(async () => {
    for (const run of runs) if (!run.naturalExitOnly && run.child.exitCode === null && run.child.signalCode === null) run.child.kill('SIGTERM');
    await Promise.all(runs.map(run => run.done));
    await rm(root, { recursive: true, force: true });
  });
  async function start(plan, options = {}) {
    const id = randomUUID(), planPath = join(root, `${id}-plan.json`), receiptPath = options.defaultReceipt ? 'default' : join(root, `${id}-receipt.json`);
    await writeFile(planPath, JSON.stringify(plan));
    const child = spawn(process.execPath, [options.entry ?? entry, planPath, options.directory ?? directory, receiptPath, options.inputIdentity ? 'identity' : ''], {
      env: { ...process.env, ...options.env, ...(options.path ? { PATH: options.path } : {}) }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    for (const stream of [child.stdout, child.stderr]) stream.on('data', part => { output += part; });
    const done = new Promise((resolveExit, reject) => { child.once('error', reject); child.once('close', (code, signal) => resolveExit({ code, signal, output })); });
    const run = { child, done, receiptPath, naturalExitOnly: options.naturalExitOnly, output: () => output }; runs.push(run); return run;
  }
  const node = (id, code, extra = []) => ({ id, phase: 'fixture', command: process.execPath, args: ['-e', code, ...extra] });
  return { root, directory, git, start, node, paths: checkDriverPaths(directory) };
}

test('real driver stops after failure and writes elapsed metadata without command arguments', async t => {
  const f = await repository(t), unexpected = join(f.root, 'unexpected'), secret = 'generated-secret-do-not-copy-to-receipt';
  const run = await f.start([
    f.node('first', 'setTimeout(()=>{},30)', [secret]),
    f.node('failing', 'process.exit(7)'),
    f.node('unrun', `require('node:fs').writeFileSync(${JSON.stringify(unexpected)},'unexpected')`),
  ]);
  const terminal = await run.done; assert.equal(terminal.code, 7, terminal.output);
  assert.equal(await exists(unexpected), false);
  const raw = await readFile(run.receiptPath, 'utf8'), receipt = JSON.parse(raw);
  assert.deepEqual(receipt.steps.map(step => step.status), ['passed', 'failed', 'unrun']);
  assert.equal(receipt.status, 'failed'); assert.equal(receipt.exitCode, 7);
  assert.deepEqual(receipt.runtime, { node: process.versions.node, modules: process.versions.modules, platform: process.platform, arch: process.arch });
  assert.ok(receipt.steps[0].elapsedMs >= 30); assert.ok(receipt.elapsedMs >= receipt.steps[0].elapsedMs);
  assert.equal(raw.includes(secret), false); assert.equal(raw.includes('process.exit(7)'), false);
  assert.match(terminal.output, /PASS fixture\/first .*s/); assert.match(terminal.output, /FAIL fixture\/failing .*exit 7/); assert.match(terminal.output, /UNRUN fixture\/unrun/);
  assert.equal(await exists(f.paths.lockDirectory), false);
});

for (const scenario of [
  {
    name: 'post-close probe EPERM retains natural exit 17 and preserves the cleanup lock',
    exitCode: 17, probeExists: false, signals: [0, 'SIGTERM'],
    errors: [['groupExists', 'post_close', 0], ['signalGroup', 'finally', 'SIGTERM']],
  },
  {
    name: 'post-close SIGTERM EPERM retains natural exit 0 and preserves the cleanup lock',
    exitCode: 0, probeExists: true, signals: [0, 'SIGTERM', 'SIGTERM'],
    errors: [['signalGroup', 'post_close', 'SIGTERM'], ['signalGroup', 'finally', 'SIGTERM']],
  },
]) test(scenario.name, { skip: process.platform === 'win32' }, async t => {
  const f = await repository(t), entry = join(f.root, 'group-error-entry.mjs');
  const taskPidPath = join(f.root, 'task.pid'), callsPath = join(f.root, 'group-calls.json'), unexpected = join(f.root, 'unexpected');
  // Only this driver process is patched. The real task has its own unmodified
  // process object, exits naturally, and has already closed before any probe.
  await writeFile(entry, `
    import assert from 'node:assert/strict';
    import { readFileSync, writeFileSync } from 'node:fs';
    import { runChecks } from ${JSON.stringify(driverUrl)};
    const signals = ${JSON.stringify(scenario.signals)}, calls = [], originalKill = process.kill;
    process.kill = (target, signal) => {
      calls.push({ target, signal });
      assert.ok(Number.isInteger(target) && target < 0, 'only generated negative group targets are allowed');
      assert.equal(signal, signals[calls.length - 1], 'unexpected group operation');
      if (${scenario.probeExists} && calls.length === 1) return true;
      throw Object.assign(new Error('Generated group permission failure'), { code: 'EPERM', errno: -1, syscall: 'kill' });
    };
    try {
      process.exitCode = await runChecks(JSON.parse(readFileSync(process.argv[2], 'utf8')), {
        directory: process.argv[3], receiptPath: process.argv[4],
      });
      assert.equal(calls.length, signals.length, 'all scripted group operations must occur');
    } finally {
      process.kill = originalKill;
      writeFileSync(${JSON.stringify(callsPath)}, JSON.stringify(calls));
    }
  `);
  const run = await f.start([
    { ...f.node('server', `require('node:fs').writeFileSync(${JSON.stringify(taskPidPath)},String(process.pid));process.exitCode=${scenario.exitCode};`), phase: 'test' },
    f.node('following', `require('node:fs').writeFileSync(${JSON.stringify(unexpected)},'unexpected')`),
  ], { entry, naturalExitOnly: true });
  // Await the driver close before any assertion or fixture-directory cleanup.
  // Cleanup must never send a signal to this naturally terminating fixture.
  const terminal = await run.done;
  assert.equal(terminal.code, 1, terminal.output); assert.equal(terminal.signal, null);
  const taskPid = Number(await readFile(taskPidPath, 'utf8'));
  const raw = await readFile(run.receiptPath, 'utf8'), receipt = JSON.parse(raw), measured = receipt.steps[0];
  assert.ok(Number.isInteger(taskPid) && taskPid > 0); assert.notEqual(taskPid, run.child.pid);
  assert.equal(measured.process.pid, taskPid); assert.equal(measured.process.expectedPgid, taskPid);
  assert.equal(measured.process.terminal.code, scenario.exitCode); assert.equal(measured.process.terminal.signal, null);
  for (const time of [measured.process.spawnAttemptedAt, measured.process.terminal.closedAt, ...receipt.processGroupErrors.map(error => error.at)]) {
    assert.equal(new Date(time).toISOString(), time);
  }
  assert.deepEqual(JSON.parse(await readFile(callsPath, 'utf8')), scenario.signals.map(signal => ({ target: -taskPid, signal })));
  assert.deepEqual(receipt.processGroupErrors.map(({ at, ...error }) => error),
    scenario.errors.map(([operation, context, signal], index) => ({
      errorId: index + 1, operation, context, pid: taskPid, targetPgid: taskPid, target: -taskPid,
      signal, code: 'EPERM', errno: -1, syscall: 'kill',
    })));
  assert.equal(receipt.status, 'failed'); assert.equal(receipt.exitCode, 1); assert.equal(receipt.cleanupConfirmed, false);
  assert.equal(receipt.reason, 'owned_process_cleanup_unconfirmed');
  assert.deepEqual(receipt.steps.map(step => step.status), ['unrun', 'unrun']);
  assert.equal(Object.hasOwn(measured, 'exitCode'), false); assert.equal(Object.hasOwn(receipt.steps[1], 'process'), false);
  assert.equal(await exists(unexpected), false); assert.equal(await exists(f.paths.lockDirectory), true);
  const owner = JSON.parse(await readFile(join(f.paths.lockDirectory, 'owner.json'), 'utf8'));
  assert.equal(owner.runId, receipt.runId); assert.equal(owner.pid, run.child.pid);
  assert.equal(raw.includes('Generated group permission failure'), false);
});

test('independent real CLI processes in two worktrees share one atomic repository lock', { skip: process.platform === 'win32' }, async t => {
  const f = await repository(t), worktree = join(f.root, 'worktree'), marker = join(f.root, 'entered');
  f.git('worktree', 'add', '-b', 'generated-second', worktree);
  assert.deepEqual(checkDriverPaths(worktree), f.paths);
  const plan = [f.node('held', `require('node:fs').writeFileSync(${JSON.stringify(marker)},String(process.pid));setInterval(()=>{},1000)`)], first = await f.start(plan);
  await until(() => exists(marker), 'first check must enter its actual command');
  const firstOwner = await readFile(join(f.paths.lockDirectory, 'owner.json'), 'utf8');
  const second = await f.start(plan, { directory: worktree }), refused = await second.done;
  assert.notEqual(refused.code, 0); assert.match(refused.output, /UNRUN: repository check lock exists/); assert.match(refused.output, /Owner PID .*cwd .*started/);
  assert.equal(await readFile(join(f.paths.lockDirectory, 'owner.json'), 'utf8'), firstOwner);
  const receipt = JSON.parse(await readFile(second.receiptPath, 'utf8')); assert.equal(receipt.status, 'blocked'); assert.equal(receipt.steps[0].status, 'unrun');
  first.child.kill('SIGTERM'); const stopped = await first.done; assert.equal(stopped.code, 143, stopped.output);
  assert.equal(await exists(f.paths.lockDirectory), false);
  const third = await f.start([f.node('after-release', 'process.exit(0)')]); assert.equal((await third.done).code, 0);
});

test('uncertain and stale locks are preserved instead of being automatically reclaimed', async t => {
  const f = await repository(t), marker = join(f.root, 'unexpected');
  await mkdir(f.paths.lockDirectory);
  for (const owner of [undefined, { pid: 99999999, directory: f.directory, startedAt: '2000-01-01T00:00:00.000Z', runId: 'generated-stale-owner' }]) {
    if (owner) await writeFile(join(f.paths.lockDirectory, 'owner.json'), JSON.stringify(owner));
    const run = await f.start([f.node('must-not-run', `require('node:fs').writeFileSync(${JSON.stringify(marker)},'unexpected')`)]), result = await run.done;
    assert.notEqual(result.code, 0); assert.match(result.output, /not reclaimed automatically/); assert.equal(await exists(marker), false); assert.equal(await exists(f.paths.lockDirectory), true);
    if (owner) assert.deepEqual(JSON.parse(await readFile(join(f.paths.lockDirectory, 'owner.json'), 'utf8')), owner);
  }
});

for (const signal of ['SIGINT', 'SIGTERM']) test(`${signal} reaches the owned process group, waits for its child and releases the lock`, { skip: process.platform === 'win32' }, async t => {
  const f = await repository(t), parentMarker = join(f.root, 'parent.pid'), grandMarker = join(f.root, 'grandchild.pid'), grandEntry = join(f.root, 'grandchild.cjs');
  await writeFile(grandEntry, `require('node:fs').writeFileSync(${JSON.stringify(grandMarker)},String(process.pid));setInterval(()=>{},1000);`);
  const code = `const fs=require('node:fs'),child=require('node:child_process').spawn(process.execPath,[${JSON.stringify(grandEntry)}],{stdio:'ignore'});fs.writeFileSync(${JSON.stringify(parentMarker)},String(process.pid));for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{if(child.exitCode!==null||child.signalCode!==null)process.exit(0);else child.once('exit',()=>process.exit(0));});setInterval(()=>{},1000);`;
  const unrelated = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { stdio: 'ignore' });
  const unrelatedDone = new Promise(resolveExit => unrelated.once('close', resolveExit));
  t.after(async () => { unrelated.kill('SIGTERM'); await unrelatedDone; });
  const run = await f.start([f.node('parent-and-grandchild', code), f.node('unrun', 'process.exit(0)')]);
  await until(() => exists(grandMarker), 'owned grandchild must start');
  const parent = Number(await readFile(parentMarker, 'utf8')), grandchild = Number(await readFile(grandMarker, 'utf8'));
  run.child.kill(signal); const result = await run.done;
  assert.equal(result.code, signal === 'SIGINT' ? 130 : 143, result.output);
  assert.equal(alive(parent), false); assert.equal(alive(grandchild), false); assert.equal(alive(unrelated.pid), true);
  assert.equal(await exists(f.paths.lockDirectory), false);
  const receipt = JSON.parse(await readFile(run.receiptPath, 'utf8')); assert.equal(receipt.status, 'interrupted'); assert.equal(receipt.cleanupConfirmed, true); assert.equal(receipt.steps[1].status, 'unrun');
});

test('separate generated repositories do not contend and successful gates write default receipts', { skip: process.platform === 'win32' }, async t => {
  const a = await repository(t), b = await repository(t), markerA = join(a.root, 'entered'), markerB = join(b.root, 'entered');
  const held = (f, marker) => f.node('independent', `require('node:fs').writeFileSync(${JSON.stringify(marker)},'entered');setInterval(()=>{},1000)`);
  const first = await a.start([held(a, markerA)]), second = await b.start([held(b, markerB)]);
  await until(async () => await exists(markerA) && await exists(markerB), 'both repositories must run independently');
  first.child.kill('SIGTERM'); second.child.kill('SIGTERM'); await Promise.all([first.done, second.done]);
  const final = await a.start([a.node('success', 'process.exit(0)')], { defaultReceipt: true }); assert.equal((await final.done).code, 0);
  const files = await readdir(a.paths.receiptDirectory); assert.equal(files.length, 1);
  const receipt = JSON.parse(await readFile(join(a.paths.receiptDirectory, files[0]), 'utf8')); assert.equal(receipt.status, 'passed'); assert.equal(receipt.steps[0].status, 'passed');
});

test('spawn failures release the lock, and an empty plan has no repository or receipt side effects', async t => {
  const f = await repository(t), failed = await f.start([{ id: 'missing-command', phase: 'fixture', command: join(f.root, 'not-installed'), args: [] }]);
  assert.notEqual((await failed.done).code, 0); assert.equal(await exists(f.paths.lockDirectory), false);
  const emptyDirectory = join(f.root, 'not-a-repository'); await mkdir(emptyDirectory);
  assert.equal(await runChecks([], { directory: emptyDirectory, receiptPath: join(emptyDirectory, 'unexpected.json') }), 0);
  assert.deepEqual(await readdir(emptyDirectory), []);
});

test('an input edit after preflight prevents the heavy command and cannot reuse a prior PASS', async t => {
  const f = await repository(t), heavy = join(f.root, 'heavy-ran');
  const run = await f.start([
    f.node('preflight', `require('node:fs').writeFileSync('fixture.txt','generated edited input')`),
    f.node('heavy', `require('node:fs').writeFileSync(${JSON.stringify(heavy)},'unexpected')`),
  ], { inputIdentity: true });
  const result = await run.done; assert.notEqual(result.code, 0, result.output); assert.equal(await exists(heavy), false);
  const receipt = JSON.parse(await readFile(run.receiptPath, 'utf8'));
  assert.equal(receipt.inputChanged, true); assert.equal(receipt.status, 'failed'); assert.deepEqual(receipt.steps.map(step => step.status), ['passed', 'unrun']);
  assert.equal(await exists(f.paths.lockDirectory), false);
});

test('an input edit in the final command also prevents a successful whole-gate receipt', async t => {
  const f = await repository(t), run = await f.start([f.node('final', `require('node:fs').writeFileSync('fixture.txt','generated final input')`)], { inputIdentity: true });
  assert.notEqual((await run.done).code, 0);
  const receipt = JSON.parse(await readFile(run.receiptPath, 'utf8')); assert.equal(receipt.inputChanged, true); assert.equal(receipt.status, 'failed'); assert.equal(receipt.steps[0].status, 'passed');
});

test('changed lock ownership is preserved and cannot produce a successful receipt', async t => {
  const f = await repository(t), replacement = { runId: 'generated-different-owner', pid: process.pid, directory: f.directory, startedAt: new Date().toISOString() };
  const run = await f.start([f.node('change-owner', `require('node:fs').writeFileSync(${JSON.stringify(join(f.paths.lockDirectory, 'owner.json'))},${JSON.stringify(JSON.stringify(replacement))})`)]);
  assert.notEqual((await run.done).code, 0);
  assert.deepEqual(JSON.parse(await readFile(join(f.paths.lockDirectory, 'owner.json'), 'utf8')), replacement);
  const receipt = JSON.parse(await readFile(run.receiptPath, 'utf8')); assert.equal(receipt.status, 'failed'); assert.equal(receipt.reason, 'check_lock_owner_changed');
});

test('receipt publication keeps the lock and detects an edit at that real filesystem checkpoint', async t => {
  const f = await repository(t), receiptPath = join(f.root, 'published-receipt.json'), input = join(f.directory, 'fixture.txt');
  let edited = false, lockHeldWhenPublished = false;
  const inputIdentity = () => {
    if (!edited && existsSync(receiptPath)) {
      lockHeldWhenPublished = existsSync(f.paths.lockDirectory);
      edited = true;
      writeFileSync(input, 'Generated edit while final receipt is published\n');
    }
    return createHash('sha256').update(readFileSync(input)).digest('hex');
  };
  const result = await runChecks([f.node('successful-command', 'process.exit(0)')], { directory: f.directory, receiptPath, inputIdentity });
  assert.notEqual(result, 0); assert.equal(edited, true); assert.equal(lockHeldWhenPublished, true);
  const receipt = JSON.parse(await readFile(receiptPath, 'utf8'));
  assert.equal(receipt.status, 'failed'); assert.equal(receipt.inputChanged, true); assert.equal(receipt.exitCode, result);
  assert.equal(await exists(f.paths.lockDirectory), false);
});

test('npm-style shell descendants use the invoking Node before an incompatible PATH runtime', { skip: process.platform === 'win32' }, async t => {
  const f = await repository(t), bin = join(f.root, 'bin'), wrong = join(f.root, 'wrong-node-ran'), actual = join(f.root, 'actual-runtime.json');
  await mkdir(bin);
  await writeFile(join(bin, 'node'), `#!/bin/sh\nprintf incompatible > '${wrong}'\nexit 97\n`, { mode: 0o700 });
  const npmStyle = join(bin, 'generated-npm'), childEntry = join(f.root, 'nested-runtime.cjs');
  await writeFile(childEntry, `require('node:fs').writeFileSync(${JSON.stringify(actual)},JSON.stringify({node:process.versions.node,modules:process.versions.modules,execPath:process.execPath}));`);
  await writeFile(npmStyle, `#!/bin/sh\nnode "$1"\n`, { mode: 0o700 });
  const run = await f.start([{ id: 'npm-style-child', phase: 'fixture', command: npmStyle, args: [childEntry] }], { path: [bin, process.env.PATH ?? ''].join(delimiter) });
  const result = await run.done; assert.equal(result.code, 0, result.output); assert.equal(await exists(wrong), false);
  assert.deepEqual(JSON.parse(await readFile(actual, 'utf8')), { node: process.versions.node, modules: process.versions.modules, execPath: process.execPath });
});

test('explicit receipt reuse reruns changed tasks and prerequisites, preserving original provenance', async t => {
  const f = await repository(t), a = join(f.root, 'a.count'), b = join(f.root, 'b.count'), build = join(f.root, 'build.count');
  const counter = (id, path, phase = 'test') => ({ ...f.node(id,
    `const fs=require('node:fs');const p=${JSON.stringify(path)};fs.writeFileSync(p,String(Number(fs.existsSync(p)?fs.readFileSync(p,'utf8'):0)+1));`), phase });
  const plan = [counter('build', build, 'build'), counter('a', a), counter('b', b)];
  let bInput = 'first';
  const taskIdentity = step => step.phase === 'build' ? undefined
    : createHash('sha256').update(JSON.stringify(step)).update(step.id === 'b' ? bInput : 'stable-a').digest('hex');
  const firstPath = join(f.root, 'first.json'), secondPath = join(f.root, 'second.json');
  assert.equal(await runChecks(plan, { directory: f.directory, receiptPath: firstPath, taskIdentity }), 0);
  const original = JSON.parse(await readFile(firstPath, 'utf8'));
  bInput = 'changed';
  assert.equal(await runChecks(plan, { directory: f.directory, receiptPath: secondPath, taskIdentity, reuseReceiptPaths: [firstPath] }), 0);
  const receipt = JSON.parse(await readFile(secondPath, 'utf8'));
  assert.deepEqual(receipt.steps.map(step => step.status), ['passed', 'reused', 'passed']);
  assert.equal(await readFile(build, 'utf8'), '2'); assert.equal(await readFile(a, 'utf8'), '1'); assert.equal(await readFile(b, 'utf8'), '2');
  assert.equal(receipt.steps[1].origin.runId, original.runId);
  assert.equal(receipt.steps[1].origin.receipt, firstPath);
  assert.equal(receipt.steps[1].origin.stepId, 'a'); assert.equal(receipt.steps[1].elapsedMs, 0);
  // A reused claim is not a new execution. Supply the original again to reuse A.
  const thirdPath = join(f.root, 'third.json');
  assert.equal(await runChecks(plan, { directory: f.directory, receiptPath: thirdPath, taskIdentity, reuseReceiptPaths: [secondPath] }), 0);
  assert.deepEqual(JSON.parse(await readFile(thirdPath, 'utf8')).steps.map(step => step.status), ['passed', 'passed', 'reused']);
});

test('a later failure does not discard an unchanged original task, while interrupted or unclean evidence is rejected', async t => {
  const f = await repository(t), taskIdentity = step => createHash('sha256').update(JSON.stringify(step)).digest('hex');
  const firstPath = join(f.root, 'failed.json'), first = [f.node('good', ''), f.node('bad', 'process.exit(7)')];
  assert.equal(await runChecks(first, { directory: f.directory, receiptPath: firstPath, taskIdentity }), 7);
  const repaired = [first[0], f.node('bad', '')], repairedPath = join(f.root, 'repaired.json');
  assert.equal(await runChecks(repaired, { directory: f.directory, receiptPath: repairedPath, taskIdentity, reuseReceiptPaths: [firstPath] }), 0);
  assert.deepEqual(JSON.parse(await readFile(repairedPath, 'utf8')).steps.map(step => step.status), ['reused', 'passed']);
  const original = JSON.parse(await readFile(firstPath, 'utf8'));
  for (const change of [{ schemaVersion: 1 }, { status: 'interrupted' }, { status: 'blocked' }, { cleanupConfirmed: false }, { reason: 'check_lock_owner_changed' }, { directory: f.root }]) {
    const ineligiblePath = join(f.root, `${randomUUID()}.json`), resultPath = join(f.root, `${randomUUID()}.json`);
    await writeFile(ineligiblePath, JSON.stringify({ ...original, ...change }));
    assert.equal(await runChecks([first[0]], { directory: f.directory, receiptPath: resultPath, taskIdentity, reuseReceiptPaths: [ineligiblePath] }), 0);
    assert.equal(JSON.parse(await readFile(resultPath, 'utf8')).steps[0].status, 'passed');
  }
});

test('runtime edits abort the frozen plan but only changed task evidence is invalidated', async t => {
  const f = await repository(t), input = join(f.directory, 'fixture.txt'), firstPath = join(f.root, 'edited.json');
  const taskIdentity = step => createHash('sha256').update(JSON.stringify(step))
    .update(step.id === 'changing' ? readFileSync(input) : 'unaffected').digest('hex');
  const inputIdentity = () => createHash('sha256').update(readFileSync(input)).digest('hex');
  const plan = [f.node('stable', ''), f.node('changing', "require('node:fs').writeFileSync('fixture.txt','changed runtime input')"), f.node('unrun', '')];
  assert.notEqual(await runChecks(plan, { directory: f.directory, receiptPath: firstPath, taskIdentity, inputIdentity }), 0);
  const original = JSON.parse(await readFile(firstPath, 'utf8'));
  assert.equal(original.inputChanged, true);
  assert.deepEqual(original.steps.map(step => step.status), ['passed', 'invalidated', 'unrun']);
  const nextPath = join(f.root, 'next.json');
  assert.equal(await runChecks([plan[0]], { directory: f.directory, receiptPath: nextPath, taskIdentity, inputIdentity, reuseReceiptPaths: [firstPath] }), 0);
  assert.equal(JSON.parse(await readFile(nextPath, 'utf8')).steps[0].status, 'reused');
});

test('a reused task is checked again while publishing the new receipt', async t => {
  const f = await repository(t), firstPath = join(f.root, 'first.json'), nextPath = join(f.root, 'next.json');
  let identity = 'a'.repeat(64);
  const taskIdentity = () => {
    if (existsSync(nextPath)) identity = 'b'.repeat(64);
    return identity;
  };
  const plan = [f.node('stable', '')];
  assert.equal(await runChecks(plan, { directory: f.directory, receiptPath: firstPath, taskIdentity }), 0);
  assert.notEqual(await runChecks(plan, { directory: f.directory, receiptPath: nextPath, taskIdentity, reuseReceiptPaths: [firstPath] }), 0);
  const receipt = JSON.parse(await readFile(nextPath, 'utf8'));
  assert.equal(receipt.status, 'failed'); assert.equal(receipt.steps[0].status, 'invalidated');
  assert.equal(receipt.steps[0].origin.receipt, firstPath);
});

test('a detected task input change stays invalid even if the old input returns before finalization', async t => {
  const f = await repository(t), receiptPath = join(f.root, 'transient.json');
  let calls = 0;
  const taskIdentity = () => (++calls === 2 ? 'b' : 'a').repeat(64);
  const result = await runChecks([f.node('changed-during-check', ''), f.node('unrun', '')], { directory: f.directory, receiptPath, taskIdentity });
  assert.notEqual(result, 0);
  const receipt = JSON.parse(await readFile(receiptPath, 'utf8'));
  assert.deepEqual(receipt.steps.map(step => step.status), ['invalidated', 'unrun']);
  assert.equal(receipt.steps[0].inputsStable, false);
});

test('caller tool invocation metadata is absent from the actual check child environment', async t => {
  const f = await repository(t), output = join(f.root, 'child-environment.txt');
  const run = await f.start([f.node('isolated-caller-metadata', `require('node:fs').writeFileSync(${JSON.stringify(output)},process.env.CODEX_TOOL_CALL_ID??'absent')`)],
    { env: { CODEX_TOOL_CALL_ID: 'generated-caller-invocation' } });
  assert.equal((await run.done).code, 0);
  assert.equal(await readFile(output, 'utf8'), 'absent');
});

test('declared prerequisites skip descendants while independent real commands report all failures', async t => {
  const f = await repository(t), marker = join(f.root, 'independent');
  const run = await f.start([
    { ...f.node('environment', ''), needs: [] },
    { ...f.node('build-a', 'process.exit(7)'), needs: ['environment'] },
    { ...f.node('test-a', 'throw Error("must not consume stale build")'), needs: ['build-a'] },
    { ...f.node('test-b', `require('node:fs').writeFileSync(${JSON.stringify(marker)},'ran')`), needs: ['environment'] },
    { ...f.node('test-c', 'process.exit(9)'), needs: ['environment'] },
    { ...f.node('test-a-child', 'throw Error("blocked descendant")'), needs: ['test-a'] },
  ]);
  const terminal = await run.done;
  assert.equal(terminal.code, 7, terminal.output);
  assert.equal(await readFile(marker, 'utf8'), 'ran');
  const receipt = JSON.parse(await readFile(run.receiptPath, 'utf8'));
  assert.deepEqual(receipt.steps.map(step => step.status), ['passed', 'failed', 'unrun', 'passed', 'failed', 'unrun']);
  assert.equal(receipt.status, 'failed'); assert.equal(receipt.cleanupConfirmed, true);
  assert.deepEqual(receipt.steps[2].blockedBy, ['build-a']);
  assert.equal(receipt.steps[2].reason, 'prerequisite_failed');
  assert.deepEqual(receipt.steps[5].blockedBy, ['test-a']);
});

test('invalid dependency graphs fail before any command starts', async t => {
  const f = await repository(t);
  for (const plan of [
    [{ ...f.node('a', ''), needs: ['missing'] }],
    [{ ...f.node('a', ''), needs: ['b'] }, { ...f.node('b', ''), needs: ['a'] }],
    [f.node('a', ''), f.node('a', '')],
  ]) {
    const run = await f.start(plan), terminal = await run.done;
    assert.notEqual(terminal.code, 0);
    assert.doesNotMatch(terminal.output, /^RUN fixture\//m);
  }
});

test('the Gradle-shaped child receives the same resolved SDK as its preflight task', async t => {
  const f = await repository(t);
  const { androidEnvironment } = await import('./check-environment.mjs');
  await mkdir(join(f.directory, 'apps/android'), { recursive: true });
  const sdk = join(f.root, 'generated SDK'), actual = join(f.root, 'gradle-env.json');
  await writeFile(join(f.directory, 'apps/android/local.properties'), `sdk.dir=${sdk}\n`);
  const env = androidEnvironment(f.directory, {});
  const run = await f.start([
    { ...f.node('environment', 'if(process.env.ANDROID_HOME!==process.env.ANDROID_SDK_ROOT)process.exit(3)'), env, needs: [] },
    { ...f.node('android-unit', `require('node:fs').writeFileSync(${JSON.stringify(actual)},JSON.stringify([process.env.ANDROID_HOME,process.env.ANDROID_SDK_ROOT]))`), env, needs: ['environment'] },
  ]);
  assert.equal((await run.done).code, 0);
  assert.deepEqual(JSON.parse(await readFile(actual, 'utf8')), [sdk, sdk]);
});

test('an environment failure stops even explicitly independent tasks', async t => {
  const f = await repository(t), run = await f.start([
    { ...f.node('environment', 'process.exit(3)'), needs: [] },
    { ...f.node('must-not-start', 'throw Error("unexpected")'), needs: [] },
  ]);
  assert.equal((await run.done).code, 3);
  assert.deepEqual(JSON.parse(await readFile(run.receiptPath, 'utf8')).steps.map(step => step.status), ['failed', 'unrun']);
});
