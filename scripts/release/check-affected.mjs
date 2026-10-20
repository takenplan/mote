import { readdirSync, readFileSync, lstatSync, readlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { affectedChecks, affectedComponents, changedPaths, workspaceGraph } from './affected-components.mjs';
import { checkPlan, fixedChecks } from './check-plan.mjs';
import { runChecks } from './check-driver.mjs';
import { createTaskIdentity, isCheckDocumentation } from './check-inputs.mjs';

export { checkPlan, runChecks };

/** Ignored build outputs and private fixture data do not change source identity.
 * No source text, credentials or command output is written into a receipt. */
export function sourceIdentity(directory = process.cwd(), fileDigests = new Map()) {
  const git = args => execFileSync('git', args, { cwd: directory, encoding: 'utf8' });
  const hash = createHash('sha256');
  hash.update(JSON.stringify({ node: process.versions.node, abi: process.versions.modules, platform: process.platform, arch: process.arch,
    path: process.env.PATH, java: process.env.JAVA_HOME, android: process.env.ANDROID_HOME, androidRoot: process.env.ANDROID_SDK_ROOT }));
  const installed = resolve(directory, 'node_modules/.package-lock.json');
  try { hash.update(readFileSync(installed)); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const paths = [...new Set(git(['ls-files', '-z', '--cached', '--others', '--exclude-standard']).split('\0').filter(Boolean))].sort();
  for (const path of paths) {
    // Ordinary review documents are not executable check inputs. Keep the
    // scope inventory, which is read by the scope-contracts task.
    if (isCheckDocumentation(path)) continue;
    hash.update(path).update('\0');
    try {
      const absolute = resolve(directory, path), stat = lstatSync(absolute, { bigint: true });
      const signature = [stat.dev, stat.ino, stat.size, stat.mode, stat.mtimeNs, stat.ctimeNs].join(':');
      let cached = fileDigests.get(path);
      if (cached?.signature !== signature) {
        const content = createHash('sha256');
        if (stat.isSymbolicLink()) content.update('symlink:').update(readlinkSync(absolute));
        else if (stat.isFile()) content.update(String(stat.mode & 0o111n)).update(readFileSync(absolute));
        else content.update('non-file');
        cached = { signature, digest: content.digest('hex') };
        fileDigests.set(path, cached);
      }
      hash.update(cached.digest);
    } catch (error) { if (error.code === 'ENOENT') hash.update('deleted'); else throw error; }
    hash.update('\0');
  }
  return hash.digest('hex');
}

export function parseArguments(args) {
  const options = {}; let component; let all = false; let dryRun = false; let typescriptOnly = false;
  const reuseReceiptPaths = [];
  for (let i = 0; i < args.length; i++) {
    const value = args[i];
    if (value === '--reuse' && args[i + 1] && !args[i + 1].startsWith('--')) reuseReceiptPaths.push(args[++i]);
    else if (['--base', '--head', '--component'].includes(value) && args[i + 1] && !args[i + 1].startsWith('--')) {
      if (value === '--component') component = args[++i]; else options[value.slice(2)] = args[++i];
    } else if (value === '--all') all = true;
    else if (value === '--dry-run') dryRun = true;
    else if (value === '--typescript-only') typescriptOnly = true;
    else throw Error(`Invalid argument: ${value}`);
  }
  if ((component || all) && Object.keys(options).length || component && all) throw Error('Choose a fixed component/all check or a Git diff, not both.');
  return { options, component, all, dryRun, typescriptOnly, reuseReceiptPaths };
}

export async function main(args = process.argv.slice(2), directory = process.cwd()) {
  const { options, component, all, dryRun, typescriptOnly, reuseReceiptPaths } = parseArguments(args);
  // Selection and execution must refer to the same input, including the async
  // interval while acquiring the shared repository lock.
  const fileDigests = new Map();
  const plannedIdentity = dryRun ? undefined : sourceIdentity(directory, fileDigests);
  const graph = workspaceGraph(directory);
  const broad = all || /^0{40}$/.test(options.base ?? '');
  const paths = component || broad ? [] : changedPaths({ ...options, directory });
  const selection = component || broad ? fixedChecks(component ?? 'all', graph) : affectedChecks(paths, graph);
  const affected = component || broad ? {
    central: selection.workspaces.some(name => name === '@mote/server' || name === '@mote/web'),
    desktop: selection.workspaces.includes('@mote/desktop'), android: selection.android,
    protocol: broad, tooling: broad,
  } : affectedComponents(paths, graph);
  if (typescriptOnly) {
    selection.contracts = selection.android;
    selection.android = false;
  }
  const tests = readdirSync(resolve(directory, 'scripts/release')).filter(file => file.endsWith('.test.mjs')).sort()
    .map(file => `scripts/release/${file}`);
  const plan = checkPlan(selection, tests, { directory, graph });
  console.log(JSON.stringify({ affected, selection, checks: plan }, null, 2));
  if (!plan.length) {
    console.log('Documentation-only or no changed inputs: review formatting, grammar, links and rendering.');
    return 0;
  }
  if (dryRun) return 0;
  return runChecks(plan, { directory, expectedInputIdentity: plannedIdentity,
    taskIdentity: createTaskIdentity({ directory, graph }), reuseReceiptPaths,
    inputIdentity: () => sourceIdentity(directory, fileDigests) });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = await main(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
