import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { checkPlan, runChecks, parseArguments, sourceIdentity } from './check-affected.mjs';
import { fixedChecks } from './check-plan.mjs';
import { changedPaths } from './affected-components.mjs';

const cli = fileURLToPath(new URL('check-affected.mjs', import.meta.url));
const tests = ['scripts/release/affected-components.test.mjs'];
test('fixed entry points retain component obligations and never turn into a diff-only no-op', () => {
  assert.deepEqual(checkPlan({}, tests), []);
  const central = checkPlan(fixedChecks('central'), tests);
  for (const name of ['shared', 'agent', 'server', 'web']) assert.ok(central.some(step => step.id === `test:@mote/${name}`));
  assert.ok(central.some(step => step.id === 'central-runner'));
  const desktop = checkPlan(fixedChecks('desktop'), tests);
  for (const name of ['shared', 'diagnostics', 'desktop']) assert.ok(desktop.some(step => step.id === `test:@mote/${name}`));
  assert.ok(!desktop.some(step => step.id === 'build:@mote/desktop'));
  const android = checkPlan(fixedChecks('android'), tests);
  assert.equal(android.at(-1).command, 'apps/android/gradlew');
  assert.ok(android.at(-1).args.includes(':app:testDebugUnitTest'));
  const all = checkPlan(fixedChecks('all'), tests);
  for (const id of ['typecheck:scripts', 'root-tests', 'client-tests', 'central-runner', 'android-unit']) assert.ok(all.some(step => step.id === id));
  assert.ok(!checkPlan(fixedChecks('typescript'), tests).some(step => step.id === 'android-unit'));
  assert.throws(() => fixedChecks('unknown'), /Unknown/);
  assert.throws(() => parseArguments(['--all', '--head', 'HEAD']), /Choose/);
});

function repository(t) {
  const directory = mkdtempSync(join(tmpdir(), 'mote-affected-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: directory, encoding: 'utf8' }).trim();
  const write = (path, text = 'generated fixture\n') => {
    mkdirSync(join(directory, path, '..'), { recursive: true });
    writeFileSync(join(directory, path), text);
  };
  git('init', '-b', 'main');
  git('config', 'user.name', 'Fixture');
  git('config', 'user.email', 'fixture@example.invalid');
  for (const component of ['server', 'web', 'desktop']) write(`apps/${component}/package.json`, JSON.stringify({ name: `@mote/${component}` }));
  mkdirSync(join(directory, 'packages'));
  mkdirSync(join(directory, 'scripts/release'), { recursive: true });
  write('README.md');
  write('package.json', JSON.stringify({ private: true, type: 'module' }));
  write('apps/desktop/src/old.ts');
  write('.gitignore', 'ignored/\n');
  git('add', '.');
  git('commit', '-m', 'fixture base');
  const base = git('rev-parse', 'HEAD');
  const dryRun = (...args) => spawnSync(process.execPath, [cli, '--base', base, '--dry-run', ...args], { cwd: directory, encoding: 'utf8' });
  return { directory, git, write, base, dryRun };
}

test('actual CLI includes committed, staged, unstaged and untracked inputs; explicit head is committed-only', t => {
  const { directory, git, write, base, dryRun } = repository(t);
  write('apps/server/src/committed.ts');
  git('add', '.'); git('commit', '-m', 'central fixture');
  write('apps/desktop/src/staged.ts'); git('add', '.');
  write('apps/web/package.json', JSON.stringify({ name: '@mote/web', fixture: true }));
  write('apps/android/new.kt');
  write('ignored/private.kt');
  const paths = changedPaths({ base, directory });
  for (const path of ['apps/server/src/committed.ts', 'apps/desktop/src/staged.ts', 'apps/web/package.json', 'apps/android/new.kt']) assert.ok(paths.includes(path), path);
  assert.ok(!paths.includes('ignored/private.kt'));
  const result = dryRun();
  assert.equal(result.status, 0, result.stderr);
  const local = JSON.parse(result.stdout);
  assert.equal(local.affected.android, true);
  assert.equal(local.affected.desktop, true);
  const committed = dryRun('--head', 'HEAD');
  assert.equal(committed.status, 0, committed.stderr);
  assert.deepEqual(JSON.parse(committed.stdout).affected, { central: true, desktop: false, android: false, protocol: false, tooling: false });
});

test('documentation-only CLI skips builds, while moving runtime code into docs retains the old consumer', t => {
  const { directory, git, write, base, dryRun } = repository(t);
  write('AGENTS.md'); write('README.zh-CN.md');
  let result = dryRun();
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes('"checks": []'));
  mkdirSync(join(directory, 'docs'));
  renameSync(join(directory, 'apps/desktop/src/old.ts'), join(directory, 'docs/old.ts'));
  git('add', '.');
  assert.ok(changedPaths({ base, directory }).includes('apps/desktop/src/old.ts'));
  result = dryRun();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).affected.desktop, true);
  git('commit', '-m', 'move runtime fixture into docs');
  assert.ok(changedPaths({ base, directory, head: 'HEAD' }).includes('apps/desktop/src/old.ts'));
});

