type SeedRange={id:string;offset:number;length:number};

/** Existing initial-original transport bounds, shared with hosts that choose
 * whether to disclose previously read context as seeds. Tool reads retain
 * their own separate budgets and never enlarge these initial bounds. */
const INITIAL_EVIDENCE_BOUNDS={ids:100,ranges:100,characters:100000} as const;

export function extractionSeedScopeFitsBudget(ids:readonly string[]|undefined,ranges:readonly SeedRange[]):boolean {
 return Boolean(ids?.length&&ids.length<=INITIAL_EVIDENCE_BOUNDS.ids&&ranges.length<=INITIAL_EVIDENCE_BOUNDS.ranges&&
  ranges.every(range=>range&&ids.includes(range.id)&&Number.isSafeInteger(range.offset)&&range.offset>=0&&Number.isSafeInteger(range.length)&&range.length>=1&&range.length<=INITIAL_EVIDENCE_BOUNDS.characters)&&
  ranges.reduce((sum,range)=>sum+range.length,0)<=INITIAL_EVIDENCE_BOUNDS.characters);
}
