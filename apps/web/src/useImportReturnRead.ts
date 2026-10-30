import {useEffect,useState} from 'react';
import type {Api} from './api';
import {pendingImportReturn} from './import-navigation';
import {resources} from './resource-cache';

/** A return visit needs a completed read from this visit, even when an older
 * cached page is immediately available. Never consume a return on a timer. */
export function useImportReturnRead(api:Api,path:string|null){
 const pending=pendingImportReturn(api,window.location.hash),key=JSON.stringify([pending?.visit,path]);
 const [completed,setCompleted]=useState('');
 useEffect(()=>{
  if(!pending)return;
  if(!path){setCompleted(key);return;}
  let active=true;const resource=resources(api).get(path);resource.refresh();
  const check=()=>{if(active&&!resource.getSnapshot().loading)setCompleted(key);};
  const unsubscribe=resource.subscribe(check);check();return()=>{active=false;unsubscribe();};
 },[api,path,pending?.visit,key]);
 return !pending||completed===key;
}
