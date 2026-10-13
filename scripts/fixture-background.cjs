// Test-only presentation policy. Load before importing Electron or product modules.
// Real renderers, preload/IPC, navigation and lifecycle handlers still run.
const electron = require('electron');
const showUI = process.env.MOTE_TEST_SHOW_UI === '1';
const { app, BrowserWindow, dialog, shell } = electron;
const FixtureWindow = new Proxy(BrowserWindow, {
  construct(Target, [options = {}]) {
    return new Target(showUI ? { ...options, show: true } : {
      ...options, show: false, focusable: false,
      webPreferences: { ...options.webPreferences, backgroundThrottling: false },
    });
  },
});
// Electron's lazy exports are not configurable. Redirect main-process imports
// in this fixture process only; do not patch product code or renderer/preload APIs.
const Module = require('node:module');
const nativeLoad = Module._load;
const fixtureElectron = { ...electron, BrowserWindow: FixtureWindow };
Module._load = function (request, parent, isMain) {
  if (request === 'electron' || request === 'electron/main') return fixtureElectron;
  return nativeLoad.call(this, request, parent, isMain);
};

if (!showUI) {
  // Electron otherwise displays its own startup-error dialog for an uncaught
  // fixture exception. Report a failing process instead, including before ready.
  const fail = error => { console.error('Background fixture failed:', error?.stack ?? error); app.exit(1); };
  process.on('uncaughtException', fail);
  process.on('unhandledRejection', fail);
  app.on('browser-window-created', (_event, window) => {
    // Also cover later show/focus calls and windows recreated by product code.
    window.show = window.showInactive = window.focus = () => {};
    window.webContents.setBackgroundThrottling(false);
    for (const contents of [window, window.webContents]) {
      const capturePage = contents.capturePage.bind(contents);
      contents.capturePage = (rect, options) => capturePage(rect, { ...options, stayHidden: true });
    }
  });
  app.focus = () => {};
  if (process.platform === 'darwin') {
    // Accessory permits hidden native windows; prohibited does not permit windows.
    app.setActivationPolicy('accessory');
    app.show = () => {};
  }
  // Unexpected native prompts fail instead of silently choosing a user response.
  // Individual journeys can supply generated dialog/browser responses afterwards.
  for (const method of ['showOpenDialog', 'showOpenDialogSync', 'showSaveDialog', 'showSaveDialogSync',
    'showMessageBox', 'showMessageBoxSync', 'showErrorBox', 'showCertificateTrustDialog']) {
    dialog[method] = () => { throw Error(`Unexpected native dialog in background fixture: ${method}`); };
  }
  shell.openExternal = async () => { throw Error('Unexpected external browser launch in background fixture'); };
}

module.exports = { showUI };
