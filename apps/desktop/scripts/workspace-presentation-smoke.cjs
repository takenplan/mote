require('../../../scripts/fixture-background.cjs');
require('../../../scripts/fixture-language.cjs');
const {app,safeStorage,shell}=require('electron');
const {createServer}=require('node:http');
const {mkdtempSync,writeFileSync,mkdirSync}=require('node:fs');
const {rm}=require('node:fs/promises');
const {tmpdir}=require('node:os');
const {join,resolve}=require('node:path');
const assert=require('node:assert/strict');
const {defaultConfig}=require('../dist/config');
const profile=mkdtempSync(join(tmpdir(),'mote-workspace-presentation-'));
app.setPath('userData',profile);process.env.MOTE_PROFILE='default';
for(const key of ['MOTE_URL','MOTE_TOKEN','MOTE_ENV_FILE'])delete process.env[key];
safeStorage.isEncryptionAvailable=()=>true;
safeStorage.encryptString=value=>Buffer.from('fixture:'+value);
safeStorage.decryptString=value=>value.toString().slice(8);
const requests=[],errors=[],pending=[];let block=false,fail=false,finished=false;
const token='generated-workspace-token-only';
const opened=[];const childProcess=require('node:child_process'),execFile=childProcess.execFile,promisify=require('node:util').promisify;
childProcess.execFile=function(file,args,...rest){if(file==='/usr/bin/open'){opened.push(args.at(-1));const callback=rest.at(-1);if(typeof callback==='function')queueMicrotask(()=>callback(null,'',''));return {kill(){}};}return execFile.call(this,file,args,...rest);};
childProcess.execFile[promisify.custom]=async(file,args,...rest)=>{if(file==='/usr/bin/open'){opened.push(args.at(-1));return {stdout:'',stderr:''};}return promisify(execFile)(file,args,...rest);};
shell.openExternal=async url=>{opened.push(url);};
const work={id:'generated.work',kind:'import',goal:'Generated import <script>untrusted evidence</script>',state:'running',createdAt:'2026-10-15T00:00:00Z',updatedAt:'2026-10-15T00:01:00Z',progress:{mode:'determinate',unit:'records',total:4,completed:2,failed:0,needsInput:0,excluded:0},branches:[],artifacts:[{id:'generated.result',kind:'result',title:'Generated saved material'}],evidence:{count:4,refs:[]},events:[],destination:'archive',technical:{operationIds:[]}};
const server=createServer((req,res)=>{
  requests.push({url:req.url,authorized:req.headers.authorization==='Bearer '+token});
  res.setHeader('Content-Type','application/json');const url=new URL(req.url,'http://fixture');
  if(url.pathname==='/api/work-activity'){
    assert.equal(req.headers.authorization,'Bearer '+token);
    const value={items:url.searchParams.get('state')==='attention'?[]:[{...work,goal:url.searchParams.has('cursor')?'Generated next page':work.goal}],nextCursor:url.searchParams.has('cursor')?null:10};
    const send=()=>{res.statusCode=fail?503:200;res.end(JSON.stringify(value));};if(block)pending.push(send);else send();return;
  }
  if(url.pathname==='/api/login/logout'){res.end('{}');return;}
  if(url.pathname==='/api/login/ticket'){res.end(JSON.stringify({code:'T'.repeat(43)}));return;}
  if(url.pathname==='/api/connections/self'){res.end(JSON.stringify({credential:{id:'generated-session',scope:'owner',label:'Generated fixture'},node:{version:'fixture',profile:'fixture',protocol:{min:1,max:1}},capabilities:{ingest:true,ownSources:true,archiveRead:true}}));return;}
  if(url.pathname==='/api/capture-browser'){res.end(JSON.stringify({items:[],totalCount:0,nextCursor:null}));return;}
  res.statusCode=410;res.end('{}');
});
const timeout=setTimeout(()=>{process.stderr.write('Workspace presentation smoke timeout\n');app.exit(1);},45000);
const until=async check=>{for(let i=0;i<300;i++){if(await check())return;await new Promise(resolve=>setTimeout(resolve,20));}throw Error('Fixture condition did not settle');};
app.on('browser-window-created',(_event,window)=>{
  window.webContents.setBackgroundThrottling(false);
  window.webContents.on('console-message',(_event,level,message)=>{if(level>=3)errors.push(message);});
  window.webContents.once('did-finish-load',()=>{void(async()=>{
    const js=code=>window.webContents.executeJavaScript(code),output=resolve(__dirname,'../../../.mote/ui-default');mkdirSync(output,{recursive:true});
    await until(()=>js(`!!document.querySelector('[data-presentation-nav]')&&document.body.dataset.theme==='mote.linear'`));
    assert.equal(window.isVisible(),false,'The real product window stays hidden');
    assert.equal(await js(`document.querySelector('[data-page=records]').hidden`),false);
    assert.deepEqual(await js(`Array.from(document.querySelectorAll('.main-nav [data-nav]')).map(node=>node.dataset.nav)`),['records','ask','sources','work']);
    assert.equal(await js(`getComputedStyle(document.body).backgroundColor`),'rgb(28, 27, 26)');
    assert.equal((await js('window.mote.status()')).running,false);
    writeFileSync(join(output,'desktop-content.png'),(await window.webContents.capturePage()).toPNG());
    const original='Generated long original — 合成资料，仅用于验证阅读。\n\n'+Array.from({length:24},(_,index)=>`${index+1}. Generated evidence paragraph keeps the exact original, its source and actual delivery state. 这一段只包含生成的测试文字，不读取真实屏幕或个人文件。`).join('\n\n');
    await js(`document.querySelector('#note-action').click();document.querySelector('#add-dialog [data-add-choice=note]').click()`);
    await until(()=>js(`!document.querySelector('#note-text').disabled`));
    await js(`document.querySelector('#note-text').value=${JSON.stringify(original)};document.querySelector('#note-text').dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#note-form').requestSubmit()`);
    await until(()=>js(`document.querySelector('#note-text').value===''&&!document.querySelector('#note-text').disabled`));
    await js(`document.querySelector('aside [data-nav=records]').click()`);
    await until(()=>js(`!!document.querySelector('#content-feed .content-row')&&document.querySelector('#content-status').getAttribute('aria-busy')==='false'`));
    await js(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
    writeFileSync(join(output,'desktop-content-loaded.png'),(await window.webContents.capturePage()).toPNG());
    await js(`document.querySelector('#content-feed .content-row').click()`);
    await until(()=>js(`document.querySelector('#content-detail-body').textContent===${JSON.stringify(original)}&&document.querySelector('#content-detail-status').getAttribute('aria-busy')==='false'`));
    await js(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
    assert.equal(await js(`document.querySelector('#content-detail-body').textContent`),original,'The rendered detail keeps the exact long original');
    writeFileSync(join(output,'desktop-content-detail.png'),(await window.webContents.capturePage()).toPNG());
    assert(await js(`document.querySelector('#content-detail-dialog').scrollHeight>document.querySelector('#content-detail-dialog').clientHeight`),'A long exact original remains scrollable');
    await js(`document.querySelector('#content-detail-close').click()`);
    await js(`document.querySelector('aside [data-nav=work]').click()`);
    await until(()=>js(`document.querySelector('#work-list').textContent.includes('Generated import')`));
    assert.equal(await js(`document.querySelector('#work-list script')`),null);
    assert(await js(`document.querySelector('#work-list').textContent.includes('2 / 4')&&document.querySelector('#work-local-pending').textContent.includes('1')`));
    assert.deepEqual(await js(`Array.from(document.querySelectorAll('aside [aria-current=page]')).map(node=>node.dataset.nav)`),['work'],'Exactly one primary destination has aria-current');
    assert.deepEqual(await js(`Array.from(document.querySelectorAll('aside .selected')).map(node=>node.dataset.nav)`),['work'],'Exactly one primary destination has selected');
    await js(`document.querySelector('#work-list .text-button').click()`);await until(()=>opened.length===1);
    const destination=new URL(opened[0]),params=new URLSearchParams(destination.hash.split('?')[1]);
    assert.equal(destination.origin,'http://127.0.0.1:'+server.address().port);assert.equal(destination.hash.split('?')[0],'#/activity');assert.equal(params.get('work'),work.id);assert.equal(params.get('loginTicket'),'T'.repeat(43));assert.equal(params.has('evidence'),false);assert.equal(params.has('token'),false);assert.equal(destination.href.includes(token),false);
    assert(await js(`window.mote.openWorkActivity('bad\\nidentity').then(()=>false,()=>true)`));assert.equal(opened.length,1,'Invalid IPC references cannot open a browser');
    assert(requests.some(request=>request.url==='/api/work-activity?state=active&limit=10'&&request.authorized));
    window.setSize(820,620);await js(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
    assert(await js(`document.documentElement.scrollWidth<=innerWidth`));
    writeFileSync(join(output,'desktop-activity-compact.png'),(await window.webContents.capturePage()).toPNG());
    await js(`document.querySelector('#work-next').click()`);await until(()=>js(`document.querySelector('#work-list').textContent.includes('Generated next page')`));
    await js(`document.querySelector('[data-work-state=attention]').click()`);await until(()=>js(`document.querySelector('#work-status').textContent.includes('目前没有需要处理')`));
    fail=true;await js(`document.querySelector('#work-refresh').click()`);await until(()=>js(`document.querySelector('#work-status').textContent.includes('读取活动失败')`));
    fail=false;await js(`document.querySelector('[data-work-state=active]').click()`);await until(()=>js(`document.querySelector('#work-list').textContent.includes('Generated import')`));
    block=true;await js(`document.querySelector('#work-refresh').click()`);await until(()=>pending.length>0);
    await js(`window.mote.ask('logout')`);await until(()=>js(`document.querySelector('#work-list').textContent===''&&!document.querySelector('#work-connect').hidden`));
    pending.splice(0).forEach(send=>send());await js(`new Promise(resolve=>setTimeout(resolve,100))`);
    assert.equal(await js(`document.querySelector('#work-list').textContent`),'');
    assert.equal((await js('window.mote.status()')).running,false);
    assert.deepEqual(errors,[]);finished=true;clearTimeout(timeout);
    process.stdout.write(JSON.stringify({ok:true,generatedOnly:true,hidden:true,realStartupPreloadIpcAndHttp:true,defaultContent:true,linearTheme:true,workPagination:true,readFailure:true,logoutFencesLatePrivateWork:true,screenshots:output})+'\n');app.quit();
  })().catch(error=>{process.stderr.write(error.stack+'\n'+errors.join('\n')+'\n');app.exit(1);});});
});
app.on('window-all-closed',()=>{if(!finished)app.exit(1);});
app.on('quit',()=>{server.close();void rm(profile,{recursive:true,force:true});});
server.listen(0,'127.0.0.1',()=>{
  const config={...defaultConfig(),serverUrl:'http://127.0.0.1:'+server.address().port,deviceName:'Generated workspace Mac',metadataEnabled:false,syncMode:'manual',credentialScope:'owner'};
  writeFileSync(join(profile,'config.json'),JSON.stringify({version:4,config,encryptedToken:safeStorage.encryptString(token).toString('base64')}),{mode:0o600});writeFileSync(join(profile,'storage-format.json'),JSON.stringify({version:4}),{mode:0o600});require('../dist/main');
});
