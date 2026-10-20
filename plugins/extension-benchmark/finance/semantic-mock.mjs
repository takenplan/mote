import {semanticScripts as scripts} from './fixtures.mjs';

// Scripted model responses for the exact generated inputs only. No semantic
// keyword dispatch, network call or aggregate/golden answer lives here.
export function semanticFixture({evidence}) {
  return {observations:evidence.flatMap(row=>{
    if (!scripts.has(row.text)) throw Error('No scripted semantic response for this generated original');
    return scripts.get(row.text).map(value=>({...value,evidenceId:row.ref}));
  })};
}
