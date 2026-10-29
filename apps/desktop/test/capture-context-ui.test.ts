import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {configureLocale} from '@mote/shared/i18n';
import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import {createCaptureContextUi} from '../src/capture-context-ui';
import type {DesktopApi,Status} from '../src/contracts';
import type {SourceContextState} from '../src/source-context-outbox';
const initial={snapshot:{sourceId:'activity:generated',version:0,description:''}};
let dom:JSDOM,api:DesktopApi,ui:ReturnType<typeof createCaptureContextUi>,states:Map<string,SourceContextState>,changed:ReturnType<typeof vi.fn>;
const flush=()=>new Promise(resolve=>setImmediate(resolve));const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const input=(channel:string,value:string)=>{const field=document.querySelector<HTMLTextAreaElement>(`[data-capture-context="${channel}"]`)!;field.value=value;field.dispatchEvent(new dom.window.Event('input'));};
const open=async()=>{el<HTMLButtonElement>('capture-context-open').click();await flush();};
const apply=()=>el<HTMLButtonElement>('capture-context-save').click();
const status=(generation=1)=>({authorizationGeneration:generation,config:{deviceId:'generated',serverUrl:'',tokenConfigured:false}} as Status);
beforeEach(()=>{configureLocale(()=> 'zh-CN');dom=new JSDOM(readFileSync(new URL('../src/index.html',import.meta.url),'utf8'));vi.stubGlobal('document',dom.window.document);vi.stubGlobal('window',dom.window);dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;};states=new Map(['activity','screen','structured','notifications'].map(channel=>[channel,{snapshot:{sourceId:channel+':generated',version:0,description:''}}]));api={captureContext:vi.fn(async channel=>states.get(channel)),saveCaptureContext:vi.fn(async(channel,value)=>{const state=states.get(channel)!;if(value.expectedVersion!==state.snapshot.version)throw Error('Generated CAS409');const next={...state,pending:value,conflict:false};states.set(channel,next);return next;})} as unknown as DesktopApi;changed=vi.fn();ui=createCaptureContextUi(api,document,changed);ui.update(status());});
afterEach(()=>{dom.window.close();vi.unstubAllGlobals();});
it('applies four-channel input only to the screen draft, then explicitly saves the exact independent declaration',async()=>{
 await open();expect(document.querySelectorAll('[data-capture-context]')).toHaveLength(4);expect(document.querySelector('#capture-context-channel')).toBeNull();
 input('activity','Generated owner declaration');apply();expect(api.saveCaptureContext).not.toHaveBeenCalled();expect(ui.dirty()).toBe(true);expect(changed).toHaveBeenCalledOnce();
 await ui.save();expect(api.saveCaptureContext).toHaveBeenCalledWith('activity',{expectedVersion:0,description:'Generated owner declaration'});expect(ui.dirty()).toBe(false);
 await open();expect(el('capture-context-state').textContent).toContain('等待同步');expect(el('capture-context-state').textContent).not.toContain('已同步');
 input('activity','Generated retained draft');apply();vi.mocked(api.saveCaptureContext).mockRejectedValueOnce(Error('Generated unavailable'));await expect(ui.save()).rejects.toThrow('unavailable');await open();expect(el<HTMLTextAreaElement>('capture-context-description').value).toBe('Generated retained draft');expect(ui.dirty()).toBe(true);
});
it('lets the owner explicitly review and apply conflict text at the newly observed version',async()=>{
 states.set('activity',{snapshot:{sourceId:'activity:generated',version:2,description:'Generated other edit',fingerprint:'a'.repeat(64)},pending:{expectedVersion:1,description:'Generated local edit'},conflict:true});await open();expect(el<HTMLButtonElement>('capture-context-save').disabled).toBe(false);apply();expect(api.saveCaptureContext).not.toHaveBeenCalled();await ui.save();expect(api.saveCaptureContext).toHaveBeenCalledWith('activity',{expectedVersion:2,description:'Generated local edit'});
});
it('clears private input and rejects a late read when the target changes',async()=>{
 let finish!:(value:typeof initial)=>void;vi.mocked(api.captureContext).mockReturnValueOnce(new Promise(resolve=>{finish=resolve;}));el<HTMLButtonElement>('capture-context-open').click();ui.update(status(2));finish({snapshot:{sourceId:'activity:generated',version:0,description:'Must not reappear'}});await flush();expect(el<HTMLDialogElement>('capture-context-dialog').open).toBe(false);expect(el<HTMLTextAreaElement>('capture-context-description').value).toBe('');expect(ui.dirty()).toBe(false);
});
it('cancelling unapplied dialog input performs no writes or screen-draft mutation',async()=>{
 await open();for(const channel of states.keys())input(channel,'Generated '+channel);document.querySelector<HTMLButtonElement>('#capture-context-dialog .secondary')!.click();expect(api.saveCaptureContext).not.toHaveBeenCalled();expect(ui.dirty()).toBe(false);expect(changed).not.toHaveBeenCalled();await open();expect([...document.querySelectorAll<HTMLTextAreaElement>('[data-capture-context]')].every(e=>e.value==='')).toBe(true);
});
it('keeps committed channels after a later save fails and explicitly retries only remaining drafts',async()=>{
 let fail=true;const save=api.saveCaptureContext;vi.mocked(api.saveCaptureContext).mockImplementation(async(channel,value)=>{if(channel==='screen'&&fail){fail=false;throw Error('Generated screen unavailable');}const next={...states.get(channel)!,pending:value};states.set(channel,next);return next;});
 await open();for(const channel of states.keys())input(channel,'Generated '+channel);apply();await expect(ui.save()).rejects.toThrow('screen unavailable');expect(vi.mocked(save).mock.calls.map(c=>c[0])).toEqual(['activity','screen']);expect(states.get('activity')?.pending?.description).toBe('Generated activity');expect(states.get('screen')?.pending).toBeUndefined();
 await open();expect(el('capture-context-state').textContent).toContain('等待同步');expect(el<HTMLTextAreaElement>('capture-context-description-screen').value).toBe('Generated screen');expect(el<HTMLTextAreaElement>('capture-context-description-structured').value).toBe('Generated structured');
 await ui.save();expect(vi.mocked(save).mock.calls.map(c=>c[0])).toEqual(['activity','screen','screen','structured','notifications']);expect(ui.dirty()).toBe(false);
});
it('screen reset discards only uncommitted declarations, preserving already durable pending text',async()=>{
 await open();input('activity','Generated durable');apply();await ui.save();await open();input('activity','Generated cancelled draft');apply();ui.reset();await ui.save();expect(api.saveCaptureContext).toHaveBeenCalledTimes(1);expect(states.get('activity')?.pending?.description).toBe('Generated durable');expect(ui.dirty()).toBe(false);
});
it('does not clear a new owner draft when an old-owner save arrives late',async()=>{
 await open();input('activity','Generated old owner');apply();let finish!:(value:SourceContextState)=>void;vi.mocked(api.saveCaptureContext).mockReturnValueOnce(new Promise(resolve=>{finish=resolve;}));const old=ui.save();ui.update(status(2));await open();input('screen','Generated new owner draft');apply();finish({...initial,pending:{expectedVersion:0,description:'Generated old owner'}});await expect(old).rejects.toThrow('登录会话已变更');expect(ui.dirty()).toBe(true);await open();expect(el<HTMLTextAreaElement>('capture-context-description-screen').value).toBe('Generated new owner draft');
});
it('preserves the originally applied CAS until explicit review applies the changed version',async()=>{
 await open();input('screen','Generated frozen draft');apply();states.set('screen',{snapshot:{sourceId:'screen:generated',version:1,description:'Generated elsewhere'}});await open();expect(el('capture-context-state-screen').textContent).toContain('其他地方更新');await expect(ui.save()).rejects.toThrow('CAS409');expect(api.saveCaptureContext).toHaveBeenLastCalledWith('screen',{expectedVersion:0,description:'Generated frozen draft'});apply();await ui.save();expect(api.saveCaptureContext).toHaveBeenLastCalledWith('screen',{expectedVersion:1,description:'Generated frozen draft'});
});

