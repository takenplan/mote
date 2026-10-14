import type {ContextRecord} from './types.js';

/** Lossless envelope metadata sharing. Canonical records, fingerprints and
 * delivered ranges remain at the bridge; model references confer no authority. */
export function compactSeedEvidence(records:readonly ContextRecord[]){
 const contexts:Record<string,unknown>={},keys=new Map<string,string>();
 const projected=records.map(record=>{
  const {id,ocrText,textRange,estimatedReadCharacters,evidenceFingerprint:_fingerprint,...metadata}=record;
  const {provenance,...common}=metadata;
  const source=provenance&&typeof provenance==='object'&&!Array.isArray(provenance)?provenance as Record<string,unknown>:undefined;
  const {uri,...sourceMetadata}=source??{};
  const context={...common,...(provenance===undefined?{}:{provenance:source?sourceMetadata:provenance})},serialized=JSON.stringify(context);
  let ref=keys.get(serialized);if(!ref){ref='evidence_context_'+keys.size;keys.set(serialized,ref);contexts[ref]=context;}
  return {id,ocrText,textRange,estimatedReadCharacters,commonContextRef:ref,...(uri===undefined?{}:{provenanceUri:uri})};
 });
 return {records:projected,contexts};
}
