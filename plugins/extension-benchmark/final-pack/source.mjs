import {normalize} from './semantic-mock.mjs';
import {originalText, sha256} from './originals.mjs';
import {releaseVersion} from './version.mjs';

const text = (value, name) => {
  if (typeof value !== 'string' || !value.length) throw Error(name + '_required');
  return value;
};
const add = (a, b) => {
  const result = a + b;
  if (!Number.isSafeInteger(result)) throw Error('amount_overflow');
  return result;
};
function observation(value, originalRef) {
  const keys = ['transactionId', 'occurredOn', 'amountMinor', 'currency', 'kind', 'evidenceId', 'refundOf'];
  if (!value || typeof value !== 'object' || Object.keys(value).some(key => !keys.includes(key))) {
    throw Error('invalid_observation');
  }
  text(value.transactionId, 'transaction_id');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.occurredOn) ||
      !Number.isFinite(Date.parse(value.occurredOn + 'T00:00:00Z')) ||
      new Date(value.occurredOn + 'T00:00:00Z').toISOString().slice(0, 10) !== value.occurredOn) {
    throw Error('invalid_utc_date');
  }
  if (!Number.isSafeInteger(value.amountMinor) || value.amountMinor < 0 || value.currency !== 'USD') {
    throw Error('invalid_amount_or_currency');
  }
  if (!['payment', 'refund'].includes(value.kind) || value.evidenceId !== originalRef) {
    throw Error('invalid_kind_or_evidence');
  }
  if (value.kind === 'refund') text(value.refundOf, 'refund_charge_identity');
  else if (value.refundOf !== undefined) throw Error('payment_has_refund_relation');
  return {
    transactionId: value.transactionId, occurredOn: value.occurredOn,
    amountMinor: value.amountMinor, currency: value.currency, kind: value.kind,
    ...(value.kind === 'refund' ? {refundOf: value.refundOf} : {}),
  };
}

