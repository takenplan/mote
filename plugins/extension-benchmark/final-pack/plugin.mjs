import {sourceComponent} from './source.mjs';
import {processorComponent} from './processor.mjs';

// Each component can also be packaged independently. Runtime order intentionally
// differs from the manifest, exercising identity-based composition.
export function createMotePlugin(configuration = {}) {
  return {
    components: [sourceComponent(configuration), processorComponent()],
    async close() {},
  };
}
