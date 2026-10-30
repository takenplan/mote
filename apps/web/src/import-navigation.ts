import {createContext} from 'react';
import type {Api} from './api';

type Opener={tag:'A'|'BUTTON';text:string;href:string|null;label:string|null};
export type ImportOrigin={token:string;hash:string;scroll:number;opener?:Opener;retain:boolean};
export type ImportNavigation={label:string;leave:()=>void};
export const ImportNavigationContext=createContext<ImportNavigation|null>(null);
const origins=new WeakMap<Api,Map<string,ImportOrigin>>();
const pendingReturns=new WeakMap<Api,{origin:ImportOrigin;visit:number}>();let nextReturnVisit=0;
const snapshots=new WeakMap<Api,Map<string,Map<string,unknown>>>();

/** Bind a local history visit to its authenticated owner. No URL or content is
 * inferred from an import job, and directly opened URLs have no origin. */
export function rememberImportOrigin(api:Api,hash:string,scroll:number,opener:Element|null,retain=true):ImportOrigin {
 const token=crypto.randomUUID(),item=opener instanceof HTMLElement&&(opener.tagName==='A'||opener.tagName==='BUTTON')?{tag:opener.tagName as Opener['tag'],text:opener.textContent?.trim()??'',href:opener.getAttribute('href'),label:opener.getAttribute('aria-label')}:undefined;
 const origin={token,hash,scroll,opener:item,retain};let owner=origins.get(api);if(!owner){owner=new Map();origins.set(api,owner);}owner.set(token,origin);
 const previous=window.history.state;window.history.replaceState({...previous,moteImportParent:token},'',window.location.href);
 if(retain)window.dispatchEvent(new window.CustomEvent('mote:import-origin',{detail:{api,origin}}));
 return origin;
}
export function refreshImportOrigin(api:Api,origin:ImportOrigin,hash:string,scroll:number){
 if(origins.get(api)?.get(origin.token)!==origin)return;
 origin.hash=hash;origin.scroll=scroll;
 if(origin.retain)window.dispatchEvent(new window.CustomEvent('mote:import-origin',{detail:{api,origin}}));
}
export function importOrigin(api:Api,state:unknown,field:'moteImportOrigin'|'moteImportParent'):ImportOrigin|undefined {
 const token=state&&typeof state==='object'?(state as Record<string,unknown>)[field]:undefined;
 return typeof token==='string'?origins.get(api)?.get(token):undefined;
}
export function markImportReturn(api:Api,origin:ImportOrigin){pendingReturns.set(api,{origin,visit:++nextReturnVisit});}
export function pendingImportReturn(api:Api,hash:string){const pending=pendingReturns.get(api);return pending?.origin.hash===hash?pending:undefined;}
export function clearImportReturn(api:Api,origin?:ImportOrigin){if(!origin||pendingReturns.get(api)?.origin===origin)pendingReturns.delete(api);}
/** Snapshot only the small, non-draft navigation state supplied by the
 * originating view. Product pages still unmount and cancel their effects. */
export function captureImportSnapshot(api:Api,key:string,read:()=>unknown){
 const capture=(event:Event)=>{const detail=(event as CustomEvent<{api:Api;origin:ImportOrigin}>).detail;if(detail?.api!==api||!detail.origin.retain)return;let owner=snapshots.get(api);if(!owner){owner=new Map();snapshots.set(api,owner);}let visit=owner.get(detail.origin.token);if(!visit){visit=new Map();owner.set(detail.origin.token,visit);}visit.set(key,read());};
 window.addEventListener('mote:import-origin',capture);return()=>window.removeEventListener('mote:import-origin',capture);
}
export function importSnapshot<T>(api:Api,key:string):T|undefined{
 const pending=pendingImportReturn(api,window.location.hash);return pending?snapshots.get(api)?.get(pending.origin.token)?.get(key) as T|undefined:undefined;
}
/** Restore only the exact recorded opener. An unavailable or changed opener
 * falls back to the page heading without guessing another navigation target. */
export function importOriginOpener(origin:ImportOrigin):HTMLElement|undefined {
 if(!origin.opener)return;
 const target=origin.opener;
 const matches=[...document.querySelectorAll<HTMLElement>(target.tag.toLowerCase())].filter(element=>element.getClientRects().length>0&&element.textContent?.trim()===target.text&&element.getAttribute('href')===target.href&&element.getAttribute('aria-label')===target.label);
 return matches.length===1?matches[0]:undefined;
}
