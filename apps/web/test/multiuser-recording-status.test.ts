import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {setTimeout as delay} from 'node:timers/promises';
import {configureLocale,moteText} from '@mote/shared/i18n';
import {recordingFixture} from './fixtures/recordings.js';
import {createApi} from '../src/api.js';
import {RecordingsSettings} from '../src/RecordingsSettings.js';

for(const [provider,locale]of [['feishu-recordings','zh-CN'],['dingtalk-recordings','en']]as const)test(provider+' original recording page shows independent persisted phase failures and retry times',{timeout:120000},async t=>{
 configureLocale(()=>locale);
 const {f,calls,state}=await recordingFixture(t,undefined,provider);state.count=3;state.audioFails=false;
 state.phaseFailures={
  'recording-00':{metadata:{category:'blocked',code:'generated_metadata_blocked'}},
  'recording-01':{transcript:{category:'transient',code:'generated_transcript_pending',retryAfterMs:60000},media:{category:'transient',code:'generated_media_pending',retryAfterMs:120000}},
  'recording-02':{media:{category:'permanent',code:'generated_media_failed'}},
 };
 async function command(path:string,body:unknown){
  const admitted=await f.request(f.a.token,path,'POST',body);assert.equal(admitted.statusCode,200,admitted.body);let task=admitted.json();
  for(let n=0;n<500&&['waiting','running'].includes(task.state);n++){await delay(10);task=(await f.request(f.a.token,'/api/tasks/'+task.id)).json();}
  assert.equal(task.state,'succeeded',JSON.stringify(task));return task;
 }
 const path='/api/connectors/same-recorder';
 await command(path+'/operations',{operationId:crypto.randomUUID(),operation:'connect',payload:{}});
 await command(path+'/operations',{operationId:crypto.randomUUID(),operation:'select',payload:{enabled:true,start:'2026-09-01T00:00:00Z',autoSync:false,backupAudio:true}});
 for(let n=0;n<1000;n++){const items=(await f.request(f.a.token,path+'/recordings?limit=20')).json().items;if(items.length===3&&items.find((item:any)=>item.id==='recording-01')?.audio.attempts===1&&items.find((item:any)=>item.id==='recording-02')?.transcript.state==='succeeded'&&items.find((item:any)=>item.id==='recording-02')?.audio.state==='failed')break;assert.ok(n<999,'The real admitted phases must execute before restart');await delay(10);}
 const checkpoints=(await f.request(f.a.token,path+'/recordings?limit=20')).json().items;
 assert.equal(checkpoints.length,3);
 const status=(await f.request(f.a.token,path)).json();assert.deepEqual(status.counts,{transcripts:1,audio:0,empty:0,pending:2,failed:2});
 const receipt=checkpoints.find((item:{id:string})=>item.id==='recording-01');
 assert.equal(receipt.transcript.error,'generated_transcript_pending');assert.equal(receipt.audio.error,'generated_media_pending');
 assert.ok(receipt.audio.nextAttemptAt>receipt.transcript.nextAttemptAt,'independent stage backoff survives publication');
 await f.restart();
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost/#/connections/recordings',pretendToBeVisual:true}),prior=new Map<string,PropertyDescriptor|undefined>();
 const login=await f.request(undefined,'/api/auth/login','POST',{username:'generated-a',password:'Generated-M13-archive-only-01',mode:'web'});assert.equal(login.statusCode,200,login.body);const cookie=String(login.headers['set-cookie']).split(';')[0];
 for(const [key,value]of Object.entries({window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,HTMLElement:dom.window.HTMLElement,Event:dom.window.Event,IS_REACT_ACT_ENVIRONMENT:true,fetch:async(url:string,init:RequestInit={})=>{const headers=new Headers(init.headers);headers.set('cookie',cookie);const response=await f.host.app.inject({url,method:init.method as any??'GET',headers:Object.fromEntries(headers),...(init.body?{payload:String(init.body)}:{})});return new Response(response.rawPayload,{status:response.statusCode,headers:response.headers as Record<string,string>});}})){prior.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});}
 const api=createApi({mode:'web',origin:'http://localhost',...login.json()}),{createRoot}=await import('react-dom/client'),root=createRoot(dom.window.document.getElementById('root')!),d=dom.window.document;
 t.after(async()=>{api.close?.();await act(async()=>root.unmount());for(const [key,value]of prior){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}dom.window.close();});
 const callCount=calls.length,wait=async(read:()=>boolean,label:string)=>{for(let n=0;n<500&&!read();n++)await act(async()=>delay(10));assert.ok(read(),label+' '+d.body.textContent);};
 await act(async()=>{root.render(React.createElement(React.StrictMode,null,React.createElement(RecordingsSettings,{api,onSources:()=>{},onOpen:()=>{}})));await delay(20);});
 await wait(()=>!!d.querySelector('select[aria-label="'+moteText('连接 ID')+'"] option[value="same-recorder"]'),'owned recording inventory');
 await act(async()=>{const select=d.querySelector<HTMLSelectElement>('select[aria-label="'+moteText('连接 ID')+'"]')!;select.value='same-recorder';select.dispatchEvent(new dom.window.Event('change',{bubbles:true}));await delay(20);});
 assert.ok(d.body.textContent?.includes(moteText('已归档转写 {0} 条，音频 {1} 条；等待 {2} 步，需处理 {3} 步。',1,0,2,2)));
 const rows=()=>Array.from(d.querySelectorAll<HTMLElement>('[aria-label="'+moteText('同步步骤与状态明细')+'"] .source-item'));
 await wait(()=>rows().length===3,'persisted current-selection checkpoints');
 const row=(id:string)=>{const item=rows().find(item=>item.querySelector('strong')?.textContent?.endsWith(id));assert.ok(item,id);return item;};
 const phase=(id:string,name:string)=>{const value=Array.from(row(id).querySelectorAll('p')).find(p=>p.textContent?.startsWith(moteText(name)+' · '));assert.ok(value,id+' '+name);return value.textContent!;};
 assert.ok(phase('recording-00','读取信息').includes(moteText('需要处理')));assert.ok(phase('recording-00','读取信息').includes('generated_metadata_blocked'));
 for(const name of ['归档转写','备份音频']){assert.ok(phase('recording-00',name).includes(moteText('等待处理')));assert.ok(!phase('recording-00',name).includes('generated_metadata_blocked'),'metadata failure must not become a sibling failure');}
 const transcript=phase('recording-01','归档转写'),audio=phase('recording-01','备份音频');
 assert.ok(transcript.includes('generated_transcript_pending'));assert.ok(!transcript.includes('generated_media_pending'));assert.ok(transcript.includes(moteText('下次可运行时间')));assert.ok(transcript.includes(new Date(receipt.transcript.nextAttemptAt).toLocaleString()));
 assert.ok(audio.includes('generated_media_pending'));assert.ok(!audio.includes('generated_transcript_pending'));assert.ok(audio.includes(moteText('下次可运行时间')));assert.ok(audio.includes(new Date(receipt.audio.nextAttemptAt).toLocaleString()));
 assert.ok(phase('recording-02','归档转写').includes(moteText('已完成')));assert.ok(!phase('recording-02','归档转写').includes('generated_media_failed'));
 assert.ok(phase('recording-02','备份音频').includes('generated_media_failed'));assert.ok(phase('recording-02','备份音频').includes(moteText('自动重试已停止，请核对原因后手动重试')));
 assert.equal(calls.length,callCount,'reading phase failures after restart cannot repeat provider IO');
});
