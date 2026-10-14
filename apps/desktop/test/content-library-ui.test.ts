import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import {createContentLibraryUi} from '../src/content-library-ui';
import {centralContentPage,type CentralContentPage,type ContentDetail,type ContentItem} from '../src/content-library';
import {defaultConfig} from '../src/config';
import type {DesktopApi,Status} from '../src/contracts';
import type {SyncContent} from '../src/sync-content';

vi.mock('../src/background',()=>({previewWork:{run:vi.fn()},sourceWork:{run:vi.fn()}}));
const id='11111111-1111-4111-8111-111111111111';
const item:ContentItem={key:`capture:${id}`,source:'note',title:'Generated note',observedAt:'2026-10-11T00:00:00Z',preview:'Generated preview'};
const remote:SyncContent={item:{key:id,source:'note',title:item.title,observedAt:item.observedAt,outcome:'received',firstReceipt:false},location:'central',captureId:id,text:'GENERATED PRIVATE BODY',metadata:'GENERATED PRIVATE METADATA',image:'data:image/jpeg;base64,Z2VuZXJhdGVk',hasImage:true,readiness:'ready'};
const status={authorizationGeneration:1,queueDepth:0,sync:{pendingRecords:0,state:'manual'},config:{tokenConfigured:true,serverUrl:'http://127.0.0.1:9999',deviceId:id}} as Status;
let dom:JSDOM,library:ReturnType<typeof createContentLibraryUi>,api:DesktopApi,page:CentralContentPage;
let dialog:HTMLDialogElement;
const flush=()=>new Promise<void>(resolve=>setImmediate(resolve));
const el=(id:string)=>document.getElementById(id)!;
beforeEach(()=>{
  dom=new JSDOM(readFileSync(new URL('../src/index.html',import.meta.url),'utf8'));vi.stubGlobal('document',dom.window.document);
  dialog=el('content-detail-dialog') as HTMLDialogElement;
  dialog.showModal=()=>{dialog.open=true;};dialog.close=()=>{dialog.open=false;};
  page={items:[item],total:1};
  api={localContent:vi.fn(async()=>({items:[],total:0})),centralContent:vi.fn(async()=>page),centralContentDetail:vi.fn(async()=>remote),localContentDetail:vi.fn(async()=>({text:'GENERATED LOCAL BODY',metadata:'GENERATED LOCAL METADATA',sourceName:'Generated Mac'}))} as unknown as DesktopApi;
  library=createContentLibraryUi(api);library.update(status);
});
afterEach(()=>{library.close();dom.window.close();vi.unstubAllGlobals();});
async function open(key=item.key){await flush();(document.querySelector(`[data-content-key="${key}"]`) as HTMLButtonElement).click();await flush();}
function expectCleared(){
  expect(dialog.open).toBe(false);
  for(const id of ['content-detail-title','content-detail-source','content-detail-body','content-detail-metadata'])expect(el(id).textContent).toBe('');
  expect(el('content-detail-image').getAttribute('src')).toBeNull();
}

it.each([401,403])('closes an open central reader on a feed HTTP %s, invalidating a late detail response',async code=>{
  await open();expect(el('content-detail-body').textContent).toBe(remote.text);expect(el('content-detail-image').getAttribute('src')).toBe(remote.image);
  let finish!:(value:SyncContent)=>void;
  vi.mocked(api.centralContentDetail).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
  (el('content-detail-refresh') as HTMLButtonElement).click();await flush();
  vi.stubGlobal('fetch',vi.fn(async()=>new Response('{}',{status:code})));
  vi.mocked(api.centralContent).mockImplementationOnce(()=>centralContentPage({...defaultConfig(),serverUrl:status.config.serverUrl,token:'generated-token',deviceId:id}));
  await library.refresh();expectCleared();expect(document.querySelectorAll('#content-feed .content-row')).toHaveLength(0);
  finish({...remote,text:'GENERATED LATE PRIVATE BODY'});await flush();expectCleared();
});

