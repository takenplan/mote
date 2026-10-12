import {featureRequirementsAvailable,type FeatureInventory,type FeatureRequirement} from '@mote/shared';
import type {CollectionEntry,PageEntry} from './features/types';

export type DiscoveryTarget={pageId:string;href:string;collectionId?:string|null;categoryId?:string|null;requires?:readonly FeatureRequirement[];requiredCollectionIds?:readonly string[]};
export type DiscoveryState={pages:readonly PageEntry[];collections:readonly CollectionEntry[];inventory?:FeatureInventory;inventoryError?:unknown;inventoryLoading?:boolean};
export type DiscoveryAvailability={state:'available'|'unavailable'|'checking'|'unknown';href?:string;reason?:string};
/** Exact trusted registry identities and versions only; never infer availability from content. */
export function resolveDiscoveryTarget(target:DiscoveryTarget,state:DiscoveryState):DiscoveryAvailability{
 const page=state.pages.find(entry=>entry.id===target.pageId);
 if(!page)return {state:'unavailable',reason:'page_not_registered'};
 const collection=target.collectionId?state.collections.find(entry=>entry.id===target.collectionId):undefined;
 if(target.collectionId&&!collection)return {state:'unavailable',reason:'collection_not_registered'};
 const requiredCollections=(target.requiredCollectionIds??[]).map(id=>state.collections.find(entry=>entry.id===id));
 if(requiredCollections.some(entry=>!entry))return {state:'unavailable',reason:'context_collection_not_registered'};
 const remote=[...(page.requires??[]),...(collection?.requires??[]),...requiredCollections.flatMap(entry=>entry?.requires??[]),...(target.requires??[])].filter(requirement=>typeof requirement==='string'||requirement.host==='server');
 if(remote.length){
  if(state.inventoryError!==undefined)return {state:'unknown',reason:'inventory_error'};
  if(!state.inventory)return {state:'checking',reason:'inventory_pending'};
  if(state.inventory.schemaVersion!==1||!Array.isArray(state.inventory.capabilities)||state.inventory.capabilities.some(capability=>!capability||typeof capability.id!=='string'||typeof capability.version!=='string'||!['active','unavailable'].includes(capability.state)))return {state:'unknown',reason:'inventory_invalid'};
  if(!featureRequirementsAvailable(remote,state.inventory))return {state:'unavailable',reason:'remote_requirement_unavailable'};
 }
 const queryStart=target.href.indexOf('?');
 const query=queryStart<0?'':target.href.slice(queryStart+1);
 const href='#/'+(page.route??page.id)+(query?'?'+query:'');
 return {state:'available',href};
}
