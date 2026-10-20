import {createHash} from 'node:crypto';

export async function collectOriginals(host, signal, sourceId) {
  const originals = [], documents = [], pages = [];
  let cursor = '';
  do {
    signal.throwIfAborted();
    const page = await host.call('pageOriginals', [sourceId, cursor, 2]);
    pages.push({count: page.items.length, nextCursor: page.nextCursor});
    for (const original of page.items) {
      const read = await host.call('readOriginal', [original.ref]);
      const bytes = Buffer.from(read.bytes.data);
      originals.push(original);
      documents.push({originalRef: original.ref, hash: createHash('sha256').update(bytes).digest('hex'), item: JSON.parse(bytes.toString('utf8'))});
    }
    cursor = page.nextCursor;
  } while (cursor);
  return {originals, documents, pages};
}

export function materialDraft(sourceId, key, label, data) {
  const externalId = 'cancel-pack:' + key;
  return {
    id: 'mat_' + createHash('sha256').update(JSON.stringify([sourceId, externalId])).digest('hex'),
    kind: 'document', schemaVersion: 1, title: 'Generated evidence ' + key,
    origin: {sourceId, externalId},
    blocks: [{id: 'body', kind: 'text', format: 'plain', text: label + '\n' + data.documents.map(row => row.item.text).join('\n'), memberIds: data.originals.map((_, index) => 'evidence-' + index)}],
    members: data.originals.map((original, index) => ({id: 'evidence-' + index, kind: 'capture', ref: 'capture:' + original.captureId})),
    coverage: {state: 'complete'}, fidelity: {state: 'derived', limitations: []},
    retention: {original: 'retained', policy: 'keep'},
  };
}
