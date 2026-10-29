import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import {createSourceWorkspaceUi} from '../src/source-workspace-ui';
import type {DesktopApi,Status} from '../src/contracts';
import type {SourceStatus} from '../src/contracts/sources';
import type {SourceContextState} from '../src/source-context-outbox';

const id='generated-same-local-source';
const status=(generation:number)=>({authorizationGeneration:generation,config:{serverUrl:`http://127.0.0.1:${8000+generation}`,tokenConfigured:true}} as Status);
const context=(description:string):SourceContextState=>({snapshot:{sourceId:id,version:0,description}});
const source:SourceStatus={source:{id,name:'Generated folder',kind:'local-files',deviceId:'generated-device',platform:'macos',retention:'snapshot',enabled:true,intervalSeconds:60,trackDeletions:false,extensions:[],excludedPaths:[],redactLiterals:[]},state:'idle',message:'Generated status',items:1,skipped:0,pending:0,scanComplete:true};
const flush=()=>new Promise<void>(resolve=>setImmediate(resolve));
let dom:JSDOM,api:DesktopApi,ui:ReturnType<typeof createSourceWorkspaceUi>;
const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const openDescription=()=>document.querySelector<HTMLButtonElement>('#source-detail-body .source-detail-context button')!.click();
beforeEach(()=>{
 dom=new JSDOM(readFileSync(new URL('../src/index.html',import.meta.url),'utf8'));vi.stubGlobal('document',dom.window.document);
 const dialog=el<HTMLDialogElement>('source-context-dialog');dialog.showModal=()=>{dialog.open=true;};dialog.close=()=>{dialog.open=false;};
 api={sourcePendingContent:vi.fn(async()=>({items:[],total:0})),sourceArchivedContent:vi.fn(async()=>({items:[]})),sourceContext:vi.fn(async()=>context('New node description')),saveSourceContext:vi.fn(async(_id,write)=>({...context('New node description'),pending:write}))} as unknown as DesktopApi;
 ui=createSourceWorkspaceUi(api,{openDetail:()=>true,edit:()=>{},toggle:async()=>{},content:()=>{},read:()=>{}});ui.status(status(1));ui.update([structuredClone(source)]);ui.open(id);
});
afterEach(()=>{ui.clear();dom.window.close();vi.unstubAllGlobals();});

it.each(['load','refresh','save'] as const)('does not apply a late %s to the same source ID reopened on another node',async operation=>{
 let finish!:(value:SourceContextState)=>void;const deferred=new Promise<SourceContextState>(resolve=>{finish=resolve;});
 if(operation==='load')vi.mocked(api.sourceContext).mockReturnValueOnce(deferred);
 openDescription();await flush();
 if(operation==='refresh'){vi.mocked(api.sourceContext).mockReturnValueOnce(deferred);el<HTMLButtonElement>('source-context-refresh').click();}
 if(operation==='save'){vi.mocked(api.saveSourceContext).mockReturnValueOnce(deferred);el<HTMLTextAreaElement>('source-context-description').value='Old node draft';el<HTMLButtonElement>('source-context-save').click();}
 await flush();ui.clear();ui.status(status(2));ui.update([structuredClone(source)]);ui.open(id);openDescription();await flush();
 el<HTMLTextAreaElement>('source-context-description').value='New node unsaved draft';
 finish({...context('Old node secret'),pending:{expectedVersion:0,description:'Old node pending secret'}});await flush();
 expect(el<HTMLDialogElement>('source-context-dialog').open).toBe(true);
 expect(el<HTMLTextAreaElement>('source-context-description').value).toBe('New node unsaved draft');
 expect(el('source-detail-body').textContent).not.toContain('Old node');
 expect(el('source-context-current-text').textContent).not.toContain('Old node');
 el<HTMLButtonElement>('source-context-save').click();await flush();
 expect(api.saveSourceContext).toHaveBeenLastCalledWith(id,{expectedVersion:0,description:'New node unsaved draft'});
});

it('invalidates a late load when closed and reopened without changing the node',async()=>{
 let finish!:(value:SourceContextState)=>void;vi.mocked(api.sourceContext).mockReturnValueOnce(new Promise(resolve=>{finish=resolve;}));openDescription();await flush();
 el<HTMLButtonElement>('source-context-cancel').click();openDescription();await flush();el<HTMLTextAreaElement>('source-context-description').value='Reopened draft';
 finish(context('Closed editor response'));await flush();expect(el<HTMLTextAreaElement>('source-context-description').value).toBe('Reopened draft');
});

it('shows an enabled but centrally paused source as paused in the list and detail',()=>{
 ui.update([{...structuredClone(source),state:'paused',message:'Generated Central pause'}]);
 expect(el('source-list').querySelector('.source-state')?.textContent).toBe('已暂停');
 expect(el('source-detail-body').querySelector('.source-state')?.textContent).toBe('已暂停');
 expect(el('source-detail-body').textContent).toContain('Generated Central pause');
 expect(el('source-detail-body').textContent).not.toContain('持续同步');
});

it('keeps rejected files visible as attention items instead of claiming they are waiting to send',()=>{
 ui.update([{...structuredClone(source),pending:0,blocked:1,failures:[{externalId:'generated-blocked',title:'Generated <script>literal</script>.txt',status:410}]}]);
 const detail=el('source-detail-body'),failure=detail.querySelector('.source-failures')!;expect(failure.textContent).toContain('本机待处理 1 项');expect(failure.textContent).toContain('中央已删除此文件');expect(failure.textContent).toContain('<script>literal</script>');expect(failure.querySelector('script')).toBeNull();expect(detail.textContent).toContain('本机待发送 · 0');expect(detail.textContent).not.toContain('本机待发送 · 1');
});
