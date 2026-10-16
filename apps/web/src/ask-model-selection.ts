/** Absence of a configured feature is normal. A selected but withdrawn resource
 * still uses the resolver and reports its actual error rather than a fallback. */
export function askModelSelectionPath(models:{selections?:Partial<Record<'chat'|'insight',unknown>>}|undefined,feature:'chat'|'insight'='chat'){
 return models?.selections?.[feature]?'/api/models/selection/'+feature:null;
}
export function requestModelSelection(web:boolean,value:string,override=''){
 if(!web)return {modelProfileId:value||undefined,modelOverride:override||undefined};
 if(!value)return {modelOverride:override||undefined};
 const match=/^(personal|shared):([^\u0000-\u001f\u007f]{1,256})$/.exec(value);
 if(!match)throw Error('Invalid account model reference');
 return {modelReference:{kind:match[1] as 'personal'|'shared',id:match[2]},modelOverride:override||undefined};
}
