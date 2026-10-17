import {apiOwnerKey,type Api} from './api';
export type ExtractionIntent={selection:string;request:{operationId:string;materialIds:string[];materialRevisions:Record<string,string>;evidencePins:{id:string;hash:string}[];recipes:{id:string;version:string}[];modelReference?:{kind:'personal'|'shared';id:string};modelOverride?:string}};
const key=(api:Api)=>'mote.memory-extraction.v1:'+apiOwnerKey(api),uuid=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i,hash=/^[a-f0-9]{64}$/;
/** Only explicit input IDs, hashes and command/model references survive reload.
 * No original/Memory text, secret, lease or execution grant is stored. */
export function readExtractionIntent(api:Api):ExtractionIntent|undefined{
 const raw=window.localStorage.getItem(key(api));if(!raw)return;const value=JSON.parse(raw),r=value?.request;
 if(typeof value.selection!=='string'||!r||!uuid.test(r.operationId)||!Array.isArray(r.materialIds)||!r.materialIds.length||!r.materialRevisions||r.materialIds.some((id:unknown)=>typeof id!=='string'||!/^mat_[a-f0-9]{64}$/.test(id)||!hash.test(r.materialRevisions[id]))||!Array.isArray(r.evidencePins)||!r.evidencePins.length||r.evidencePins.some((pin:any)=>!pin||!uuid.test(pin.id)||!hash.test(pin.hash))||!Array.isArray(r.recipes)||!r.recipes.length||r.recipes.some((ref:any)=>!ref||typeof ref.id!=='string'||typeof ref.version!=='string')||Object.keys(r).some(field=>!['operationId','materialIds','materialRevisions','evidencePins','recipes','modelReference','modelOverride'].includes(field)))throw Error('Invalid saved Memory extraction');
 return value;
}
export function saveExtractionIntent(api:Api,intent:ExtractionIntent){window.localStorage.setItem(key(api),JSON.stringify(intent));}
export function clearExtractionIntent(api:Api,operationId:string){const current=readExtractionIntent(api);if(current?.request.operationId===operationId)window.localStorage.removeItem(key(api));}
