import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync, chmodSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, delimiter } from 'node:path';
import { checkExecutionEnvironment, createTaskIdentity } from './check-inputs.mjs';

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'mote-task-inputs-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: directory, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const write = (path, value = 'generated fixture\n') => {
    mkdirSync(dirname(join(directory, path)), { recursive: true }); writeFileSync(join(directory, path), value);
  };
  const graph = [
    { name: '@mote/shared', path: 'packages/shared', dependencies: [] },
    { name: '@mote/agent', path: 'packages/agent', dependencies: ['@mote/shared'] },
    { name: '@mote/server', path: 'apps/server', dependencies: ['@mote/agent', '@mote/shared'] },
    { name: '@mote/web', path: 'apps/web', dependencies: ['@mote/shared'] },
    { name: '@mote/desktop', path: 'apps/desktop', dependencies: ['@mote/shared'] },
  ];
  write('.gitignore', 'node_modules/\n.npmrc\n**/dist/\n');
  write('package.json', JSON.stringify({ private: true, workspaces: ['apps/*', 'packages/*'] }));
  write('package-lock.json', '{"generated":true}\n');
  write('tsconfig.base.json', '{}\n');
  write('scripts/release/check-plan.mjs');
  write('scripts/fixtures/provider.ts');
  write('docs/design/scope-inventory.json', '{}\n');
  for (const workspace of graph) {
    write(`${workspace.path}/package.json`, JSON.stringify({ name: workspace.name }));
    write(`${workspace.path}/src/index.ts`);
    write(`${workspace.path}/test/entry.test.ts`);
    write(`${workspace.path}/test/fixtures/evidence.json`);
  }
  git('init', '-b', 'main'); git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.invalid');
  git('add', '.'); git('commit', '-m', 'generated fixture');
  const env = { PATH: dirname(process.execPath), HOME: join(directory, 'home') };
  const identity = createTaskIdentity({ directory, graph, env });
  const step = (name, extra = {}) => ({ id: `test:@mote/${name}`, phase: 'test', command: process.execPath, args: ['--test'], ...extra });
  const key = (name, extra) => { identity.refresh(); return identity(step(name, extra)); };
  return { directory, git, graph, env, write, identity, step, key };
}

test('test-only correction invalidates the owning suite without discarding transitive consumer PASS', t => {
  const f = fixture(t), before = Object.fromEntries(['shared', 'agent', 'server', 'web', 'desktop'].map(name => [name, f.key(name)]));
  f.write('apps/server/test/entry.test.ts', 'generated assertion correction\n');
  for (const name of ['shared', 'agent', 'web', 'desktop']) assert.equal(f.key(name), before[name], name);
  assert.notEqual(f.key('server'), before.server);
  const server = f.key('server');
  f.write('packages/shared/test/entry.test.ts', 'generated shared assertion\n');
  assert.equal(f.key('server'), server);
  assert.equal(f.key('agent'), before.agent);
  assert.notEqual(f.key('shared'), before.shared);
});

test('product source and fixture changes invalidate their source and implicit runtime consumers', t => {
  const f = fixture(t), before = Object.fromEntries(['shared', 'agent', 'server', 'web', 'desktop'].map(name => [name, f.key(name)]));
  f.write('apps/server/src/index.ts', 'generated product correction\n');
  for (const name of ['server', 'web', 'desktop']) assert.notEqual(f.key(name), before[name], name);
  for (const name of ['shared', 'agent']) assert.equal(f.key(name), before[name], name);
  const after = f.key('web');
  f.write('apps/server/test/fixtures/evidence.json', 'generated changed fixture\n');
  assert.notEqual(f.key('web'), after, 'test helper/fixture directories are not suite-only exclusions');
  const shared = f.key('server');
  f.write('packages/shared/src/index.ts', 'generated transitive source correction\n');
  assert.notEqual(f.key('server'), shared);
});

test('root definitions, all manifests, lock and unknown root inputs invalidate every selected task', t => {
  const f = fixture(t);
  for (const path of ['scripts/release/check-plan.mjs', 'apps/desktop/package.json', 'package-lock.json', 'tsconfig.base.json',
    'scripts/fixtures/provider.ts', 'new-unknown-input.txt', 'docs/design/scope-inventory.json']) {
    const before = f.key('server'); f.write(path, `generated change to ${path}\n`); assert.notEqual(f.key('server'), before, path);
  }
});

