/** Absence of a configured feature is normal. A selected but withdrawn resource
 * still uses the resolver and reports its actual error rather than a fallback. */
export function askModelSelectionPath(models:{selections?:Partial<Record<'chat'|'insight',unknown>>}|undefined,feature:'chat'|'insight'='chat'){
 return models?.selections?.[feature]?'/api/models/selection/'+feature:null;
}
