import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {InsightReportFrame} from '../../src/InsightReportFrame';
declare global {interface Window {reportSizing:{render:(html:string,scheme?:'light'|'dark')=>void};untrustedMessages:unknown[]}}
const citations:never[]=[];window.untrustedMessages=[];window.addEventListener('message',event=>{if(event.data?.type==='generated-model-executed')window.untrustedMessages.push(event.data);});
function Fixture(){const [value,setValue]=useState({html:'<p>Generated short report.</p>',scheme:'light' as 'light'|'dark'});window.reportSizing={render:(html,scheme='light')=>setValue({html,scheme})};return <InsightReportFrame html={value.html} citations={citations} scheme={value.scheme} title="Generated report size fixture"/>;}
createRoot(document.getElementById('root')!).render(<Fixture/>);
