import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, realpathSync, rmSync } from 'node:fs';
import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { constants } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { checkExecutionEnvironment } from './check-inputs.mjs';

export function checkDriverPaths(directory = process.cwd()) {
  const commonDirectory = realpathSync(execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {
    cwd: directory, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }).trim());
  return {
    commonDirectory,
    lockDirectory: join(commonDirectory, 'mote-check-driver.lock'),
    receiptDirectory: join(commonDirectory, 'mote-check-receipts'),
  };
}

const signalStatus = signal => 128 + (constants.signals[signal] ?? 1);
const seconds = milliseconds => `${(milliseconds / 1000).toFixed(3)}s`;
function groupExists(child, recordError, context) {
  if (!child.pid) return false;
  try { process.kill(process.platform === 'win32' ? child.pid : -child.pid, 0); return true; }
  catch (error) {
    if (error.code === 'ESRCH') return false;
    recordError?.('groupExists', child, error, context, 0);
    throw error;
  }
}
function signalGroup(child, signal, recordError, context) {
  if (!child?.pid) return;
  try { process.kill(process.platform === 'win32' ? child.pid : -child.pid, signal); }
  catch (error) {
    if (error.code !== 'ESRCH') {
      recordError?.('signalGroup', child, error, context, signal);
      throw error;
    }
  }
}
async function groupGone(child, milliseconds, recordError, context) {
  const deadline = performance.now() + milliseconds;
  try {
    while (groupExists(child, recordError, context)) {
      if (performance.now() >= deadline) return false;
      await delay(20);
    }
    return true;
  } catch (error) {
    recordError?.('groupGone', child, error, context);
    throw error;
  }
}

async function saveReceipt(path, receipt) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    await rename(temporary, path);
  } finally { await rm(temporary, { force: true }); }
}

