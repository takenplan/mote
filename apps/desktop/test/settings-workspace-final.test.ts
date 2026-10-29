import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import {mountSettingsWorkspace,renderSettingsWorkspace} from '../src/settings-workspace';
import type {Status} from '../src/contracts';
const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
let dom:JSDOM;
beforeEach(()=>{dom=new JSDOM(readFileSync(new URL('../src/index.html',import.meta.url),'utf8'));vi.stubGlobal('document',dom.window.document);mountSettingsWorkspace();});
afterEach(()=>{dom.window.close();vi.unstubAllGlobals();});
const status=()=>({queueDepth:2,sync:{pendingRecords:2,message:'Generated stopped sends'},config:{defaultCollection:{duration:true,screenshots:false,structured:false},serverUrl:'',syncPaused:true},credentialStorage:'json',environment:{profile:'generated',defaultProfile:false}} as Status);
it('states the exact queued-backup exclusions and keeps the existing metadata action under its scope disclosure',()=>{
 const metadata=el<HTMLButtonElement>('export-metadata'),action=vi.fn();metadata.addEventListener('click',action);const details=metadata.closest('details')!;expect(details.open).toBe(false);expect(details.querySelector('summary')!.textContent).toBe('备份包含什么');expect(details.textContent).toContain('来源文件使用独立的传输队列');expect(details.textContent).toContain('来源文件原件、未提交草稿、设置或登录凭据');expect(details.textContent).toContain('个人资料');metadata.click();expect(action).toHaveBeenCalledOnce();expect(document.querySelectorAll('#export-metadata')).toHaveLength(1);expect(el('data-folder').closest('details')).not.toBe(details);renderSettingsWorkspace(status());expect(el('backup-facts').textContent).toBe('2条');
});
it('puts actual diagnostic samples after controls and before exports while retaining full diagnostics behind More without touching drafts',()=>{
 const view=status();renderSettingsWorkspace(view);expect(el('diagnostics-current-facts').hidden).toBe(true);const interval=el<HTMLInputElement>('diagnostic-interval');interval.value='90';el<HTMLInputElement>('diagnostics-enabled').checked=true;
 view.diagnostics={enabled:true,sampleCount:3,fileBytes:120,counters:{saved:0,blocked:0,failed:0,imageBytes:0,uploadedBytes:0,inferenceMs:0,ocrMs:0,captureMs:0},latest:{at:'2026-10-30T01:00:00.000Z',rssBytes:104857600,cpuUserMicros:1500000,cpuSystemMicros:500000,processId:42,queueBytes:0,modelBytes:0,counters:{saved:0,blocked:0,failed:0,imageBytes:0,uploadedBytes:0,inferenceMs:0,ocrMs:0,captureMs:0}}};renderSettingsWorkspace(view);const facts=el('diagnostics-current-facts');expect(facts.hidden).toBe(true,'a background or transient configuration sample is not a user refresh');el<HTMLButtonElement>('diagnostics-sample').click();view.diagnostics.latest.at='2026-10-30T01:01:00.000Z';renderSettingsWorkspace(view);expect(facts.hidden).toBe(false);expect(facts.textContent).toContain('3 条数值样本');expect(facts.textContent).toContain('100.0 MiB');expect(facts.textContent).toContain('2.0 s');expect(Boolean(el('diagnostics-sample').compareDocumentPosition(facts)&4)).toBe(true);expect(Boolean(facts.compareDocumentPosition(document.querySelector('.diagnostic-exports')!)&4)).toBe(true);expect(el<HTMLDetailsElement>('diagnostics-more').open).toBe(false);expect(el('diagnostics-more').contains(el('diagnostics-detail'))).toBe(true);expect(interval.value).toBe('90');expect(el<HTMLInputElement>('diagnostics-enabled').checked).toBe(true);
 renderSettingsWorkspace(status());expect(facts.hidden).toBe(true);expect(facts.textContent).toBe('');expect(interval.value).toBe('90');
});