it('keeps an open local reader after the central feed denies access',async()=>{
  const local={...item,key:'queue:22222222-2222-4222-8222-222222222222'};vi.mocked(api.localContent).mockResolvedValue({items:[local],total:1});
  await library.refresh();await open(local.key);
  page={items:[],total:0,authorizationDenied:true};await library.refresh();
  expect(dialog.open).toBe(true);expect(el('content-detail-body').textContent).toBe('GENERATED LOCAL BODY');expect(el('content-detail-metadata').textContent).toBe('GENERATED LOCAL METADATA');
});

it('closes a late central receipt resolved from a local row after feed access was denied',async()=>{
  const local={...item,key:`source:local-${id}:generated-version`};vi.mocked(api.localContent).mockResolvedValue({items:[local],total:1});
  let finish!:(value:ContentDetail|SyncContent)=>void;vi.mocked(api.localContentDetail).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
  await library.refresh();await open(local.key);page={items:[],total:0,authorizationDenied:true};await library.refresh();
  expect(dialog.open).toBe(true);finish(remote);await flush();expectCleared();
});

it('preserves an open central reader on temporary network or server failure',async()=>{
  await open();vi.mocked(api.centralContent).mockRejectedValueOnce(Error('Generated temporary network failure'));
  await library.refresh();expect(dialog.open).toBe(true);expect(el('content-detail-body').textContent).toBe(remote.text);expect(el('content-detail-image').getAttribute('src')).toBe(remote.image);
  vi.stubGlobal('fetch',vi.fn(async()=>new Response('{}',{status:503})));
  await expect(centralContentPage({...defaultConfig(),serverUrl:status.config.serverUrl,token:'generated-token',deviceId:id})).rejects.toThrow();
});

it('clears private DOM and invalidates old requests when a credential changes within the same node',async()=>{
  await open();let finish!:(value:SyncContent)=>void;vi.mocked(api.centralContentDetail).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
  (el('content-detail-refresh') as HTMLButtonElement).click();await flush();library.update({...status,authorizationGeneration:2});expectCleared();
  finish(remote);await flush();expectCleared();
});

it('shows a note excerpt once and reads its exact original before expandable processing stages',async()=>{
  const text='Generated first line\nGenerated second line';
  page={items:[{...item,title:'Generated first line',preview:text}],total:1};
  vi.mocked(api.centralContentDetail).mockResolvedValue({...remote,text});
  await library.refresh();
  const button=document.querySelector<HTMLButtonElement>('#content-feed .content-row')!;
  const copy=button.querySelector('.content-row-copy')!;
  expect(copy.querySelector('strong')).toBeNull();expect(copy.querySelector('span')!.textContent).toBe(text);
  button.click();await flush();
  expect(el('content-detail-title').textContent).not.toContain('Generated first line');
  expect(el('content-detail-body').textContent).toBe(text);
  const processing=el('content-processing') as HTMLDetailsElement;
  expect(processing.open).toBe(false);expect(processing.querySelector('summary')!.textContent!.trim()).not.toBe('');
  expect(el('content-detail-body').compareDocumentPosition(processing)&dom.window.Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(el('content-detail-status').textContent).not.toBe('');
  processing.open=true;expect(processing.querySelectorAll('li')).toHaveLength(4);
  el('content-detail-close').click();expect(document.activeElement).toBe(button);
});

it('retains the authored title of a non-note source and resets process help for the next reader',async()=>{
  page={items:[{...item,source:'file',title:'Generated authored file name'}],total:1};
  await library.refresh();await open();
  expect(document.querySelector('#content-feed .content-row-copy strong')!.textContent).toBe('Generated authored file name');
  expect(el('content-detail-title').textContent).toBe('Generated authored file name');
  (el('content-processing') as HTMLDetailsElement).open=true;el('content-detail-close').click();await open();
  expect((el('content-processing') as HTMLDetailsElement).open).toBe(false);
});

it('keeps source time separate from the original and omits absent source separators',async()=>{
  page={items:[item],total:1};await library.refresh();await open();
  const time=document.querySelector<HTMLTimeElement>('#content-feed .content-row-copy time')!;
  expect(time.dateTime).toBe(item.observedAt);expect(time.textContent).not.toBe('');
  expect(document.querySelector('#content-feed .content-source-name')!.textContent).not.toBe('');
  expect(el('content-detail-source').textContent).not.toMatch(/^\s*·/);
  expect(el('content-detail-body').textContent).toBe(remote.text);
});
