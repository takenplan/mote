import {collectOriginals, materialDraft} from './data.mjs';
import {mark, waitOwned} from './observations.mjs';

export function makeSource(configuration) {
  return {
    id: 'cancel.source', version: '1', surface: 'ingress', capability: 'source',
    async invoke(input, host, signal) {
      signal.throwIfAborted();
      if (input.action === 'ingest') {
        const receipt = await host.call('receiveSourceItems', [input.sourceId, input.batchId, input.items]);
        return {pid: process.pid, receipt};
      }
      if (input.action === 'read-original') return host.call('readOriginal', [input.originalRef]);
      if (input.action === 'trigger-probe') {
        return host.call('registerTrigger', [{kind: 'cancel.periodic', sourceIds: [input.sourceId], intervalMs: 60000}]);
      }
      const data = await collectOriginals(host, signal, input.sourceId);
      if (input.action === 'page') return {pid: process.pid, ...data};
      const draft = materialDraft(input.sourceId, input.key, String(configuration.label), data);
      if (input.action === 'hold-cancel') {
        await mark(input.key, 'started', {action: input.action, materialId: draft.id});
        const cleanup = await waitOwned(signal, 60000);
        if (!cleanup.aborted) throw Error('expected_explicit_task_cancellation');
        const attempts = [];
        for (const [method, params] of [['publishMaterial', [draft]], ['emit', {key: input.key, phase: 'after-cancel'}]]) {
          try { await host.call(method, params); attempts.push({method, succeeded: true}); }
          catch (error) { attempts.push({method, succeeded: false, error: error instanceof Error ? error.name : 'unknown'}); }
        }
        await mark(input.key, 'cancelled', {signalAborted: signal.aborted, cleanup, attempts, materialId: draft.id});
        return {pid: process.pid, cancelled: true};
      }
      if (input.action === 'delay-publish') {
        await mark(input.key, 'started', {action: input.action, materialId: draft.id});
        const cleanup = await waitOwned(signal, input.delayMs ?? 1200);
        if (cleanup.aborted) {
          await mark(input.key, 'retired', {signalAborted: true, cleanup});
          signal.throwIfAborted();
        }
      } else if (input.action !== 'publish') throw Error('unknown_generated_action');
      signal.throwIfAborted();
      const material = await host.call('publishMaterial', [draft]);
      await host.call('emit', {key: input.key, materialId: material.id, label: String(configuration.label)});
      return {pid: process.pid, materialId: material.id, ...data};
    },
  };
}
