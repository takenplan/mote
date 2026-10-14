/** Geometry from the real loaded file form; no mocked markup or product imports. */
function diarizationPresentation() {
 const form=document.querySelector('.file-diarization-fields');
 if(!form)throw Error('Loaded per-file diarization form is missing');
 const boundary=()=>innerWidth<=760?document.getElementById('primary-navigation').getBoundingClientRect().top:innerHeight;
 const fits=e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=boundary()&&r.left>=0&&r.right<=innerWidth&&e.scrollWidth<=e.clientWidth+1;};
 const selections=[...form.querySelectorAll('select')].map(select=>{
  const caption=select.parentElement.querySelector('.file-diarization-selection'),selected=select.selectedOptions[0].textContent.trim();
  const companion=caption&&getComputedStyle(caption).display!=='none';
  const displayed=companion?caption:select;displayed.scrollIntoView({block:'center',behavior:'instant'});
  const canvas=document.createElement('canvas'),context=canvas.getContext('2d'),style=getComputedStyle(select);context.font=style.font;
  const nativeTextFits=context.measureText(selected).width+parseFloat(style.paddingLeft)+parseFloat(style.paddingRight)+24<=select.clientWidth;
  return {selected,caption:caption?.textContent.trim(),companion:Boolean(companion),complete:fits(displayed)&&(companion?caption.textContent.trim()===selected:nativeTextFits)};
 });
 const button=form.querySelector('button[type=submit]');button.scrollIntoView({block:'center',behavior:'instant'});
 const r=button.getBoundingClientRect(),words=[];const walker=document.createTreeWalker(button,NodeFilter.SHOW_TEXT);
 while(walker.nextNode())for(const match of walker.currentNode.textContent.matchAll(/[A-Za-z]+/g)){
  const range=document.createRange();range.setStart(walker.currentNode,match.index);range.setEnd(walker.currentNode,match.index+match[0].length);
  words.push({text:match[0],lines:range.getClientRects().length});
 }
 const style=getComputedStyle(form);
 return {selections,buttonText:button.textContent.trim(),words,border:style.borderTopStyle,radius:parseFloat(style.borderTopLeftRadius),primary:button.classList.contains('primary'),buttonComplete:fits(button),hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===button,limit:[...form.querySelectorAll('input')].every(input=>input.max==='16'),fit:form.scrollWidth<=form.clientWidth+1};
}
function englishFileBoundaries() {
 const detail=document.querySelector('.file-detail'),text=detail?.textContent??'';
 return {summary:/Summary:\s+/.test(text),used:/Used:\s+/.test(text),matched:/Matched\s+Global type rule/.test(text),version:/Configuration version:\s+/.test(text),current:/would use:\s+/.test(text)};
}
function selectedCorrectionCaption() {
 const button=[...document.querySelectorAll('.file-detail button')].find(button=>button.textContent.trim()==='Confirm selected corrections');
 if(!button)return {present:false};button.scrollIntoView({block:'center',behavior:'instant'});
 const r=button.getBoundingClientRect(),dock=document.getElementById('primary-navigation').getBoundingClientRect();
 return {present:true,enabled:!button.disabled,complete:r.top>=0&&r.bottom<=(innerWidth<=760?dock.top:innerHeight)&&r.left>=0&&r.right<=innerWidth,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===button};
}
module.exports={diarizationPresentation,englishFileBoundaries,selectedCorrectionCaption};
