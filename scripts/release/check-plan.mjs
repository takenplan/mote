import { readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { androidEnvironment } from './check-environment.mjs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { workspaceGraph } from './affected-components.mjs';

const script = name => fileURLToPath(new URL(name, import.meta.url));
export const quickReleaseTests = new Set([
  'affected-components.test.mjs', 'check-affected.test.mjs', 'check-plan.test.mjs',
  'check-driver.test.mjs', 'check-environment.test.mjs', 'check-inputs.test.mjs', 'profile-health.test.mjs',
  'components.test.mjs', 'dev-assets.test.mjs',
]);
const serverReleaseTests = new Set([
  'dev-server.test.mjs', 'dev-log-retention.test.mjs', 'profile-config.test.mjs',
  'profile-proxy.test.mjs', 'storage-owner.test.mjs',
]);
const infrastructureTests = new Set([
  'affected-components.test.mjs', 'check-affected.test.mjs', 'check-plan.test.mjs',
  'check-driver.test.mjs', 'check-environment.test.mjs', 'check-inputs.test.mjs',
]);

export function fixedChecks(component, graph = workspaceGraph()) {
  const names = graph.map(entry => entry.name);
  const choices = {
    typescript: names, all: names,
    central: ['@mote/shared', '@mote/agent', '@mote/server', '@mote/web'],
    desktop: ['@mote/shared', '@mote/diagnostics', '@mote/desktop'],
    tooling: [], android: [], web: ['@mote/web'], server: ['@mote/server', '@mote/web'],
  };
  if (!Object.hasOwn(choices, component)) throw Error(`Unknown check component: ${component}`);
  return {
    workspaces: choices[component].filter(name => names.includes(name)),
    android: component === 'android' || component === 'all', i18n: component !== 'tooling',
    tooling: component === 'tooling', all: component === 'all' || component === 'typescript', rootTests: [],
  };
}

/** One ordered task set. Build prerequisites and consumer suites are distinct:
 * Web fixtures use real Server code and the compiled Agent without requiring
 * the unrelated complete Server suite for every Web presentation edit. */
export function checkPlan(selection, releaseTests, { directory = process.cwd(), graph = workspaceGraph(directory) } = {}) {
  const selected = new Set(selection.workspaces ?? []);
  const server = selected.has('@mote/server');
  const web = selected.has('@mote/web');
  const desktop = selected.has('@mote/desktop');
  const applications = selected.size > 0 || selection.android || selection.contracts;
  const scope = server || selection.rootTests?.includes('scope');
  const scriptTypes = selection.all || selection.rootTests?.includes('scripts-types');
  if (!applications && !selection.tooling && !scope) return [];
  const steps = new Map();
  const add = (id, phase, command, args, cwd) => {
    if (!steps.has(id)) steps.set(id, { id, phase, command, args, ...(cwd ? { cwd } : {}) });
  };
  const node = (id, phase, args, cwd) => add(id, phase, process.execPath, args, cwd);
  const npm = (id, phase, args) => add(id, phase, 'npm', ['run', ...args]);

  const builds = new Set();
  const byName = new Map(graph.map(entry => [entry.name, entry]));
  const includeBuild = name => {
    if (builds.has(name) || !byName.has(name)) return;
    builds.add(name);
    for (const dependency of byName.get(name).dependencies) includeBuild(dependency);
  };
  for (const name of selected) includeBuild(name);
  if (applications && byName.has('@mote/shared')) includeBuild('@mote/shared');
  // Desktop source-CLI fixtures start the real Server in a native child, whose
  // package imports require the compiled Agent even in a Desktop-only plan.
  if (web || server || desktop || selection.android) includeBuild('@mote/agent');
  // The complete scripts tsconfig imports Desktop contracts, whose diagnostics
  // type is resolved from this package's emitted declarations.
  if (scriptTypes) includeBuild('@mote/diagnostics');
  // Desktop typechecks/tests use source; its build would compile native helpers.
  builds.delete('@mote/desktop');

  const environment = [...new Set([...builds, ...selected, ...(web || selection.android ? ['@mote/server'] : [])])].sort();
  node('environment', 'preflight', [script('check-environment.mjs'),
    ...environment.flatMap(name => ['--workspace', name]), ...(selection.android ? ['--android'] : []), ...(!applications ? ['--node-only'] : [])]);
  if (selection.i18n) node('i18n', 'preflight', ['scripts/check-i18n.mjs']);
  if (scope) node('scope-contracts', 'preflight', ['scripts/check-scope-contracts.mjs']);

  const release = releaseTests.filter(path => {
    const name = path.split('/').at(-1);
    if (!applications) return infrastructureTests.has(name);
    return !serverReleaseTests.has(name) || server || selection.all;
  });
  const early = release.filter(path => quickReleaseTests.has(path.split('/').at(-1)));
  const late = release.filter(path => !quickReleaseTests.has(path.split('/').at(-1)));
  if (early.length) node('release-contracts', 'preflight', ['--test', ...early]);

  const built = new Set();
  const build = name => {
    if (built.has(name) || !builds.has(name)) return;
    built.add(name);
    for (const dependency of byName.get(name)?.dependencies ?? []) build(dependency);
    npm(`build:${name}`, 'build', ['build', '-w', name]);
  };
  for (const name of builds) build(name);
  // Emitting tsc builds already check exactly the workspace's tsconfig. Avoid
  // running tsc --noEmit a second time against the same unchanged inputs.
  for (const name of selected) if (!built.has(name)) npm(`typecheck:${name}`, 'typecheck', ['typecheck', '-w', name]);
  if (scriptTypes) node('typecheck:scripts', 'typecheck', ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.scripts.json']);

  const tested = new Set(selected);
  if (applications && byName.has('@mote/shared')) tested.add('@mote/shared');
  for (const name of tested) {
    if (name === '@mote/agent') {
      // npm test for Agent includes an implicit build. The task above already
      // built it once, while standalone npm test retains its existing behavior.
      const cwd = byName.get(name).path;
      const files = readdirSync(join(directory, cwd, 'test')).filter(file => file.endsWith('.test.mjs')).sort();
      node(`test:${name}`, 'test', ['--test', ...files.map(file => `test/${file}`)], cwd);
    } else if (name === '@mote/server') {
      const path = byName.get(name).path;
      const files = existsSync(join(directory, path, 'test'))
        ? readdirSync(join(directory, path, 'test')).filter(file => file.endsWith('.test.ts')).sort() : [];
      const groups = new Map();
      for (const file of files) {
        const bucket = createHash('sha256').update(file).digest()[0] % 16;
        if (!groups.has(bucket)) groups.set(bucket, []);
        groups.get(bucket).push(file);
      }
      if (!groups.size) npm(`test:${name}`, 'test', ['test', '-w', name]); // missing inventory fails through the existing launcher
      for (const [bucket, entries] of [...groups].sort(([a], [b]) => a - b)) {
        const id = bucket === 0 ? `test:${name}` : `test:${name}#${bucket}`;
        node(id, 'test', ['test/run.mjs', ...entries.flatMap(file => ['--file', `test/${file}`])], path);
        steps.get(id).testFiles = entries.map(file => `${path}/test/${file}`);
      }
    } else npm(`test:${name}`, 'test', ['test', '-w', name]);
  }
  if (late.length) node('release-integration', 'integration', ['--test', ...late]);
  if (selection.all || selection.rootTests?.includes('backup')) {
    node('root-tests', 'integration', ['--test',
      ...(selection.all ? ['scripts/media-workers.test.mjs'] : []), 'scripts/security-tests.mjs',
      ...(selection.all ? ['scripts/reset-mvp-vault.test.mjs', 'scripts/journey-network-proxy.test.mjs'] : [])]);
    // Keep the existing root test batch unchanged; the driver runs update/rollback
    // afterward rather than adding another concurrently eligible test file.
    node('backup-update-tests', 'integration', ['--test', 'scripts/update-tests.mjs']);
  }
  if (selection.all) {
    node('client-tests', 'integration', ['--import', 'tsx', '--test', 'scripts/client.test.ts']);
  }
  if (server || selection.all) node('central-runner', 'integration', ['scripts/test-central-runner.mjs']);
  if (selection.android) add('android-unit', 'native', 'apps/android/gradlew',
    ['-p', 'apps/android', '--no-daemon', ':app:testDebugUnitTest']);
  const buildIds = [...steps.keys()].filter(id => id.startsWith('build:'));
  for (const step of steps.values()) {
    if (step.phase === 'preflight') step.needs = [];
    else if (step.phase === 'build') step.needs = ['environment',
      ...(byName.get(step.id.slice('build:'.length))?.dependencies ?? []).map(name => `build:${name}`).filter(id => steps.has(id))];
    else if (step.id === 'android-unit') {
      step.needs = ['environment', ...buildIds.filter(id => ['build:@mote/shared', 'build:@mote/agent'].includes(id))];
    } else if (step.id.startsWith('test:') || step.id.startsWith('typecheck:@mote/')) {
      const name = step.id.slice(step.id.indexOf(':') + 1).split('#')[0], closure = new Set();
      const include = name => {
        if (closure.has(name)) return;
        closure.add(name);
        for (const dependency of byName.get(name)?.dependencies ?? []) include(dependency);
      };
      include(name);
      if (['@mote/web', '@mote/desktop'].includes(name)) { include('@mote/server'); include('@mote/agent'); }
      step.needs = ['environment', ...buildIds.filter(id => closure.has(id.slice('build:'.length)))];
    } else step.needs = ['environment', ...buildIds];
  }
  if (selection.android) {
    // One resolved SDK is used by preflight and the actual Gradle command.
    const env = androidEnvironment(directory);
    steps.get('environment').env = env;
    steps.get('android-unit').env = env;
  }
  return [...steps.values()];
}
