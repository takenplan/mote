import {getLocale, moteText} from '@mote/shared/i18n';
import type {DesktopApi, Status} from './contracts';

export type RecentConversation = {id:string;title:string;turnCount?:number;updatedAt?:string};
type WorkbenchActions = {question:(text:string)=>boolean;conversation:(id:string)=>void};

/** A small entry to the existing Ask and content workspaces. No query is submitted here. */
export function createWorkbenchUi(api:DesktopApi, actions:WorkbenchActions) {
  const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
  const question=el<HTMLTextAreaElement>('home-question'),submit=el<HTMLButtonElement>('home-ask-submit'),history=el('home-conversations');
  let status:Status|undefined,authorization='',generation=0,blocked=false,hasContent=false,hasSource=false;
  function controls(){
    submit.disabled=blocked||!question.value.trim();
    for(const button of Array.from(history.querySelectorAll('button')))button.disabled=blocked;
  }
  function onboarding(){
    el('home-onboarding').hidden=hasContent||hasSource||Boolean(status?.lastCaptureAt)||Boolean(status?.queueDepth)||Boolean(status?.running);
  }
  function message(text:string){
    const empty=document.createElement('p');empty.className='home-empty';empty.textContent=text;history.replaceChildren(empty);
  }
  function renderHistory(items:RecentConversation[]){
    history.removeAttribute('aria-busy');history.replaceChildren();
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
    if(!status?.config.serverUrl||!status.config.tokenConfigured){history.removeAttribute('aria-busy');message(moteText('连接中央后查看对话历史'));return;}
    history.setAttribute('aria-busy','true');
    try{
      const page=await api.ask('history') as {items:RecentConversation[]};
      if(version===generation)renderHistory(page.items);
    }catch(error){if(version===generation){history.removeAttribute('aria-busy');message(error instanceof Error?error.message:moteText('请求失败，请重试'));}}
  }
  question.addEventListener('input',controls);
  el('home-ask-form').addEventListener('submit',event=>{event.preventDefault();if(blocked||!question.value.trim())return;if(actions.question(question.value)){question.value='';controls();}});
  return {
    refresh,
    setHistory(items:RecentConversation[]){generation++;renderHistory(items);},
    setBusy(value:boolean){blocked=value;controls();},
    setHasContent(value:boolean){hasContent=value;onboarding();},
    setHasSource(value:boolean){hasSource=value;onboarding();},
    update(next:Status){
      status=next;onboarding();
      const capture={stopped:moteText('已停止'),capturing:moteText('正在记录'),paused:moteText('已暂停'),permission_required:moteText('需要屏幕录制权限'),error:moteText('采集需要处理')}[next.state];
      const sending=next.config.syncPaused?moteText('发送已暂停'):next.sync.state==='unconfigured'?moteText('仅保存在本机'):next.sync.state==='error'?moteText('发送需要处理'):next.sync.state==='uploading'?moteText('正在发送'):next.config.syncMode==='manual'?moteText('仅手动发送'):moteText('按设置自动发送');
      el('home-collection-summary').textContent=capture+' · '+sending;
      const key=JSON.stringify([next.authorizationGeneration,next.config.serverUrl,next.config.tokenConfigured,next.config.authSignedOut,next.config.authExpiresAt,next.config.authSourceBinding]);
      if(key!==authorization){authorization=key;generation++;history.replaceChildren();void refresh();}
    },
  };
}
