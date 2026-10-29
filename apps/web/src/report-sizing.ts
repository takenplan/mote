export const REPORT_SIZE_MESSAGE='mote:insight-size';
export const REPORT_MAX_HEIGHT=16000;
export function newReportSizeToken(){return Array.from(crypto.getRandomValues(new Uint8Array(16)),value=>value.toString(16).padStart(2,'0')).join('');}
export function reportSizeScript(token:string,parentOrigin:string){
 if(!/^[a-f0-9]{32}$/.test(token))throw Error('Invalid report size token');
 const origin=new URL(parentOrigin);if(!['http:','https:'].includes(origin.protocol)||origin.origin!==parentOrigin)throw Error('Invalid report parent origin');
 // Only host literals enter this script. Generated HTML never becomes JavaScript.
 return `<script nonce="${token}">(()=>{const token=${JSON.stringify(token)},target=${JSON.stringify(parentOrigin)};let queued=false,last=-1;const measure=()=>{queued=false;const body=document.body;if(!body)return;const bounds=body.getBoundingClientRect();let bottom=bounds.bottom;for(const element of body.querySelectorAll('*')){if(!['SCRIPT','STYLE','LINK','META'].includes(element.tagName))bottom=Math.max(bottom,element.getBoundingClientRect().bottom);}const height=Math.max(1,Math.ceil(Math.max(body.offsetHeight,bottom-bounds.top)));if(height===last)return;last=height;parent.postMessage({type:${JSON.stringify(REPORT_SIZE_MESSAGE)},token,height},target);};const schedule=()=>{if(!queued){queued=true;requestAnimationFrame(measure);}};new ResizeObserver(schedule).observe(document.body);addEventListener('load',schedule);schedule();})();</script>`;
}
export function acceptedReportHeight(event:MessageEvent,source:Window|null,token:string):number|undefined{
 if(!source||event.source!==source||!event.data||event.data.type!==REPORT_SIZE_MESSAGE||event.data.token!==token||typeof event.data.height!=='number'||!Number.isFinite(event.data.height)||event.data.height<=0)return;
 return Math.min(REPORT_MAX_HEIGHT,Math.max(100,Math.ceil(event.data.height)));
}
