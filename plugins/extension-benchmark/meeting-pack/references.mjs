import {summarizeSource} from './source-summary.mjs';
export const referencesComponent = {
  id: 'meeting.references.summary', version: '1', surface: 'ingress', capability: 'source',
  async invoke(input, host, signal) {
    return summarizeSource(input, host, signal, 'reference-facts', record => ({
      heading: record.referenceTitle,
      statements: record.facts.map(fact => `${fact.id}: ${fact.text}`),
      amountCents: record.facts.reduce((sum, fact) => sum + (fact.amountCents ?? 0), 0),
    }));
  },
};
