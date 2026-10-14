/** Actual rendered tab labels must retain complete Latin words and reachable controls. */
function controlCaptionPresentation(selector) {
 const owner=document.querySelector(selector);
 if(!owner)throw Error('Loaded tab controls are missing: '+selector);
 const buttons=[...owner.querySelectorAll('button')];
 const scrollOwners=new Set([document.scrollingElement]);
 for(const button of buttons)for(let parent=button.parentElement;parent;parent=parent.parentElement)scrollOwners.add(parent);
 const positions=[...scrollOwners].map(element=>({element,top:element.scrollTop,left:element.scrollLeft}));
 const before=buttons.map(button=>button.textContent.trim());
 const controls=buttons.map(button=>{
  button.scrollIntoView({block:'center',behavior:'instant'});
  const rect=button.getBoundingClientRect(),dock=document.getElementById('primary-navigation')?.getBoundingClientRect();
  const words=[],walker=document.createTreeWalker(button,NodeFilter.SHOW_TEXT);
  while(walker.nextNode())for(const match of walker.currentNode.textContent.matchAll(/[A-Za-z]+/g)){
   const range=document.createRange();range.setStart(walker.currentNode,match.index);range.setEnd(walker.currentNode,match.index+match[0].length);
   words.push({text:match[0],lines:range.getClientRects().length});
  }
  return {text:button.textContent.trim(),rect:rect.toJSON(),words,complete:rect.width>0&&rect.height>0&&rect.left>=0&&rect.right<=innerWidth&&rect.top>=0&&rect.bottom<=(innerWidth<=760&&dock?dock.top:innerHeight)&&button.scrollWidth<=button.clientWidth+1,hit:document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2)?.closest('button')===button};
 });
 const after=buttons.map(button=>button.textContent.trim());
 for(const {element,top,left} of positions)element.scrollTo({top,left,behavior:'instant'});
 return {before,after,controls,scrollRestored:positions.every(({element,top,left})=>element.scrollTop===top&&element.scrollLeft===left)};
}
module.exports={controlCaptionPresentation};
