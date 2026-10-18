import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { affectedChecks, affectedComponents, workspaceGraph } from './affected-components.mjs';

const graph = [
  { name: '@mote/server', path: 'apps/server', dependencies: ['@mote/agent', '@mote/shared'] },
  { name: '@mote/web', path: 'apps/web', dependencies: ['@mote/shared'] },
  { name: '@mote/desktop', path: 'apps/desktop', dependencies: ['@mote/diagnostics', '@mote/shared'] },
  { name: '@mote/diagnostics', path: 'packages/diagnostics', dependencies: ['@mote/shared'] },
  { name: '@mote/agent', path: 'packages/agent', dependencies: ['@mote/shared'] },
  { name: '@mote/shared', path: 'packages/shared', dependencies: [] },
];
const changed = (...paths) => affectedComponents(paths, graph);
const groups = result => ['central', 'desktop', 'android'].filter(group => result[group]);

test('individual clients and central plugins select only their build consumers', () => {
  assert.deepEqual(groups(changed('apps/android/app/src/main/java/Collector.kt')), ['android']);
  assert.deepEqual(groups(changed('apps/desktop/src/queue.ts')), ['desktop']);
  assert.deepEqual(groups(changed('apps/web/src/App.tsx')), ['central']);
  assert.deepEqual(groups(changed('plugins/source-packs/recorder/plugin.mjs')), ['central']);
});
test('shared workspace changes traverse actual npm dependencies', () => {
  assert.deepEqual(groups(changed('packages/agent/src/index.ts')), ['central']);
  assert.deepEqual(groups(changed('packages/diagnostics/src/index.ts')), ['desktop']);
  const actual = workspaceGraph(fileURLToPath(new URL('../../', import.meta.url)));
  assert.deepEqual(groups(affectedComponents(['packages/diagnostics/src/index.ts'], actual)), ['desktop']);
  assert.deepEqual(groups(changed('packages/shared/src/connection.ts')), ['central', 'desktop', 'android']);
  assert.equal(changed('packages/shared/src/connection.ts').protocol, true);
});
test('protocol and release infrastructure check every affected platform without publishing', () => {
  assert.deepEqual(changed('protocol/contract.json'), { central: true, desktop: true, android: true, protocol: true, tooling: false });
  assert.deepEqual(groups(changed('scripts/release/components.mjs')), ['central', 'desktop', 'android']);
  assert.deepEqual(groups(changed('.github/workflows/component-checks.yml')), ['central', 'desktop', 'android']);
  assert.deepEqual(groups(changed('package-lock.json')), ['central', 'desktop', 'android']);
  assert.deepEqual(groups(changed('new-platform-input/config.json')), ['central', 'desktop', 'android']);
});
test('documentation and historic notes do not require app builds', () => {
  for (const path of ['docs/releasing.md', 'README.md', 'README.zh-CN.md', 'README.en.md', 'AGENTS.md', 'THIRD_PARTY_NOTICES.md', 'protocol/README.md', 'adapters/ui/README.md', 'plugins/source-packs/memex-markdown/README.md', 'release/notes/android/0.0.77.md']) {
    assert.deepEqual(changed(path), { central: false, desktop: false, android: false, protocol: false, tooling: false }, path);
  }
  // Markdown runtime prompts inside a workspace remain build inputs.
  assert.deepEqual(groups(changed('packages/agent/src/prompt.md')), ['central']);
  assert.deepEqual(groups(changed('packages/agent/skills/memory-extraction/SKILL.md')), ['central']);
});
test('component release workflows check only their platform and release tools', () => {
  for (const component of ['central', 'desktop', 'android']) {
    const result = changed(`.github/workflows/release-${component}.yml`);
    assert.deepEqual(groups(result), [component]);
    assert.equal(result.tooling, true);
  }
  assert.deepEqual(groups(changed('.github/workflows/release-android.yml', 'apps/web/src/App.tsx')), ['central', 'android']);
});
test('check-selection infrastructure runs its own regressions without app builds', () => {
  for (const name of ['affected-components', 'check-affected', 'check-plan', 'check-driver', 'check-environment']) for (const suffix of ['.mjs', '.test.mjs']) {
    const result = changed(`scripts/release/${name}${suffix}`);
    assert.deepEqual(groups(result), []);
    assert.equal(result.tooling, true);
  }
});

