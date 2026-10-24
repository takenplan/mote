/** Runs in Chrome's isolated world. Read-only, main-frame, bounded visible leaf evidence. */
export function extractVisible(request) {
  const rect=r=>({x:r.x,y:r.y,width:r.width,height:r.height});
  const viewport={x:window.screenX+(window.outerWidth-window.innerWidth)/2,y:window.screenY+window.outerHeight-window.innerHeight-(window.outerWidth-window.innerWidth)/2,width:window.innerWidth,height:window.innerHeight};
  const identity={url:location.href,viewport,scroll:{x:window.scrollX,y:window.scrollY}};
  if(!request.structured)return {identity}; // No DOM, title, media, or document text access.
  if(window!==window.top||document.visibilityState!=='visible'||!document.hasFocus()||window.visualViewport?.scale!==1)return {blocked:true};
  const masks=request.masks??[],intersects=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
  let budget=24000,visits=0,partial=true;
  // Hit testing alone misses pointer-events:none overlays and narrow covers between
  // sample points. Any overlapping unrelated painted box makes a range ambiguous.
  const boxes=[],elements=document.createTreeWalker(document.documentElement,NodeFilter.SHOW_ELEMENT);let candidate,elementCount=0;
  while((candidate=elements.nextNode())){if(++elementCount>4000)return {blocked:true};const b=candidate.getBoundingClientRect();if(b.width<=0||b.height<=0||b.bottom<=0||b.right<=0||b.x>=innerWidth||b.y>=innerHeight)continue;const s=getComputedStyle(candidate);if(s.display==='none'||s.visibility!=='visible'||Number(s.opacity)===0)continue;boxes.push({element:candidate,bounds:rect(b)});}
  const visible=(element,r)=>{
    if(r.width<=0||r.height<=0||r.x<0||r.y<0||r.right>innerWidth||r.bottom>innerHeight)return false;
    if(boxes.some(b=>b.element!==element&&!b.element.contains(element)&&intersects(rect(r),b.bounds)))return false;
    const screen={x:r.x+viewport.x,y:r.y+viewport.y,width:r.width,height:r.height};if(masks.some(m=>intersects(screen,m)))return false;
    for(let p=element;p;p=p.parentElement){for(const pseudo of ['::before','::after']){const ps=getComputedStyle(p,pseudo);if(ps.content&&ps.content!=='none'&&ps.content!=='normal'&&ps.display!=='none'&&ps.visibility==='visible'&&Number(ps.opacity)>0)return false;}const s=getComputedStyle(p);if(s.display==='none'||s.visibility!=='visible'||Number(s.opacity)<1||s.filter!=='none'||s.transform!=='none'||s.clipPath!=='none'||s.maskImage!=='none'||p.hidden||p.inert||p.getAttribute('aria-hidden')==='true')return false;
      if(/(hidden|clip|scroll|auto)/.test(s.overflow+s.overflowX+s.overflowY)){const b=p.getBoundingClientRect();if(r.x<b.x||r.y<b.y||r.right>b.right||r.bottom>b.bottom)return false;}}
    for(const [x,y] of [[r.x+1,r.y+1],[r.right-1,r.y+1],[r.x+1,r.bottom-1],[r.right-1,r.bottom-1],[r.x+r.width/2,r.y+r.height/2]]){const top=document.elementFromPoint(x,y);if(!top||!(element===top||element.contains(top)||top.contains(element)))return false;}return true;
  };
  const forbidden='input,textarea,select,button,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="searchbox"],[role="combobox"],script,style,noscript,template,iframe,canvas,svg';
  const textOf=root=>{if(!root||root.closest(forbidden))return [];const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const values=[];let node;
    while((node=walker.nextNode())&&visits++<4000&&values.length<64&&budget>0){const element=node.parentElement;if(!element||element.closest(forbidden)||!node.nodeValue?.trim())continue;const range=document.createRange();range.selectNodeContents(node);const ranges=[...range.getClientRects()];if(!ranges.length||!ranges.every(r=>visible(element,r)))continue;const text=node.nodeValue.replace(/\s+/g,' ').trim();if(!text||text.length>budget)continue;budget-=text.length;values.push({text,source:'text'});}return values;};
  const fields=[],add=(name,values)=>{if(values?.length)fields.push({name,values});};let adapterId='chrome.visible-main',kind='visible_page';
  const host=location.hostname,bilibili=(host==='www.bilibili.com'||host==='bilibili.com')&&/^\/video\//.test(location.pathname);
  if((host==='www.zhihu.com'||host==='zhihu.com')&&/^\/question\/\d+\/answer\/\d+/.test(location.pathname)){
    const answers=[...document.querySelectorAll('.AnswerItem')].filter(e=>e.querySelector('.RichContent-inner'));
    const targetId=location.pathname.match(/^\/question\/\d+\/answer\/(\d+)(?:\/|$)/)?.[1];
    const targets=answers.filter(e=>{if(e.getAttribute('data-answer-id')===targetId)return true;const data=e.getAttribute('data-zop');if(!data||data.length>4096)return false;try{return String(JSON.parse(data).itemId)===targetId;}catch{return false;}});
    const answer=targets.length===1&&(()=>{const b=targets[0].getBoundingClientRect();return b.bottom>0&&b.top<innerHeight;})()?targets[0]:undefined;
    if(answer){adapterId='chrome.zhihu-answer';kind='article';add('title',textOf(document.querySelector('h1.QuestionHeader-title')));add('author',textOf(answer.querySelector('.AuthorInfo-name')));add('body',textOf(answer.querySelector('.RichContent-inner')));}
  } else if(bilibili){
    adapterId='chrome.bilibili-video';kind='video';add('title',textOf(document.querySelector('h1.video-title')));add('author',textOf(document.querySelector('.up-name')));add('description',textOf(document.querySelector('.basic-desc-info')));
  }
  if(!fields.length&&!bilibili){adapterId='chrome.visible-main';kind='visible_page';const roots=[...document.querySelectorAll('main,[role="main"],article')].filter(e=>!e.parentElement?.closest('main,[role="main"],article'));if(roots.length===1)add('body',textOf(roots[0]));}
  const hasText=fields.length>0;
  if(hasText)add('url',[{text:location.href,source:'state'}]);
  const at=request.observedAt,page={version:3,scope:'visible_window',adapterId,adapterVersion:'1',appVersion:'',activity:'',status:'partial',truncated:partial,observations:{firstAt:at,lastAt:at,count:1},objects:[{kind,fields}]};
  let media; // Provider-reported playhead belongs to media, never UI text fields.
  if(bilibili){
    const videos=[...document.querySelectorAll('video')].filter(v=>visible(v,v.getBoundingClientRect()));if(videos.length===1){const v=videos[0];const ids=globalThis.__moteVisibleMediaIds??(globalThis.__moteVisibleMediaIds=new WeakMap());let id=ids.get(v);if(!id||id.source!==v.currentSrc){id={source:v.currentSrc,value:`chrome:${crypto.randomUUID()}`};ids.set(v,id);}if(Number.isFinite(v.currentTime)&&Number.isFinite(v.duration)&&v.currentTime>=0&&v.duration>=0)media={status:'available',observedAt:at,sessions:[{sessionId:id.value,appId:'com.google.Chrome',appName:'Google Chrome',playbackState:v.paused?'paused':'playing',appVisibility:'foreground',playbackType:'local',durationMs:Math.floor(v.duration*1000),positionMs:Math.floor(v.currentTime*1000),playbackSpeed:v.playbackRate}]};}
  }
  return {identity,pages:hasText?[page]:[],...(media?{media}:{})};
}
