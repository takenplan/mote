import { spawn } from 'node:child_process';
import { availableParallelism } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { testEmbeddingConfiguration } from './fixtures/test-embedding-config.mjs';

export const MAX_TEST_WORKERS = 6;
export const PERFORMANCE_REPORTER = fileURLToPath(new URL('./performance-reporter.mjs', import.meta.url));

function nodeOptionTokens(value) {
  const tokens = [];
  let token = '', quoted = false;
  for (let index = 0; index < value.length; index++) {
    const character = value[index];
    if (character === '\\' && quoted && index + 1 < value.length) token += value[++index];
    else if (character === '"') quoted = !quoted;
    else if (character === ' ' && !quoted) {
      if (token) tokens.push(token);
      token = '';
    } else token += character;
  }
  if (token) tokens.push(token);
  return tokens;
}

export function testWorkerCount(parallelism = availableParallelism()) {
  return Math.max(4, Math.min(parallelism, MAX_TEST_WORKERS));
}

export function testArguments({ args = [], files = ['test/*.test.ts'], parallelism = availableParallelism(), nodeOptions = process.env.NODE_OPTIONS ?? '' } = {}) {
  // Native reporter arrays have paired destinations. Leave explicit selections
  // entirely to Node, including its underscore aliases and NODE_OPTIONS quoting.
  const explicitReporter = [...args, ...nodeOptionTokens(nodeOptions)]
    .some(arg => /^--test[-_]reporter(?:[-_]destination)?(?:=|$)/.test(arg));
  return ['--import', 'tsx', '--test', `--test-concurrency=${testWorkerCount(parallelism)}`,
    '--test-timeout=120000', ...(!explicitReporter ? [`--test-reporter=${PERFORMANCE_REPORTER}`] : []),
    ...args, ...files];
}

export async function testInvocation(args = [], env = process.env) {
  const flags = ['--performance', '--live', '--live-embeddings'];
  const selected = args.filter(arg => flags.includes(arg));
  if (selected.length > 1) throw new Error('Choose exactly one optional test mode');
  const mode = selected[0], nativeArgs = args.filter(arg => !flags.includes(arg)), childEnv = { ...env };
  delete childEnv.MOTE_TEST_LIVE_EMBEDDINGS;
  delete childEnv.MOTE_MEMORY_CONTEXT_LIVE;
  if (mode === '--live') {
    childEnv.MOTE_MEMORY_CONTEXT_LIVE = '1';
    return { args: ['--import', 'tsx', 'test/live/memory-context-reading.ts', ...nativeArgs], env: childEnv };
  }
  let files;
  if (mode === '--performance') files = ['test/performance/*.test.ts'];
  if (mode === '--live-embeddings') {
    childEnv.MOTE_TEST_LIVE_EMBEDDINGS = '1';
    await testEmbeddingConfiguration(childEnv);
    files = ['test/mem0-memory-provider.test.ts', 'test/memory-provider-consumers.test.ts'];
  }
  return { args: testArguments({ args: nativeArgs, files, nodeOptions: childEnv.NODE_OPTIONS ?? '' }), env: childEnv };
}

export async function runTests(args = []) {
  // Inherit the invoking process group so the complete-check driver retains
  // ownership of every test worker and fixture descendant during cleanup.
  const invocation = await testInvocation(args);
  const child = spawn(process.execPath, invocation.args, { stdio: 'inherit', env: invocation.env });
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
