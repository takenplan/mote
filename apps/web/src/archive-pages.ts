import {ApiError, type Api} from './api';

export type ArchivePage<T>={items:T[];nextCursor:string|null};
export type ArchivePages<T>={api:Api;scope:string;cursor:string;previous:T[]};

/** Files and source items append older pages within one API/filter identity.
 * Page components retain ownership of reads, effects and refresh controls. */
export function currentArchivePages<T>(pages:ArchivePages<T>|undefined,api:Api,scope:string){
  return pages?.api===api&&pages.scope===scope?pages:undefined;
}

export function archivePageWithdrawn(error:unknown){
  return error instanceof ApiError&&[401,403,404,410].includes(error.status);
}

export function reconcileArchivePages<T>(pages:ArchivePages<T>|undefined,api:Api,scope:string,withdrawn:boolean){
  if(!pages)return pages;
  if(!currentArchivePages(pages,api,scope))return undefined;
  return withdrawn?{...pages,previous:[]}:pages;
}

/** Preserve the first-seen record at a page boundary. Only overlap with copied
 * pages is removed; this does not reinterpret a server page's own contents. */
export function mergeArchivePage<T extends {captureId:string}>(pages:ArchivePages<T>|undefined,items:T[],withdrawn:boolean){
  const previous=withdrawn?[]:pages?.previous??[];
  return [...previous,...items.filter(item=>!previous.some(old=>old.captureId===item.captureId))];
}
