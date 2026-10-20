// Independent comparisons. Expected values were frozen before the Iterator existed.
import {assert} from './http-runtime.mjs';
const sorted = values => [...values].sort();
export function assertFinanceBody(body,variant,bindings) {
  const expected=variant.expected,actualStats=body.statistics,actualTotals=body.totals;
  assert(actualStats&&actualTotals,'published finance body exposes statistics and totals');
  for(const key of ['totalObservations','uniqueTransactions','noiseObservations','repeatedObservations','monthlyCharges','monthlyRefunds'])assert.equal(actualStats[key],expected[key],key);
  assert.equal(actualStats.normalizedObservations,expected.totalObservations-expected.noiseObservations,'normalized observation count');
  for(const key of ['grossCents','refundCents','netCents'])assert.equal(actualTotals[key],expected[key],key);
  assert.deepEqual(sorted(body.allTransactions.map(t=>t.transactionId)),expected.allTransactionIds,'all identities retained');
  assert.deepEqual(sorted(body.transactions.map(t=>t.transactionId)),expected.ledgerIds,'month boundary selection');
  const byId=new Map(variant.transactions.map(t=>[t.transactionId,t]));
  const monthlyIds=new Set(expected.ledgerIds);
  for(const t of body.allTransactions){
    const canonical=byId.get(t.transactionId);assert(canonical);
    assert.equal(t.amountMinor,Math.abs(canonical.amountCents),'integer cents for '+t.transactionId);
    assert.equal(t.kind,canonical.transactionType==='refund'?'refund':'payment','transaction kind');
    assert.equal(t.occurredOn,canonical.postedAt.slice(0,10),'UTC normalized date');assert.equal(t.currency,'USD');
    if(canonical.refundOf)assert.equal(t.refundOf,canonical.refundOf,'refund identity linkage');
    const observations=variant.observations.filter(o=>o.transactionId===t.transactionId);
    const expectedRefs=sorted(observations.map(o=>bindings.get(o.observationId).ref));
    assert.deepEqual(sorted(t.evidenceIds),expectedRefs,'dedup retains every observation original');
    assert.deepEqual(sorted(t.sourceIds),sorted(new Set(observations.map(o=>o.sourceId))),'dedup retains observed sources');
  }
  for(const t of body.transactions)assert.deepEqual(t,body.allTransactions.find(x=>x.transactionId===t.transactionId),'monthly ledger is the selected full transaction record');
  assert.equal(body.inputs.length,expected.totalObservations,'all input lineage retained, including noise');
  assert.deepEqual(sorted(body.inputs.map(i=>i.originalRef)),sorted([...bindings.values()].map(b=>b.ref)),'exact input original identities');
  for(const input of body.inputs){const binding=[...bindings.values()].find(b=>b.ref===input.originalRef);assert(binding);assert.equal(input.sourceId,binding.sourceId);assert.equal(input.captureId,binding.captureId);assert.equal(input.sha256,binding.hash);}
  for(const [source,pages] of Object.entries(expected.sourceMinimumPages))assert(body.pagesBySource[source]>=pages,'pagination across all original pages');
  return {matchedIdentities:byId.size,matchedMonthlyIdentities:monthlyIds.size,matchedObservations:body.inputs.length,netCents:expected.netCents,pageCounts:body.pagesBySource};
}
