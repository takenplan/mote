import {caseInput} from './case-input.mjs';

// Render independent Case Designer inputs into actual one-observation originals.
const transactions=new Map(caseInput.canonicalTransactions.map(row=>[row.transactionId,row]));
const csvKeys=['transactionId','postedAt','amountCents','currency','transactionType','category'];
export const sources={};
export const semanticScripts=new Map();
for (const observation of caseInput.observations) {
  const row=transactions.get(observation.transactionId),sourceId=observation.sourceId;
  const text=!row ? 'Generated informational message '+observation.observationId+': your statement delivery preferences changed.'
    : sourceId==='source-bank' ? csvKeys.join(',')+'\n'+csvKeys.map(key=>row[key]).join(',')
    : sourceId==='source-notice' ? `Generated payment notice ${observation.observationId}: ${row.transactionType} reference ${row.transactionId}, USD ${(Math.abs(row.amountCents)/100).toFixed(2)}, posted ${row.postedAt}.`
    : `Subject: Generated billing message ${observation.observationId}\nThe ${row.transactionType} reference ${row.transactionId} is USD ${(Math.abs(row.amountCents)/100).toFixed(2)}, posted ${row.postedAt}.`;
  const item={externalId:observation.observationId,revision:'1',observedAt:'2026-10-15T00:00:00Z',title:'Generated finance evidence '+observation.observationId,text,kind:sourceId==='source-bank'?'file':'message',layer:'original',mimeType:sourceId==='source-bank'?'text/csv':'text/plain'};
  (sources[sourceId]??=[]).push(item);
  // Generate the semantic stub's response from declared truth. This is not
  // recognition/classification of user content in the plugin.
  semanticScripts.set(text,row?[{transactionId:row.transactionId,occurredOn:row.postedAt.slice(0,10),amountMinor:Math.abs(row.amountCents),currency:row.currency,kind:row.transactionType==='refund'?'refund':'payment',category:row.category,...(row.refundOf?{refundOf:row.refundOf}:{})}]:[]);
}
