// Node-only production-main harness. Never loads or launches Electron and never
// accesses real native capture/calendar/credential APIs. Those are external I/O.
const {EventEmitter}=require('node:events');
const Module=require('node:module');
const pending=new Map(),handlers=new Map(),documents=new Map();let sequence=0,mainWindow,exposedApi;
const root=process.argv[2];if(!root)throw Error('Generated profile required');
let dialogPaths=[];
let holdCapture=false,releaseCapture;
let holdSaveDialog=false,releaseSaveDialog;
const app=Object.assign(new EventEmitter(),{
 isPackaged:false,getPath:()=>root,setPath:()=>{},getPreferredSystemLanguages:()=>['en'],requestSingleInstanceLock:()=>true,whenReady:()=>Promise.resolve(),getVersion:()=> '0.0.87',getSystemVersion:()=> 'generated',getLoginItemSettings:()=>({wasOpenedAtLogin:false,openAtLogin:false}),setLoginItemSettings:()=>{},relaunch:()=>{},
 quit(){const event={prevented:false,preventDefault(){this.prevented=true;}};app.emit('before-quit',event);if(!event.prevented)process.exit(0);}
});
class Window extends EventEmitter{
 constructor(){super();mainWindow=this;this.webContents=Object.assign(new EventEmitter(),{mainFrame:{url:''},session:{setPermissionRequestHandler:()=>{}},setWindowOpenHandler:()=>{},send:(channel,status)=>{if(channel==='mote:status')process.send?.({type:'status',status});},reload:()=>process.send?.({type:'reload'})});}
 async loadURL(url){this.webContents.mainFrame.url=url;process.send?.({type:'ready'});}
 isDestroyed(){return false;}show(){}focus(){}hide(){}
}
class Tray extends EventEmitter{setToolTip(){}setContextMenu(){}}
const electron={contextBridge:{exposeInMainWorld:(_name,value)=>{exposedApi=value;}},app,BrowserWindow:Window,Tray,Menu:{setApplicationMenu:()=>{},buildFromTemplate:value=>value},nativeImage:{createFromBitmap:()=>({setTemplateImage:()=>{}})},ipcMain:{handle:(name,fn)=>handlers.set(name,fn)},safeStorage:{isEncryptionAvailable:()=>true,encryptString:value=>Buffer.from(value).map(v=>v^90),decryptString:value=>Buffer.from(value.map(v=>v^90)).toString()},session:{fromPartition:()=>({})},net:{request:()=>{throw Error('Unexpected public network');}},shell:{openExternal:async url=>{process.send?.({type:'external',url});},openPath:async()=>'',showItemInFolder:()=>{}},systemPreferences:{getMediaAccessStatus:()=> 'granted'},powerMonitor:Object.assign(new EventEmitter(),{getSystemIdleTime:()=>0,getSystemIdleState:()=> 'active'}),desktopCapturer:{getSources:async()=>{throw Error('No real screenshots allowed');}},screen:{}};
const native={readPowerState:async()=>({charging:true,onBattery:false}),foregroundApplication:async()=>{if(holdCapture){process.send?.({type:'capture-entered'});await new Promise(resolve=>{releaseCapture=resolve;});holdCapture=false;}return {appId:'generated.application',appName:'Generated application',pid:1};},activeApplication:async()=>({appId:'generated.application',appName:'Generated application',pid:1,visibleAppIds:['generated.application'],unknownVisibleWindows:false}),readVisibleNotifications:async()=>[],runHelper:async()=> '{}',readInstalledApplications:async()=>[],recognizeInvitationQr:async()=>{throw Error('No QR native I/O');}};
const originalLoad=Module._load;
Module._load=function(request,parent,...rest){if(request==='electron')return electron;if(request==='./native'&&parent?.filename.includes('/desktop/dist/'))return native;return originalLoad.call(this,request,parent,...rest);};
electron.dialog={showOpenDialog:async()=>({canceled:false,filePaths:dialogPaths}),showSaveDialog:async()=>{if(!holdSaveDialog)return {canceled:true};process.send?.({type:'save-dialog-entered'});return new Promise(resolve=>{releaseSaveDialog=resolve;});},showMessageBox:async options=>{process.send?.({type:'startup-error',error:options.detail});return {response:1};},showErrorBox:(_title,error)=>process.send?.({type:'startup-error',error})};
global.fetch=async(input,init={})=>{
 const id=++sequence,body=init.body?Buffer.from(await new Response(init.body).arrayBuffer()).toString('base64'):undefined;
 const response=new Promise((resolve,reject)=>pending.set(id,{resolve,reject}));
 process.send?.({type:'fetch',id,url:String(input),method:init.method??'GET',headers:Object.fromEntries(new Headers(init.headers)),body});
 // Deliberately allow a generated transport to settle after abort; tests hold a
 // real ACK at this boundary and assert it can affect only its original queue.
 return response;
};
process.on('message',async message=>{
 if(message.type==='hold-capture'){holdCapture=true;return;}
 if(message.type==='release-capture'){releaseCapture?.();return;}
 if(message.type==='hold-save-dialog'){holdSaveDialog=true;return;}
 if(message.type==='release-save-dialog'){holdSaveDialog=false;releaseSaveDialog?.({canceled:false,filePath:message.path});return;}
 if(message.type==='fetch-response'){const request=pending.get(message.id);if(!request)return;pending.delete(message.id);if(message.error)request.reject(Error(message.error));else request.resolve(new Response(Buffer.from(message.body,'base64'),{status:message.status,headers:message.headers}));return;}
 if(message.type==='document'){try{const frame=mainWindow.webContents.mainFrame;electron.ipcRenderer={invoke:(channel,...args)=>handlers.get(channel)({sender:mainWindow.webContents,senderFrame:frame},...args),on:()=>{},removeListener:()=>{}};delete require.cache[require.resolve('../dist/preload.js')];require('../dist/preload.js');documents.set(message.document,exposedApi);await exposedApi.status();process.send?.({type:'result',id:message.id,value:true});}catch(error){process.send?.({type:'result',id:message.id,error:error.message});}return;}
 if(message.type==='document-invoke'){try{const value=await documents.get(message.document)[message.method](...(message.args??[]));process.send?.({type:'result',id:message.id,value});}catch(error){process.send?.({type:'result',id:message.id,error:error.message});}return;}
 if(message.type==='invoke'){try{dialogPaths=message.paths??dialogPaths;const fn=handlers.get(message.channel);if(!fn)throw Error('Unknown production IPC '+message.channel);const value=await fn({sender:mainWindow.webContents,senderFrame:mainWindow.webContents.mainFrame},{accountGeneration:message.generation},...(message.args??[]));process.send?.({type:'result',id:message.id,value});}catch(error){process.send?.({type:'result',id:message.id,error:error.message});}}
 if(message.type==='quit')app.quit();
});
require('../dist/main.js');
