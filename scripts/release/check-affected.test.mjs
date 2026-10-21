import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, renameSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
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
  assert.deepEqual(parseArguments(['--reuse', '/first.json', '--reuse', '/second.json']).reuseReceiptPaths, ['/first.json', '/second.json']);
  assert.throws(() => parseArguments(['--reuse']), /Invalid/);
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

test('actual CLI reuses an original tooling task after a documentation commit and reports provenance', t => {
  const { directory, write, git, base } = repository(t), marker = join(directory, 'ignored/executions');
  write('scripts/release/check-plan.mjs');
  write('scripts/release/check-plan.test.mjs', `import fs from 'node:fs';const p=${JSON.stringify(marker)};fs.mkdirSync(${JSON.stringify(join(directory, 'ignored'))},{recursive:true});fs.writeFileSync(p,String(Number(fs.existsSync(p)?fs.readFileSync(p,'utf8'):0)+1));fs.mkdirSync('docs',{recursive:true});fs.writeFileSync('docs/generated.md','Generated validation notes');`);
  const env = { PATH: [dirname(process.execPath), '/usr/bin', '/bin'].join(':'), HOME: directory, TMPDIR: process.env.TMPDIR,
    CODEX_TOOL_CALL_ID: 'generated-first-invocation' };
  const run = args => spawnSync(process.execPath, [cli, '--base', base, ...args], { cwd: directory, encoding: 'utf8', env });
  const first = run([]); assert.equal(first.status, 0, first.stderr);
  const originalPath = /Check receipt: (.+)/.exec(first.stdout)?.[1]; assert.ok(originalPath, first.stdout);
  const original = JSON.parse(readFileSync(originalPath, 'utf8'));
  assert.equal(original.steps.find(step => step.id === 'release-contracts').inputsStable, true);
  git('add', '.'); git('commit', '-m', 'generated fixture plus validation notes');
  write('AGENTS.md', 'Generated ordinary documentation edit');
  env.CODEX_TOOL_CALL_ID = 'generated-second-invocation';
  const second = run(['--reuse', originalPath]); assert.equal(second.status, 0, second.stderr);
  assert.match(second.stdout, /RUN preflight\/environment/);
  assert.match(second.stdout, /REUSED preflight\/release-contracts/);
  assert.equal(readFileSync(marker, 'utf8'), '1');
  const receipt = JSON.parse(readFileSync(/Check receipt: (.+)/.exec(second.stdout)[1], 'utf8'));
  assert.equal(receipt.steps.find(step => step.id === 'release-contracts').origin.runId, original.runId);
  assert.notEqual(receipt.revision, original.revision);
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

test('ordinary documentation and content-equivalent commits do not invalidate runtime identity', t => {
  const { directory, write, git } = repository(t), original = sourceIdentity(directory);
  write('AGENTS.md', 'Generated review rules'); write('docs/development.md', 'Generated prose');
  assert.equal(sourceIdentity(directory), original);
  git('add', '.'); git('commit', '-m', 'generated review document change');
  assert.equal(sourceIdentity(directory), original);
  write('docs/design/scope-inventory.json', '{}');
  assert.notEqual(sourceIdentity(directory), original, 'executable scope input must still invalidate');
});

test('focused CLI selects only explicit Server files and never claims a complete candidate plan', t => {
  const { directory, write } = repository(t);
  write('apps/server/test/selected.test.ts', "import test from 'node:test';test('GENERATED_FOCUSED',()=>{});");
  write('apps/server/test/unrelated.test.ts', "throw Error('must not run');");
  const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;
  const run = (...args) => spawnSync(process.execPath, [cli, ...args], { cwd: directory, env, encoding: 'utf8' });
  const selected = run('--test-file', 'apps/server/test/selected.test.ts', '--dry-run');
  assert.equal(selected.status, 0, selected.stderr);
  const plan = JSON.parse(selected.stdout);
  assert.equal(plan.affected.central, true);
  assert.deepEqual(plan.checks.map(step => step.id), ['environment', 'test:@mote/server#focused']);
  const focused = plan.checks.at(-1);
  assert.deepEqual(focused.args, ['test/run.mjs', '--file', 'test/selected.test.ts']);
  assert.deepEqual(focused.testFiles, ['apps/server/test/selected.test.ts']);
  assert.deepEqual(focused.needs, ['environment']);
  for (const file of ['apps/server/test/missing.test.ts', 'apps/server/test', 'apps/web/test/selected.test.ts', 'apps/server/test/../src/selected.test.ts']) {
    assert.notEqual(run('--test-file', file, '--dry-run').status, 0, file);
  }
  assert.throws(() => parseArguments(['--test-file', 'apps/server/test/selected.test.ts', '--base', 'main']), /Choose/);
  assert.throws(() => parseArguments(['--test-file']), /Invalid/);
});


test('actual focused CLI runs the real Server launcher under the shared driver and reuses only focused evidence', t => {
  const { directory, write } = repository(t);
  write('.gitignore', 'ignored/\nnode_modules/\n');
  write('apps/server/test/performance-reporter.mjs', readFileSync(new URL('../../apps/server/test/performance-reporter.mjs', import.meta.url), 'utf8'));
  write('apps/server/test/run.mjs', readFileSync(new URL('../../apps/server/test/run.mjs', import.meta.url), 'utf8'));
  write('apps/server/test/fixtures/test-embedding-config.mjs', readFileSync(new URL('../../apps/server/test/fixtures/test-embedding-config.mjs', import.meta.url), 'utf8'));
  write('apps/server/test/selected.test.ts', "import test from 'node:test';test('GENERATED_FOCUSED',()=>{});\n");
  write('apps/server/test/unrelated.test.ts', "throw Error('GENERATED_UNRELATED_MUST_NOT_RUN');\n");
  // Generated native adapters only satisfy the environment probe. This test
  // exercises the real driver/launcher boundary, without product Server I/O.
  write('node_modules/better-sqlite3/package.json', '{"main":"index.cjs"}');
  write('node_modules/better-sqlite3/index.cjs', 'module.exports=class {prepare(){return {get(){return 1}}}close(){}}');
  write('node_modules/mem0ai/package.json', '{"exports":{"./oss":"./oss.cjs"}}');
  write('node_modules/mem0ai/oss.cjs', 'module.exports={}');
  const tsx = fileURLToPath(new URL('../../node_modules/tsx', import.meta.url));
  symlinkSync(tsx, join(directory, 'node_modules/tsx'), process.platform === 'win32' ? 'junction' : 'dir');
  const env = { PATH: process.env.PATH, HOME: join(directory, 'ignored/home'), ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}) };
  const run = (...extra) => spawnSync(process.execPath, [cli, '--test-file', 'apps/server/test/selected.test.ts', ...extra], { cwd: directory, encoding: 'utf8', env });
  const first = run();
  assert.equal(first.status, 0, first.stderr + first.stdout);
  assert.match(first.stdout, /GENERATED_FOCUSED/);
  assert.doesNotMatch(first.stdout, /GENERATED_UNRELATED_MUST_NOT_RUN/);
  const receiptPath = /Check receipt: (.+)/.exec(first.stdout)[1].trim();
  const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
  assert.equal(receipt.cleanupConfirmed, true);
  assert.deepEqual(receipt.steps.map(step => [step.id, step.status]), [['environment', 'passed'], ['test:@mote/server#focused', 'passed']]);
  const again = run('--reuse', receiptPath);
  assert.equal(again.status, 0, again.stderr + again.stdout);
  assert.match(again.stdout, /REUSED test\/test:@mote\/server#focused/);
  assert.doesNotMatch(again.stdout, /GENERATED_FOCUSED/);
});
