import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import {createWorkbenchUi} from '../src/workbench-ui';
import type {DesktopApi,Status} from '../src/contracts';

const conversation={id:'11111111-1111-4111-8111-111111111111',title:'Generated <script>title</script>',turnCount:2,updatedAt:'2026-10-28T16:20:00Z'};
const status={authorizationGeneration:1,state:'stopped',running:false,queueDepth:0,sync:{state:'idle',pendingRecords:0},config:{serverUrl:'http://127.0.0.1:1234',tokenConfigured:true,syncMode:'batch',syncPaused:false}} as Status;
let dom:JSDOM,api:DesktopApi,ui:ReturnType<typeof createWorkbenchUi>;
const actions={question:vi.fn<(text:string)=>boolean>(),conversation:vi.fn<(id:string)=>void>()};
const el=(id:string)=>document.getElementById(id)!;
const flush=()=>new Promise<void>(resolve=>setImmediate(resolve));
beforeEach(()=>{
  dom=new JSDOM(readFileSync(new URL('../src/index.html',import.meta.url),'utf8'));vi.stubGlobal('document',dom.window.document);
  actions.question.mockReset().mockReturnValue(true);actions.conversation.mockReset();
  api={ask:vi.fn(async()=>({items:[conversation]}))} as unknown as DesktopApi;
  ui=createWorkbenchUi(api,actions);
});
afterEach(()=>{dom.window.close();vi.unstubAllGlobals();});

it('opens the same real conversation and treats its title as text',async()=>{
  ui.update(status);await flush();
  const button=el('home-conversations').querySelector('button')!;
  expect(button.textContent).toContain(conversation.title);expect(button.querySelector('script')).toBeNull();
  expect(button.textContent).toContain('2 轮对话');button.click();expect(actions.conversation).toHaveBeenCalledWith(conversation.id);
  ui.setBusy(true);expect(button.disabled).toBe(true);button.click();expect(actions.conversation).toHaveBeenCalledTimes(1);
});

it('does not repopulate history after a login change with a late private response',async()=>{
  let finish!:(value:{items:typeof conversation[]})=>void;
  vi.mocked(api.ask).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
  ui.update(status);ui.update({...status,authorizationGeneration:2,config:{...status.config,tokenConfigured:false}});
  finish({items:[conversation]});await flush();
  expect(el('home-conversations').textContent).not.toContain(conversation.title);expect(el('home-conversations').querySelector('button')).toBeNull();
  expect(el('home-conversations').getAttribute('aria-busy')).toBeNull();
});

it('preserves the home question when changing drafts is cancelled and never submits a model request',()=>{
  const input=el('home-question') as HTMLTextAreaElement,submit=el('home-ask-submit') as HTMLButtonElement;
  expect(submit.disabled).toBe(true);input.value='Generated unsent question';input.dispatchEvent(new dom.window.Event('input'));
  expect(submit.disabled).toBe(false);actions.question.mockReturnValueOnce(false);
  el('home-ask-form').dispatchEvent(new dom.window.Event('submit',{cancelable:true}));expect(input.value).toBe('Generated unsent question');
  el('home-ask-form').dispatchEvent(new dom.window.Event('submit',{cancelable:true}));expect(input.value).toBe('');expect(submit.disabled).toBe(true);
  expect(api.ask).not.toHaveBeenCalled();
});

it('keeps collection and sending independent and only dismisses first-use after real content or a source',async()=>{
  vi.mocked(api.ask).mockResolvedValue({items:[]});
  ui.update(status);await flush();expect(el('home-onboarding').hidden).toBe(true);
  ui.setHasContent(false);
  ui.update({...status,config:{...status.config,syncPaused:true}});await flush();
  expect(el('home-collection-summary').textContent).toBe('已停止 · 发送已暂停');expect(el('home-onboarding').hidden).toBe(false);
  ui.update({...status,running:true,state:'capturing',config:{...status.config,syncPaused:true}});
  expect(el('home-collection-summary').textContent).toBe('正在记录 · 发送已暂停');expect(el('home-onboarding').hidden).toBe(true);
  ui.update(status);ui.setHasContent(true);expect(el('home-onboarding').hidden).toBe(true);
  ui.setHasContent(false);ui.setHasSource(true);expect(el('home-onboarding').hidden).toBe(true);
});