test('actual CLI maps only the three reviewed backup inputs and unions mixed consumers', t => {
  const { write, dryRun } = repository(t);
  const helpers = ['scripts/backup.ts', 'scripts/scoped-backup-schema.mjs', 'scripts/scoped-backup.mjs'];
  for (const helper of helpers) write(helper);
  let result = dryRun();
  assert.equal(result.status, 0, result.stderr);
  const backup = JSON.parse(result.stdout);
  assert.deepEqual(backup.selection.workspaces, ['@mote/server', '@mote/web']);
  assert.deepEqual(backup.selection.rootTests, ['backup', 'scripts-types']);
  assert.equal(backup.selection.android, false);
  assert.equal(backup.selection.all, false);
  assert.ok(backup.checks.find(step => step.id === 'backup-update-tests').args.includes('scripts/update-tests.mjs'));
  assert.ok(backup.checks.some(step => step.id === 'typecheck:scripts'));
  write('apps/android/New.kt'); write('apps/desktop/src/new.ts');
  result = dryRun();
  assert.equal(result.status, 0, result.stderr);
  const mixed = JSON.parse(result.stdout);
  assert.deepEqual(mixed.selection.workspaces, ['@mote/desktop', '@mote/server', '@mote/web']);
  assert.equal(mixed.selection.android, true);
  assert.ok(mixed.checks.some(step => step.id === 'android-unit'));
  write('scripts/scoped-backup-future.mjs');
  result = dryRun();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).selection.all, true);
});

test('actual Git rename diffs retain both old and new backup input obligations', t => {
  const { directory, git, write } = repository(t);
  const helper = 'scripts/scoped-backup.mjs';
  write(helper); git('add', '.'); git('commit', '-m', 'known backup fixture');
  const base = git('rev-parse', 'HEAD');
  const inspect = () => {
    const result = spawnSync(process.execPath, [cli, '--base', base, '--head', 'HEAD', '--dry-run'], { cwd: directory, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  };
  mkdirSync(join(directory, 'docs'));
  git('mv', helper, 'docs/backup-fixture.mjs'); git('commit', '-m', 'move helper to docs');
  assert.deepEqual(changedPaths({ base, head: 'HEAD', directory }).sort(), ['docs/backup-fixture.mjs', helper].sort());
  assert.deepEqual(inspect().selection.rootTests, ['backup']);
  assert.deepEqual(inspect().selection.workspaces, ['@mote/server', '@mote/web']);
  git('mv', 'docs/backup-fixture.mjs', 'scripts/renamed-backup.mjs'); git('commit', '-m', 'unknown new backup location');
  assert.equal(inspect().selection.all, true);
  const unknownBase = git('rev-parse', 'HEAD');
  git('mv', 'scripts/renamed-backup.mjs', helper); git('commit', '-m', 'unknown old backup location');
  const result = spawnSync(process.execPath, [cli, '--base', unknownBase, '--head', 'HEAD', '--dry-run'], { cwd: directory, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const restored = JSON.parse(result.stdout);
  assert.equal(restored.selection.all, true);
  assert.ok(restored.selection.rootTests.includes('backup'));
});

test('an advanced base branch does not turn its unrelated changes into PR inputs', t => {
  const { directory, git, write } = repository(t);
  git('switch', '-c', 'feature');
  write('apps/android/feature.kt'); git('add', '.'); git('commit', '-m', 'android feature');
  git('switch', 'main');
  write('apps/desktop/src/base-only.ts'); git('add', '.'); git('commit', '-m', 'unrelated base change');
  git('switch', 'feature');
  assert.deepEqual(changedPaths({ base: 'main', head: 'HEAD', directory }), ['apps/android/feature.kt']);
});

test('opposite staged and working edits to the same file cannot hide a consumer', t => {
  const { directory, git, write, base, dryRun } = repository(t);
  write('apps/desktop/src/old.ts', 'generated staged change\n');
  git('add', '.');
  write('apps/desktop/src/old.ts');
  assert.equal(git('diff', 'HEAD', '--name-only'), '');
  assert.ok(changedPaths({ base, directory }).includes('apps/desktop/src/old.ts'));
  assert.equal(JSON.parse(dryRun().stdout).affected.desktop, true);
});

test('invalid revisions and options fail instead of reporting no checks', t => {
  const { dryRun } = repository(t);
  for (const args of [['--head', 'missing-revision'], ['--base'], ['--unknown']]) assert.notEqual(dryRun(...args).status, 0);
});

test('actual tooling-only CLI executes regression checks without invoking application tools', t => {
  const { directory, write, base } = repository(t);
  const marker = join(directory, 'ignored/regression-ran');
  mkdirSync(join(directory, 'ignored'));
  write('scripts/release/affected-components.mjs');
  write('scripts/release/check-affected.test.mjs', `import {writeFileSync} from 'node:fs'; writeFileSync(${JSON.stringify(marker)}, 'passed');`);
  // Start as a user's CLI, not as a child worker of this test runner.
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, [cli, '--base', base], { cwd: directory, encoding: 'utf8', env });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes('"tooling": true'));
  assert.ok(!result.stdout.includes('"command": "npm"'));
  assert.ok(existsSync(marker), result.stdout);
  assert.equal(readFileSync(marker, 'utf8'), 'passed');
});

test('check execution stops at the first failing command', async t => {
  const { directory } = repository(t);
  const marker = join(directory, 'unexpected');
  const status = await runChecks([
    { id: 'failure', phase: 'preflight', command: process.execPath, args: ['-e', 'process.exit(7)'] },
    { id: 'unexpected', phase: 'test', command: process.execPath, args: ['-e', `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'unexpected')`] },
  ], { directory, lock: false, receiptPath: join(directory, 'receipt.json') });
  assert.equal(status, 7);
  assert.deepEqual(execFileSync(process.execPath, ['-e', `console.log(require('node:fs').existsSync(${JSON.stringify(marker)}))`], { encoding: 'utf8' }).trim(), 'false');
});

test('actual CLI dependency preflight fails before any selected regression can execute', t => {
  const { directory, write, base } = repository(t);
  const marker = join(directory, 'ignored/heavy-marker');
  mkdirSync(join(directory, 'ignored'));
  write('package.json', JSON.stringify({ dependencies: { 'generated-uninstalled-package': '1' } }));
  write('scripts/release/check-plan.mjs');
  write('scripts/release/check-plan.test.mjs', `import {writeFileSync} from 'node:fs'; writeFileSync(${JSON.stringify(marker)}, 'must not execute');`);
  const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, [cli, '--base', base], { cwd: directory, encoding: 'utf8', env });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /generated-uninstalled-package/);
  assert.ok(!existsSync(marker));
  assert.match(result.stdout, /UNRUN preflight\/release-contracts/);
});

