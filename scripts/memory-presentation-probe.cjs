/** Inspect the actual loaded owner-correction form and its preserved limits. */
function memoryCorrectionPresentation(){
 const form=document.querySelector('.memory-detail form.review-notes');
 if(!form)throw Error('Actual owner correction form is missing');
 const edge=()=>innerWidth<=760?document.getElementById('primary-navigation').getBoundingClientRect().top:innerHeight;
 const fields=[...form.querySelectorAll('label')].map(label=>{
  const input=label.querySelector('input,textarea');input.scrollIntoView({block:'center',behavior:'instant'});
  const r=input.getBoundingClientRect(),range=document.createRange();range.selectNode(label.firstChild);
  return {type:input.type,maxLength:input.maxLength,rect:r.toJSON(),labelWidth:label.clientWidth,labelBeforeField:range.getBoundingClientRect().bottom<=r.top+1,fullWidth:r.width>=label.clientWidth-1,reachable:r.top>=-1&&r.bottom<=edge()+1&&r.left>=0&&r.right<=innerWidth,originalValue:input.value};
 });
 const buttons=[...form.querySelectorAll('button')].map(button=>{
  button.scrollIntoView({block:'center',behavior:'instant'});const r=button.getBoundingClientRect(),words=[],walker=document.createTreeWalker(button,NodeFilter.SHOW_TEXT);
  while(walker.nextNode())for(const match of walker.currentNode.textContent.matchAll(/[A-Za-z]+/g)){const range=document.createRange();range.setStart(walker.currentNode,match.index);range.setEnd(walker.currentNode,match.index+match[0].length);words.push({text:match[0],lines:range.getClientRects().length});}
  return {text:button.textContent.trim(),primary:button.classList.contains('primary'),type:button.type,complete:r.top>=-1&&r.bottom<=edge()+1&&r.left>=0&&r.right<=innerWidth,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===button,words};
 });
 return {fields,buttons,fit:form.scrollWidth<=form.clientWidth+1};
}
module.exports={memoryCorrectionPresentation};