it('keeps IPC diagnostics out of the home error and retries history in place',async()=>{
  vi.mocked(api.ask).mockRejectedValueOnce(Error("Error invoking remote method 'mote:ask': generated failure 503"));
  ui.update(status);await flush();
  expect(el('home-conversations').textContent).toContain('对话暂不可读取');
  expect(el('home-conversations').textContent).not.toMatch(/mote:ask|503/);
  el('home-conversations').querySelector('button')!.click();await flush();
  expect(el('home-conversations').textContent).toContain(conversation.title);
});


it('does not hide retained conversations behind first-use when all original materials are gone',async()=>{
  ui.setHasContent(false);ui.update(status);await flush();
  expect(el('home-onboarding').hidden).toBe(true);
  expect(document.querySelector('[data-page=overview]')!.classList.contains('first-use-home')).toBe(false);
  expect(el('home-conversations').textContent).toContain(conversation.title);
});

it('does not claim an empty profile when its conversation history cannot be read',async()=>{
  vi.mocked(api.ask).mockRejectedValue(Error('Generated unavailable archive'));
  ui.setHasContent(false);ui.update(status);await flush();
  expect(el('home-onboarding').hidden).toBe(true);
  expect(el('home-conversations').textContent).toContain('对话暂不可读取');
});

it('tracks the explicitly selected first note by its draft ID and keeps its exact original through a reader return',async()=>{
  vi.mocked(api.ask).mockResolvedValue({items:[]});
  document.querySelector<HTMLElement>('[data-page=overview]')!.hidden=false;
  api.noteDraft=vi.fn(async()=>({id:conversation.id,text:'',description:'',mood:'',revision:0}));
  api.localContentDetail=vi.fn(async()=>({text:'  Generated exact original\n第二行  ',metadata:'',sourceName:'Generated Mac'}));
  ui.update(status);ui.setHasContent(false);await flush();
  el('home-onboarding').querySelector<HTMLButtonElement>('[data-add-choice=note]')!.click();await flush();
  ui.setHasContent(true);
  ui.setHomeRows([{key:'queue:unrelated',source:'note',title:'Unrelated',preview:'Wrong record',observedAt:new Date().toISOString()}]);
  expect(el('home-first-record').hidden).toBe(true);
  ui.setHomeRows([{key:'queue:'+conversation.id,source:'note',title:'Generated exact original',preview:'Short preview',observedAt:new Date().toISOString()}]);await flush();
  expect(el('home-first-record-preview').textContent).toBe('  Generated exact original\n第二行  ');
  expect(api.localContentDetail).toHaveBeenCalledWith('queue:'+conversation.id);
  ui.leave('content-reader');expect(el('home-onboarding').hidden).toBe(false);
  ui.leave('records');expect(el('home-onboarding').hidden).toBe(true);expect(el('home-first-record-preview').textContent).toBe('');
});

it('cannot restore first-note content after the owner connection changes while its read is pending',async()=>{
  vi.mocked(api.ask).mockResolvedValue({items:[]});
  document.querySelector<HTMLElement>('[data-page=overview]')!.hidden=false;
  api.noteDraft=vi.fn(async()=>({id:conversation.id,text:'',description:'',mood:'',revision:0}));
  let finish!:(value:{text:string;metadata:string;sourceName:string})=>void;
  api.localContentDetail=vi.fn(()=>new Promise(resolve=>{finish=resolve;}));
  ui.update(status);ui.setHasContent(false);await flush();el('note-action').click();await flush();ui.setHasContent(true);
  ui.setHomeRows([{key:'queue:'+conversation.id,source:'note',title:'Generated original',preview:'',observedAt:new Date().toISOString()}]);
  ui.update({...status,authorizationGeneration:2,config:{...status.config,tokenConfigured:false}});
  finish({text:'Previous owner generated original',metadata:'',sourceName:'Previous owner'});await flush();
  expect(el('home-first-record-preview').textContent).toBe('');expect(el('home-first-record').hidden).toBe(true);
});

it('keeps an already confirmed first-note receipt when its original later becomes unreadable',async()=>{
  vi.mocked(api.ask).mockResolvedValue({items:[]});
  document.querySelector<HTMLElement>('[data-page=overview]')!.hidden=false;
  api.noteDraft=vi.fn(async()=>({id:conversation.id,text:'',description:'',mood:'',revision:0}));
  api.localContentDetail=vi.fn(async()=>({location:'central',captureId:conversation.id,text:'Generated first original',metadata:'',sourceName:'Generated Mac'}));
  ui.update(status);ui.setHasContent(false);await flush();el('note-action').click();await flush();ui.setHasContent(true);
  ui.setHomeRows([{key:'capture:'+conversation.id,source:'note',title:'Generated first original',preview:'',observedAt:new Date().toISOString()}]);await flush();
  expect(el('home-first-record-state').textContent).toBe('中央已收到');
  vi.mocked(api.localContentDetail).mockRejectedValue(Error('Generated original HTTP503'));
  ui.update({...status,sync:{...status.sync,state:'uploading'}});await flush();
  expect(el('home-first-record-state').textContent).toBe('中央已收到');
  expect(el('home-first-copy').textContent).toBe('资料已收到，原文暂不可用。');
  expect(el('home-first-record-preview').textContent).toBe('');
  expect(el('home-onboarding').hidden).toBe(false);
});

