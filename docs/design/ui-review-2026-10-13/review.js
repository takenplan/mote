'use strict';
(() => {
 const data=window.MOTE_UI_REVIEW;
 if(!data||!data.generatedOnly)throw Error('Generated-only screenshot manifest is required');
 const state={platform:'mac',variant:'normal',language:'zh',scene:'home',compare:true};
 const noteKey='mote.offlineUiReview.2026-10-13';
 let notes={mac:{preference:'',text:''},android:{preference:'',text:''}},storageAvailable=true;
 try{const saved=JSON.parse(localStorage.getItem(noteKey)||'null');if(saved)for(const platform of ['mac','android'])if(saved[platform])notes[platform]={preference:['candidate','baseline'].includes(saved[platform].preference)?saved[platform].preference:'',text:String(saved[platform].text||'')};}catch{storageAvailable=false;}
 const $=selector=>document.querySelector(selector);
 const sceneInfo=id=>data.scenes.find(item=>item.id===id);
 const variantLabel=()=>data.platforms[state.platform].variantLabels[state.variant]||data.variantLabels[state.variant];
 const find=(revision,scene=state.scene)=>data.assets.find(item=>item.platform===state.platform&&item.revision===revision&&item.scene===scene&&item.variant===state.variant&&item.language===state.language);
 const evidence=revision=>find(revision);
 const subtitles=['整体设计与身份','有意为产品做出的原创选择','字体、间距、对比度与响应','实际可用性与状态转换','追加项：用途、起点和重要入口'];
 $('#final-validation').hidden=!data.finalValidation;
 function sceneAvailable(id){return !!(find('baseline',id)||find('candidate',id));}
 function platformScenes(){return data.scenes.filter(item=>data.platforms[state.platform].walkthrough.includes(item.id)||data.assets.some(asset=>asset.platform===state.platform&&asset.scene===item.id));}
 function option(value,label){const e=document.createElement('option');e.value=value;e.textContent=label;return e;}
 function selectedAsset(revision){return evidence(revision)||(revision==='candidate'&&state.platform==='web'?evidence('baseline'):undefined);}
 function candidateLabel(){return data.source.candidate.platformLabels?.[state.platform]||data.source.candidate.label;}
 function renderPane(revision){
  const item=selectedAsset(revision),img=$('#'+revision+'-image'),button=$(`[data-enlarge="${revision}"]`),missing=$('#'+revision+'-missing');
  button.hidden=!item;missing.hidden=!!item;
  const reused=revision==='candidate'&&state.platform==='web';
  const label=revision==='baseline'?data.source.baseline.label:reused?'沿用第 5 轮':candidateLabel();
  if(revision==='candidate')$('#candidate-label').textContent=label;
  $('#'+revision+'-tag').textContent=item?(item.verified?'已验证生成截图':'实际生成截图 · 待完成验证'):'证据未提供';
  if(item){
   img.src=item.src;img.alt=`${data.platforms[state.platform].title} ${label} · ${sceneInfo(state.scene).title} · ${state.language==='en'?'English':'中文'} · ${variantLabel()}，实际生成 fixture 截图`;
   $('#'+revision+'-caption').textContent=`原始图像 ${item.width} × ${item.height} px · ${item.note||'复制原图，未绘制替代界面。'}${reused?' 本轮没有 Web 新候选。':''}`;
  }else{
   img.removeAttribute('src');img.alt='';
   const isCandidate=revision==='candidate';
   missing.textContent=isCandidate&&!data.assets.some(asset=>asset.platform===state.platform&&asset.revision==='candidate')?'当前原生候选尚未同步生成截图。':'此版本未提供当前语言 / 条件的这个场景。';
   $('#'+revision+'-caption').textContent='未用其他语言、尺寸或旧轮次替代缺失证据。';
  }
 }
 function renderScores(){
  const before=data.source.baseline.scores[state.platform],after=data.source.candidate.scores[state.platform];
  $('#candidate-score-title').textContent=state.platform==='web'?'沿用第 5 轮':candidateLabel();
  const rows=$('#score-rows');rows.replaceChildren();
  data.metrics.forEach((metric,index)=>{
   const row=document.createElement('tr'),name=document.createElement('th');name.scope='row';name.textContent=metric;
   const subtitle=document.createElement('span');subtitle.className='metric-subtitle';subtitle.textContent=subtitles[index];name.append(subtitle);row.append(name);
   const baseline=document.createElement('td');baseline.textContent=String(before[index]);row.append(baseline);
   const candidate=document.createElement('td');candidate.textContent=state.platform==='web'?'未改动':after?String(after[index]):'待独立复评';row.append(candidate);
   const change=document.createElement('td');
   if(after&&state.platform!=='web'){const difference=after[index]-before[index];change.textContent=(difference>0?'+':'')+Number(difference.toFixed(2));if(difference>0)change.className='positive';}
   else change.textContent='—';row.append(change);rows.append(row);
  });
  $('#score-note').textContent=state.platform==='web'?'Web 原四项及追加项如左列。本次补充工作聚焦原生原创性，不为未改动的 Web 添加新评分。':after?'候选分数来自独立评审；图片浏览与静态示意本身不证明功能成功。原生原创性的新目标为严格高于 7，其他四项不低于第 5 轮。':'第 5 轮原生原创性为 6.5；新候选要求严格高于 7，其他四项不低于第 5 轮。候选尚未完成独立复评，未根据外观自动加分。';
  $('#candidate-score-source').hidden=state.platform==='web'||!data.source.candidate.scoreSource;
 }
 function renderJourney(){
  const ids=data.platforms[state.platform].walkthrough,journey=$('#journey');journey.replaceChildren();
  ids.forEach((id,index)=>{
   const li=document.createElement('li'),button=document.createElement('button');button.type='button';button.dataset.scene=id;
   if(state.scene===id)button.setAttribute('aria-current','step');
   const number=document.createElement('span');number.textContent=String(index+1).padStart(2,'0');button.append(number,document.createTextNode(sceneInfo(id).title));
   if(!sceneAvailable(id)){button.title='当前语言 / 条件的截图尚未提供';const missing=document.createElement('small');missing.textContent='缺截图';button.append(missing);}button.addEventListener('click',()=>selectScene(id,true));li.append(button);journey.append(li);
  });
  const index=ids.indexOf(state.scene),scene=sceneInfo(state.scene);
  $('#journey-index').textContent=index>=0?String(index+1).padStart(2,'0'):'·';$('#journey-scene').textContent=scene.title;$('#journey-purpose').textContent=scene.purpose;
  const available=ids,position=available.indexOf(state.scene);
  $('#previous').disabled=position<=0;$('#next').disabled=position<0||position===available.length-1;
  $('#previous').onclick=()=>selectScene(available[position-1],true);$('#next').onclick=()=>selectScene(available[position+1],true);
 }
 function render(){
  const platform=data.platforms[state.platform];
  document.querySelectorAll('[data-platform]').forEach(e=>e.setAttribute('aria-pressed',String(e.dataset.platform===state.platform)));
  $('#platform-number').textContent=({web:'01 / WEB',mac:'02 / MAC',android:'03 / ANDROID'})[state.platform];
  $('#platform-title').textContent=({web:'中央档案与证据阅读',mac:'本机档案与中央整理',android:'随身保存与可回看的记录'})[state.platform];$('#platform-role').textContent=platform.role;
  $('#variant').replaceChildren(...platform.variants.map(v=>option(v,platform.variantLabels[v]||data.variantLabels[v])));$('#variant').value=state.variant;$('#language').value=state.language;
  const select=$('#scene');select.replaceChildren(...platformScenes().map(item=>option(item.id,item.title+(sceneAvailable(item.id)?'':'（当前条件缺截图）'))));select.value=state.scene;
  $('#compare').classList.toggle('single',!state.compare);$('#compare').classList.toggle('phone',state.platform==='android'||['compact','minimum'].includes(state.variant));$('#baseline-pane').hidden=!state.compare;
  $('#toggle-compare').textContent=state.compare?'只看候选':'并排对照';$('#toggle-compare').setAttribute('aria-pressed',String(state.compare));
  renderPane('baseline');renderPane('candidate');renderJourney();renderScores();
  $('#selection-status').textContent=`${platform.title} · ${state.language==='en'?'English':'中文'} · ${variantLabel()} · ${sceneInfo(state.scene).title}。${sceneInfo(state.scene).purpose}${sceneAvailable(state.scene)?'':' 当前条件没有此场景的截图证据。'}`;
  $('#decisions').replaceChildren(...platform.decisions.map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));
  $('.owner-notes').hidden=state.platform==='web';
  if(state.platform!=='web'){
   $('#preference-platform').textContent=platform.title+' 倾向';
   document.querySelectorAll('[name=preference]').forEach(input=>{input.checked=notes[state.platform].preference===input.value;});
   $('#owner-note').value=notes[state.platform].text;
   $('#note-status').textContent=storageAvailable?'已保存在当前浏览器；没有发送。':'浏览器不支持本地保存；本次备注仍可导出。';
  }
  const params=new URLSearchParams(state);history.replaceState(null,'','#'+params.toString());
 }
 function selectScene(id,scroll=false){if(!platformScenes().some(scene=>scene.id===id))return;state.scene=id;render();if(scroll)$('#workspace').scrollIntoView({behavior:'instant',block:'start'});}
 function ensureScene(){if(!platformScenes().some(scene=>scene.id===state.scene))state.scene='home';}
 document.querySelectorAll('[data-platform]').forEach(button=>button.addEventListener('click',()=>{state.platform=button.dataset.platform;if(!data.platforms[state.platform].variants.includes(state.variant))state.variant='normal';ensureScene();render();}));
 $('#variant').addEventListener('change',event=>{state.variant=event.target.value;ensureScene();render();});
 $('#language').addEventListener('change',event=>{state.language=event.target.value;ensureScene();render();});
 $('#scene').addEventListener('change',event=>selectScene(event.target.value));
 $('#toggle-compare').addEventListener('click',()=>{state.compare=!state.compare;render();});
 function saveNotes(){try{localStorage.setItem(noteKey,JSON.stringify(notes));storageAvailable=true;}catch{storageAvailable=false;}$('#note-status').textContent=storageAvailable?'已保存在当前浏览器；没有发送。':'浏览器不支持本地保存；本次备注仍可导出。';}
 document.querySelectorAll('[name=preference]').forEach(input=>input.addEventListener('change',()=>{notes[state.platform].preference=input.value;saveNotes();}));
 $('#owner-note').addEventListener('input',()=>{notes[state.platform].text=$('#owner-note').value;saveNotes();});
 $('#clear-preference').addEventListener('click',()=>{notes[state.platform].preference='';saveNotes();render();});
 function decisionText(){return ['Mote 三端 UI 离线评审 · 2026-10-13',`对照：第 5 轮 / ${data.source.candidate.label}`,'生成截图；本页仅静态浏览，倾向不是功能验证。','',...['mac','android'].flatMap(platform=>[data.platforms[platform].title,`倾向：${({candidate:'倾向本轮',baseline:'保留第 5 轮'})[notes[platform].preference]||'未选择'}`,`候选：${data.source.candidate.platformLabels?.[platform]||data.source.candidate.label}`,`备注：${notes[platform].text||'无'}`,''])].join('\n');}
 window.moteReviewDecisionText=decisionText;
 $('#export-decisions').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([decisionText()],{type:'text/plain;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download='mote-ui-review-decisions-2026-10-13.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 const dialog=$('#image-dialog');
 document.querySelectorAll('[data-enlarge]').forEach(button=>button.addEventListener('click',()=>{
  const revision=button.dataset.enlarge,item=selectedAsset(revision);if(!item)return;
  $('#dialog-image').src=item.src;$('#dialog-image').alt=$('#'+revision+'-image').alt;
  $('#dialog-title').textContent=`${data.platforms[state.platform].title} · ${revision==='baseline'?'第 5 轮':state.platform==='web'?'沿用第 5 轮':candidateLabel()} · ${sceneInfo(state.scene).title}`;
  $('#dialog-caption').textContent=`实际生成 fixture 截图 · ${item.width} × ${item.height} px · SHA-256 ${item.sha256.slice(0,16)}… · 图中按钮不执行产品操作。`;
  $('#dialog-canvas').classList.remove('pixels');$('#pixel-toggle').setAttribute('aria-pressed','false');$('#pixel-toggle').textContent='原始像素';dialog.showModal();
 }));
 $('#pixel-toggle').addEventListener('click',()=>{const pixels=$('#dialog-canvas').classList.toggle('pixels');$('#pixel-toggle').setAttribute('aria-pressed',String(pixels));$('#pixel-toggle').textContent=pixels?'适合窗口':'原始像素';});
 $('#close-dialog').addEventListener('click',()=>dialog.close());
 const initial=new URLSearchParams(location.hash.slice(1));
 if(Object.hasOwn(data.platforms,initial.get('platform')))state.platform=initial.get('platform');
 if(data.platforms[state.platform].variants.includes(initial.get('variant')))state.variant=initial.get('variant');
 if(['zh','en'].includes(initial.get('language')))state.language=initial.get('language');
 if(sceneInfo(initial.get('scene')))state.scene=initial.get('scene');
 if(initial.get('compare')==='false')state.compare=false;ensureScene();render();
})();
