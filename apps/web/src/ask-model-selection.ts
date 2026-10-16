/** Absence of a configured feature is normal. A selected but withdrawn resource
 * still uses the resolver and reports its actual error rather than a fallback. */
export function askModelSelectionPath(models:{selections?:{chat?:unknown}}|undefined){
 return models?.selections?.chat?'/api/models/selection/chat':null;
}
