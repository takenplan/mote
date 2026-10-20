import { spawn } from 'node:child_process';
import { availableParallelism } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MAX_TEST_WORKERS = 8;

export function testWorkerCount(parallelism = availableParallelism()) {
  return Math.max(4, Math.min(parallelism, MAX_TEST_WORKERS));
}

export function testArguments({ args = [], parallelism = availableParallelism() } = {}) {
  return ['--import', 'tsx', '--test', `--test-concurrency=${testWorkerCount(parallelism)}`,
    '--test-timeout=120000', ...args, 'test/*.test.ts'];
}

export async function runTests(args = []) {
  // Inherit the invoking process group so the complete-check driver retains
  // ownership of every test worker and fixture descendant during cleanup.
  const child = spawn(process.execPath, testArguments({ args }), { stdio: 'inherit' });
  let receivedSignal;
  const forward = signal => { receivedSignal ??= signal; child.kill(signal); };
  const interrupt = () => forward('SIGINT'), terminate = () => forward('SIGTERM');
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', terminate);
  try {
    return await new Promise((resolveExit, reject) => {
      child.once('error', reject);
      child.once('close', (code, signal) => resolveExit({ code, signal: receivedSignal ?? signal }));
    });
  } finally {
    process.off('SIGINT', interrupt);
    process.off('SIGTERM', terminate);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { code, signal } = await runTests(process.argv.slice(2));
    if (signal) process.kill(process.pid, signal);
    else process.exitCode = code ?? 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
