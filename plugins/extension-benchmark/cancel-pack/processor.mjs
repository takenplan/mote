import {createHash} from 'node:crypto';
import {mark} from './observations.mjs';

export function makeProcessor() {
  return {
    id: 'cancel.processor', version: '1', surface: 'processing', capability: 'processor',
    async invoke(input, host, signal) {
      signal.throwIfAborted();
      const read = await host.call('readOriginal', [input.originalRef]);
      const bytes = Buffer.from(read.bytes.data), item = JSON.parse(bytes.toString('utf8'));
      const sha256 = createHash('sha256').update(bytes).digest('hex');
      // Generated structured text needs no semantic model inference.
      const transcript = {durationMs: 0, coverage: 'full', engine: 'cancel-pack.generated-text-v1', segments: [{startMs: 0, endMs: 0, text: 'Extracted: ' + item.text + '\nSHA256: ' + sha256}]};
      const result = await host.call('stageExtraction', [input.originalRef, transcript]);
      await mark(input.key, 'processor', {originalRef: input.originalRef, sha256, artifactId: result.artifactId});
      return result;
    },
  };
}
