/** Inspect actual dialog title, focus paint and every visible form/action lane. */
function dialogPresentation(selector) {
 const dialog=document.querySelector(selector);
 if(!dialog)throw Error('Actual dialog is missing: '+selector);
 const rect=dialog.getBoundingClientRect(),focused=document.activeElement;
 const scrollOwners=new Set([document.scrollingElement]);
 for(const element of dialog.querySelectorAll('input,select,textarea,button'))for(let parent=element.parentElement;parent;parent=parent.parentElement)scrollOwners.add(parent);
 const positions=[...scrollOwners].map(element=>({element,top:element.scrollTop,left:element.scrollLeft}));
 const box=element=>element.getBoundingClientRect();
 const title=dialog.querySelector('h2');
 const titleRect=box(title);
 const activeRect=dialog.contains(focused)?box(focused):null;
 const activeStyle=activeRect?getComputedStyle(focused):null;
 const ring=activeStyle?Math.max(0,parseFloat(activeStyle.outlineWidth)||0)+Math.max(0,parseFloat(activeStyle.outlineOffset)||0):0;
 const focus={owned:Boolean(activeRect),outline:activeStyle?.outlineStyle,ring,shadow:activeStyle?.boxShadow,rect:activeRect?.toJSON(),unclipped:Boolean(activeRect&&activeRect.left-ring>=rect.left+2&&activeRect.right+ring<=rect.right-2&&activeRect.top-ring>=rect.top+2&&activeRect.bottom+ring<=rect.bottom-2)};
 const controls=[...dialog.querySelectorAll('input,select,textarea,button')].filter(element=>element.getClientRects().length).map(element=>{
  element.scrollIntoView({block:'center',behavior:'instant'});
  const r=box(element),outer=box(dialog);
  return {tag:element.tagName,text:element.textContent.trim(),type:element.getAttribute('type'),rect:r.toJSON(),inset:r.left>=outer.left+6&&r.right<=outer.right-6&&r.top>=outer.top+2&&r.bottom<=outer.bottom-2,hit:element===document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)||element.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};
 });
 for(const {element,top,left} of positions)element.scrollTo({top,left,behavior:'instant'});
 if(dialog.contains(focused))focused.focus({preventScroll:true});
 return {rect:rect.toJSON(),title:{text:title.textContent.trim(),rect:titleRect.toJSON(),inset:titleRect.left>=rect.left+8&&titleRect.right<=rect.right-8&&titleRect.top>=rect.top+8},focus,controls,scrollRestored:positions.every(({element,top,left})=>element.scrollTop===top&&element.scrollLeft===left)};
}
module.exports={dialogPresentation};
