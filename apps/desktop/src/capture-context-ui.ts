import {moteText} from '@mote/shared/i18n';
import type {DesktopApi,Status} from './contracts';
import type {CaptureContextChannel} from './source-manager';
import type {SourceContextState} from './source-context-outbox';

/** The versioned owner declaration belongs to this device/channel, separately from captured bytes. */
export function createCaptureContextUi(api:DesktopApi,root:Document=document){
  const button=root.createElement('button');button.id='capture-context-open';button.type='button';button.className='text-button';button.textContent=moteText('资料说明');root.querySelector('[data-page="screen"] .page-header')!.append(button);
  const dialog=root.createElement('dialog');dialog.id='capture-context-dialog';dialog.className='source-add-dialog';
  const title=root.createElement('h2');title.textContent=moteText('采集资料说明');
  const select=root.createElement('select');select.id='capture-context-channel';select.setAttribute('aria-label',moteText('采集通道'));
  for(const [value,label] of [['activity',moteText('应用活动')],['screen',moteText('屏幕记录')],['structured',moteText('页面内容采集')],['notifications',moteText('通知')]]){const option=root.createElement('option');option.value=value;option.textContent=label;select.append(option);}
  const scope=root.createElement('p');scope.className='helper';scope.textContent=moteText('适用于这台 Mac 所选通道的已有与后续资料，不改写原文。');
  const input=root.createElement('textarea');input.id='capture-context-description';input.rows=5;input.maxLength=12000;input.setAttribute('aria-label',moteText('资料说明'));
  const message=root.createElement('p');message.id='capture-context-state';message.className='helper';message.setAttribute('role','status');
  const actions=root.createElement('div');actions.className='actions';const cancel=root.createElement('button');cancel.type='button';cancel.className='secondary';cancel.textContent=moteText('取消');const save=root.createElement('button');save.type='button';save.className='primary';save.textContent=moteText('保存');save.id='capture-context-save';actions.append(cancel,save);dialog.append(title,select,scope,input,message,actions);root.body.append(dialog);
  let state:SourceContextState|undefined,generation=0,key='',reading=false,saving=false,channel=select.value as CaptureContextChannel;
  const controls=()=>{select.disabled=saving;input.disabled=reading||saving||state?.error==='denied';save.disabled=reading||saving||!state||state.error==='denied'||input.value===(state.pending?.description??state.snapshot.description)&&!state.conflict;};
  const dirty=()=>state&&input.value!==(state.pending?.description??state.snapshot.description);
  async function read(){const revision=++generation;reading=true;state=undefined;input.value='';message.textContent=moteText('正在读取…');controls();
    try{const next=await api.captureContext(channel);if(revision!==generation||!dialog.open)return;state=next;input.value=next.pending?.description??next.snapshot.description;message.textContent=next.conflict?moteText('说明已在其他地方更新，请核对后再保存。'):next.pending?moteText('已保存在本机，等待同步。'):next.error==='denied'?moteText('没有访问权限'):next.error?moteText('暂时无法读取中央说明，可在本机保存后同步。'):'';}
    catch(error){if(revision===generation)message.textContent=error instanceof Error?error.message:moteText('操作失败');}
    finally{if(revision===generation){reading=false;controls();}}
  }
  button.addEventListener('click',()=>{dialog.showModal();void read();});input.addEventListener('input',controls);
  select.addEventListener('change',()=>{if(dirty()&&!window.confirm(moteText('有未保存的修改。离开并丢弃修改？'))){select.value=channel;return;}channel=select.value as CaptureContextChannel;void read();});
  const close=()=>{if(saving)return;generation++;dialog.close();input.value='';state=undefined;button.focus();};cancel.addEventListener('click',close);dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  save.addEventListener('click',async()=>{if(save.disabled||!state)return;const revision=generation;saving=true;controls();try{const next=await api.saveCaptureContext(channel,{expectedVersion:state.snapshot.version,description:input.value});if(revision!==generation)return;state=next;message.textContent=next.pending?moteText('已保存在本机，等待同步。'):moteText('已保存');}catch(error){if(revision===generation)message.textContent=error instanceof Error?error.message:moteText('操作失败');}finally{if(revision===generation){saving=false;controls();}}});
  return {update(status:Status){const next=JSON.stringify([status.authorizationGeneration,status.config.deviceId,status.config.serverUrl,status.config.tokenConfigured,status.config.authSignedOut,status.config.authSourceBinding]);if(key&&next!==key){generation++;dialog.close();input.value='';state=undefined;saving=false;reading=false;}key=next;}};
}