const checks = (...paths) => affectedChecks(paths, graph);
const allWorkspaces = graph.map(workspace => workspace.name).sort();

const backupInputs = ['scripts/backup.ts', 'scripts/scoped-backup-schema.mjs', 'scripts/scoped-backup.mjs'];
test('reviewed instance backup inputs retain Server, Web and root backup obligations', () => {
  for (const path of backupInputs) {
    assert.deepEqual(checks(path), {
      workspaces: ['@mote/server', '@mote/web'], android: false, i18n: true, tooling: true, all: false,
      rootTests: path === 'scripts/backup.ts' ? ['backup', 'scripts-types'] : ['backup'],
    }, path);
    assert.deepEqual(groups(changed(path)), ['central'], path);
  }
  for (const path of ['scripts/backup-new.ts', 'scripts/scoped-backup-new.mjs', 'scripts/restore-instance.mjs',
    'scripts/profile-lib.mjs', 'new-location/scoped-backup.mjs', 'scripts/scoped-backup-schema.json', 'new-input.png']) {
    assert.deepEqual(checks(path).workspaces, allWorkspaces, path);
    assert.equal(checks(path).android, true, path);
    assert.equal(checks(path).all, true, path);
  }
});

test('backup ownership unions independent Kotlin, Desktop, shared and unknown inputs', () => {
  for (const helper of backupInputs) {
    const android = checks(helper, 'apps/android/app/src/main/java/Collector.kt');
    assert.equal(android.android, true);
    assert.deepEqual(android.workspaces, ['@mote/server', '@mote/web']);
    assert.equal(android.all, false);
    const desktop = checks(helper, 'apps/desktop/src/main.ts');
    assert.deepEqual(desktop.workspaces, ['@mote/desktop', '@mote/server', '@mote/web']);
    assert.equal(desktop.android, false);
    for (const path of ['packages/shared/src/connection.ts', 'protocol/contract.json', 'unknown-root.mjs']) {
      const mixed = checks(helper, path);
      assert.deepEqual(mixed.workspaces, allWorkspaces, `${helper}: ${path}`);
      assert.equal(mixed.android, true, path);
      assert.equal(mixed.all, true, path);
      assert.ok(mixed.rootTests.includes('backup'));
    }
  }
});

test('check workspaces follow npm consumers and the Server HTTP consumer without grouping unrelated Central code', () => {
  assert.deepEqual(checks('apps/web/src/App.tsx').workspaces, ['@mote/web']);
  assert.deepEqual(checks('apps/server/src/index.ts').workspaces, ['@mote/server', '@mote/web']);
  assert.deepEqual(checks('packages/agent/src/index.ts').workspaces, ['@mote/agent', '@mote/server', '@mote/web']);
  assert.deepEqual(checks('packages/diagnostics/src/index.ts').workspaces, ['@mote/desktop', '@mote/diagnostics']);
  assert.deepEqual(checks('apps/desktop/src/main.ts').workspaces, ['@mote/desktop']);
  const actual = workspaceGraph(fileURLToPath(new URL('../../', import.meta.url)));
  assert.deepEqual(affectedChecks(['apps/server/src/index.ts'], actual).workspaces, ['@mote/server', '@mote/web']);
  const cyclic = [...graph, {name: '@mote/cyclic', path: 'packages/cyclic', dependencies: ['@mote/cyclic', '@mote/web']}];
  assert.deepEqual(affectedChecks(['apps/web/src/App.tsx'], cyclic).workspaces, ['@mote/cyclic', '@mote/web']);
});

