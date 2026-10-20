import {summarizeSource} from './source-summary.mjs';
export const notesComponent = {
  id: 'meeting.notes.summary', version: '1', surface: 'ingress', capability: 'source',
  async invoke(input, host, signal) {
    return summarizeSource(input, host, signal, 'meeting-notes', record => ({
      heading: record.meetingTitle,
      statements: record.decisions.map(decision => `${decision.id}: ${decision.text} [owner: ${decision.owner}]`),
      amountCents: record.commitments.reduce((sum, commitment) => sum + commitment.amountCents, 0),
    }));
  },
};
