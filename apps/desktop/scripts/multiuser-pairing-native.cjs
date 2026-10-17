require('../../../scripts/fixture-background.cjs');
// Exercise production main/preload/renderer. Only OS dialogs, native capture,
// safeStorage and outbound network are generated external I/O substitutes.
const electron = require('electron');
const Module = require('node:module');
const {EventEmitter} = require('node:events');
const {mkdirSync} = require('node:fs');
const {join} = require('node:path');
const {createHash} = require('node:crypto');
const profile = process.argv[2];
if (!profile) throw Error('Generated profile required');
for (const [name, path] of [['userData', profile], ['sessionData', join(profile, 'chromium-session')], ['cache', join(profile, 'cache')], ['crashDumps', join(profile, 'crashes')]]) {
  mkdirSync(path, {recursive: true, mode: 0o700});
  electron.app.setPath(name, path);
}
process.env.MOTE_PROFILE = 'default';
for (const key of ['MOTE_TOKEN', 'MOTE_URL', 'MOTE_ENV_FILE']) delete process.env[key];
let mainWindow, sequence = 0, selectedImport;
const pending = new Map();
class GeneratedTray extends EventEmitter {setToolTip() {} setContextMenu() {}}
const native = {
  readDeviceMetadata: async () => ({device: {model: 'Generated pairing Desktop'}, state: {}}),
  readPowerState: async () => ({charging: true, onBattery: false}),
  foregroundApplication: async () => ({appId: 'generated.pairing', appName: 'Generated pairing', pid: 1}),
  activeApplication: async () => ({appId: 'generated.pairing', appName: 'Generated pairing', pid: 1, visibleAppIds: ['generated.pairing'], unknownVisibleWindows: false}),
  readVisibleNotifications: async () => [], runHelper: async () => ({status: 'denied'}), readInstalledApplications: async () => [],
  recognizeInvitationQr: async (_helper, bytes) => {
    if (!selectedImport?.qr || createHash('sha256').update(bytes).digest('hex') !== selectedImport.hash) throw Error('Unexpected generated QR input');
    process.send?.({type: 'generated-qr-read'});
    return selectedImport.qr;
  },
};
const io = {
  ...electron, Tray: GeneratedTray,
  powerMonitor: Object.assign(new EventEmitter(), {getSystemIdleTime: () => 0, getSystemIdleState: () => 'active'}),
  safeStorage: {isEncryptionAvailable: () => true, encryptString: value => Buffer.from(value).map(v => v ^ 90), decryptString: value => Buffer.from(value.map(v => v ^ 90)).toString()},
  systemPreferences: {getMediaAccessStatus: () => 'denied', isTrustedAccessibilityClient: () => false},
  desktopCapturer: {getSources: async () => {throw Error('Real screenshots disabled');}},
  net: {request: () => {throw Error('External network disabled');}},
};
io.dialog.showOpenDialog = async () => {
  if (!selectedImport?.path) throw Error('Unexpected generated dialog');
  return {canceled: false, filePaths: [selectedImport.path]};
};
const load = Module._load;
Module._load = function(request, parent, ...rest) {
  if (request === 'electron' || request === 'electron/main') return io;
  if (request === './native' && parent?.filename.includes('/desktop/dist/')) return native;
  if (request === 'node:os' && parent?.filename.endsWith('/desktop/dist/config.js')) return {...load.call(this, request, parent, ...rest), hostname: () => 'Generated pairing Desktop'};
  if (request === 'node:child_process' && parent?.filename.endsWith('/desktop/dist/main.js')) {
    const child = load.call(this, request, parent, ...rest);
    return {...child, execFile: (file, args, ...options) => {
      if (file !== '/usr/bin/open') return child.execFile(file, args, ...options);
      process.send?.({type: 'open-browser', url: args.at(-1)});
      options.at(-1)(null, '', '');
      return {};
    }};
  }
  return load.call(this, request, parent, ...rest);
};
electron.shell.openExternal = async () => {throw Error('External browser disabled');};
electron.shell.openPath = async () => '';
global.fetch = async (input, init = {}) => {
  const url = new URL(String(input));
  if (url.hostname !== '127.0.0.1') throw Error('Only generated account transport allowed');
  const id = ++sequence;
  const body = init.body ? Buffer.from(await new Response(init.body).arrayBuffer()).toString('base64') : undefined;
  const promise = new Promise((resolve, reject) => pending.set(id, {resolve, reject}));
  process.send?.({type: 'fetch', id, url: String(input), method: init.method ?? 'GET', headers: Object.fromEntries(new Headers(init.headers)), redirect: init.redirect, credentials: init.credentials, body});
  return promise;
};
electron.app.on('browser-window-created', (_event, window) => {
  mainWindow = window;
  window.webContents.on('did-finish-load', () => process.send?.({type: 'loaded'}));
});
process.on('message', async message => {
  if (message.type === 'fetch-response') {
    const task = pending.get(message.id);
    if (!task) return;
    pending.delete(message.id);
    if (message.error) task.reject(Error(message.error));
    else task.resolve(new Response(Buffer.from(message.body, 'base64'), {status: message.status, headers: message.headers}));
    return;
  }
  if (message.type === 'fixture-import') {
    selectedImport = message.value;
    process.send?.({type: 'fixture-ready', id: message.id});
    return;
  }
  if (message.type === 'execute') {
    try {
      const value = await mainWindow.webContents.executeJavaScript(message.code);
      process.send?.({type: 'result', id: message.id, value});
    } catch (error) {process.send?.({type: 'result', id: message.id, error: error.message});}
  }
  if (message.type === 'quit') electron.app.quit();
});
require('../dist/main.js');
