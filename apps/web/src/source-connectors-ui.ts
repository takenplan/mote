import {useEffect,useRef,useState,type Dispatch,type SetStateAction} from 'react';
import {commonFailureMessage,httpStatusMessage} from '@mote/shared';
import {ApiError,errorMessage,type Api} from './api';
const stylesheet=new URL('./source-connectors-final.css',import.meta.url).href;
export function useSourceConnectorStyle(){useEffect(()=>{if(document.head.querySelector('link[data-mote-source-connectors]'))return;const link=document.createElement('link');link.rel='stylesheet';link.href=stylesheet;link.dataset.moteSourceConnectors='true';document.head.append(link);},[]);}
export const connectorFailure=(error:unknown)=>error instanceof ApiError?commonFailureMessage(error.code??'',error.status)||httpStatusMessage(error.status):errorMessage(error);
const drafts=new WeakMap<Api,Map<string,unknown>>();
/** Temporary form state follows this exact owner API session; never browser storage. */
export function useConnectorDraft<T>(api:Api,key:string,initial:T):[T,Dispatch<SetStateAction<T>>]{
 const read=()=>drafts.get(api)?.has(key)?drafts.get(api)!.get(key) as T:initial;
 const [state,setState]=useState(()=>({owner:api,key,value:read()}));
 const active=useRef({api,key});active.current={api,key};
 const update:Dispatch<SetStateAction<T>>=action=>{if(active.current.api!==api||active.current.key!==key)return;const value=typeof action==='function'?(action as (value:T)=>T)(read()):action;let cache=drafts.get(api);if(!cache){cache=new Map();drafts.set(api,cache);}cache.set(key,value);setState({owner:api,key,value});};
 return[state.owner===api&&state.key===key?state.value:read(),update];
}
