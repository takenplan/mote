type SeedRange={id:string;offset:number;length:number};

/** Initial-original scope validation, shared with hosts that choose whether to
 * disclose previously read context as seeds. Exact membership and range checks
 * never enlarge an original authorization; counts are not capacity estimates. */

export function extractionSeedScopeValid(ids:readonly string[]|undefined,ranges:readonly SeedRange[]):boolean {
 if(!ids?.length||ids.some(id=>typeof id!=='string'||!id))return false;
 const allowed=new Set(ids);
 return ranges.every(range=>range&&allowed.has(range.id)&&Number.isSafeInteger(range.offset)&&range.offset>=0&&Number.isSafeInteger(range.length)&&range.length>=1&&Number.isSafeInteger(range.offset+range.length));
}
