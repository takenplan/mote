import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { affectedChecks, workspaceGraph } from './affected-components.mjs';
import { checkPlan, fixedChecks } from './check-plan.mjs';

const graph = workspaceGraph();
const release = readdirSync('scripts/release').filter(name => name.endsWith('.test.mjs')).sort().map(name => `scripts/release/${name}`);
const plan = (...paths) => checkPlan(affectedChecks(paths, graph), release);
const ids = steps => steps.map(step => step.id);

test('Web-only plans retain real fixture prerequisites without the full Server suite', () => {
  const steps = plan('apps/web/src/App.tsx'), names = ids(steps);
  for (const name of ['build:@mote/shared', 'build:@mote/agent', 'build:@mote/web', 'test:@mote/web', 'test:@mote/shared']) assert.ok(names.includes(name), name);
  assert.ok(!names.includes('test:@mote/server'));
  assert.ok(!names.includes('build:@mote/server'));
  assert.ok(steps[0].args.includes('@mote/server'), 'Web tests still need Server dependencies and a native SQLite ABI probe');
  assert.ok(!steps.some(step => step.args.includes('scripts/release/dev-server.test.mjs')));
});

test('Desktop-only plans preserve the cold source-CLI Agent prerequisite without adding its suite', () => {
  for (const steps of [plan('apps/desktop/src/config.ts'), checkPlan(fixedChecks('desktop'), release)]) {
    const names = ids(steps);
    assert.equal(names.filter(id => id === 'build:@mote/agent').length, 1);
    assert.ok(names.indexOf('build:@mote/agent') < names.indexOf('test:@mote/desktop'));
    for (const id of ['test:@mote/agent', 'test:@mote/server', 'build:@mote/server', 'central-runner']) assert.ok(!names.includes(id), id);
  }
});

test('mixed Central/Desktop checks build and test shared prerequisites once', () => {
  const steps = plan('apps/server/src/app.ts', 'apps/desktop/src/main.ts'), names = ids(steps);
  assert.equal(new Set(names).size, names.length);
  for (const name of ['shared', 'agent', 'server', 'web', 'diagnostics']) assert.equal(names.filter(id => id === `build:@mote/${name}`).length, 1, name);
  for (const name of ['shared', 'server', 'web', 'desktop']) assert.equal(names.filter(id => id === `test:@mote/${name}`).length, 1, name);
  const files = steps.flatMap(step => step.args.filter(arg => release.includes(arg)));
  assert.deepEqual(files.toSorted(), release.toSorted(), 'the complete original release suite remains present for Central');
  assert.equal(new Set(files).size, files.length);
});

test('cheap guards precede builds and runtime release integrations', () => {
  const steps = plan('packages/shared/src/connection.ts');
  const firstBuild = steps.findIndex(step => step.phase === 'build');
  for (const id of ['environment', 'i18n', 'scope-contracts', 'release-contracts']) assert.ok(steps.findIndex(step => step.id === id) < firstBuild, id);
  assert.ok(steps.findIndex(step => step.id === 'release-integration') > firstBuild);
  assert.ok(steps.find(step => step.id === 'release-integration').args.includes('scripts/release/dev-server.test.mjs'));
});

test('shared, translations, protocol and unknown inputs retain all full consumer suites and root checks', () => {
  for (const path of ['packages/shared/src/i18n-en.ts', 'apps/android/app/src/main/assets/i18n-en.json', 'protocol/wire.json', 'package-lock.json', 'unmapped-input.json']) {
    const names = ids(plan(path));
    for (const workspace of graph) assert.ok(names.includes(`test:${workspace.name}`), `${path}: ${workspace.name}`);
    for (const id of ['android-unit', 'typecheck:scripts', 'root-tests', 'client-tests', 'central-runner']) assert.ok(names.includes(id), `${path}: ${id}`);
  }
});

test('infrastructure-only and scope-inventory changes cannot silently lose their regressions', () => {
  const steps = plan('scripts/release/check-driver.mjs');
  assert.ok(steps.every(step => step.phase === 'preflight'));
  assert.ok(steps.some(step => step.args.includes('scripts/release/check-driver.test.mjs')));
  assert.ok(!steps.some(step => step.args.includes('scripts/release/dev-server.test.mjs')));
  const scope = plan('docs/design/scope-inventory.json');
  assert.ok(ids(scope).includes('scope-contracts'));
  assert.ok(!scope.some(step => step.phase === 'build'));
  assert.deepEqual(plan('docs/development.md'), []);
});

test('Agent uses the already-built test entry, while standalone npm test still builds', () => {
  const steps = plan('packages/agent/src/index.ts');
  const entry = steps.find(step => step.id === 'test:@mote/agent');
  assert.equal(entry.command, process.execPath);
  assert.equal(entry.cwd, 'packages/agent');
  assert.ok(entry.args.some(arg => arg.endsWith('agent.test.mjs')));
  assert.equal(steps.filter(step => step.id === 'build:@mote/agent').length, 1);
  assert.match(JSON.parse(readFileSync('packages/agent/package.json', 'utf8')).scripts.test, /npm run build/);
});

test('fixed aliases retain explicit full obligations and CI uses the same plan', () => {
  const local = ids(checkPlan(fixedChecks('typescript'), release));
  for (const name of graph) assert.ok(local.includes(`test:${name.name}`));
  assert.ok(!local.includes('android-unit'));
  const workflow = readFileSync('.github/workflows/component-checks.yml', 'utf8');
  assert.match(workflow, /check:affected -- --base "\$CHECK_BASE" --head "\$CHECK_HEAD" --typescript-only/);
  assert.match(workflow, /needs: \[affected, typescript-and-tools\]/);
});