it('freezes the screen-save batch before configure, rejects old-owner drafts after identity changes even at the same version',async()=>{
 await open();input('activity','Generated old target draft');apply();const task=ui.prepareSave();ui.update({...status(2),config:{...status(2).config,deviceId:'other-device',serverUrl:'https://other.invalid'}});await expect(task.persist()).rejects.toThrow('登录会话已变更');task.release();expect(api.saveCaptureContext).not.toHaveBeenCalled();expect(ui.dirty()).toBe(false);
});
it('cannot reopen or replace fields while a frozen main-save batch waits for an earlier channel acknowledgement',async()=>{
 await open();input('activity','Generated activity');input('screen','Generated screen');apply();const actual=api.saveCaptureContext;let release!:(value:SourceContextState)=>void;vi.mocked(api.saveCaptureContext).mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;}));const task=ui.prepareSave(),saving=task.persist();expect(el<HTMLButtonElement>('capture-context-open').disabled).toBe(true);el<HTMLButtonElement>('capture-context-open').click();expect(el<HTMLDialogElement>('capture-context-dialog').open).toBe(false);release({...initial,pending:{expectedVersion:0,description:'Generated activity'}});await saving;task.release();expect(vi.mocked(actual).mock.calls.map(c=>c[0])).toEqual(['activity','screen']);expect(ui.dirty()).toBe(false);expect(el<HTMLButtonElement>('capture-context-open').disabled).toBe(false);
});
