import {createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import fixtures from './semantic-fixtures.json' with {type: 'json'};

// The only semantic seam. The evaluator replaces this entire module. A lookup
// is keyed by the exact generated original bytes and contains only row facts.
// No model profile, network request, host object, aggregate, or write is here.
export async function normalize({originalRef, sourceId, text}, {signal} = {}) {
  signal?.throwIfAborted();
  const hash = createHash('sha256').update(text).digest('hex');
  const fixture = fixtures[hash];
  if (!fixture || fixture.sourceId !== sourceId) throw Error('unmapped_semantic_fixture');
  if (fixture.delayMs) await delay(fixture.delayMs, undefined, {signal});
  signal?.throwIfAborted();
  return {observations: fixture.observations.map(item => ({...item, evidenceId: originalRef}))};
}
