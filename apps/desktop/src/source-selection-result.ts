/** Consume a local save receipt only for the exact still-current selection and owner/device scope. */
export interface SourceSelectionScope { selectionId:string; scope:string }
export function sourceSelectionResult(value:unknown,selected:SourceSelectionScope,current:SourceSelectionScope|undefined):string[]|undefined {
  if(!current||current.selectionId!==selected.selectionId||current.scope!==selected.scope)return;
  const ids=(value as {sourceIds?:unknown})?.sourceIds;
  if(!Array.isArray(ids)||!ids.length||ids.some(id=>typeof id!=='string'||!/^local-[a-f0-9-]{36}$/i.test(id))||new Set(ids).size!==ids.length)throw Error('Invalid source save receipt');
  return [...ids];
}