test('shared code, protocol and either English catalog retain full consumer suites and Android checks', () => {
  for (const path of ['packages/shared/src/connection.ts', 'packages/shared/src/i18n-en.ts', 'apps/android/app/src/main/assets/i18n-en.json', 'protocol/contract.json']) {
    const result = checks(path);
    assert.deepEqual(result.workspaces, allWorkspaces, path);
    assert.equal(result.android, true, path);
    assert.equal(result.i18n, true, path);
    assert.equal(result.all, true, path);
    assert.deepEqual(groups(changed(path)), ['central', 'desktop', 'android'], path);
  }
  assert.deepEqual(checks('apps/android/app/src/main/java/Collector.kt'), {
    workspaces: [], android: true, i18n: true, tooling: false, all: false, rootTests: [],
  });
});

test('reviewed root UI scripts have explicit consumers while unknown future script names stay broad', () => {
  for (const name of ['connections', 'content-storage', 'conversations', 'diagnostics', 'evidence-focus', 'feature-packs', 'i18n', 'login', 'markdown', 'metadata', 'navigation', 'operations', 'owner-questions', 'presentation', 'sessions-insights', 'sources', 'tasks-imports']) {
    const path = `scripts/test-web-${name}.cjs`;
    assert.deepEqual(checks(path).workspaces, ['@mote/web'], path);
    assert.deepEqual(groups(changed(path)), ['central'], path);
    assert.equal(checks(path).tooling, true, path);
  }
  for (const path of ['scripts/test-appearance-ui.cjs', 'scripts/test-background-ui.cjs', 'scripts/fixture-background.cjs', 'scripts/fixture-language.cjs', 'scripts/fixture-language-preload.cjs']) {
    assert.deepEqual(checks(path).workspaces, ['@mote/desktop', '@mote/web'], path);
    assert.deepEqual(groups(changed(path)), ['central', 'desktop'], path);
    assert.equal(checks(path).android, false, path);
  }
  for (const path of ['scripts/test-web-new.cjs', 'scripts/new-helper.mjs', 'package.json', 'package-lock.json', '.github/workflows/component-checks.yml']) {
    assert.deepEqual(checks(path).workspaces, allWorkspaces, path);
    assert.equal(checks(path).android, true, path);
    assert.equal(checks(path).all, true, path);
  }
});

test('fine selection preserves documentation exceptions, executable scope inventory and infrastructure-only regressions', () => {
  assert.deepEqual(checks('README.md', 'docs/development.md'), {
    workspaces: [], android: false, i18n: false, tooling: false, all: false, rootTests: [],
  });
  assert.deepEqual(checks('docs/design/scope-inventory.json'), {
    workspaces: [], android: false, i18n: false, tooling: true, all: false, rootTests: ['scope'],
  });
  assert.deepEqual(checks('scripts/check-scope-contracts.mjs').workspaces, ['@mote/server', '@mote/web']);
  assert.deepEqual(checks('scripts/check-scope-contracts.mjs').rootTests, ['scope']);
  for (const name of ['affected-components', 'check-affected', 'check-plan', 'check-driver', 'check-environment']) for (const suffix of ['.mjs', '.test.mjs']) {
    assert.deepEqual(checks(`scripts/release/${name}${suffix}`), {
      workspaces: [], android: false, i18n: false, tooling: true, all: false, rootTests: [],
    });
  }
});

test('mixed ownership unions workspace, platform and root obligations without widening known inputs', () => {
  const result = checks('apps/web/src/App.tsx', 'packages/diagnostics/src/index.ts', 'docs/design/scope-inventory.json', 'apps/android/app/src/main/java/Collector.kt');
  assert.deepEqual(result, {
    workspaces: ['@mote/desktop', '@mote/diagnostics', '@mote/web'],
    android: true, i18n: true, tooling: true, all: false, rootTests: ['scope'],
  });
  assert.deepEqual(checks('apps/web/src/App.tsx', 'new-unknown-input').workspaces, allWorkspaces);
});