test('ordinary docs and Git commit identity do not invalidate task inputs', t => {
  const f = fixture(t), before = f.key('server');
  for (const path of ['AGENTS.md', 'README.zh-CN.md', 'docs/development.md', 'release/notes/current.md']) f.write(path);
  assert.equal(f.key('server'), before);
  f.git('add', '.'); f.git('commit', '-m', 'generated documentation commit');
  assert.equal(f.key('server'), before);
});

test('new, deleted and renamed suite inputs are observed after each refresh', t => {
  const f = fixture(t), before = f.key('server');
  f.write('apps/server/test/new.test.ts'); assert.notEqual(f.key('server'), before);
  rmSync(join(f.directory, 'apps/server/test/new.test.ts')); assert.equal(f.key('server'), before);
  rmSync(join(f.directory, 'apps/server/test/entry.test.ts')); assert.notEqual(f.key('server'), before);
  f.write('apps/server/test/renamed.test.ts'); assert.notEqual(f.key('server'), before);
});

test('command definition, arguments, cwd and executable bits are task inputs', t => {
  const f = fixture(t), before = f.key('server');
  for (const extra of [{ args: ['--test', '--test-concurrency=1'] }, { cwd: 'apps/server' }, { phase: 'integration' }]) assert.notEqual(f.key('server', extra), before);
  chmodSync(join(f.directory, 'apps/server/src/index.ts'), 0o755);
  assert.notEqual(f.key('server'), before);
});

test('changed inherited environment and ignored npm config invalidate without exposing values', t => {
  const f = fixture(t), before = f.key('server');
  f.env.GENERATED_SECRET = 'generated-secret-value';
  const changed = f.key('server'); assert.notEqual(changed, before); assert.match(changed, /^[a-f0-9]{64}$/); assert.ok(!changed.includes(f.env.GENERATED_SECRET));
  f.write('.npmrc', 'generated-option=true\n'); assert.notEqual(f.key('server'), changed);
});

test('caller invocation tracing is absent from the effective child environment and its task identity', t => {
  const f = fixture(t); f.env.CODEX_TOOL_CALL_ID = 'generated-first-invocation';
  const before = f.key('server'); f.env.CODEX_TOOL_CALL_ID = 'generated-next-invocation';
  assert.equal(f.key('server'), before);
  const childEnv = checkExecutionEnvironment(f.env);
  assert.equal(Object.hasOwn(childEnv, 'CODEX_TOOL_CALL_ID'), false);
  assert.equal(childEnv.PATH, [dirname(process.execPath), f.env.PATH].join(delimiter));
  assert.equal(childEnv.HOME, f.env.HOME);
  assert.equal(f.env.CODEX_TOOL_CALL_ID, 'generated-next-invocation', 'normalization does not mutate caller state');
  f.env.GENERATED_FIXTURE_OPTION = 'generated-relevant-change'; assert.notEqual(f.key('server'), before);
});

test('installed dependency changes invalidate even with an unchanged package lock', t => {
  const f = fixture(t); f.write('node_modules/generated-package/index.js');
  const before = f.key('server');
  f.write('node_modules/generated-package/index.js', 'generated local dependency patch\n'); assert.notEqual(f.key('server'), before);
  const patched = f.key('server'); f.write('node_modules/generated-package/new.js'); assert.notEqual(f.key('server'), patched);
});

test('reviewed Vite output caches do not invalidate installed inputs, while other cache files do', t => {
  const f = fixture(t); f.write('node_modules/generated-package/index.js');
  const before = f.key('server');
  f.write('node_modules/.vite/vitest/generated/results.json', '{}\n');
  f.write('node_modules/.vite-temp/config.mjs', 'generated transform\n');
  assert.equal(f.key('server'), before);
  f.write('node_modules/.vite/vitest/generated/results.json', '{"updated":true}\n');
  assert.equal(f.key('server'), before);
  f.write('node_modules/.cache/unknown-input.json'); assert.notEqual(f.key('server'), before);
});

test('ignored built package contents remain inputs across byte-identical rebuilds', t => {
  const f = fixture(t); f.write('packages/agent/dist/index.js');
  const before = f.key('server');
  f.write('packages/agent/dist/index.js'); assert.equal(f.key('server'), before);
  f.write('packages/agent/dist/index.js', 'generated changed build\n'); assert.notEqual(f.key('server'), before);
  const changed = f.key('server'); f.write('packages/agent/dist/stale-extra.js'); assert.notEqual(f.key('server'), changed);
});

