// External generated-data plugin. All storage and publication use the worker ABI.
export function createMotePlugin(configuration) {
  let closed = false;
  const active = signal => {
    signal.throwIfAborted();
    if (closed) throw new Error('reading_pack_closed');
  };
  return {
    components: [
      {
        id: 'reading.source.enumerate', version: '1', surface: 'ingress', capability: 'source',
        async invoke(input, host, signal) {
          active(signal);
          const items = [];
          let cursor = '';
          let pages = 0;
          do {
            active(signal);
            const page = await host.call('pageOriginals', [input.sourceId, cursor, 2]);
            items.push(...page.items);
            cursor = page.nextCursor;
            pages += 1;
          } while (cursor !== null);
          return {items, pages, label: configuration.label, workerPid: process.pid};
        },
      },
      {
        id: 'reading.processor.normalize', version: '1', surface: 'processing', capability: 'processor',
        async invoke(input, host, signal) {
          active(signal);
          const chunks = [];
          let offset = 0;
          let original;
          do {
            active(signal);
            original = await host.call('readOriginal', [input.originalRef, {offset}]);
            const bytes = Buffer.from(original.bytes.data);
            if (!bytes.length && offset < original.totalBytes) throw new Error('original_read_stalled');
            chunks.push(bytes);
            offset += bytes.length;
          } while (offset < original.totalBytes);
          // This pack accepts archived SourceItem JSON containing generated reading notes.
          // It changes line separators only; it does not infer or generate a summary.
          const item = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          if (typeof item.text !== 'string') throw new Error('reading_text_required');
          const text = item.text.replace(/\r\n?/g, '\n');
          if (text.length > 8000) throw new Error('reading_fixture_exceeds_one_transcript_segment');
          const transcript = {
            durationMs: 0, coverage: 'full', engine: 'reading-pack-normalize-v1',
            segments: text ? [{startMs: 0, endMs: 0, untimed: true, text}] : [],
          };
          active(signal);
          await host.call('emit', {kind: 'reading.normalized', originalRef: input.originalRef, workerPid: process.pid});
          return host.call('stageExtraction', [input.originalRef, transcript]);
        },
      },
    ],
    async close() { closed = true; },
  };
}