/** One local repository gate. Receipts contain metadata, never arguments or output. */
export async function runChecks(plan, { directory = process.cwd(), lock = true, receiptPath, inputIdentity, expectedInputIdentity,
  taskIdentity, reuseReceiptPaths = [] } = {}) {
  directory = resolve(directory);
  if (!plan.length) return 0;
  const started = performance.now(), runId = randomUUID(), startedAt = new Date().toISOString();
  const receipt = {
    schemaVersion: 2, runId, pid: process.pid, directory, startedAt,
    runtime: { node: process.versions.node, modules: process.versions.modules, platform: process.platform, arch: process.arch },
    status: 'running', steps: plan.map(({ id, phase }, index) => ({ id: id ?? `step-${index + 1}`, phase: phase ?? 'check', status: 'unrun' })),
  };
  let paths, ownsLock = false, cleanupConfirmed = true, activeChild, interruptedSignal, shutdownTimer;
  let initialIdentity;
  const reusable = [];
  let result = 1;
  const groupErrorIds = new Map();
  const recordGroupError = (operation, child, error, context, signal) => {
    if (!groupErrorIds.has(error)) groupErrorIds.set(error, groupErrorIds.size + 1);
    (receipt.processGroupErrors ??= []).push({
      errorId: groupErrorIds.get(error), operation, context, pid: child?.pid ?? null,
      targetPgid: process.platform === 'win32' ? null : child?.pid ?? null,
      target: child?.pid ? (process.platform === 'win32' ? child.pid : -child.pid) : null,
      signal: signal ?? null, code: error.code ?? null, errno: error.errno ?? null,
      syscall: error.syscall ?? null, at: new Date().toISOString(),
    });
  };
  const identifyTask = step => {
    const identity = taskIdentity?.(step);
    if (identity !== undefined && (typeof identity !== 'string' || !/^[a-f0-9]{64}$/.test(identity))) throw Error('Invalid task input identity');
    return identity;
  };
  const validateTasks = () => {
    if (!receipt.steps.some(step => ['passed', 'reused'].includes(step.status) && step.inputIdentity)) return;
    taskIdentity?.refresh?.();
    for (let index = 0; index < plan.length; index++) {
      const measured = receipt.steps[index];
      if (!['passed', 'reused'].includes(measured.status) || !measured.inputIdentity) continue;
      measured.inputsStable = measured.inputsStable !== false && identifyTask(plan[index]) === measured.inputIdentity;
      if (!measured.inputsStable) {
        measured.status = 'invalidated';
        measured.reason = 'task_inputs_changed';
        result = 1;
        receipt.reason ??= 'check_inputs_changed';
        console.error(`INVALIDATED ${measured.phase}/${measured.id}: task inputs changed.`);
      }
    }
  };
  const unchangedInputs = () => {
    if (!inputIdentity || receipt.status === 'blocked') return true;
    if (receipt.inputChanged) return false;
    const current = inputIdentity();
    if (typeof current !== 'string' || !current) throw Error('Invalid check input identity');
    if (current === initialIdentity) return true;
    receipt.inputChanged = true;
    receipt.reason = 'check_inputs_changed';
    console.error('FAIL: check inputs changed during execution; previous results do not validate the new inputs.');
    return false;
  };
  const forwardSignal = signal => {
    const repeated = interruptedSignal !== undefined;
    interruptedSignal ??= signal;
    if (!activeChild) return;
    try { signalGroup(activeChild, repeated ? 'SIGKILL' : signal, recordGroupError, 'forward_signal'); }
    catch { cleanupConfirmed = false; }
    if (!shutdownTimer) shutdownTimer = setTimeout(() => {
      try { signalGroup(activeChild, 'SIGKILL', recordGroupError, 'shutdown_timer'); } catch { cleanupConfirmed = false; }
    }, 2000);
  };
  const onInterrupt = () => forwardSignal('SIGINT'), onTerminate = () => forwardSignal('SIGTERM');
  process.on('SIGINT', onInterrupt);
  process.on('SIGTERM', onTerminate);
  try {
    paths = checkDriverPaths(directory);
    receipt.revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: directory, encoding: 'utf8' }).trim();
    receiptPath ??= join(paths.receiptDirectory, `${startedAt.replace(/[:.]/g, '-')}-${runId}.json`);
    receiptPath = resolve(directory, receiptPath);
    if (lock) {
      try {
        await mkdir(paths.lockDirectory, { mode: 0o700 });
        ownsLock = true;
        await writeFile(join(paths.lockDirectory, 'owner.json'), JSON.stringify({
          schemaVersion: 1, runId, pid: process.pid, directory, startedAt,
        }, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
      } catch (error) {
        if (error.code !== 'EEXIST' || ownsLock) throw error;
        let owner;
        try {
          const value = JSON.parse(await readFile(join(paths.lockDirectory, 'owner.json'), 'utf8'));
          if (Number.isInteger(value.pid) && typeof value.directory === 'string' && typeof value.startedAt === 'string') owner = value;
        } catch {}
        console.error(`UNRUN: repository check lock exists at ${paths.lockDirectory}.`);
        if (owner) console.error(`Owner PID ${owner.pid}, cwd ${owner.directory}, started ${owner.startedAt}.`);
        console.error('Inspect the owner and its processes. Remove this lock manually only after confirming no check or owned child remains; uncertain and stale locks are not reclaimed automatically.');
        receipt.status = 'blocked';
        receipt.reason = 'repository_lock_exists';
      }
    }
    if (receipt.status !== 'blocked') {
      if (inputIdentity) {
        initialIdentity = expectedInputIdentity ?? inputIdentity();
        if (typeof initialIdentity !== 'string' || !initialIdentity) throw Error('Invalid check input identity');
        receipt.inputIdentity = initialIdentity;
      }
      // Opt in to concrete local evidence. Never promote a reused result into
      // an execution, or use interrupted/unclean/blocked/older-format receipts.
      for (const path of reuseReceiptPaths) {
        const absolute = resolve(directory, path);
        if (absolute === receiptPath) throw Error('A new receipt cannot overwrite its original evidence');
        const previous = JSON.parse(await readFile(absolute, 'utf8'));
        if (previous.schemaVersion !== 2 || previous.directory !== directory || !previous.cleanupConfirmed
          || !['passed', 'failed'].includes(previous.status) || previous.reason && previous.reason !== 'check_inputs_changed'
          || typeof previous.runId !== 'string' || !Array.isArray(previous.steps)) {
          console.log(`IGNORE reuse receipt: ${absolute} (ineligible evidence)`);
          continue;
        }
        for (const step of previous.steps) {
          if (step.status === 'passed' && step.exitCode === 0 && step.inputsStable === true && /^[a-f0-9]{64}$/.test(step.inputIdentity ?? '')) {
            reusable.push({ step, origin: { receipt: absolute, runId: previous.runId, stepId: step.id,
              completedAt: previous.completedAt, elapsedMs: step.elapsedMs } });
          }
        }
      }
      result = 0;
    }
    for (let index = 0; receipt.status !== 'blocked' && index < plan.length; index++) {
      if (interruptedSignal) { result = signalStatus(interruptedSignal); break; }
      if (!unchangedInputs()) { result = 1; break; }
      const step = plan[index], measured = receipt.steps[index], stepStarted = performance.now();
      taskIdentity?.refresh?.();
      measured.inputIdentity = identifyTask(step);
      const previous = measured.inputIdentity && reusable.find(value => value.step.id === measured.id
        && value.step.phase === measured.phase && value.step.inputIdentity === measured.inputIdentity);
      if (previous) {
        measured.status = 'reused'; measured.exitCode = 0; measured.elapsedMs = 0;
        measured.inputsStable = true; measured.origin = previous.origin;
        console.log(`REUSED ${measured.phase}/${measured.id} from ${previous.origin.runId}/${previous.origin.stepId}`);
        continue;
      }
      console.log(`RUN ${measured.phase}/${measured.id}`);
      let spawnError;
      measured.process = { spawnAttemptedAt: new Date().toISOString(), pid: null, expectedPgid: null };
      activeChild = spawn(step.command, step.args ?? [], {
        cwd: step.cwd ? resolve(directory, step.cwd) : directory,
        env: checkExecutionEnvironment(),
        stdio: 'inherit', detached: process.platform !== 'win32',
      });
      const child = activeChild;
      measured.process.pid = child.pid ?? null;
      measured.process.expectedPgid = process.platform === 'win32' ? null : child.pid ?? null;
      const terminal = await new Promise(resolveExit => {
        child.once('error', error => { spawnError = error.code ?? 'spawn_error'; });
        child.once('close', (code, signal) => {
          measured.process.terminal = { code, signal, closedAt: new Date().toISOString() };
          resolveExit({ code, signal });
        });
      });
      clearTimeout(shutdownTimer); shutdownTimer = undefined;
      let leftChildren = false;
      if (groupExists(child, recordGroupError, 'post_close')) {
        leftChildren = !interruptedSignal;
        signalGroup(child, 'SIGTERM', recordGroupError, 'post_close');
        if (!await groupGone(child, 2000, recordGroupError, 'post_close')) {
          signalGroup(child, 'SIGKILL', recordGroupError, 'post_close');
          cleanupConfirmed = await groupGone(child, 2000, recordGroupError, 'post_close');
        }
      }
      activeChild = undefined;
      measured.elapsedMs = Math.round((performance.now() - stepStarted) * 1000) / 1000;
      measured.exitCode = interruptedSignal ? signalStatus(interruptedSignal)
        : spawnError || leftChildren || !cleanupConfirmed ? 1
          : terminal.code ?? signalStatus(terminal.signal);
      if (terminal.signal) measured.signal = terminal.signal;
      if (spawnError) measured.reason = spawnError;
      if (leftChildren) measured.reason = 'owned_processes_outlived_command';
      if (!cleanupConfirmed) measured.reason = 'owned_process_cleanup_unconfirmed';
      measured.status = measured.exitCode === 0 ? 'passed' : 'failed';
      taskIdentity?.refresh?.();
      if (measured.inputIdentity) measured.inputsStable = identifyTask(step) === measured.inputIdentity;
      console.log(`${measured.exitCode === 0 ? 'PASS' : 'FAIL'} ${measured.phase}/${measured.id} ${seconds(measured.elapsedMs)}${measured.exitCode ? ` exit ${measured.exitCode}` : ''}${measured.reason ? ` (${measured.reason})` : ''}`);
      if (measured.exitCode !== 0 || measured.inputsStable === false) { result = measured.exitCode || 1; break; }
    }
    if (!unchangedInputs()) result = 1;
    validateTasks();
    if (receipt.status !== 'blocked') receipt.status = interruptedSignal ? 'interrupted' : result === 0 ? 'passed' : 'failed';
  } catch (error) {
    console.error(`FAIL check driver: ${error.code ?? error.name ?? 'unknown error'}`);
    receipt.status = 'failed';
    receipt.reason = error.code ?? error.name ?? 'driver_error';
    result = interruptedSignal ? signalStatus(interruptedSignal) : 1;
  } finally {
    clearTimeout(shutdownTimer);
    if (activeChild) {
      try {
        signalGroup(activeChild, 'SIGTERM', recordGroupError, 'finally');
        if (!await groupGone(activeChild, 2000, recordGroupError, 'finally')) {
          signalGroup(activeChild, 'SIGKILL', recordGroupError, 'finally');
          cleanupConfirmed = await groupGone(activeChild, 2000, recordGroupError, 'finally');
        }
      } catch { cleanupConfirmed = false; }
    }
    if (interruptedSignal) { result = signalStatus(interruptedSignal); receipt.status = 'interrupted'; }
    for (const step of receipt.steps) if (step.status === 'unrun') console.log(`UNRUN ${step.phase}/${step.id}`);
    let releaseOwnedLock = false;
    if (ownsLock && cleanupConfirmed) {
      try {
        const owner = JSON.parse(await readFile(join(paths.lockDirectory, 'owner.json'), 'utf8'));
        if (owner.runId === runId) releaseOwnedLock = true;
        else {
          result = 1; receipt.reason = 'check_lock_owner_changed';
          console.error(`Check lock ownership changed; preserved ${paths.lockDirectory}.`);
        }
      } catch (error) {
        result = 1; receipt.reason = 'check_lock_release_failed';
        console.error(`Check lock release requires inspection: ${paths.lockDirectory} (${error.code ?? error.name}).`);
      }
    } else if (ownsLock) {
      result = 1; receipt.reason = 'owned_process_cleanup_unconfirmed';
      console.error(`Owned process cleanup is unconfirmed; preserved check lock ${paths.lockDirectory}.`);
    }
    const finalizeOutcome = () => {
      try { if (initialIdentity !== undefined && !unchangedInputs()) result = 1; }
      catch { result = 1; receipt.reason = 'check_input_identity_failed'; }
      try { validateTasks(); }
      catch { result = 1; receipt.reason = 'check_task_identity_failed'; }
      if (interruptedSignal) { result = signalStatus(interruptedSignal); receipt.status = 'interrupted'; }
      else if (result !== 0 && receipt.status === 'passed') receipt.status = 'failed';
      receipt.elapsedMs = Math.round((performance.now() - started) * 1000) / 1000;
      receipt.completedAt = new Date().toISOString();
      receipt.exitCode = result;
      receipt.cleanupConfirmed = cleanupConfirmed;
    };
    finalizeOutcome();
    if (receiptPath) {
      try {
        await saveReceipt(receiptPath, receipt);
        const outcome = () => JSON.stringify([receipt.exitCode, receipt.status, receipt.inputChanged, receipt.reason, receipt.steps]);
        const savedOutcome = outcome();
        // Receipt persistence is asynchronous. Keep the repository locked and
        // reject an edit or interruption that happened while publishing it.
        finalizeOutcome();
        if (savedOutcome !== outcome()) await saveReceipt(receiptPath, receipt);
        console.log(`Check receipt: ${receiptPath}`);
      } catch (error) { console.error(`FAIL writing check receipt: ${error.code ?? error.name}`); result = 1; }
    }
    if (releaseOwnedLock) {
      try {
        // Finish the tiny lock operation without an asynchronous gap after the
        // final input/receipt check. Only our verified owner may be removed.
        const owner = JSON.parse(readFileSync(join(paths.lockDirectory, 'owner.json'), 'utf8'));
        if (owner.runId !== runId) throw Error('Check lock owner changed');
        rmSync(paths.lockDirectory, { recursive: true });
      } catch (error) {
        result = 1; receipt.reason = 'check_lock_release_failed'; finalizeOutcome();
        console.error(`Check lock release requires inspection: ${paths.lockDirectory} (${error.code ?? error.name}).`);
        if (receiptPath) { try { await saveReceipt(receiptPath, receipt); } catch {} }
      }
    }
    process.removeListener('SIGINT', onInterrupt);
    process.removeListener('SIGTERM', onTerminate);
  }
  return interruptedSignal ? signalStatus(interruptedSignal) : result;
}
