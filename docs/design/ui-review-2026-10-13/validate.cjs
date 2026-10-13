/** Background-only actual Chromium check for the offline, generated review artifact. */
const {app,BrowserWindow}=require('electron');
const {mkdtempSync,rmSync,mkdirSync,writeFileSync,readFileSync,existsSync}=require('node:fs');
const {join,resolve}=require('node:path');
const {tmpdir}=require('node:os');
const {pathToFileURL,fileURLToPath}=require('node:url');
const {createHash}=require('node:crypto');
const {spawnSync}=require('node:child_process');
const assert=require('node:assert/strict');
const repo=resolve(__dirname,'../../..'),args=process.argv.slice(2),selected=args.indexOf('--folder');
const folder=selected>=0?resolve(args[selected+1]):join(repo,'.mote/ui-review-2026-10-13'),output=join(repo,'.mote/ui-review-validation');
const temporary=mkdtempSync(join(tmpdir(),'mote-offline-review-'));app.setPath('userData',temporary);
mkdirSync(output,{recursive:true});
let window;const externalRequests=[],errors=[];
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(predicate,label){const limit=Date.now()+8000;while(Date.now()<limit){if(await predicate())return;await wait(30);}throw Error('Timed out: '+label);}
const evaluate=code=>window.webContents.executeJavaScript(code);
async function readyImages(){await until(()=>evaluate("[...document.querySelectorAll('.screen-button:not([hidden]) img')].every(img=>img.complete&&img.naturalWidth>0)"),'local images');await evaluate("Promise.all([...document.querySelectorAll('.screen-button:not([hidden]) img')].map(img=>img.decode()))");}
async function run(){
 const manifest=JSON.parse(readFileSync(join(folder,'manifest.json'),'utf8'));
 assert.equal(manifest.generatedOnly,true);assert.ok(manifest.assets.length>0);
 for(const asset of manifest.assets){assert.equal(asset.generatedOnly,true);const bytes=readFileSync(join(folder,asset.src));assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256,'Original PNG bytes are retained');}
 const excluded=new Set((manifest.invalidHistoricalEvidence||[]).map(item=>item.src));
 const reusable=platform=>manifest.source.candidate.unchangedPlatforms?.includes(platform)??(platform==='web'&&!manifest.source.candidate.webRoot);
 const selectedRevision=(revision,platform)=>revision==='candidate'&&reusable(platform)?'baseline':revision;
 const available=(platform,revision,scene,variant,language)=>manifest.assets.find(item=>!excluded.has(item.src)&&item.platform===platform&&item.revision===selectedRevision(revision,platform)&&item.scene===scene&&item.variant===variant&&item.language===language);
 for(const invalid of manifest.invalidHistoricalEvidence||[]){const asset=manifest.assets.find(item=>item.src===invalid.src);assert.ok(asset&&asset.sha256===invalid.sha256,'Exact invalid historical evidence');}
 if(manifest.source.candidate.requireReadyEvidence)for(const asset of manifest.assets.filter(item=>item.revision==='candidate')){
  assert.equal(asset.readiness?.ready,true,'Current scene content readiness: '+asset.src);
  assert.ok(asset.readiness.page&&['content','empty','restriction'].includes(asset.readiness.state),'Known finished page state: '+asset.src);
  assert.notEqual(asset.captureKind,'dialog-fragment','Current dialog scenes retain their full application context');
 }
 for(const file of ['index.html','review.js','review.css','manifest.js','README.md','evidence/evaluator.md','evidence/journeys.md','evidence/validation.md'])assert.ok(existsSync(join(folder,file)),file);
 let reportPreviews=0,reportLinks=0;
 const documents=new Set(['README.md',...(manifest.documents||['evidence/evaluator.md','evidence/journeys.md','evidence/validation.md']),...(manifest.finalValidation?[manifest.finalValidation]:[])]);
 for(const name of documents){
  const report=join(folder,name),document=readFileSync(report,'utf8');
  for(const match of document.matchAll(/(!?)\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)){
   const [,image,reference]=match;if(/^[a-z]+:/i.test(reference)){assert.ok(!image,'Report previews are local');continue;}
   if(reference.startsWith('#'))continue;
   const path=resolve(report,'..',reference.split('#')[0]);
   assert.ok(path.startsWith(folder+'/')&&existsSync(path),'Portable report reference: '+name+': '+reference);
   if(image)reportPreviews++;else reportLinks++;
  }
 }
 // Exercise the actual frozen-artifact entry point with corrupted evidence. It must reject
 // before touching the generated output, rather than silently substituting another image.
 const corrupted=join(temporary,'corrupted-frozen'),first=manifest.assets[0];mkdirSync(join(corrupted,'assets'),{recursive:true});
 writeFileSync(join(corrupted,first.src),readFileSync(join(folder,first.src)));
 writeFileSync(join(corrupted,'manifest.json'),JSON.stringify({...manifest,assets:[{...first,sha256:'0'.repeat(64)}]}));
 const rejected=spawnSync(process.execPath,[join(__dirname,'generate.cjs'),'--frozen',corrupted,'--refresh-platform','web','--refresh-platform','mac','--refresh-platform','android'],{encoding:'utf8',env:{...process.env,ELECTRON_RUN_AS_NODE:'1'}});
 assert.notEqual(rejected.status,0,'Corrupt frozen PNG cannot be regenerated');assert.match(rejected.stderr,/Frozen PNG hash/);
 if(manifest.source.baseline.originManifestSha256){
  const before=createHash('sha256').update(readFileSync(join(folder,'manifest.json'))).digest('hex');
  const unsafe=spawnSync(process.execPath,[join(__dirname,'generate.cjs')],{encoding:'utf8',env:{...process.env,ELECTRON_RUN_AS_NODE:'1'}});
  assert.notEqual(unsafe.status,0,'A promoted feedback baseline cannot be reconstructed from obsolete fixture directories');assert.match(unsafe.stderr,/Feedback baseline requires --frozen/);
  assert.equal(createHash('sha256').update(readFileSync(join(folder,'manifest.json'))).digest('hex'),before,'Rejected reconstruction cannot rewrite existing evidence');
 }
 if(args.includes('--static-only')){
  const documentHashes=Object.fromEntries([...documents].map(name=>[name,createHash('sha256').update(readFileSync(join(folder,name))).digest('hex')]));
  writeFileSync(join(output,'result-static.json'),JSON.stringify({passed:true,generatedOnly:true,manifestSha256:createHash('sha256').update(readFileSync(join(folder,'manifest.json'))).digest('hex'),screenshots:manifest.assets.length,reportPreviews,reportLinks,documentHashes,frozenCorruptionRejected:true,boundary:'Static PNG bytes and document references only. No new UI interaction, product, native or live-model check.'},null,2));
  console.log(`PASS: static review ${manifest.assets.length} PNGs, ${reportPreviews} report images, ${reportLinks} local document links.`);return;
 }
 await app.whenReady();
 window=new BrowserWindow({show:false,width:1440,height:1000,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
 window.webContents.session.webRequest.onBeforeRequest((details,done)=>{const protocol=new URL(details.url).protocol;const allowed=['file:','data:','blob:'].includes(protocol);if(!allowed)externalRequests.push(details.url);done({cancel:!allowed});});
 window.webContents.on('console-message',(_event,level,message)=>{if(level>=3)errors.push(message);});
 await window.loadURL(pathToFileURL(join(folder,'index.html')).href);await until(()=>evaluate("!!document.querySelector('#baseline-image')?.naturalWidth"),'actual local page');await readyImages();
 const localResources=await evaluate("[...document.querySelectorAll('a[href],link[href],script[src]')].map(item=>item.href||item.src).filter(url=>url&&!url.includes('#'))");
 for(const url of localResources){assert.equal(new URL(url).protocol,'file:','Offline review links stay local');assert.ok(existsSync(fileURLToPath(url)),url);}
 const checks=[];
 for(const platform of ['web','mac','android']){
  await evaluate(`document.querySelector('[data-platform="${platform}"]').click();true`);
  assert.equal(await evaluate("document.querySelector('[data-platform][aria-pressed=true]').dataset.platform"),platform);
  assert.deepEqual(await evaluate("[...document.querySelectorAll('#score-rows th')].map(item=>item.childNodes[0].textContent)"),manifest.metrics,'All seven independent criteria remain visible');
  assert.equal(await evaluate("document.querySelector('#score-rows').textContent.includes('NaN')"),false,'Missing historical criteria cannot produce invented numeric deltas');
  for(const language of ['zh','en']){
   await evaluate(`document.querySelector('#language').value='${language}';document.querySelector('#language').dispatchEvent(new Event('change',{bubbles:true}));true`);
   for(const variant of manifest.platforms[platform].variants){
    await evaluate(`document.querySelector('#variant').value='${variant}';document.querySelector('#variant').dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('#scene').value='home';document.querySelector('#scene').dispatchEvent(new Event('change'));true`);await readyImages();
    assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth'),false,'No horizontal overflow');
    for(const revision of ['baseline','candidate']){
     const expected=!!available(platform,revision,'home',variant,language);
     assert.equal(await evaluate(`document.querySelector('[data-enlarge="${revision}"]').hidden`),!expected,'Missing scene cannot display a substitute');
    }
    const scenes=await evaluate("[...document.querySelector('#scene').options].map(item=>item.value)");
    checks.push({platform,language,variant,scenes:scenes.length});
   }
  }
 }
 for(const platform of ['web','mac','android']){
  await evaluate(`document.querySelector('[data-platform="${platform}"]').click();document.querySelector('#variant').value='normal';document.querySelector('#variant').dispatchEvent(new Event('change'));document.querySelector('#language').value='zh';document.querySelector('#language').dispatchEvent(new Event('change'));true`);
  for(const scene of manifest.platforms[platform].walkthrough){
   await evaluate(`document.querySelector('#journey [data-scene="${scene}"]').click();true`);await readyImages();
   assert.equal(await evaluate("document.querySelector('#scene').value"),scene,'Actual walkthrough control selects its static scene');
   assert.equal(await evaluate("document.querySelector('#journey [aria-current=step]').dataset.scene"),scene);
  }
 }
 await evaluate("document.querySelector('[data-platform=mac]').click();document.querySelector('#variant').value='normal';document.querySelector('#variant').dispatchEvent(new Event('change'));document.querySelector('#language').value='zh';document.querySelector('#language').dispatchEvent(new Event('change'));document.querySelector('#scene').value='home';document.querySelector('#scene').dispatchEvent(new Event('change'));true");await readyImages();
 await evaluate("document.querySelector('[name=preference][value=candidate]').click();document.querySelector('#owner-note').value='Generated offline decision note';document.querySelector('#owner-note').dispatchEvent(new Event('input'));true");
 assert.match(await evaluate('window.moteReviewDecisionText()'),/Mac\n倾向：倾向本轮\n候选：[^\n]+\n备注：Generated offline decision note/);
 await evaluate("document.querySelector('[data-platform=android]').click();document.querySelector('[name=preference][value=baseline]').click();true");
 assert.match(await evaluate('window.moteReviewDecisionText()'),/Android\n倾向：保留反馈前/);
 await evaluate("document.querySelector('[data-platform=mac]').click();true");assert.equal(await evaluate("document.querySelector('#owner-note').value"),'Generated offline decision note');
 const noteReload=new Promise(resolve=>window.webContents.once('did-finish-load',resolve));window.webContents.reload();await noteReload;await until(()=>evaluate("!!document.querySelector('#scene')?.value"),'saved local notes reload');
 assert.equal(await evaluate("document.querySelector('#owner-note').value"),'Generated offline decision note','Nonempty local notes survive reload');
 assert.equal(await evaluate("document.querySelector('[name=preference][value=candidate]').checked"),true,'Selected preference survives reload');
 await readyImages();
 await evaluate("document.querySelector('[data-enlarge=baseline]').click();true");
 assert.equal(await evaluate("document.querySelector('#image-dialog').open"),true);
 await evaluate("document.querySelector('#pixel-toggle').click();true");assert.equal(await evaluate("document.querySelector('#dialog-canvas').classList.contains('pixels')"),true);
 window.webContents.sendInputEvent({type:'keyDown',keyCode:'Escape'});window.webContents.sendInputEvent({type:'keyUp',keyCode:'Escape'});await until(()=>evaluate("!document.querySelector('#image-dialog').open"),'Escape closes HTML image dialog');
 await evaluate("document.querySelector('#clear-preference').click();document.querySelector('#owner-note').value='';document.querySelector('#owner-note').dispatchEvent(new Event('input'));true");
 await evaluate("document.querySelector('[data-platform=android]').click();document.querySelector('#clear-preference').click();true");
 const reloaded=new Promise(resolve=>window.webContents.once('did-finish-load',resolve));window.webContents.reload();await reloaded;await until(()=>evaluate("!!document.querySelector('#scene')?.value"),'local reload');
 assert.equal(await evaluate("document.querySelector('[data-platform][aria-pressed=true]').dataset.platform"),'android','Reload restores the selected platform');
 assert.equal(await evaluate("document.querySelector('#owner-note').value"),'');
 // Exhaustive screenshot browsing follows persistence checks: fast automation can
 // exceed Chromium's history.replaceState rate limit, which is unrelated to storage.
 for(const {platform,language,variant} of checks){
  await evaluate(`document.querySelector('[data-platform="${platform}"]').click();document.querySelector('#language').value='${language}';document.querySelector('#language').dispatchEvent(new Event('change'));document.querySelector('#variant').value='${variant}';document.querySelector('#variant').dispatchEvent(new Event('change'));true`);
  const scenes=await evaluate("[...document.querySelector('#scene').options].map(item=>item.value)");
  for(const scene of scenes){
   await evaluate(`document.querySelector('#scene').value=${JSON.stringify(scene)};document.querySelector('#scene').dispatchEvent(new Event('change'));true`);await readyImages();
   for(const revision of ['baseline','candidate']){
    const asset=available(platform,revision,scene,variant,language);
    assert.equal(await evaluate(`document.querySelector('[data-enlarge="${revision}"]').hidden`),!asset,'Missing selected scene cannot display a substitute');
    if(asset)assert.equal(await evaluate(`document.querySelector('#${revision}-image').getAttribute('src')`),asset.src,'Exact selected scene is displayed');
   }
  }
 }
 for(const invalid of manifest.invalidHistoricalEvidence||[]){
  const asset=manifest.assets.find(item=>item.src===invalid.src);
  await evaluate(`document.querySelector('[data-platform="${asset.platform}"]').click();document.querySelector('#language').value='${asset.language}';document.querySelector('#language').dispatchEvent(new Event('change'));document.querySelector('#variant').value='${asset.variant}';document.querySelector('#variant').dispatchEvent(new Event('change'));document.querySelector('#scene').value='${asset.scene}';document.querySelector('#scene').dispatchEvent(new Event('change'));true`);await readyImages();
  assert.equal(await evaluate("document.querySelector('[data-enlarge=baseline]').hidden"),true,'A decodable historical loading-shell PNG cannot appear as a completed page');
  assert.equal(await evaluate("document.querySelector('#baseline-missing').textContent"),invalid.reason,'Owner sees the exact excluded evidence reason');
 }
 await evaluate("document.querySelector('[data-platform=web]').click();document.querySelector('#language').value='zh';document.querySelector('#language').dispatchEvent(new Event('change'));true");await readyImages();
 assert.equal(await evaluate("document.querySelector('[data-platform][aria-pressed=true]').dataset.platform"),'web');
 await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');await wait(200);
 writeFileSync(join(output,'review-wide.png'),(await window.webContents.capturePage()).toPNG());
 window.setSize(390,844);await until(()=>evaluate('innerWidth===390'),'narrow viewport');await wait(60);assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth'),false);writeFileSync(join(output,'review-narrow.png'),(await window.webContents.capturePage()).toPNG());
 assert.deepEqual(externalRequests,[],'No external network requests');assert.deepEqual(errors,[],'No renderer errors');
 writeFileSync(join(output,'result.json'),JSON.stringify({passed:true,generatedOnly:true,screenshots:manifest.assets.length,matrix:checks,localResources:localResources.length,reportPreviews,reportLinks,frozenCorruptionRejected:true,checks:['byte-identical PNGs','frozen corruption rejected','actual file:// page','local resource loads','all portable Markdown references','platform/language/size/scene controls','truthful missing evidence','local per-platform notes','export text formatting','image zoom and Escape','reload','wide and narrow overflow','no external network'],boundary:'Hidden generated renderer only. Download text formatter checked without opening OS save dialog; no product actions or native permissions.'},null,2));
 console.log(`PASS: offline review ${manifest.assets.length} PNGs, ${checks.length} platform/language/condition checks; no external requests.`);
}
async function finish(code){if(window&&!window.isDestroyed())window.destroy();rmSync(temporary,{recursive:true,force:true});app.exit(code);}
run().then(()=>finish(0)).catch(async error=>{console.error(error);writeFileSync(join(output,'result.json'),JSON.stringify({passed:false,message:error.message},null,2));await finish(1);});
