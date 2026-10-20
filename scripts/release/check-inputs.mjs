import { accessSync, constants, lstatSync, readFileSync, readdirSync, readlinkSync, realpathSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { arch, hostname, platform, release, version } from 'node:os';
import { basename, delimiter, dirname, isAbsolute, join, resolve } from 'node:path';
import { workspaceGraph } from './affected-components.mjs';

const reusableRootTasks = new Set(['i18n', 'scope-contracts', 'release-contracts', 'release-integration',
  'typecheck:scripts', 'root-tests', 'client-tests', 'central-runner']);
const sourceOnlyTasks = new Set(['i18n', 'scope-contracts', 'release-contracts']);
const signature = stat => [stat.dev, stat.ino, stat.size, stat.mode, stat.mtimeNs, stat.ctimeNs].join(':');

/** Invocation tracing belongs to the caller, not the fixture process. Removing
 * it from execution as well as the key keeps the effective environment exact. */
export function checkExecutionEnvironment(env = process.env) {
  const inherited = { ...env, PATH: [dirname(process.execPath), env.PATH ?? ''].join(delimiter) };
  delete inherited.CODEX_TOOL_CALL_ID;
  return inherited;
}

/** Ordinary prose is not an executable input. The scope inventory is executed. */
export function isCheckDocumentation(path) {
  return path !== 'docs/design/scope-inventory.json' && (path.startsWith('docs/') || path.startsWith('release/notes/')
    || /^(?:README(?:\.[\w-]+)?|AGENTS|THIRD_PARTY_NOTICES)\.md$/.test(path)
    || ['protocol/README.md', 'adapters/ui/README.md', 'plugins/source-packs/memex-markdown/README.md'].includes(path));
}

/** A top-level suite entry belongs to its own task. Helpers and fixtures retain
 * their consumers, including fixtures placed below test/. */
const suiteEntry = (path, workspace) => new RegExp(`^${workspace.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/test/[^/]+\\.test\\.(?:ts|mjs)$`).test(path);

/** Local, same-checkout task inputs. Only declared fixture suites/typechecks are
 * reusable; builds/environment/native and unknown commands always execute.
 *
 * File bytes identify repository inputs. Installed packages and host executable
 * discovery use complete stat snapshots (including ctime, inode and symlink
 * targets); this deliberately rejects reuse after a reinstall even if the lock
 * is unchanged. Call refresh() at each execution checkpoint: it snapshots the
 * path inventory, environment and dependencies once for all task keys. Selected
 * source file metadata/bytes are checked on each call. No environment values,
 * source text or credentials are returned.
 */
export function createTaskIdentity({ directory = process.cwd(), graph = workspaceGraph(directory), env } = {}) {
  directory = resolve(directory);
  const byName = new Map(graph.map(workspace => [workspace.name, workspace]));
  const workspaceTargets = new Set(graph.map(workspace => {
    try { return realpathSync(resolve(directory, workspace.path)); } catch { return resolve(directory, workspace.path); }
  }));
  const fileDigests = new Map();
  const git = args => execFileSync('git', args, { cwd: directory, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  function fileIdentity(path) {
    try {
      const stat = lstatSync(path, { bigint: true });
      let target, stamp = signature(stat);
      if (stat.isSymbolicLink()) {
        try { target = realpathSync(path); stamp += `:${target}:${signature(lstatSync(target, { bigint: true }))}`; }
        catch (error) { if (!['ENOENT', 'ENOTDIR', 'ELOOP'].includes(error.code)) throw error; stamp += ':unresolved'; }
      }
      let cached = fileDigests.get(path);
      if (cached?.signature !== stamp || target && lstatSync(target).isDirectory()) {
        const hash = createHash('sha256').update(String(stat.mode & 0o111n));
        if (stat.isSymbolicLink()) {
          hash.update('symlink:').update(readlinkSync(path));
          if (target && lstatSync(target).isFile()) hash.update(target).update('\0').update(fileIdentity(target));
          else if (target) snapshotTree(hash, target);
          else hash.update('unresolved');
        }
        else if (stat.isFile()) hash.update(readFileSync(path));
        else hash.update('non-file');
        cached = { signature: stamp, digest: hash.digest('hex') }; fileDigests.set(path, cached);
      }
      return cached.digest;
    } catch (error) { if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return 'missing'; throw error; }
  }
  function snapshotTree(hash, path, visited = new Set(), modulesRoot = basename(path) === 'node_modules', normalizeEmptyRoot = true) {
    hash.update(path).update('\0');
    let stat;
    try { stat = lstatSync(path, { bigint: true }); }
    catch (error) { if (error.code === 'ENOENT' || error.code === 'ENOTDIR') { hash.update(modulesRoot && normalizeEmptyRoot ? 'no-installed-inputs\0' : 'missing\0'); return; } throw error; }
    // First-run Vitest can create an otherwise absent workspace install root.
    // Only actual readable directories containing no installed inputs are
    // equivalent to missing roots. Links and their targets retain identity.
    const entries = stat.isDirectory() && modulesRoot
      ? readdirSync(path).sort().filter(entry => !['.vite', '.vite-temp'].includes(entry)) : undefined;
    if (normalizeEmptyRoot && entries?.length === 0) { hash.update('no-installed-inputs\0'); return; }
    // Directory mtimes/size also change when reviewed output caches are
    // created. Included sorted children detect actual input additions/removals.
    hash.update(stat.isDirectory() ? [stat.dev, stat.ino, stat.mode].join(':') : signature(stat)).update('\0');
    if (stat.isSymbolicLink()) {
      hash.update(readlinkSync(path)).update('\0');
      let target;
      try { target = realpathSync(path); }
      catch (error) { if (['ENOENT', 'ENOTDIR', 'ELOOP'].includes(error.code)) { hash.update('unresolved\0'); return; } throw error; }
      // npm workspace links are represented by their selected source closure.
      // Following them here would invalidate every task on any workspace edit.
      if (!workspaceTargets.has(target)) snapshotTree(hash, target, visited, modulesRoot, false);
    } else if (stat.isDirectory()) {
      const key = `${stat.dev}:${stat.ino}`;
      if (visited.has(key)) { hash.update('visited\0'); return; }
      visited.add(key);
      // Vite/Vitest output caches were filtered above; source/config/package
      // inputs and all unreviewed entries remain in the key.
      for (const entry of entries ?? readdirSync(path).sort()) {
        snapshotTree(hash, join(path, entry), visited);
      }
    }
  }
  function commandPath(command, cwd, effectivePath) {
    if (isAbsolute(command) || command.includes('/') || command.includes('\\')) return resolve(cwd, command);
    for (const entry of effectivePath.split(delimiter)) {
      const candidate = resolve(cwd, entry || '.', command);
      try { accessSync(candidate, constants.X_OK); if (lstatSync(candidate).isFile() || lstatSync(candidate).isSymbolicLink()) return candidate; }
      catch (error) { if (!['ENOENT', 'ENOTDIR', 'EACCES'].includes(error.code)) throw error; }
    }
    return resolve(cwd, command);
  }
  function executable(hash, path) {
    hash.update(path).update('\0').update(fileIdentity(path)).update('\0');
    try {
      const target = realpathSync(path);
      hash.update(target).update('\0').update(signature(lstatSync(target, { bigint: true }))).update('\0').update(fileIdentity(target));
      return target;
    } catch (error) { if (error.code === 'ENOENT' || error.code === 'ENOTDIR') { hash.update('missing'); return; } throw error; }
  }
  function environmentIdentity() {
    const inherited = checkExecutionEnvironment(env ?? process.env);
    // Arbitrary preload/module search files and opt-in live tool checks do not
    // have a reviewed filesystem closure. Keep running these tasks normally.
    if (['NODE_OPTIONS', 'NODE_PATH', 'TSX_TSCONFIG_PATH', 'TS_NODE_PROJECT', 'npm_config_node_options', 'NPM_CONFIG_NODE_OPTIONS'].some(key => inherited[key])
      || Object.keys(inherited).some(key => (key.startsWith('MOTE_') || key.endsWith('_PROCESS_ENTRY')) && inherited[key])) return undefined;
    const hash = createHash('sha256');
    const effectivePath = inherited.PATH;
    hash.update(JSON.stringify({ directory, host: hostname(), os: [platform(), arch(), release(), version()], versions: process.versions,
      env: Object.entries(inherited).filter(([, value]) => value !== undefined).sort(([a], [b]) => a.localeCompare(b)) }));
    executable(hash, process.execPath);
    // Relative PATH entries have a different meaning in each task's cwd and may
    // introduce arbitrary executable inputs from output directories.
    if (effectivePath.split(delimiter).some(entry => !isAbsolute(entry))) return undefined;
    const cwd = directory;
    const tool = executable(hash, commandPath('npm', cwd, effectivePath));
    // The Node/npm entry may live outside project node_modules. Its own package
    // modules and npm defaults are just as relevant as the entry point.
    if (tool && /[\\/]bin[\\/]npm-cli\.js$/.test(tool)) snapshotTree(hash, dirname(dirname(tool)));
    for (const value of [inherited.SHELL, inherited.ComSpec, inherited.npm_config_script_shell,
      inherited.NPM_CONFIG_SCRIPT_SHELL, process.platform === 'win32' ? undefined : '/bin/sh'].filter(Boolean)) {
      executable(hash, commandPath(value, cwd, effectivePath));
    }
    for (const [key, value] of Object.entries(inherited)) if (value && /(?:_BIN|_EXECUTABLE)$/.test(key)) executable(hash, commandPath(value, cwd, effectivePath));
    // A PATH string alone misses replacement/install of tools at the same path.
    // Snapshot direct entries and resolved symlink targets, without walking SDKs.
    for (const entry of [...new Set(effectivePath.split(delimiter))]) {
      const path = resolve(cwd, entry || '.'); hash.update(path).update('\0');
      let entries;
      try { entries = readdirSync(path).sort(); }
      catch (error) { if (['ENOENT', 'ENOTDIR', 'EACCES'].includes(error.code)) { hash.update(error.code); continue; } throw error; }
      for (const name of entries) {
        const candidate = join(path, name);
        try {
          const stat = lstatSync(candidate, { bigint: true });
          hash.update(name).update('\0').update(signature(stat)).update('\0');
          if (stat.isSymbolicLink()) {
            hash.update(readlinkSync(candidate)).update('\0');
            try { const target = realpathSync(candidate); hash.update(target).update('\0').update(signature(lstatSync(target, { bigint: true }))); }
            catch (error) { if (!['ENOENT', 'ENOTDIR', 'ELOOP', 'EACCES', 'EPERM'].includes(error.code)) throw error; hash.update(error.code); }
          }
        } catch (error) { if (!['ENOENT', 'EACCES', 'EPERM'].includes(error.code)) throw error; hash.update(error.code); }
      }
    }
    for (const path of [join(directory, '.npmrc'), join(inherited.HOME ?? inherited.USERPROFILE ?? directory, '.npmrc'),
      inherited.npm_config_userconfig, inherited.NPM_CONFIG_USERCONFIG, inherited.npm_config_globalconfig,
      inherited.NPM_CONFIG_GLOBALCONFIG].filter(Boolean)) hash.update(resolve(directory, path)).update('\0').update(fileIdentity(resolve(directory, path)));
    const visited = new Set();
    for (const path of [join(directory, 'node_modules'), ...graph.map(workspace => join(directory, workspace.path, 'node_modules'))]) snapshotTree(hash, path, visited);
    return hash.digest('hex');
  }
  function outputIdentity(hash, path, visited = new Set()) {
    hash.update(path).update('\0');
    let stat;
    try { stat = lstatSync(path); }
    catch (error) { if (['ENOENT', 'ENOTDIR'].includes(error.code)) { hash.update('missing\0'); return; } throw error; }
    if (stat.isDirectory()) {
      const target = realpathSync(path);
      if (visited.has(target)) { hash.update('visited\0'); return; }
      visited.add(target);
      hash.update('directory\0');
      for (const entry of readdirSync(path).sort()) outputIdentity(hash, join(path, entry), visited);
    } else hash.update(fileIdentity(path)).update('\0');
  }
  let paths, environment;
  const taskIdentity = step => {
    const match = /^(?:test|typecheck):(.+)$/.exec(step.id ?? '');
    if ((!match || !byName.has(match[1])) && !reusableRootTasks.has(step.id)) return undefined;
    if (!paths) taskIdentity.refresh();
    if (!environment) return undefined;
    const closure = new Set();
    function include(name) {
      if (closure.has(name) || !byName.has(name)) return;
      closure.add(name);
      for (const child of byName.get(name).dependencies ?? []) include(child);
    }
    if (match) {
      include(match[1]);
      // These fixture suites start real Server code and compiled Agent code.
      if (['@mote/web', '@mote/desktop'].includes(match[1])) { include('@mote/server'); include('@mote/agent'); }
    }
    const hash = createHash('sha256').update('mote-task-inputs-v1\0').update(environment)
      .update(JSON.stringify({ id: step.id, phase: step.phase, command: step.command, args: step.args ?? [], cwd: step.cwd ?? '.', graph }));
    executable(hash, commandPath(step.command, resolve(directory, step.cwd ?? '.'),
      checkExecutionEnvironment(env ?? process.env).PATH));
    for (const path of paths) {
      if (isCheckDocumentation(path)) continue;
      const workspace = graph.find(entry => path.startsWith(`${entry.path}/`));
      // Every package manifest is an npm/build definition. Unknown root inputs
      // conservatively belong to every task; only reviewed workspace suites
      // receive the narrower closure.
      if (match && workspace && path !== `${workspace.path}/package.json`) {
        if (!closure.has(workspace.name)) continue;
        if (workspace.name !== match[1] && suiteEntry(path, workspace)) continue;
      }
      hash.update(path).update('\0').update(fileIdentity(resolve(directory, path))).update('\0');
    }
    // Tests load built workspace packages. Content identities allow identical
    // rebuilds while detecting stale/additional/tampered ignored output files.
    if (!sourceOnlyTasks.has(step.id)) for (const workspace of graph) {
      if (!match || closure.has(workspace.name)) outputIdentity(hash, join(directory, workspace.path, 'dist'));
    }
    return hash.digest('hex');
  };
  taskIdentity.refresh = () => {
    paths = [...new Set(git(['ls-files', '-z', '--cached', '--others', '--exclude-standard']).split('\0').filter(Boolean))].sort();
    try { environment = environmentIdentity(); }
    catch (error) {
      // Inability to inspect installed/tool inputs prevents reuse, not a fresh
      // check. Its normal preflight/command still reports actual availability.
      if (!['EACCES', 'EPERM', 'ELOOP', 'ENOTDIR', 'ENOENT'].includes(error.code)) throw error;
      environment = undefined;
    }
  };
  return taskIdentity;
}