it('does not reuse a first-note receipt after the owner generation changes, even for an identical draft ID',async()=>{
  vi.mocked(api.ask).mockResolvedValue({items:[]});document.querySelector<HTMLElement>('[data-page=overview]')!.hidden=false;
  api.noteDraft=vi.fn(async()=>({id:conversation.id,text:'',description:'',mood:'',revision:0}));
  api.localContentDetail=vi.fn(async()=>({location:'central',captureId:conversation.id,text:'Old owner first original',metadata:'',sourceName:'Generated Mac'}));
  ui.update(status);ui.setHasContent(false);await flush();el('note-action').click();await flush();ui.setHasContent(true);
  const row={key:'queue:'+conversation.id,source:'note' as const,title:'Generated original',preview:'',observedAt:new Date().toISOString()};ui.setHomeRows([row]);await flush();expect(el('home-first-record-state').textContent).toBe('中央已收到');
  vi.mocked(api.localContentDetail).mockRejectedValue(Error('New owner original unavailable'));
  ui.update({...status,authorizationGeneration:2});ui.setHasContent(false);await flush();el('note-action').click();await flush();ui.setHasContent(true);ui.setHomeRows([row]);await flush();
  expect(el('home-first-record-state').textContent).toBe('接收结果待核实');expect(el('home-first-copy').textContent).not.toContain('资料已收到');
});

it('does not replace the selected first note with a different capture returned by its reader',async()=>{
  vi.mocked(api.ask).mockResolvedValue({items:[]});document.querySelector<HTMLElement>('[data-page=overview]')!.hidden=false;
  api.noteDraft=vi.fn(async()=>({id:conversation.id,text:'',description:'',mood:'',revision:0}));
  api.localContentDetail=vi.fn(async()=>({location:'central',captureId:'22222222-2222-4222-8222-222222222222',text:'Unrelated capture',metadata:'',sourceName:'Generated Mac'}));
  ui.update(status);ui.setHasContent(false);await flush();el('note-action').click();await flush();ui.setHasContent(true);
  ui.setHomeRows([{key:'queue:'+conversation.id,source:'note',title:'Generated first original',preview:'',observedAt:new Date().toISOString()}]);await flush();
  expect(el('home-first-record-state').textContent).toBe('接收结果待核实');expect(el('home-first-record-preview').textContent).toBe('');
});

it('keeps receipt confirmation from the exact current-device remote row when the first body read fails',async()=>{
  vi.mocked(api.ask).mockResolvedValue({items:[]});document.querySelector<HTMLElement>('[data-page=overview]')!.hidden=false;
  api.noteDraft=vi.fn(async()=>({id:conversation.id,text:'',description:'',mood:'',revision:0}));
  api.localContentDetail=vi.fn(async()=>{throw Error('Generated first body HTTP503');});
  ui.update(status);ui.setHasContent(false);await flush();el('note-action').click();await flush();ui.setHasContent(true);
  ui.setHomeRows([{key:'capture:'+conversation.id,source:'note',title:'Current-device received row',preview:'',observedAt:new Date().toISOString()}]);await flush();
  expect(el('home-first-record-state').textContent).toBe('中央已收到');expect(el('home-first-copy').textContent).toBe('资料已收到，原文暂不可用。');expect(el('home-first-record-preview').textContent).toBe('');
});

