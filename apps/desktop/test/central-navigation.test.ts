import { expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

// Native Node runs the actual server module graph; Vitest's runner cannot evaluate
// the Agent runtime's import.meta.resolve. No browser or external service is started.
it('preserves the desktop → server → Web login contract', async () => {
  const { stdout } = await promisify(execFile)(process.execPath, ['--import', 'tsx', '--test', '--test-reporter=tap', fileURLToPath(new URL('./central-navigation-contract.mts', import.meta.url))], { timeout: 30_000, maxBuffer: 1024 * 1024 }).catch(error => {
    throw Error(`${error.message}\n${error.stdout ?? ''}\n${error.stderr ?? ''}`);
  });
  expect(stdout).toContain('# fail 0');
}, 35_000);
