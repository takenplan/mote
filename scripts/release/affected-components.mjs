import { appendFileSync, readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const groups = ['central', 'desktop', 'android'];
const roots = { central: ['@mote/server', '@mote/web'], desktop: ['@mote/desktop'], android: [] };

// These are reviewed build/test inputs, not semantic dispatch. New or renamed
// scripts stay conservative until their consumers are explicitly declared here.
const webFixtures = [
  'connections', 'content-storage', 'conversations', 'diagnostics', 'evidence-focus',
  'feature-packs', 'i18n', 'login', 'markdown', 'metadata', 'navigation', 'operations',
  'owner-questions', 'presentation', 'sessions-insights', 'sources', 'tasks-imports',
].map(name => `scripts/test-web-${name}.cjs`);
const rootScriptOwners = new Map([
  ...webFixtures.map(path => [path, ['@mote/web']]),
  ...[
    'scripts/test-appearance-ui.cjs', 'scripts/test-background-ui.cjs',
    'scripts/fixture-background.cjs', 'scripts/fixture-language.cjs',
    'scripts/fixture-language-preload.cjs',
  ].map(path => [path, ['@mote/web', '@mote/desktop']]),
]);

export function workspaceGraph(directory = '.') {
  return ['apps', 'packages'].flatMap(parent => readdirSync(resolve(directory, parent), { withFileTypes: true })
    .filter(entry => entry.isDirectory()).flatMap(entry => {
      const path = `${parent}/${entry.name}`;
      try {
        const pkg = JSON.parse(readFileSync(resolve(directory, path, 'package.json'), 'utf8'));
        return [{ path, name: pkg.name, dependencies: Object.keys({ ...pkg.dependencies, ...pkg.optionalDependencies, ...pkg.devDependencies }) }];
      } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
    }));
}

function inputSelection(paths, graph) {
  const result = { central: false, desktop: false, android: false, protocol: false, tooling: false };
  const workspaces = new Set();
  const rootTests = new Set();
  let all = false;
  const mark = selected => selected.forEach(group => { result[group] = true; });
  const byName = new Map(graph.map(workspace => [workspace.name, workspace]));
  function uses(name, dependency, seen = new Set()) {
    if (name === dependency) return true;
    if (seen.has(name)) return false;
    seen.add(name);
    return (byName.get(name)?.dependencies ?? []).some(child => uses(child, dependency, seen));
  }
  function selectWorkspace(name) {
    mark(groups.filter(group => roots[group].some(root => uses(root, name))));
    for (const workspace of graph) {
      // Web consumes the Server HTTP surface even without an npm dependency.
      if (uses(workspace.name, name) || workspace.name === '@mote/web' && uses('@mote/server', name)) {
        workspaces.add(workspace.name);
      }
    }
    if (name === '@mote/shared') { result.android = true; result.protocol = true; all = true; }
  }
  function selectGroup(group) {
    mark([group]);
    for (const workspace of graph) {
      if (roots[group].some(root => uses(root, workspace.name))) workspaces.add(workspace.name);
    }
  }
  function selectAll() {
    mark(groups);
    for (const workspace of graph) workspaces.add(workspace.name);
    all = true;
  }
  for (const path of paths) {
    // This JSON lives with design records but is executed by the scope checker.
    if (path === 'docs/design/scope-inventory.json') {
      rootTests.add('scope'); result.tooling = true; continue;
    }
    if (path.startsWith('docs/') || path.startsWith('release/notes/') || /^(?:README(?:\.[\w-]+)?|AGENTS|THIRD_PARTY_NOTICES)\.md$/.test(path)
      || ['protocol/README.md', 'adapters/ui/README.md', 'plugins/source-packs/memex-markdown/README.md'].includes(path)) continue;
    if (path.startsWith('protocol/')) { selectAll(); result.protocol = true; continue; }
    const workflow = /^\.github\/workflows\/release-(central|desktop|android)\.yml$/.exec(path);
    if (workflow) { selectGroup(workflow[1]); result.tooling = true; continue; }
    if (/^scripts\/release\/(?:affected-components|check-affected|check-plan|check-driver|check-environment)(?:\.test)?\.mjs$/.test(path)) {
      result.tooling = true; continue;
    }
    if (path.startsWith('scripts/release/') || path.startsWith('.github/workflows/')) {
      selectAll(); result.tooling = true; continue;
    }
    if (path === 'apps/android/app/src/main/assets/i18n-en.json') { selectWorkspace('@mote/shared'); continue; }
    if (path.startsWith('apps/android/')) { mark(['android']); continue; }
    const workspace = graph.find(entry => path.startsWith(entry.path + '/'));
    if (workspace) {
      selectWorkspace(workspace.name);
      continue;
    }
    if (rootScriptOwners.has(path)) {
      for (const owner of rootScriptOwners.get(path)) selectWorkspace(owner);
      result.tooling = true;
      continue;
    }
    if (path === 'scripts/check-scope-contracts.mjs') {
      selectWorkspace('@mote/server'); rootTests.add('scope'); result.tooling = true; continue;
    }
    if (path.startsWith('plugins/') || path.startsWith('deploy/') || path.startsWith('Dockerfile') || path.startsWith('compose.')) { selectGroup('central'); continue; }
    if (path.startsWith('adapters/') || path.startsWith('licenses/')) { selectGroup('desktop'); mark(['android']); continue; }
    if (path.startsWith('models/') || path.startsWith('vendor/')) { selectAll(); continue; }
    // Root tooling/configuration and unknown inputs conservatively check every consumer.
    selectAll();
    result.tooling = true;
  }
  return { components: result, workspaces: [...workspaces].sort(), all, rootTests: [...rootTests].sort() };
}

/** Coarse platform projection for CI; this never chooses releases. */
export function affectedComponents(paths, graph = workspaceGraph()) {
  return inputSelection(paths, graph).components;
}

/** Check ownership is finer than the Central/Desktop/Android release grouping. */
export function affectedChecks(paths, graph = workspaceGraph()) {
  const { components, workspaces, all, rootTests } = inputSelection(paths, graph);
  return {
    workspaces,
    android: components.android,
    i18n: workspaces.length > 0 || components.android,
    tooling: components.tooling,
    all,
    // Other common root regression obligations belong to the check planner.
    rootTests,
  };
}

/** Local checks include all working changes; CI's explicit head checks only committed inputs. */
export function changedPaths({ base = 'origin/main', head, directory = '.', workingTree = head === undefined } = {}) {
  const git = args => execFileSync('git', args, { cwd: directory, encoding: 'utf8' });
  const revision = ref => git(['rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`]).trim();
  const target = revision(head ?? 'HEAD');
  const ancestor = git(['merge-base', revision(base), target]).trim();
  const paths = git(['diff', '--no-renames', '--name-only', '-z', ancestor, target, '--']).split('\0');
  if (workingTree) {
    paths.push(...git(['diff', '--cached', '--no-renames', '--name-only', '-z', 'HEAD', '--']).split('\0'));
    paths.push(...git(['diff', '--no-renames', '--name-only', '-z', '--']).split('\0'));
    paths.push(...git(['ls-files', '--others', '--exclude-standard', '-z']).split('\0'));
  }
  return [...new Set(paths.filter(Boolean))];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const option = name => args[args.indexOf(name) + 1];
  let result;
  const base = args.includes('--base') ? option('--base') : 'origin/main';
  if (args.includes('--all') || /^0{40}$/.test(base)) result = Object.fromEntries(Object.keys(affectedComponents([])).map(key => [key, true]));
  else {
    const paths = changedPaths({ base, head: args.includes('--head') ? option('--head') : undefined });
    result = affectedComponents(paths);
  }
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(result).map(([key, value]) => `${key}=${value}\n`).join(''));
  console.log(JSON.stringify(result));
}
