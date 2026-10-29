import {moteText,getLocale} from '@mote/shared/i18n';
import type {DesktopApi,Status} from './contracts';
import type {ContentItem} from './contracts/content';

/** Reads the same complete local queue index as Content; each row opens the shared reader. */
export function createWorkPendingUi(api:DesktopApi,open:(item:ContentItem)=>void,receipts:()=>void){
  const root=document.querySelector<HTMLElement>('[data-page="work"]')!;
  const tabs=document.createElement('div');tabs.className='content-scope-buttons work-delivery-tabs';const pending=document.createElement('button');pending.type='button';pending.className='secondary';pending.textContent=moteText('待发送');pending.setAttribute('aria-pressed','true');const history=document.createElement('button');history.type='button';history.className='secondary';history.id='work-receipts';history.textContent=moteText('接收历史');history.addEventListener('click',receipts);tabs.append(pending,history);root.insertBefore(tabs,root.children[1]);
  const wrapper=document.getElementById('home-sync-details')!;wrapper.replaceWith(...Array.from(wrapper.children).filter(node=>node.tagName!=='SUMMARY'));
  const connection=document.getElementById('central-status')!,details=document.createElement('details'),summary=document.createElement('summary');details.className='disclosure';summary.textContent=moteText('连接状态');details.append(summary);connection.replaceWith(details);details.append(connection);
  const section=document.querySelector<HTMLElement>('.work-local')!,list=document.createElement('div');list.className='work-pending-list';list.id='work-pending-list';const state=document.createElement('p');state.className='helper';state.id='work-pending-state';state.setAttribute('role','status');const more=document.createElement('button');more.type='button';more.className='secondary';more.textContent=moteText('加载更多');more.hidden=true;more.id='work-pending-more';section.append(state,list,more);
  let version=0,active=false,next:number|undefined,reading=false,scope='',items:ContentItem[]=[];
  function render(){list.replaceChildren();for(const item of items){const row=document.createElement('button');row.type='button';row.className='content-row';const copy=document.createElement('span'),title=document.createElement('strong'),meta=document.createElement('small'),status=document.createElement('span');title.textContent=item.title;meta.textContent=[item.sourceName,new Date(item.observedAt).toLocaleString(getLocale())].filter(Boolean).join(' · ');copy.append(title,meta);status.className='tag';status.textContent=item.error?moteText('需要处理'):moteText('本机待发送');row.append(copy,status);row.addEventListener('click',()=>open(item));list.append(row);}more.hidden=next===undefined;}
  async function refresh(append=false){if(!active||reading)return;const revision=++version;reading=true;state.textContent=moteText('正在读取…');more.disabled=true;
    try{const page=await api.localContent(append?next:0);if(revision!==version||!active)return;items=append?[...items,...page.items]:page.items;next=page.nextOffset;render();state.textContent=items.length?'':moteText('没有待发送内容');}
    catch(error){if(revision===version&&active)state.textContent=error instanceof Error?error.message:moteText('操作失败');}
    finally{if(revision===version){reading=false;more.disabled=false;}}
  }
  more.addEventListener('click',()=>void refresh(true));pending.addEventListener('click',()=>void refresh());document.getElementById('work-refresh')!.addEventListener('click',()=>void refresh());
  return {show(){active=true;void refresh();},hide(){active=false;version++;reading=false;},update(status:Status){const nextScope=JSON.stringify([status.authorizationGeneration,status.config.serverUrl,status.config.tokenConfigured,status.queueDepth,status.sync.pendingRecords]);if(scope&&scope!==nextScope){version++;reading=false;items=[];list.replaceChildren();if(active)void refresh();}scope=nextScope;}};
}
