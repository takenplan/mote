/** Read actual generated renderer geometry/paint; results are guards, never pixel acceptance. */
function rolloutPresentation() {
 const visible=e=>e&&e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';
 const rootStyle=getComputedStyle(document.documentElement),checks=[],roleCoverage=[];
 function rgb(value){const e=document.createElement('span');e.style.cssText='display:none;position:fixed';e.style.color=value;document.body.append(e);const result=getComputedStyle(e).color;e.remove();return result;}
 const accent=rgb(rootStyle.getPropertyValue('--mote-accent')),hover=rgb(rootStyle.getPropertyValue('--mote-accent-hover')),danger=rgb(rootStyle.getPropertyValue('--mote-danger'));
 const paint=e=>{const s=getComputedStyle(e);return {background:s.backgroundColor,color:s.color,border:s.borderColor};};
 const add=(name,pass,measurements)=>checks.push({name,pass:Boolean(pass),measurements});
 function role(selector,caption,expected){let matched=0;for(const e of document.querySelectorAll(selector)){if(!visible(e)||e.disabled||caption&&!caption.includes(e.textContent.trim()))continue;matched++;const p=paint(e);add(expected+' '+e.textContent.trim(),expected==='primary'?[accent,hover].includes(p.background):expected==='danger'?p.background===danger:![accent,hover].includes(p.background),p);}roleCoverage.push({selector,caption,expected,matched});return matched;}
 const importOpenerMatches=role('.imports-page>.page-heading>.button',['新建导入','New import'],'secondary');
 if(visible(document.querySelector('.imports-page')))add('Actual Import page includes its named New import opener',importOpenerMatches===1,{matched:importOpenerMatches});
 role('.todos-panel form button',null,'primary');role('.failed-answer button',null,'primary');
 role('.conversation-delete-confirm button',['确认删除对话','Confirm deletion'],'danger');
 role('.provider-inline-form button',['确认删除','Confirm deletion'],'danger');
 role('.image-progress .source-toolbar button',['补齐未完成步骤','Complete missing steps'],'primary');
 role('.image-progress .source-toolbar button',['重新计算已有结果','Recompute existing results','停止处理','Stop processing'],'secondary');
 role('.usage-tabs button',null,'secondary');
 role('.config-draft-footer button',['测试连接','Test connection'],'secondary');
 role('.file-detail button',['建议匹配日程场次','Suggest matching calendar sessions','检查可能的识别错误','Check possible recognition errors','重新转写 / 提取','Transcribe / Extract again','重新分离说话人（保留转写）','Separate speakers again (keep transcript)'],'primary');
 for(const selector of ['.todos-panel','.actions-page .actions-empty']){const e=document.querySelector(selector),h=e?.querySelector('h2');if(!visible(e)||!visible(h))continue;const r=e.getBoundingClientRect(),t=h.getBoundingClientRect();add('Authored panel retains practical text lane '+selector,t.left-r.left>=8&&t.left-r.left<=32,{panel:r.toJSON(),heading:t.toJSON(),inset:t.left-r.left});}
 for(const selector of ['.model-selector','.memory-integration','.import-parser-field'])for(const e of document.querySelectorAll(selector)){
  const select=e.querySelector('select'),caption=e.querySelector(selector==='.model-selector'?'.model-selector-selection':selector==='.memory-integration'?'.memory-integration-selection':'.import-parser-selection');
  if(!visible(e)||!visible(select)||!select.selectedOptions[0])continue;
  const text=select.selectedOptions[0].textContent.trim(),s=getComputedStyle(select),c=document.createElement('canvas').getContext('2d');c.font=s.font||`${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
  const required=c.measureText(text).width+parseFloat(s.paddingLeft)+parseFloat(s.paddingRight)+24,nativeFits=required<=select.clientWidth;
  const completeHelper=visible(caption)&&caption.textContent.trim()===text&&caption.scrollWidth<=caption.clientWidth+1;
  add('Whole configured selection '+selector,nativeFits||completeHelper,{text,required,nativeWidth:select.clientWidth,nativeFits,helper:caption?.textContent.trim(),helperVisible:Boolean(visible(caption)),helperRect:caption?.getBoundingClientRect().toJSON()});
 }
 for(const form of document.querySelectorAll('.file-detail form:has(textarea[maxlength="8000"])')){if(!visible(form))continue;const [save,cancel]=[...form.querySelectorAll('button')];if(!visible(save)||!visible(cancel))continue;const a=save.getBoundingClientRect(),b=cancel.getBoundingClientRect(),sameRow=Math.abs(a.top-b.top)<2;add('Manual correction Save and Cancel have separate full action lanes',sameRow?b.left-a.right>=4:b.top-a.bottom>=4,{save:a.toJSON(),cancel:b.toJSON()});}
 const heading=document.querySelector('.evidence-heading'),button=heading?.querySelector('button'),active=document.activeElement;
 if(visible(heading)&&active===button&&button.matches(':focus-visible')){
  const s=getComputedStyle(button),r=button.getBoundingClientRect(),ring=(parseFloat(s.outlineWidth)||0)+Math.max(0,parseFloat(s.outlineOffset)||0),hull={left:r.left-ring,right:r.right+ring,top:r.top-ring,bottom:r.bottom+ring},intersections=[];
  for(const e of heading.children){if(e===button||!visible(e))continue;const w=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);while(w.nextNode()){const range=document.createRange();range.selectNodeContents(w.currentNode);for(const text of range.getClientRects())if(text.right>hull.left&&text.left<hull.right&&text.bottom>hull.top&&text.top<hull.bottom)intersections.push({text:w.currentNode.textContent,rect:text.toJSON()});}}
  add('Reader focused Close ring is clear of full caption',intersections.length===0,{ring,hull,intersections});
 }
 if(document.documentElement.lang==='en'){const footer=document.querySelector('.footer span:last-child');if(visible(footer)&&/Agent ready|Waiting for model/.test(footer.textContent))add('Connected record count uses full neutral caption',/^Records:\s[\d,.]+\s·\s/.test(footer.textContent.trim()),{text:footer.textContent.trim()});}
 return {checks,roleCoverage,scope:'Actual configured controls/geometry/paint in generated renderer only; no automatic visual acceptance or synthetic product markup.'};
}
module.exports={rolloutPresentation};
