import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import type {WorkActivity,WorkActivityPage} from '@mote/shared';
import type {DesktopApi,Status} from '../src/contracts';
import {createWorkActivityUi} from '../src/work-activity-ui';
let dom:JSDOM,ui:ReturnType<typeof createWorkActivityUi>,api:DesktopApi;
const flush=()=>new Promise<void>(resolve=>setImmediate(resolve));
const work={id:'fixture.work',goal:'Generated work <script>never runs</script>',state:'running',updatedAt:'2026-10-15T00:00:00Z',progress:{mode:'determinate',total:4,completed:2,failed:1,needsInput:1,excluded:0,unit:'records'},artifacts:[{id:'fixture.result',title:'Generated saved result'}]} as WorkActivity;
const status={authorizationGeneration:1,queueDepth:2,sync:{pendingRecords:3,state:'waiting',message:'Generated local sync'},config:{tokenConfigured:true,serverUrl:'http://127.0.0.1:9999'}} as Status;
beforeEach(()=>{
  dom=new JSDOM(readFileSync(new URL('../src/index.html',import.meta.url),'utf8'));
  vi.stubGlobal('document',dom.window.document);vi.stubGlobal('AbortController',dom.window.AbortController);
  api={workActivity:vi.fn(async()=>({items:[work],nextCursor:10})),openWorkActivity:vi.fn(async()=>{})} as unknown as DesktopApi;
  ui=createWorkActivityUi(api,vi.fn());ui.update(status);
});
afterEach(()=>{ui.dispose();dom.window.close();vi.unstubAllGlobals();});
it('shows actual central work alongside local delivery and opens only the central activity destination',async()=>{
  ui.show();await flush();const list=document.getElementById('work-list')!;
  expect(list.textContent).toContain(work.goal);expect(list.querySelector('script')).toBeNull();
  expect(list.textContent).toContain('2 / 4');expect(list.textContent).toContain('Generated saved result');
  expect(document.getElementById('work-local-state')!.textContent).toBe('Generated local sync');expect(document.getElementById('work-local-pending')!.textContent).toContain('3');
  list.querySelector<HTMLButtonElement>('button')!.click();expect(api.openWorkActivity).toHaveBeenCalledWith(work.id);
  document.getElementById('work-next')!.click();await flush();expect(api.workActivity).toHaveBeenLastCalledWith({state:'active',cursor:10});
  document.querySelector<HTMLButtonElement>('[data-work-state=attention]')!.click();await flush();expect(api.workActivity).toHaveBeenLastCalledWith({state:'attention'});
});
it('revokes old work on identity change and ignores late responses after leaving or disposal',async()=>{
  let finish!:(page:WorkActivityPage)=>void;
  vi.mocked(api.workActivity).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));ui.show();
  ui.update({...status,authorizationGeneration:2,config:{...status.config,tokenConfigured:false}});
  expect(document.getElementById('work-list')!.textContent).toBe('');finish({items:[work],nextCursor:null});await flush();
  expect(document.getElementById('work-list')!.textContent).toBe('');
  ui.update(status);await flush();expect(document.getElementById('work-list')!.textContent).toContain(work.goal);
  vi.mocked(api.workActivity).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));document.getElementById('work-refresh')!.click();ui.hide();finish({items:[{...work,goal:'Generated late result'}],nextCursor:null});await flush();expect(document.getElementById('work-list')!.textContent).not.toContain('Generated late result');
  ui.show();await flush();ui.dispose();expect(document.getElementById('work-list')!.textContent).toBe('');
  const count=vi.mocked(api.workActivity).mock.calls.length;document.getElementById('work-refresh')!.click();await flush();expect(api.workActivity).toHaveBeenCalledTimes(count);
});