test('actual CLI refuses an old narrow plan when a Server input changes during lock acquisition', t => {
  const { directory, write, base } = repository(t);
  const marker = join(directory, 'ignored/obsolete-plan-ran');
  const hook = join(directory, 'ignored/lock-race.mjs');
  write('scripts/release/check-plan.mjs');
  write('scripts/release/check-plan.test.mjs', `import {writeFileSync} from 'node:fs'; writeFileSync(${JSON.stringify(marker)}, 'obsolete plan');`);
  write('ignored/lock-race.mjs', `
    import fsp from 'node:fs/promises';
    import {mkdirSync,writeFileSync} from 'node:fs';
    import {syncBuiltinESMExports} from 'node:module';
    const original=fsp.mkdir;
    fsp.mkdir=async function(path,...args){
      const value=await original.call(this,path,...args);
      if(String(path).endsWith('mote-check-driver.lock')){
        mkdirSync(${JSON.stringify(join(directory, 'apps/server/src'))},{recursive:true});
        writeFileSync(${JSON.stringify(join(directory, 'apps/server/src/late.ts'))},'generated late Server input');
      }
      return value;
    };syncBuiltinESMExports();
  `);
  const env = { ...process.env, NODE_OPTIONS: `--import=${hook}` }; delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, [cli, '--base', base], { cwd: directory, encoding: 'utf8', env });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /check inputs changed/);
  assert.match(result.stdout, /UNRUN preflight\/environment/);
  assert.ok(!existsSync(marker));
});

test('source identity includes staged/unstaged/untracked source and ignores generated outputs', t => {
  const { directory, write, git } = repository(t);
  const first = sourceIdentity(directory);
  write('ignored/output.log', 'generated output');
  assert.equal(sourceIdentity(directory), first);
  write('apps/web/src/change.ts');
  const changed = sourceIdentity(directory);
  assert.notEqual(changed, first);
  const cache = new Map();
  assert.equal(sourceIdentity(directory, cache), changed);
  git('add', '.');
  assert.equal(sourceIdentity(directory), changed);
  write('apps/web/src/change.ts', 'next input');
  assert.notEqual(sourceIdentity(directory), changed);
  assert.equal(sourceIdentity(directory, cache), sourceIdentity(directory), 'per-run file digest reuse observes changed file metadata');
});
