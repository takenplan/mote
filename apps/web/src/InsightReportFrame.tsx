import {useEffect,useMemo,useRef,useState} from 'react';
import type {Answer} from './api';
import {reportDocument} from './report-document';
import {acceptedReportHeight,newReportSizeToken} from './report-sizing';

/** Opaque content keeps all owner controls and credentials outside the frame.
 * The sole allowed host script reports a numeric height; model scripts remain denied. */
export function InsightReportFrame({html,citations,scheme,title}:{html:string;citations:Answer['citations'];scheme:'light'|'dark';title:string}){
 const frame=useRef<HTMLIFrameElement>(null),updates=useRef({token:'',width:0,count:0,height:-1}),[size,setSize]=useState<{token:string;height:number}>();
 const citationIds=JSON.stringify(citations.map(citation=>citation.id));
 const document=useMemo(()=>{const token=newReportSizeToken(),parentOrigin=typeof window==='undefined'?'http://localhost':window.location.origin;return {token,source:reportDocument(html,citations,scheme,{token,parentOrigin})};},[html,citationIds,scheme]);
 useEffect(()=>{const receive=(event:MessageEvent)=>{const height=acceptedReportHeight(event,frame.current?.contentWindow??null,document.token);if(height!==undefined){const width=frame.current?.clientWidth??0;if(updates.current.token!==document.token||updates.current.width!==width)updates.current={token:document.token,width,count:0,height:-1};if(updates.current.height===height||updates.current.count>=32)return;updates.current.height=height;updates.current.count++;setSize({token:document.token,height});}};window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive);},[document.token]);
 const height=size?.token===document.token?size.height:450;
 return <iframe ref={frame} className="report-frame" title={title} sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={document.source} style={{height}}/>;
}
