import {useEffect,useState} from 'react';

/** The app confirms navigation first; sync after its handler restores a declined hash. */
export function useHashChoice<T extends string|null>(key:string,read:(hash:string)=>T):[T,(value:T)=>void] {
 const [value,setValue]=useState(()=>read(window.location.hash));
 useEffect(()=>{
  let alive=true;const host=window;
  const sync=()=>queueMicrotask(()=>{if(alive)setValue(read(host.location.hash));});
  host.addEventListener('hashchange',sync);
  return()=>{alive=false;host.removeEventListener('hashchange',sync);};
 },[read]);
 function choose(next:T){
  const [route,queryText]=window.location.hash.split('?'),query=new URLSearchParams(queryText);
  if(next===null)query.delete(key);else query.set(key,next);
  const suffix=query.toString(),hash=route+(suffix?'?'+suffix:'');
  if(hash!==window.location.hash){
   window.location.hash=hash;
   // Deliver the guarded transition immediately for actions that continue after selecting a tab.
   // The browser's later native event sees the same accepted hash and adds no extra warning.
   window.dispatchEvent(new window.HashChangeEvent('hashchange'));
  }
 }
 return [value,choose];
}
