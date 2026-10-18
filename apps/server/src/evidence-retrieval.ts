/** Shared reciprocal rank fusion for independent literal and vector channels.
 * Channel order does not assign a preferred evidence/table type. */
export function fuseEvidenceRanks<T extends {id:string}>(channels:readonly (readonly T[])[],limit:number):T[]{
 const ranked=new Map<string,{record:T;score:number}>();
 for(const channel of channels){const seen=new Set<string>();channel.forEach((record,index)=>{
  if(seen.has(record.id))return;seen.add(record.id);
  const previous=ranked.get(record.id);ranked.set(record.id,{record:previous?.record??record,score:(previous?.score??0)+1/(60+index+1)});
 });}
 return [...ranked.values()].sort((a,b)=>b.score-a.score||a.record.id.localeCompare(b.record.id)).slice(0,limit).map(({record})=>record);
}
