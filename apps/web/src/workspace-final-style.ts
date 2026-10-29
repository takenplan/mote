import {useEffect} from 'react';
const href=new URL('./home-search-questions.css?no-inline',import.meta.url).href;
export function useWorkspaceStyle(){useEffect(()=>{if(document.head.querySelector('link[data-mote-workspace-final]'))return;const link=document.createElement('link');link.rel='stylesheet';link.href=href;link.dataset.moteWorkspaceFinal='true';document.head.append(link);},[]);}
