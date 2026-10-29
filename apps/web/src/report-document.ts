import type {Answer} from './api';
import {moteText} from '@mote/shared/i18n';
import designTokens from '../../../packages/shared/design-tokens.json';
import lightTokens from '../../../packages/shared/design-tokens.light.json';
import {reportSizeScript} from './report-sizing';

// This document contains only the report. The authenticated application's state and
// controls stay outside the opaque-origin iframe.
function displayReportHtml(html:string,citations:Answer['citations']):string {
  if (typeof document==='undefined') return html;
  const indexes=new Map(citations.map((citation,index)=>[citation.id,index+1]));
  // A template keeps generated markup inert while we change only visible text nodes.
  // Its serialization normalizes document wrappers, but retains the report's styles and body.
  const template=document.createElement('template');
  template.innerHTML=html;
  // Central's full-document artifact already contains framework policy metadata.
  // The display document supplies the effective policy before all report content.
  template.content.querySelectorAll('meta[http-equiv="content-security-policy" i]').forEach(meta=>meta.remove());
  const hidden=new Set(['SCRIPT','STYLE','CODE','PRE','TEXTAREA','TITLE','NOSCRIPT','TEMPLATE','SVG','MATH']);
  const walker=document.createTreeWalker(template.content,4);
  let node:Node|null;
  while((node=walker.nextNode())) {
    if(!node.nodeValue?.includes('['))continue;
    let ancestor=node.parentElement,skip=false;
    while(ancestor){if(hidden.has(ancestor.tagName.toUpperCase())){skip=true;break;}ancestor=ancestor.parentElement;}
    if(skip)continue;
    node.nodeValue=node.nodeValue.replace(/\[([^\]\n]{1,300})\]/g,(marker,id:string)=>{
      const index=indexes.get(id);
      return index===undefined?marker:`（${moteText('来源 {0}',index)}）`;
    });
  }
  return template.innerHTML;
}

export function reportDocument(html:string,citations:Answer['citations']=[],scheme:'light'|'dark'='light',resize?:{token:string;parentOrigin:string}):string {
  const colors=scheme==='dark'?designTokens:lightTokens;
  const policy="default-src 'none'; script-src "+(resize?"'nonce-"+resize.token+"'":"'none'")+"; script-src-attr 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
  return '<!doctype html><html lang="zh-CN"><head><meta http-equiv="Content-Security-Policy" content="'+policy+'"><meta name="referrer" content="no-referrer"><meta name="viewport" content="width=device-width, initial-scale=1"><style>html{color-scheme:'+scheme+'}body{margin:0;padding:0;display:flow-root;font-size:15px;font-family:'+designTokens.font+';color:'+colors.ink+';background:'+colors.background+';line-height:1.95;overflow-wrap:anywhere}p{margin:0 0 18px}h2{font-size:17px;line-height:1.5;margin:24px 0 12px}img,svg{max-width:100%;height:auto}*{box-sizing:border-box}table{max-width:100%}a{color:'+colors.accent+';pointer-events:none}</style></head><body>'+displayReportHtml(html,citations)+(resize?reportSizeScript(resize.token,resize.parentOrigin):'')+'</body></html>';
}

