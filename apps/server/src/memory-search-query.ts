/** Literal Memory search contract shared by the legacy and scoped readers. */
export function memorySearchQuery(query:string){
 const terms=query.trim().split(/\s+/u).slice(0,12),long=terms.filter(term=>Array.from(term).length>=3);
 return {match:long.length?long.map(term=>'"'+term.replaceAll('"','""')+'"').join(' AND '):undefined,short:terms.filter(term=>Array.from(term).length<3)};
}
