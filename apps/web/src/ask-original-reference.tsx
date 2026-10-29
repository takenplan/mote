import {useEffect,useState} from 'react';
import {moteText} from '@mote/shared/i18n';
import {type Api,errorMessage} from './api';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function originalReferenceRoute(kind:'memory'|'capture',id:string){return '#/ask?'+new URLSearchParams({[kind==='memory'?'fromMemory':'fromCapture']:id});}
function readOrigin(){const query=new URLSearchParams(window.location.hash.split('?')[1]);const memory=query.get('fromMemory'),capture=query.get('fromCapture');return memory?{kind:'memory' as const,id:memory}:capture?{kind:'capture' as const,id:capture}:null;}
export function useOriginalReference(api:Api){
 const [origin,setOrigin]=useState(readOrigin),[read,setRead]=useState<{owner:Api;key:string;ids:string[];title:string;error?:string}>();
 const key=origin?origin.kind+':'+origin.id:'';
 useEffect(()=>{const sync=()=>setOrigin(readOrigin());window.addEventListener('hashchange',sync);return()=>window.removeEventListener('hashchange',sync);},[]);
 useEffect(()=>{if(!origin){setRead(undefined);return;}const controller=new AbortController();setRead(undefined);
  void (async()=>{try{if(!uuid.test(origin.id))throw Error(moteText('参考原件暂不可用，请清除参考后继续。'));
   const memory=origin.kind==='memory'?await api.request<{title:string;evidenceIds?:string[];evidence?:{id:string}[]}>('/api/memories/'+origin.id,{signal:controller.signal}):undefined;
   const ids=[...new Set(memory?(memory.evidence?.length?memory.evidence.map(item=>item.id):memory.evidenceIds??[]):[origin.id])];
   if(!ids.length||ids.some(id=>!uuid.test(id)))throw Error(moteText('参考原件暂不可用，请清除参考后继续。'));
   await Promise.all(ids.map(id=>api.request('/api/capture-browser/'+id,{signal:controller.signal})));
   if(!controller.signal.aborted)setRead({owner:api,key,ids,title:memory?.title??moteText('原始记录')});
  }catch(error){if(!controller.signal.aborted)setRead({owner:api,key,ids:[],title:'',error:errorMessage(error)});}})();return()=>controller.abort();
 },[api,key]);
 const current=read?.owner===api&&read.key===key?read:undefined;
 function clear(){setOrigin(null);setRead(undefined);const [route,text]=window.location.hash.split('?'),query=new URLSearchParams(text);query.delete('fromMemory');query.delete('fromCapture');window.history.replaceState(null,'',route+(query.size?'?'+query:''));window.dispatchEvent(new window.Event('mote:workspace-state'));}
 return {key,origin,ids:current?.ids??[],title:current?.title??'',error:current?.error,loading:Boolean(origin&&!current),ready:!origin||Boolean(current&&!current.error&&current.ids.length),clear};
}
