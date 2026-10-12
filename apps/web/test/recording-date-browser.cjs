/** Native keyboard regression against the built Web UI and an isolated fixture central.
 * Run after build:central: TZ=Asia/Shanghai node_modules/.bin/electron apps/web/test/recording-date-browser.cjs
 */
const {app,BrowserWindow}=require('electron');
const {spawn}=require('node:child_process');
const {mkdtempSync,rmSync}=require('node:fs');
const {join,resolve}=require('node:path');
const {tmpdir}=require('node:os');
const assert=require('node:assert/strict');
const repo=resolve(__dirname,'../../..'),directory=mkdtempSync(join(tmpdir(),'mote-recording-dates-'));
app.setPath('userData',join(directory,'browser'));
app.commandLine.appendSwitch('lang','en-US');
app.on('window-all-closed',()=>{});
let child,window;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function run(){
 await app.whenReady();
 const env={...process.env};for(const key of Object.keys(env))if(key.startsWith('MOTE_'))delete env[key];
 child=spawn(process.env.MOTE_FIXTURE_NODE||'node',['--import','tsx','scripts/recordings-browser-fixture.ts',directory],{cwd:repo,env,stdio:['ignore','pipe','pipe']});
 const fixture=await new Promise((resolve,reject)=>{
  let output='',errors='';const timer=setTimeout(()=>reject(Error('Fixture startup timed out')),30000);
  child.stderr.on('data',data=>errors+=data);
  child.stdout.on('data',data=>{output+=data;for(const line of output.split('\n'))try{
   const value=JSON.parse(line);if(value.generatedOnly){clearTimeout(timer);resolve(value);}
  }catch{}});
  child.on('error',error=>{clearTimeout(timer);reject(error);});
  child.on('exit',()=>{clearTimeout(timer);reject(Error('Fixture exited: '+errors));});
 });
 const endpoint='http://127.0.0.1:'+fixture.server.port;
 const request=async(path,body)=>{
  const response=await fetch(endpoint+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+fixture.token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  assert.equal(response.ok,true,'fixture API '+path);return response.json();
 };
 const session=await request('/api/login/session',{serverUrl:endpoint,deviceId:require('node:crypto').randomUUID(),deviceName:'Generated date browser',platform:'other',durationMs:0});
 window=new BrowserWindow({width:1360,height:1000,show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
 const wc=window.webContents,js=code=>wc.executeJavaScript(code),errors=[];
 wc.debugger.attach('1.3');
 wc.on('console-message',(_event,level,message)=>{if(level>=3)errors.push(message);});
 const until=async(fn,label)=>{const deadline=Date.now()+30000;while(Date.now()<deadline){if(await fn())return;await delay(25);}throw Error('Timed out: '+label);};
 await window.loadURL(endpoint+'/__fixture-bootstrap');
 await js(`sessionStorage.setItem('mote.connection',${JSON.stringify(JSON.stringify({token:session.token,viewScope:require('node:crypto').randomUUID()}))})`);
 await window.loadURL(endpoint+'/#/connections/recordings?provider=feishu');
 await until(()=>js(`!!document.querySelector('.lark-step button')`),'recording provider');
 // Match labels by their position so this regression does not depend on OS language.
 await until(()=>js(`(()=>{const b=document.querySelector('.lark-step button');if(!b||b.disabled)return false;b.click();return true;})()`),'connect generated account');
 await until(()=>js(`document.querySelectorAll('.lark-range input[type=datetime-local]').length===2`),'date range');
 await js(`window.dateFields=[...document.querySelectorAll('.lark-range input')];`);
 const setDate=async(index,value)=>js(`(()=>{const input=window.dateFields[${index}];Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 // DevTools keyboard input reaches Chromium's native segment editor without
 // bringing a window to the foreground or injecting DOM KeyboardEvents.
 const key=async(name)=>{
  const keyName={Left:'ArrowLeft',Right:'ArrowRight',Backspace:'Backspace'}[name]??name;
  const virtualKey={Left:37,Right:39,Backspace:8}[name]??name.charCodeAt(0);
  const event={key:keyName,code:/^\d$/.test(name)?'Digit'+name:keyName,windowsVirtualKeyCode:virtualKey};
  await wc.debugger.sendCommand('Input.dispatchKeyEvent',{type:'keyDown',...event});
  if(/^\d$/.test(name))await wc.debugger.sendCommand('Input.dispatchKeyEvent',{type:'char',text:name,unmodifiedText:name,...event});
  await wc.debugger.sendCommand('Input.dispatchKeyEvent',{type:'keyUp',...event});await delay(25);
 };
 await setDate(0,'2010-09-01T08:30');await setDate(1,'2012-10-02T18:45');
 for(const [index,year,expected] of [[0,'2011','2011-09-01T08:30'],[1,'2013','2013-10-02T18:45']]){
  await js(`window.dateFields[${index}].focus()`);
  for(let i=0;i<8;i++)await key('Left');
  await key('Right');await key('Right');
  for(const digit of year)await key(digit);
  assert.equal(await js(`window.dateFields[${index}].value`),expected,'typing four year digits in '+(index?'end':'start'));
 }
 // Let status polling rerender while the keyboard draft remains unsaved.
 await delay(3200);
 assert.deepEqual(await js('window.dateFields.map(input=>input.value)'),['2011-09-01T08:30','2013-10-02T18:45']);
 await js(`document.querySelector('.lark-step button[type=submit]').click()`);
 await until(async()=>{const status=await request('/api/connectors/feishu-recordings');return status.selection.start===new Date('2011-09-01T08:30').toISOString()&&status.selection.end===new Date('2013-10-02T18:45').toISOString();},'save local dates as UTC');
 await new Promise(resolve=>{wc.once('did-finish-load',resolve);window.reload();});
 await until(()=>js(`document.querySelector('.lark-range input')?.value==='2011-09-01T08:30'`),'persisted start after reload');
 await until(()=>js(`!!document.querySelector('.source-context-fields textarea')&&!document.querySelector('.source-context-fields textarea').disabled`),'source context after reload');
 assert.equal(await js(`document.querySelectorAll('.lark-range input')[1].value`),'2013-10-02T18:45');
 await js(`window.dateFields=[...document.querySelectorAll('.lark-range input')];window.dateFields[1].focus()`);
 for(let i=0;i<8;i++)await key('Left');
 await key('Right');await key('Right');await key('Backspace');
 assert.equal(await js('window.dateFields[1].validity.badInput'),true,'a missing year is an incomplete end, not an intentionally empty end: '+await js('JSON.stringify({value:window.dateFields[1].value,focus:document.hasFocus(),active:document.activeElement===window.dateFields[1]})'));
 await js(`document.querySelector('.lark-step button[type=submit]').click()`);
 await delay(150);
 assert.equal((await request('/api/connectors/feishu-recordings')).selection.end,new Date('2013-10-02T18:45').toISOString(),'incomplete end must not clear the saved bound');
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,generatedOnly:true,nativeKeyboardYears:['2011','2013'],savedAndReloaded:true,timezone:process.env.TZ,modelCalls:0,physicalDeviceTested:false}));
}
async function finish(code){
 if(window&&!window.isDestroyed())window.destroy();
 if(child&&child.exitCode===null){child.kill('SIGTERM');await Promise.race([new Promise(resolve=>child.once('exit',resolve)),delay(5000)]);}
 rmSync(directory,{recursive:true,force:true});app.exit(code);
}
run().then(()=>finish(0)).catch(error=>{console.error(error);finish(1);});
