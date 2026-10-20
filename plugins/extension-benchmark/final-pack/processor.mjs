import {originalText} from './originals.mjs';
import {releaseVersion} from './version.mjs';

export function processorComponent() {
  return {
    id: 'final.text.processor', version: '1', surface: 'processing', capability: 'processor',
    async invoke(input, host, signal) {
      const actual = await originalText(input.originalRef, host, signal);
      // Source-item JSON is a documented transport envelope. Selecting its text
      // field and normalizing line endings is deterministic text processing.
      let text = actual.text;
      try { const envelope = JSON.parse(text); if (typeof envelope.text === 'string') text = envelope.text; } catch {}
      text = text.replace(/\r\n?/g, '\n').trim();
      if (!text) throw Error('empty_text');
      await host.call('emit', {phase: 'processor.normalized', originalRef: actual.originalRef, sha256: actual.sha256, releaseVersion});
      signal.throwIfAborted();
      return host.call('stageExtraction', [actual.originalRef, {
        durationMs: 0, coverage: 'full', engine: 'final-text-normalizer-' + releaseVersion,
        segments: [{startMs: 0, endMs: 0, untimed: true, text}],
      }]);
    },
  };
}