export function sourceComponent(configuration = {}) {
  return {
    id: 'final.finance.source', version: '1', surface: 'ingress', capability: 'source',
    async invoke(input, host, signal) {
      signal.throwIfAborted();
      // Optional intake remains the host's actual account/source-scoped intake.
      if (input.mode === 'receive') {
        return host.call('receiveSourceItems', [input.sourceId, input.batchId, input.items]);
      }
      if (!Array.isArray(input.sourceIds) || !input.sourceIds.length ||
          input.sourceIds.some(id => typeof id !== 'string' || !id.length)) throw Error('source_ids_required');
      const sourceIds = [...new Set(input.sourceIds)].sort();
      const month = text(input.month, 'month');
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw Error('invalid_month');
      const pageLimit = input.pageLimit ?? configuration.pageLimit ?? 7;
      if (!Number.isSafeInteger(pageLimit) || pageLimit < 1 || pageLimit > 100) throw Error('invalid_page_limit');
      const inputs = [], groups = new Map(), pagesBySource = {};
      const seenOriginals = new Set();
      let normalizedObservations = 0, noiseObservations = 0;
      for (const sourceId of sourceIds) {
        let cursor = '';
        const cursors = new Set();
        pagesBySource[sourceId] = 0;
        do {
          signal.throwIfAborted();
          const page = await host.call('pageOriginals', [sourceId, cursor, pageLimit]);
          pagesBySource[sourceId]++;
          if (!Array.isArray(page.items)) throw Error('invalid_original_page');
          for (const descriptor of page.items) {
            if (descriptor.sourceId !== sourceId || seenOriginals.has(descriptor.ref)) {
              throw Error('duplicate_or_misattributed_original');
            }
            seenOriginals.add(descriptor.ref);
            const actual = await originalText(descriptor.ref, host, signal);
            if (actual.sourceId !== sourceId) throw Error('original_source_mismatch');
            // This event is a current-owner observation, never a publication.
            await host.call('emit', {phase: 'semantic.input', operationId: input.operationId, releaseVersion, ...actual});
            const output = await normalize({originalRef: actual.originalRef, sourceId, text: actual.text}, {signal});
            signal.throwIfAborted();
            if (!output || Object.keys(output).some(key => key !== 'observations') || !Array.isArray(output.observations)) {
              throw Error('invalid_semantic_output');
            }
            const evidence = {originalRef: descriptor.ref, sourceId, captureId: descriptor.captureId, sha256: actual.sha256};
            inputs.push(evidence);
            if (!output.observations.length) noiseObservations++;
            for (const raw of output.observations) {
              const item = observation(raw, descriptor.ref), identity = item.transactionId;
              normalizedObservations++;
              const group = groups.get(identity);
              if (group) {
                if (JSON.stringify(group.value) !== JSON.stringify(item)) throw Error('conflicting_transaction_identity');
                if (!group.evidence.some(value => value.originalRef === descriptor.ref)) group.evidence.push(evidence);
              } else groups.set(identity, {value: item, evidence: [evidence]});
            }
          }
          if (page.nextCursor !== null && page.nextCursor !== undefined) {
            if (typeof page.nextCursor !== 'string' || !page.nextCursor || cursors.has(page.nextCursor)) {
              throw Error('invalid_pagination_cursor');
            }
            cursors.add(page.nextCursor);
          }
          cursor = page.nextCursor;
        } while (cursor !== null && cursor !== undefined);
      }
      // Keep charge/refund identities separate, including charge evidence from
      // outside the selected month. Validate relations before filtering dates.
      for (const {value} of groups.values()) if (value.kind === 'refund') {
        const charge = groups.get(value.refundOf)?.value;
        if (!charge || charge.kind !== 'payment' || charge.currency !== value.currency) {
          throw Error('refund_charge_unavailable');
        }
      }
      const allTransactions = [...groups.values()].map(({value, evidence}) => ({
        ...value, evidenceIds: evidence.map(item => item.originalRef).sort(),
        sourceIds: [...new Set(evidence.map(item => item.sourceId))].sort(),
        evidence: [...evidence].sort((a, b) => a.originalRef.localeCompare(b.originalRef)),
      })).sort((a, b) => a.transactionId.localeCompare(b.transactionId));
      const transactions = allTransactions.filter(item => item.occurredOn.slice(0, 7) === month);
      let grossCents = 0, refundCents = 0;
      for (const item of transactions) {
        if (item.kind === 'refund') refundCents = add(refundCents, item.amountMinor);
        else grossCents = add(grossCents, item.amountMinor);
      }
      const statistics = {
        totalObservations: inputs.length, normalizedObservations, uniqueTransactions: groups.size,
        noiseObservations, repeatedObservations: normalizedObservations - groups.size,
        monthlyCharges: transactions.filter(item => item.kind === 'payment').length,
        monthlyRefunds: transactions.filter(item => item.kind === 'refund').length,
      };
      const ledger = {
        format: 'mote-finance-ledger-v1', releaseVersion, month, currency: 'USD', sourceIds,
        statistics, totals: {grossCents, refundCents, netCents: add(grossCents, -refundCents)},
        transactions, allTransactions,
        inputs: inputs.sort((a, b) => a.originalRef.localeCompare(b.originalRef)), pagesBySource,
      };
      const externalId = 'finance-month:' + month + ':' + sha256(JSON.stringify(sourceIds));
      const id = 'mat_' + sha256(JSON.stringify([sourceIds[0], externalId]));
      const members = ledger.inputs.map((item, index) => ({
        id: 'original-' + index, kind: 'capture', ref: 'capture:' + item.captureId,
        locator: {originalRef: item.originalRef, sourceId: item.sourceId},
      }));
      // A Material block may attribute at most 32 members. All original members
      // remain attached to the formal Material, with additional evidence blocks.
      const blocks = [];
      for (let offset = 0; offset < Math.max(1, members.length); offset += 32) {
        blocks.push({id: 'ledger-' + offset, kind: 'text', format: 'plain',
          text: offset === 0 ? JSON.stringify(ledger) : '',
          memberIds: members.slice(offset, offset + 32).map(member => member.id)});
      }
      signal.throwIfAborted();
      const published = await host.call('publishMaterial', [{
        id, kind: 'document', schemaVersion: 1, title: 'Financial ledger ' + month,
        origin: {sourceId: sourceIds[0], externalId}, blocks, members,
        coverage: {state: 'complete'}, fidelity: {state: 'derived', limitations: ['Deterministic semantic fixture; no model-quality claim']},
        retention: {original: 'retained', policy: 'keep'},
      }]);
      return {materialId: published.id, revision: published.revision, releaseVersion, statistics, totals: ledger.totals, pagesBySource};
    },
  };
}
