import {writeFile, rename} from 'node:fs/promises';

// These generated observations belong to the plugin's own working directory.
// They are diagnostics, never a queue, publication store, or source of authority.
export async function mark(key, phase, value) {
  if (!/^[a-zA-Z0-9_-]{1,96}$/.test(key)) throw Error('invalid_observation_key');
  const name = `cancel-pack.${key}.${phase}.json`;
  await writeFile(name + '.pending', JSON.stringify({pid: process.pid, ...value}));
  await rename(name + '.pending', name);
}

export function waitOwned(signal, milliseconds) {
  signal.throwIfAborted();
  return new Promise(resolve => {
    let pending = true;
    const finish = aborted => {
      if (!pending) return;
      pending = false;
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      resolve({aborted, timerCleared: true, listenerRemoved: true, pendingWaits: 0});
    };
    const onAbort = () => finish(true);
    const timer = setTimeout(() => finish(false), milliseconds);
    signal.addEventListener('abort', onAbort, {once: true});
    if (signal.aborted) finish(true);
  });
}
