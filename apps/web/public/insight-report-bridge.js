/* Fixed host bridge for an opaque report. No model-authored code is evaluated. */
(()=>{
 const script=document.currentScript,token=script?.nonce;
 if(!/^[a-f0-9]{32}$/.test(token??'')||parent===window)return;
 const source=new URL(script.src);
 if(!['http:','https:'].includes(source.protocol)||source.pathname!=='/insight-report-bridge.js'||source.search||source.hash||source.username||source.password)return;
 const target=source.origin;
 const navigate=event=>{
  if(event.type==='keydown'&&!['Enter',' '].includes(event.key))return;
  const element=event.target instanceof Element?event.target:null;
  if(element?.closest('a,area'))event.preventDefault();
  const marker=element?.closest('[data-mote-report-source="'+token+'"]');
  if(!marker)return;
  event.preventDefault();
  const index=Number(marker.getAttribute('data-mote-report-index'));
  if(Number.isSafeInteger(index)&&index>=0)parent.postMessage({type:'mote:insight-source',token,index},target);
 };
 document.addEventListener('click',navigate,true);
 document.addEventListener('keydown',navigate,true);
 let queued=false,last=-1;
 const measure=()=>{
  queued=false;const body=document.body;if(!body)return;
  const bounds=body.getBoundingClientRect();let bottom=bounds.bottom;
  for(const element of body.querySelectorAll('*'))if(!['SCRIPT','STYLE','LINK','META'].includes(element.tagName))bottom=Math.max(bottom,element.getBoundingClientRect().bottom);
  const height=Math.max(1,Math.ceil(Math.max(body.offsetHeight,bottom-bounds.top)));
  if(height===last)return;last=height;
  parent.postMessage({type:'mote:insight-size',token,height},target);
 };
 const schedule=()=>{if(!queued){queued=true;requestAnimationFrame(measure);}};
 new ResizeObserver(schedule).observe(document.body);
 addEventListener('load',schedule);schedule();
})();
