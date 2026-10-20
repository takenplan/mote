/** Supported production composition only; no domain adapters or internal state
 * are replaced. Accounts and every task/worker/publication run in this child. */
import {buildScopedApp} from '../../../apps/server/src/scope/app.js';
import {releaseTransport, generatedPassword} from './release.mjs';

const dataDir = process.env.MOTE_EXTENSION_FINAL_VAULT;
if (!dataDir) throw Error('MOTE_EXTENSION_FINAL_VAULT required');
const node = await buildScopedApp({dataDir}, {pluginReleaseTransport: await releaseTransport()});
if (process.env.MOTE_EXTENSION_FINAL_INITIALIZE === '1') {
  await node.accounts!.initialize('round5-admin', generatedPassword);
}
const base = await node.app.listen({host: '127.0.0.1', port: 0});
process.stdout.write(JSON.stringify({phase: 'listening', base, pid: process.pid}) + '\n');
let closing = false;
process.on('SIGTERM', async () => {
  if (closing) return;
  closing = true;
  await node.app.close();
  process.stdout.write(JSON.stringify({phase: 'closed', pid: process.pid}) + '\n');
  process.exit(0);
});
