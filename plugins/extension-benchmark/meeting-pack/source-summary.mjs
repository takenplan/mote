import {createHash} from 'node:crypto';

// Inputs are explicit generated structured facts; no keyword classification or
// semantic model inference occurs here. The tests keep expected text/amounts outside the ZIP.
export async function summarizeSource(input, host, signal, kind, render) {
  signal.throwIfAborted();
  let receipt;
  if (input.items) receipt = await host.call('receiveSourceItems', [input.sourceId, input.batchId, input.items]);
  const originals = [];
  let cursor = '';
  do {
    const page = await host.call('pageOriginals', [input.sourceId, cursor, 2]);
    originals.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);
  const records = [];
  for (const original of originals) {
    signal.throwIfAborted();
    const read = await host.call('readOriginal', [original.ref]);
    const item = JSON.parse(Buffer.from(read.bytes.data).toString('utf8'));
    const value = JSON.parse(item.text);
    if (value.kind !== kind) throw Error('Unexpected explicit structured record kind');
    records.push({original, externalId: item.externalId, value: render(value)});
  }
  records.sort((a, b) => a.externalId.localeCompare(b.externalId));
  const externalId = kind + '-summary';
  const id = 'mat_' + createHash('sha256').update(JSON.stringify([input.sourceId, externalId])).digest('hex');
  const members = records.map(({original}, i) => ({id: 'evidence-' + i, kind: 'capture', ref: 'capture:' + original.captureId, locator: {originalRef: original.ref, sha256: original.hash}}));
  const blocks = records.map(({value}, i) => ({id: 'entry-' + i, kind: 'text', format: 'plain', text: value.heading + '\n' + value.statements.join('\n') + '\nAmount (cents): ' + value.amountCents, memberIds: [members[i].id]}));
  blocks.push({id: 'total', kind: 'text', format: 'plain', text: 'Source total (cents): ' + records.reduce((sum, row) => sum + row.value.amountCents, 0), memberIds: members.map(member => member.id)});
  const published = await host.call('publishMaterial', [{id, kind: 'document', schemaVersion: 1, title: kind + ': ' + input.sourceId, origin: {sourceId: input.sourceId, externalId}, blocks, members, coverage: {state: 'complete'}, fidelity: {state: 'derived', limitations: ['Deterministic rendering of explicit structured fixture facts; no semantic model quality claim']}, retention: {original: 'retained', policy: 'keep'}}]);
  return {materialId: published.id, sourceId: input.sourceId, originalCount: originals.length, receipt, workerPid: process.pid};
}
