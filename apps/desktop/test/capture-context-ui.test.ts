import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {configureLocale} from '@mote/shared/i18n';
import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import {createCaptureContextUi} from '../src/capture-context-ui';
import type {DesktopApi,Status} from '../src/contracts';
const initial={snapshot:{sourceId:'activity:generated',version:0,description:''}};
let dom:JSDOM,api:DesktopApi,ui:ReturnType<typeof createCaptureContextUi>;
const flush=()=>new Promise(resolve=>setImmediate(resolve));const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
beforeEach(()=>{configureLocale(()=> 'zh-CN');dom=new JSDOM(readFileSync(new URL('../src/index.html',import.meta.url),'utf8'));vi.stubGlobal('document',dom.window.document);vi.stubGlobal('window',dom.window);dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;};api={captureContext:vi.fn(async()=>initial),saveCaptureContext:vi.fn(async(_channel,input)=>({...initial,pending:input}))} as unknown as DesktopApi;ui=createCaptureContextUi(api);ui.update({config:{deviceId:'generated',serverUrl:'',tokenConfigured:false}} as Status);});
afterEach(()=>{dom.window.close();vi.unstubAllGlobals();});
it('saves an independent channel declaration as local pending, then keeps its draft after a failed save',async()=>{
 el<HTMLButtonElement>('capture-context-open').click();await flush();el<HTMLTextAreaElement>('capture-context-description').value='Generated owner declaration';el('capture-context-description').dispatchEvent(new dom.window.Event('input'));el<HTMLButtonElement>('capture-context-save').click();await flush();expect(api.saveCaptureContext).toHaveBeenCalledWith('activity',{expectedVersion:0,description:'Generated owner declaration'});expect(el('capture-context-state').textContent).toContain('等待同步');expect(el('capture-context-state').textContent).not.toContain('已同步');
 vi.mocked(api.saveCaptureContext).mockRejectedValueOnce(Error('Generated unavailable'));el<HTMLTextAreaElement>('capture-context-description').value='Generated retained draft';el('capture-context-description').dispatchEvent(new dom.window.Event('input'));el<HTMLButtonElement>('capture-context-save').click();await flush();expect(el<HTMLTextAreaElement>('capture-context-description').value).toBe('Generated retained draft');expect(el('capture-context-state').textContent).toContain('unavailable');
});
it('lets the owner explicitly review and resubmit the same pending text at the newly observed version after conflict',async()=>{
 vi.mocked(api.captureContext).mockResolvedValueOnce({snapshot:{sourceId:'activity:generated',version:2,description:'Generated other edit',fingerprint:'a'.repeat(64)},pending:{expectedVersion:1,description:'Generated local edit'},conflict:true});el<HTMLButtonElement>('capture-context-open').click();await flush();expect(el<HTMLButtonElement>('capture-context-save').disabled).toBe(false);el<HTMLButtonElement>('capture-context-save').click();await flush();expect(api.saveCaptureContext).toHaveBeenCalledWith('activity',{expectedVersion:2,description:'Generated local edit'});
});
it('clears private reader state and rejects a late response when the target changes',async()=>{
 let finish!:(value:typeof initial)=>void;vi.mocked(api.captureContext).mockReturnValueOnce(new Promise(resolve=>{finish=resolve;}));el<HTMLButtonElement>('capture-context-open').click();ui.update({authorizationGeneration:2,config:{deviceId:'generated',serverUrl:'https://other.invalid',tokenConfigured:false}} as Status);finish({snapshot:{sourceId:'activity:generated',version:0,description:'Must not reappear'}});await flush();expect(el<HTMLDialogElement>('capture-context-dialog').open).toBe(false);expect(el<HTMLTextAreaElement>('capture-context-description').value).toBe('');
});