test('preflight source-only keys remain valid when later prerequisites produce compiled outputs', t => {
  const f = fixture(t), steps = ['i18n', 'scope-contracts', 'release-contracts'].map(id => f.step('server', { id, phase: 'preflight' }));
  f.identity.refresh(); const before = steps.map(step => f.identity(step));
  f.write('packages/agent/dist/index.js'); f.write('apps/server/dist/index.js');
  f.identity.refresh(); assert.deepEqual(steps.map(step => f.identity(step)), before);
});

test('workspace npm links preserve task independence while external package links retain their contents', { skip: process.platform === 'win32' }, t => {
  const f = fixture(t); f.write('node_modules/.package-lock.json', '{}\n');
  mkdirSync(join(f.directory, 'node_modules/@mote'), { recursive: true });
  symlinkSync(join(f.directory, 'apps/server'), join(f.directory, 'node_modules/@mote/server'));
  f.write('ignored-external-package/index.js'); f.write('.gitignore', 'node_modules/\nignored-external-package/\n');
  symlinkSync(join(f.directory, 'ignored-external-package'), join(f.directory, 'node_modules/generated-linked-package'));
  const before = f.key('agent');
  f.write('apps/server/test/entry.test.ts', 'generated unrelated test change\n'); assert.equal(f.key('agent'), before);
  f.write('ignored-external-package/index.js', 'generated installed package change\n'); assert.notEqual(f.key('agent'), before);
});

test('replacement of a PATH tool is detected without a PATH value change', { skip: process.platform === 'win32' }, t => {
  const f = fixture(t); f.write('tools/generated-tool', '#!/bin/sh\nexit 0\n'); chmodSync(join(f.directory, 'tools/generated-tool'), 0o755);
  f.write('.gitignore', 'tools/\nnode_modules/\n');
  f.env.PATH += delimiter + join(f.directory, 'tools');
  const before = f.key('server');
  f.write('tools/generated-tool', '#!/bin/sh\nexit 1\n'); assert.notEqual(f.key('server'), before);
});

test('tracked source symlink target changes are observed', { skip: process.platform === 'win32' }, t => {
  const f = fixture(t); f.write('ignored-target.ts'); f.write('.gitignore', 'ignored-target.ts\nnode_modules/\n');
  symlinkSync(join(f.directory, 'ignored-target.ts'), join(f.directory, 'apps/server/src/linked.ts'));
  const before = f.key('server'); f.write('ignored-target.ts', 'generated changed linked source\n'); assert.notEqual(f.key('server'), before);
});

test('source directory symlinks recheck nested files even when their top directory is unchanged', { skip: process.platform === 'win32' }, t => {
  const f = fixture(t); f.write('ignored-directory/nested/index.ts'); f.write('.gitignore', 'ignored-directory/\nnode_modules/\n');
  symlinkSync(join(f.directory, 'ignored-directory'), join(f.directory, 'apps/server/src/linked-directory'));
  const before = f.key('server'); f.write('ignored-directory/nested/index.ts', 'generated changed nested source\n');
  assert.notEqual(f.key('server'), before);
});

test('native/build/preflight/unknown tasks and arbitrary preload/live environments have no reusable key', t => {
  const f = fixture(t);
  for (const id of ['environment', 'build:@mote/server', 'android-unit', 'unregistered-task']) assert.equal(f.identity(f.step('server', { id })), undefined, id);
  for (const key of ['NODE_OPTIONS', 'NODE_PATH', 'MOTE_TEST_CODEX_BIN', 'MOTE_MEM0_TEST_EMBEDDING_CONFIG',
    'MOTE_HINDSIGHT_BACKUP_MODULE', 'GENERATED_PROCESS_ENTRY', 'npm_config_node_options']) {
    f.env[key] = 'generated-external-input'; assert.equal(f.key('server'), undefined, key); delete f.env[key];
  }
  f.env.PATH += delimiter + '.'; assert.equal(f.key('server'), undefined, 'relative PATH has no reviewed output closure');
});

test('declared root fixture tasks retain all workspace test inputs conservatively', t => {
  const f = fixture(t), step = f.step('server', { id: 'release-contracts' });
  f.identity.refresh(); const before = f.identity(step);
  f.write('apps/server/test/entry.test.ts', 'generated corrected suite entry\n');
  f.identity.refresh(); assert.notEqual(f.identity(step), before);
});
