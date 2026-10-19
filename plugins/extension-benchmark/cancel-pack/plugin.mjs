import {makeSource} from './source.mjs';
import {makeProcessor} from './processor.mjs';
import {mark} from './observations.mjs';

export function createMotePlugin(configuration) {
  // Intentionally opposite to the manifest's [processor, source] order.
  return {
    components: [makeSource(configuration), makeProcessor()],
    async close() { await mark('worker-' + process.pid, 'closed', {closed: true}); },
  };
}