it('withdraws central first-note text on same-node denial and rejects its late body while retaining the exact receipt',async()=>{
  vi.mocked(api.ask).mockResolvedValue({items:[]});document.querySelector<HTMLElement>('[data-page=overview]')!.hidden=false;
  api.noteDraft=vi.fn(async()=>({id:conversation.id,text:'',description:'',mood:'',revision:0}));
  api.localContentDetail=vi.fn(async()=>({location:'central',captureId:conversation.id,text:'Generated authorized original',metadata:'',sourceName:'Generated Mac'}));
  ui.update(status);ui.setHasContent(false);await flush();el('note-action').click();await flush();ui.setHasContent(true);
  const row={key:'capture:'+conversation.id,source:'note' as const,title:'Generated original',preview:'',observedAt:new Date().toISOString()};ui.setHomeRows([row]);await flush();
  let finish!:(value:unknown)=>void;vi.mocked(api.localContentDetail).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));ui.setHomeRows([row]);
  ui.setArchiveAuthorizationDenied(true);ui.setHomeRows([]);
  expect(el('home-first-record-preview').textContent).toBe('');expect(el('home-first-record-state').textContent).toBe('中央已收到');expect((el('home-first-read') as HTMLButtonElement).disabled).toBe(true);
  finish({location:'central',captureId:conversation.id,text:'Generated late denied original',metadata:'',sourceName:'Generated Mac'});await flush();
  expect(el('home-first-record-preview').textContent).toBe('');expect(el('home-first-copy').textContent).toBe('资料已收到，原文暂不可用。');
  ui.setHomeRows([row]);await flush();expect(el('home-first-record-preview').textContent).toBe('');
  ui.setArchiveAuthorizationDenied(false);ui.setHomeRows([row]);await flush();expect(el('home-first-record-preview').textContent).toBe('Generated authorized original');expect((el('home-first-read') as HTMLButtonElement).disabled).toBe(false);
});

it('keeps the independent local first-note original when central archive access is denied',async()=>{
  vi.mocked(api.ask).mockResolvedValue({items:[]});document.querySelector<HTMLElement>('[data-page=overview]')!.hidden=false;
  api.noteDraft=vi.fn(async()=>({id:conversation.id,text:'',description:'',mood:'',revision:0}));
  api.localContentDetail=vi.fn(async()=>({text:'Generated independent local original',metadata:'',sourceName:'Generated Mac'}));
  ui.update(status);ui.setHasContent(false);await flush();el('note-action').click();await flush();ui.setHasContent(true);
  ui.setHomeRows([{key:'queue:'+conversation.id,source:'note',title:'Generated local',preview:'',observedAt:new Date().toISOString()}]);await flush();
  ui.setArchiveAuthorizationDenied(true);ui.setHomeRows([]);
  expect(el('home-first-record-preview').textContent).toBe('Generated independent local original');expect(el('home-first-record-state').textContent).toBe('本机已保存');expect((el('home-first-read') as HTMLButtonElement).disabled).toBe(false);
});

it('does not transfer a local read grant to a new capture row while its first remote read is held',async()=>{
  vi.mocked(api.ask).mockResolvedValue({items:[]});document.querySelector<HTMLElement>('[data-page=overview]')!.hidden=false;
  api.noteDraft=vi.fn(async()=>({id:conversation.id,text:'',description:'',mood:'',revision:0}));api.localContentDetail=vi.fn(async()=>({text:'Generated prior local original',metadata:'',sourceName:'Generated Mac'}));
  const opened=vi.fn();ui=createWorkbenchUi(api,{...actions,content:opened});ui.update(status);ui.setHasContent(false);await flush();el('note-action').click();await flush();ui.setHasContent(true);
  const local={key:'queue:'+conversation.id,source:'note' as const,title:'Generated local',preview:'',observedAt:new Date().toISOString()};ui.setHomeRows([local]);await flush();
  expect(el('home-first-record-preview').textContent).toBe('Generated prior local original');
  let finish!:(value:unknown)=>void;vi.mocked(api.localContentDetail).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));ui.setHomeRows([{...local,key:'capture:'+conversation.id,title:'Generated central title'}]);
  ui.setArchiveAuthorizationDenied(true);expect(el('home-first-record-preview').textContent).toBe('');expect((el('home-first-read') as HTMLButtonElement).disabled).toBe(true);el('home-first-read').click();expect(opened).not.toHaveBeenCalled();expect(el('home-first-record-state').textContent).toBe('中央已收到');
  finish({location:'central',captureId:conversation.id,text:'Generated late remote original',metadata:'',sourceName:'Generated Mac'});await flush();expect(el('home-first-record-preview').textContent).toBe('');
  ui.setArchiveAuthorizationDenied(false);expect((el('home-first-read') as HTMLButtonElement).disabled).toBe(false);
  vi.mocked(api.localContentDetail).mockResolvedValue({text:'Generated current local original',metadata:'',sourceName:'Generated Mac'});ui.setHomeRows([local]);await flush();ui.setArchiveAuthorizationDenied(true);expect((el('home-first-read') as HTMLButtonElement).disabled).toBe(false);el('home-first-read').click();expect(opened).toHaveBeenCalledWith(local);expect(el('home-first-record-preview').textContent).toBe('Generated current local original');
});
