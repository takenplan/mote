/** Current routes use explicit collection query parameters. */
export function canonicalDestination(page: string, collection: string, available: readonly string[]) {
  const legacyCollections: Record<string,string> = {library:'materials',files:'files',timeline:'records',memories:'memories'};
  const view=legacyCollections[page]??collection;
  if ((page === 'archive' || page === 'library') && view === 'work-activity') return { page: 'activity', collection: 'materials' };
  return {
    page: Object.hasOwn(legacyCollections,page)?'archive':page,
    collection: view,
  };
}
export function readWorkspaceRoute(hash: string, readPage: (hash: string) => string, available: readonly string[]) {
  const query = new URLSearchParams(hash.split('?')[1] ?? '');
  const raw=hash.replace(/^#\/?/,'').split('?')[0];
  if (!raw) return canonicalDestination('archive', query.get('view') ?? 'materials', available);
  const legacyRoutes:Record<string,string>={'library/materials':'materials','library/files':'files','library/memories':'memories','library/segments':'segments'};
  if(Object.hasOwn(legacyRoutes,raw))return canonicalDestination('archive',legacyRoutes[raw],available);
  if(['files','timeline','memories'].includes(raw))return canonicalDestination(raw,query.get('view')??'materials',available);
  const page=readPage(hash);
  return canonicalDestination(page==='overview'&&['files','timeline','memories'].includes(raw)?raw:page, query.get('view') ?? 'materials', available);
}
export function workspaceHash(route: string, collection?: string, existingHash?: string) {
  const query = new URLSearchParams(existingHash?.split('?')[1] ?? '');
  if (collection) query.set('view', collection); else query.delete('view');
  const suffix = query.toString();
  return '#/' + route + (suffix ? '?' + suffix : '');
}
