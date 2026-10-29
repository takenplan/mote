import {getLocale, moteText} from '@mote/shared/i18n';
import type {DesktopApi, Status} from './contracts';
import type {ContentItem} from './contracts/content';

export type RecentConversation = {id:string;title:string;turnCount?:number;updatedAt?:string};
type WorkbenchActions = {question:(text:string)=>boolean;conversation:(id:string)=>void;content?:(item:ContentItem)=>void};

/** A small entry to the existing Ask and content workspaces. No query is submitted here. */
export function createWorkbenchUi(api:DesktopApi, actions:WorkbenchActions) {
  const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
  const question=el<HTMLTextAreaElement>('home-question'),submit=el<HTMLButtonElement>('home-ask-submit'),history=el('home-conversations');
  let status:Status|undefined,authorization='',generation=0,blocked=false,hasContent:boolean|undefined,hasSource=false,hasConversation:boolean|undefined,firstUseActive=false,firstNoteId:string|undefined,firstRecord:ContentItem|undefined,firstVersion=0,firstDetailSignature='',firstCopy='';
  function controls(){
    submit.disabled=blocked||!question.value.trim();
    for(const button of Array.from(history.querySelectorAll('button')))button.disabled=blocked;
  }
  function onboarding(leaving=false){
    const empty=hasContent===false&&!hasSource&&hasConversation===false&&!status?.lastCaptureAt&&!status?.queueDepth&&!status?.running;
    if(!leaving&&empty&&!el('home-onboarding').closest<HTMLElement>('[data-page]')!.hidden)firstUseActive=true;
    const first=empty||firstUseActive&&Boolean(firstNoteId);
    el('home-onboarding').hidden=!first;document.querySelector('[data-page=overview]')!.classList.toggle('first-use-home',first);
    const connected=Boolean(status?.config.serverUrl&&status.config.tokenConfigured);
    el('home-first-status').textContent=(status?.config.deviceName||moteText('这台 Mac'))+' · '+(connected?moteText('已连接你的 Mote'):moteText('仅保存在本机'));
    el('home-first-connection-title').textContent=connected?moteText('已连接你的 Mote'):moteText('连接你的 Mote');el('home-first-connection-copy').textContent=connected?moteText('自动采集尚未开启。'):moteText('让记录进入中央档案，供其他设备和 AI 使用。');
    el('home-first-record').hidden=!firstRecord;if(!firstRecord){el('home-first-record-preview').textContent='';el('home-first-record-state').textContent='';}el('home-onboarding').querySelector<HTMLElement>('.home-task-actions')!.hidden=Boolean(firstRecord);
    el('home-first-title').textContent=firstRecord?moteText('先留下，再慢慢想。'):moteText('先留下一点内容。');el('home-first-copy').textContent=firstRecord?(firstCopy||moteText('正在读取内容…')):moteText('记一句想法，或导入一份文件。自动采集可以稍后再设置。');
    if(firstRecord)el('home-first-connection-copy').textContent=status?.sync.message??'';
    el('home-first-connect').hidden=connected;el('home-first-help').hidden=connected;el('home-first-connected').hidden=!connected;
  }
  async function readFirstRecord(){
    if(!firstRecord||!firstNoteId)return;const version=++firstVersion,item=firstRecord;
    try{const detail=await api.localContentDetail('queue:'+firstNoteId);if(version!==firstVersion||!firstUseActive)return;
      const remote='location'in detail&&detail.location==='central';if(remote)firstRecord={...item,key:'capture:'+firstNoteId};
      firstCopy=remote?moteText('中央已收到'):moteText('原文已经保存在这台 Mac，可以随时打开。');el('home-first-copy').textContent=firstCopy;el('home-first-record-preview').textContent=detail.text;el('home-first-record-state').textContent=remote?moteText('中央已收到'):moteText('本机已保存');
    }catch{if(version!==firstVersion||!firstUseActive)return;el('home-first-record-preview').textContent='';firstCopy=moteText('接收结果待核实');el('home-first-copy').textContent=firstCopy;el('home-first-record-state').textContent=moteText('接收结果待核实');}
  }
  const armFirstNote=()=>{if(!firstUseActive)return;const scope=authorization;void api.noteDraft().then(draft=>{if(scope===authorization&&firstUseActive)firstNoteId=draft.id;}).catch(()=>{});};el('home-onboarding').querySelector('[data-add-choice=note]')!.addEventListener('click',armFirstNote);el('note-action').addEventListener('click',armFirstNote);
  el('home-first-read').addEventListener('click',()=>{if(firstRecord)actions.content?.(firstRecord);});
  function message(text:string){
    const empty=document.createElement('p');empty.className='home-empty';empty.textContent=text;history.replaceChildren(empty);
  }
  function renderHistory(items:RecentConversation[]){
    hasConversation=items.length>0;if(hasConversation&&!firstNoteId)firstUseActive=false;onboarding();history.removeAttribute('aria-busy');history.replaceChildren();
    if(!items.length){message(moteText('还没有对话'));return;}
    for(const item of items.slice(0,3)){
      const button=document.createElement('button');button.type='button';button.className='home-conversation';button.dataset.conversationId=item.id;
      const icon=document.createElement('span');icon.className='home-conversation-icon';icon.setAttribute('aria-hidden','true');icon.textContent='◌';
      const copy=document.createElement('span'),title=document.createElement('strong'),meta=document.createElement('small'),arrow=document.createElement('span');
      title.textContent=item.title;const details:string[]=[];
      if(item.turnCount!==undefined&&Number.isSafeInteger(item.turnCount)&&item.turnCount>=0)details.push(moteText('{0} 轮对话',item.turnCount));
      if(item.updatedAt&&Number.isFinite(Date.parse(item.updatedAt)))details.push(new Date(item.updatedAt).toLocaleString(getLocale(),{month:'long',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}));
      meta.textContent=details.join(' · ');copy.append(title);if(details.length)copy.append(meta);
      arrow.className='chevron';arrow.setAttribute('aria-hidden','true');arrow.textContent='›';button.append(icon,copy,arrow);
      button.addEventListener('click',()=>{if(!blocked)actions.conversation(item.id);});history.append(button);
    }
    controls();
  }
  async function refresh(){
    const version=++generation;
    if(!status?.config.serverUrl||!status.config.tokenConfigured){hasConversation=false;onboarding();history.removeAttribute('aria-busy');message(moteText('连接中央后查看对话历史'));return;}
    history.setAttribute('aria-busy','true');
    try{
      const page=await api.ask('history') as {items:RecentConversation[]};
      if(version===generation)renderHistory(page.items);
    }catch{if(version===generation){
      hasConversation=undefined;onboarding();history.removeAttribute('aria-busy');message(moteText('对话暂不可读取，请稍后重试。'));
      const retry=document.createElement('button');retry.type='button';retry.className='text-button';retry.textContent=moteText('重试');
      retry.addEventListener('click',()=>{retry.disabled=true;void refresh();});history.append(retry);controls();
    }}
  }
  question.addEventListener('input',controls);
  el('home-ask-form').addEventListener('submit',event=>{event.preventDefault();if(blocked||!question.value.trim())return;if(actions.question(question.value)){question.value='';controls();}});
  return {
    refresh,
    leave(page:string){if(page!=='overview'&&page!=='content-reader'){firstUseActive=false;firstNoteId=undefined;firstRecord=undefined;firstVersion++;firstDetailSignature='';firstCopy='';onboarding(true);}},
    setHomeRows(rows:readonly ContentItem[]){if(!firstUseActive||!firstNoteId)return;const row=rows.find(row=>row.key==='queue:'+firstNoteId||row.key==='capture:'+firstNoteId);if(row){firstRecord=row;onboarding();void readFirstRecord();}},
    setHistory(items:RecentConversation[]){generation++;renderHistory(items);},
    setBusy(value:boolean){blocked=value;controls();},
    setHasContent(value:boolean|undefined){hasContent=value;if(value&&!firstNoteId)firstUseActive=false;onboarding();},
    setHasSource(value:boolean){hasSource=value;onboarding();},
    update(next:Status){
      status=next;onboarding();const detailSignature=JSON.stringify([next.queueDepth,next.sync.state,next.sync.lastUploadAt]);if(firstRecord&&detailSignature!==firstDetailSignature){firstDetailSignature=detailSignature;void readFirstRecord();}
      const capture={stopped:moteText('已停止'),capturing:moteText('正在记录'),paused:moteText('已暂停'),permission_required:moteText('需要屏幕录制权限'),error:moteText('采集需要处理')}[next.state];
      const sending=next.config.syncPaused?moteText('发送已暂停'):next.sync.state==='unconfigured'?moteText('仅保存在本机'):next.sync.state==='error'?moteText('发送需要处理'):next.sync.state==='uploading'?moteText('正在发送'):next.config.syncMode==='manual'?moteText('仅手动发送'):moteText('按设置自动发送');
      el('home-collection-summary').textContent=capture+' · '+sending;
      const key=JSON.stringify([next.authorizationGeneration,next.config.serverUrl,next.config.tokenConfigured,next.config.authSignedOut,next.config.authExpiresAt,next.config.authSourceBinding]);
      if(key!==authorization){authorization=key;firstUseActive=false;firstNoteId=undefined;firstRecord=undefined;firstCopy='';firstVersion++;hasConversation=undefined;onboarding();generation++;history.replaceChildren();void refresh();}
    },
  };
}
