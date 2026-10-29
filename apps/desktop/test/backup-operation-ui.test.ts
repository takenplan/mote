import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import {createBackupOperationUi} from '../src/backup-operation-ui';
import {mountSettingsWorkspace} from '../src/settings-workspace';
import type {BackgroundJob} from '../src/contracts/operations';
let dom:JSDOM,view:ReturnType<typeof createBackupOperationUi>;
const file={name:'generated.json',path:'/generated/selected/generated.json',sizeBytes:42};
const job=(startedAt:number,extra:Partial<BackgroundJob>={}):BackgroundJob=>({id:'mote:import-queue',startedAt,message:'Generated progress',state:'running',...extra});
const panel=()=>dom.window.document.getElementById('backup-operation')!;
beforeEach(()=>{dom=new JSDOM(readFileSync(new URL('../src/index.html',import.meta.url),'utf8'));vi.stubGlobal('document',dom.window.document);mountSettingsWorkspace();view=createBackupOperationUi(dom.window.document);vi.spyOn(Date,'now').mockReturnValue(200);});
afterEach(()=>{vi.restoreAllMocks();dom.window.close();vi.unstubAllGlobals();});
it('shows the actual file from this operation during work and retains it with an unknown result',()=>{
 const visit=view.begin('import','Generated pending');view.update([job(201,{file})]);expect(panel().querySelector('.backup-operation-file')!.textContent).toContain(file.path);
 view.finish(visit,'error','Generated readable failure',undefined,'Generated EIO detail');expect(panel().dataset.phase).toBe('error');expect(panel().textContent).toContain('42 bytes');expect(panel().querySelector<HTMLDetailsElement>('.ui-diagnostic')!.open).toBe(false);expect(panel().textContent).toContain('重新选择同一份备份后重试。');
});
it('does not reuse an old completed or in-flight operation file for a new picker',()=>{
 const old=job(100,{file,state:'completed'}),visit=view.begin('import','Generated pending',[old]);view.update([old]);expect(panel().querySelector('.backup-operation-file')).toBeNull();
 view.update([job(201,{file})]);expect(panel().querySelector('.backup-operation-file')).not.toBeNull();view.finish(visit,'complete','Generated confirmed',file);
 vi.mocked(Date.now).mockReturnValue(300);const next=view.begin('import','Generated pending',[job(201,{file})]);view.update([job(201,{file})]);expect(panel().querySelector('.backup-operation-file')).toBeNull();view.finish(next,'canceled','Generated canceled');expect(panel().querySelector('.backup-operation-file')).toBeNull();expect(panel().hidden).toBe(true);
});
it('keeps a new operation independent from a late earlier result and a different operation channel',()=>{
 const a=view.begin('import','Generated A'),b=view.begin('export','Generated B');view.update([job(201,{file})]);view.finish(a,'complete','Old result',file);expect(panel().textContent).not.toContain(file.path);expect(panel().textContent).not.toContain('Old result');view.finish(b,'complete','Generated saved',file);expect(panel().querySelector('h2')!.textContent).toBe('已保存到所选位置');expect(panel().textContent).toContain('导出没有清空本机内容。');
});
it('does not call a retry until the owner explicitly selects that action, and does not send a file parameter',()=>{
 const button=dom.window.document.getElementById('import')!,retry=vi.fn();button.addEventListener('click',retry);const visit=view.begin('import','Generated pending');view.finish(visit,'error','Generated failure',{name:'unknown-size.json',path:'/generated/unknown-size.json'});expect(panel().textContent).not.toContain('0 bytes');expect(retry).not.toHaveBeenCalled();panel().querySelector<HTMLButtonElement>('.actions .primary')!.click();expect(retry).toHaveBeenCalledOnce();
});
it('clears a prior selected file when the next operation is canceled before its picker is invoked',()=>{
 const a=view.begin('import','Generated A');view.finish(a,'error','Generated failure',file);expect(panel().querySelector('.backup-operation-file')).not.toBeNull();
 const b=view.begin('import','Generated B');view.finish(b,'canceled','Generated confirmation canceled');expect(panel().hidden).toBe(true);expect(panel().querySelector('.backup-operation-file')).toBeNull();expect(dom.window.document.getElementById('restore-selection')!.hidden).toBe(false);
});
