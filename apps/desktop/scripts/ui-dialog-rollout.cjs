// Called by background ui-smoke/sync-history-smoke after real product startup.
const {readFileSync,writeFileSync}=require('node:fs');
const {join,resolve}=require('node:path');
const {createHash}=require('node:crypto');
const {spawnSync}=require('node:child_process');
const assert=require('node:assert/strict');

module.exports=async function({window,js,outputDirectory,kind,navigate,run,items,archive}) {
  const repo=resolve(__dirname,'../../..'),sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
  const reference=JSON.parse(readFileSync(join(repo,'.mote/ui-rollout/mac/canonical-final/rollout-manifest.json'),'utf8'));
  const productSourceFiles=spawnSync('git',['ls-files','apps/desktop/src','apps/desktop/native','packages/shared/src','packages/shared/design-tokens.json'],{cwd:repo,encoding:'utf8'}).stdout.trim().split('\n');
  const sourceIdentity=Object.fromEntries(productSourceFiles.map(f=>[f,sha(join(repo,f))]));
  const formatterSource='apps/desktop/src/sync-history-ui.ts';
  const referenceSourceIdentity=Object.fromEntries(productSourceFiles.map(f=>{const blob=spawnSync('git',['show',reference.parentCommit+':'+f],{cwd:repo});assert.equal(blob.status,0,'Reference product source exists: '+f);return[f,createHash('sha256').update(blob.stdout).digest('hex')];}));
  const buildIdentity=Object.fromEntries(Object.keys(reference.buildIdentity).map(f=>[f,sha(join(__dirname,'../dist',f))]));
  const nativeIdentity=Object.fromEntries(Object.keys(reference.nativeIdentity).map(f=>[f,sha(join(__dirname,'../native/bin',f))]));
  const changedSourceInputs=Object.keys(sourceIdentity).filter(f=>sourceIdentity[f]!==referenceSourceIdentity[f]);
  const changedBuildInputs=Object.keys(buildIdentity).filter(f=>buildIdentity[f]!==reference.buildIdentity[f]);
  assert.deepEqual(changedSourceInputs,[formatterSource],'Only the reviewed upload error formatter source changes');
  assert.deepEqual(changedBuildInputs,['ui-bundle.js'],'Only the renderer bundle containing the formatter changes');
  assert.deepEqual(nativeIdentity,reference.nativeIdentity,'Supplement keeps final native build');
  const fixtureIdentity=Object.fromEntries(['ui-dialog-rollout.cjs','ui-smoke.cjs','sync-history-smoke.cjs'].map(f=>[f,sha(join(__dirname,f))]));
  const parentCommit=spawnSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).stdout.trim();
  const workingTreeChanges=spawnSync('git',['status','--porcelain','--','apps/desktop'],{cwd:repo,encoding:'utf8'}).stdout;
  const captures=[],journeys=[];
  async function until(code,label){for(let i=0;i<400;i++){if(await js(code))return;await new Promise(r=>setTimeout(r,25));}throw Error('Dialog readiness: '+label);}
  const frames=()=>js('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
  async function locale(language){if(await js('document.documentElement.lang')===language)return;
    await js('document.querySelector("aside [data-nav=settings]").click();true;');
    const reload=new Promise(r=>window.webContents.once('did-finish-load',r));
    await js('window.confirm=()=>true;document.querySelector("#language").value='+JSON.stringify(language)+';document.querySelector("#language").dispatchEvent(new Event("change"));true;');
    await reload;await until('document.documentElement.lang==='+JSON.stringify(language)+'&&!!window.mote','locale');
  }
  async function shot(name,id){await frames();
    const layout=await js('(()=>{const d=document.getElementById('+JSON.stringify(id)+'),b=d.getBoundingClientRect();return {viewport:{width:innerWidth,height:innerHeight},dialog:{id:d.id,open:d.open,top:b.top,bottom:b.bottom,scrollTop:d.scrollTop,scrollHeight:d.scrollHeight,clientHeight:d.clientHeight},clipped:Array.from(d.querySelectorAll("button,input,select")).filter(e=>e.getClientRects().length&&!e.closest("[hidden]")).filter(e=>{const r=e.getBoundingClientRect();return r.left<0||r.right>innerWidth+1||(e.tagName==="BUTTON"&&e.scrollWidth>e.clientWidth+2);}).map(e=>e.id),horizontalOverflow:d.scrollWidth>d.clientWidth+1};})()');
    assert(layout.dialog.open&&layout.dialog.top>=0&&layout.dialog.bottom<=layout.viewport.height+1,'Dialog fits viewport');assert.deepEqual(layout.clipped,[],'Dialog controls fit');assert.equal(layout.horizontalOverflow,false,'Dialog no horizontal overflow');
    const png=(await window.webContents.capturePage()).toPNG(),file=name+'.png';writeFileSync(join(outputDirectory,file),png);
    captures.push({file,name,page:kind==='capture'?'screen':'uploads',sha256:createHash('sha256').update(png).digest('hex'),bitmap:{width:png.readUInt32BE(16),height:png.readUInt32BE(20)},zoom:window.webContents.getZoomFactor(),layout,readiness:{ready:true,marker:'#'+id+'[open]',locale:await js('document.documentElement.lang')},generatedOnly:true});return layout.dialog;
  }
  async function whole(name,id){await js('document.getElementById('+JSON.stringify(id)+').scrollTop=0;true;');let d=await shot(name+'-top',id);const lane=d.clientHeight;
    for(let top=Math.max(1,lane-24),i=1;top<d.scrollHeight-lane;top+=lane-24,i++){await js('document.getElementById('+JSON.stringify(id)+').scrollTop='+top+';true;');await shot(name+'-middle-'+i,id);}
    await js('document.getElementById('+JSON.stringify(id)+').scrollTop=1e9;true;');await shot(name+'-end',id);
  }
  for(const language of ['zh-CN','en']){await locale(language);
    for(const [variant,width,height,zoom] of [['normal',1140,840,1],['compact',820,620,1],['large',820,620,1.3]]){
      window.setSize(width,height);window.webContents.setZoomFactor(zoom);const condition=(language==='en'?'en':'zh')+'-'+variant;
      if(kind==='capture'){
        await navigate('screen');await js('document.querySelector("#start").click();true;');await until('document.querySelector("#capture-confirm-dialog").open','capture confirmation');
        await whole('capture-confirm-'+condition,'capture-confirm-dialog');await js('document.querySelector("#capture-confirm-cancel").click();true;');
        assert.equal((await js('window.mote.status()')).running,false,'Cancel never starts collector');
      }else{
        await js('document.querySelector("aside [data-nav=overview]").click();document.querySelector("#home-sync-details").open=true;document.querySelector("#home-sync-details [data-nav=uploads]").click();true;');
        await until('!!document.querySelector('+JSON.stringify('[data-upload-run="'+run+'"]')+')','real generated run');
        await js('document.querySelector('+JSON.stringify('[data-upload-run="'+run+'"]')+').click();true;');await until('!!document.querySelector("#upload-view-all")','receipt');
        await whole('upload-receipt-'+condition,'upload-receipt-dialog');await js('document.querySelector("#upload-view-all").click();true;');
        await until('!!document.querySelector(".upload-content-image")','generated screenshot');await whole('upload-content-image-'+condition,'upload-content-dialog');
        await js('document.querySelector('+JSON.stringify('[data-upload-key="'+items[1].key+'"]')+').click();true;');await until('!!document.querySelector(".upload-content-text")&&!document.querySelector(".upload-content-image")','escaped text');
        assert.equal(await js('Boolean(window.fixtureExecuted)'),false,'Untrusted evidence never executes');await whole('upload-content-text-'+condition,'upload-content-dialog');
        const captureId=(await js('window.mote.syncHistoryContent('+JSON.stringify(run)+','+JSON.stringify(items[1].key)+')')).captureId,saved=archive.get(captureId);archive.delete(captureId);
        await js('document.querySelector("#upload-preview-refresh").click();true;');await until('!!document.querySelector("#upload-content-preview [role=alert]")','expired evidence');
        const displayedError=await js('document.querySelector("#upload-content-preview [role=alert]").textContent');
        assert.equal(displayedError,language==='en'?'Archived content is missing or has expired; the sync receipt remains available.':'归档内容不存在或已按保留策略清理；同步凭据仍可查看。','Complete translated retention/receipt fact without internal IPC wrapper');
        await whole('upload-content-expired-'+condition,'upload-content-dialog');archive.set(captureId,saved);
        await js('document.querySelector("#upload-content-dialog [data-upload-close]").click();true;');
      }
      journeys.push({name:kind==='capture'?'actual scope confirmation and Cancel':'actual receipt, generated screenshot, escaped text and expired material dialogs',language,variant,verified:true});
    }
  }
  assert.equal((await js('window.mote.status()')).running,false,'No collection');
  const manifest={platform:'mac',parentCommit,workingTreeChanges,sourceIdentity,buildIdentity,nativeIdentity,fixtureIdentity,captures,journeys,passed:true,generatedOnly:true,unchangedReferenceProducer:reference.parentCommit,unchangedReferenceManifest:'.mote/ui-rollout/mac/canonical-final/rollout-manifest.json',referenceSourceIdentity,referenceBuildIdentity:reference.buildIdentity,changedSourceInputs,changedBuildInputs,boundary:'Hidden real Electron main/preload/renderer. Fresh upload dialogs for the reviewed error formatter; every tracked baseline source and built input is identical to final31339 except sync-history-ui.ts and its ui-bundle.js, with native binaries unchanged. Three generated upload records via real SyncHistory and loopback archive. No personal screen/account/calendar/live model/OS permission activation. Full dialog scroll intervals captured with24CSSpx overlap; native picker/permission fixture adapters remain explicit.'};
  writeFileSync(join(outputDirectory,'dialog-manifest.json'),JSON.stringify(manifest,null,2));return manifest;
};
