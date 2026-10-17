import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopApi, Status } from './contracts';

const documentBinding=ipcRenderer.invoke('mote:get-status',{}).then((status:Status)=>status.authorizationGeneration);
async function invoke(channel:string,...args:unknown[]):Promise<any>{
  const documentAccountGeneration=await documentBinding;
  return ipcRenderer.invoke(channel,{accountGeneration:documentAccountGeneration},...args);
}
const api: DesktopApi = {
  initialAppearance: ipcRenderer.sendSync('mote:appearance-initial'),
  setAppearance: preference => ipcRenderer.invoke('mote:set-appearance',preference),
  onAppearance: callback => {
    const handler=(_event: Electron.IpcRendererEvent,value: DesktopApi['initialAppearance'])=>callback(value);
    ipcRenderer.on('mote:appearance',handler);
    return ()=>ipcRenderer.removeListener('mote:appearance',handler);
  },
  workActivity: input => invoke('mote:work-activity',input),
  openWorkActivity: workId => invoke('mote:central-work',workId),
  syncHistory: input => invoke('mote:sync-history',input),
  syncHistoryContents: input => invoke('mote:sync-history-contents',input),
  syncHistoryContent: (runId,key,chunkOffset,includeImage) => invoke('mote:sync-history-content',runId,key,chunkOffset,includeImage),
  syncHistoryPending: () => invoke('mote:sync-history-pending'),
  ask: (command, input) => invoke('mote:ask', command, input),
  storageStatistics: () => invoke('mote:storage-statistics'),
  language: () => ipcRenderer.invoke('mote:language'),
  setLanguage: preference => ipcRenderer.invoke('mote:set-language', preference),
  compressionPreview: (quality, maxSide) => invoke('mote:compression-preview', quality, maxSide),
  browseCaptures: input => invoke('mote:captures-browse', input),
  captureDetail: (location, id) => invoke('mote:captures-detail', location, id),
  captureImage: (location, id, thumbnail) => invoke('mote:captures-image', location, id, thumbnail),
  installedApplications: () => invoke('mote:installed-applications'),
  onNavigate: callback => {
    const handler = (_event: Electron.IpcRendererEvent, page: 'overview' | 'notes' | 'sources' | 'settings') => callback(page);
    ipcRenderer.on('mote:navigate', handler);
    return () => ipcRenderer.removeListener('mote:navigate', handler);
  },
  previewConnection: input => invoke('mote:connection-preview', input),
  importConnection: kind => invoke('mote:connection-import', kind),
  cancelConnection: () => invoke('mote:connection-cancel'),
  confirmConnection: (id, origin, deviceName) => invoke('mote:connection-confirm', id, origin, deviceName),
  pendingConnection: () => invoke('mote:connection-pending'),
  resumeConnection: () => invoke('mote:connection-resume'),
  connectionStatus: () => invoke('mote:connection-status'),
  testConnection: () => invoke('mote:connection-test'),
  updateStatus: () => invoke('mote:update-status'),
  updateChannel: channel => invoke('mote:update-channel', channel),
  checkUpdate: () => invoke('mote:update-check'),
  downloadUpdate: () => invoke('mote:update-download'),
  cancelUpdate: () => invoke('mote:update-cancel'),
  installUpdate: () => invoke('mote:update-install'),
  revealUpdate: () => invoke('mote:update-reveal'),
  releaseNotes: () => invoke('mote:update-notes'),
  openFeedback: () => invoke('mote:feedback'),
  codingAgents: () => invoke('mote:coding-agents'),
  addCodingAgent: (provider, options) => invoke('mote:source-coding', provider, options),
  setSyncPaused: paused => invoke('mote:sync-paused', paused),
  sources: () => invoke('mote:sources'),
  selectSourceFiles: mode => invoke('mote:source-select', mode),
  confirmSourceFiles: (id, options) => invoke('mote:source-confirm', id, options),
  cancelSourceFiles: id => invoke('mote:source-cancel', id),
  centralContent: cursor => invoke('mote:content-central', cursor),
  centralContentDetail: (id,offset,image) => invoke('mote:content-central-detail',id,offset,image),
  localContent: offset => invoke('mote:content-local', offset),
  localContentDetail: (key, image) => invoke('mote:content-local-detail', key, image),
  chooseSourceFiles: (mode, options) => invoke('mote:source-files', mode, options),
  authorizeCalendar: () => invoke('mote:calendar-authorize'),
  connectCalendarActions: () => invoke('mote:calendar-actions-connect'),
  deliverCalendarActions: () => invoke('mote:calendar-actions-deliver'),
  addCalendarSource: (id, options) => invoke('mote:source-calendar', id, options),
  updateSource: (id, options) => invoke('mote:source-update', id, options),
  syncSources: () => invoke('mote:source-sync'),
  openCalendarPermissions: () => invoke('mote:calendar-permissions'),
  exportSupport: hours => invoke('mote:support-export', hours),
  sampleDiagnostics: () => invoke('mote:diagnostics-sample'),
  exportDiagnostics: () => invoke('mote:diagnostics-export'),
  readRawEvents: () => invoke('mote:events-raw'),
  readEvents: () => invoke('mote:events-read'),
  noteDraft: () => invoke('mote:note-draft'),
  updateNoteDraft: input => invoke('mote:note-draft-update', input),
  saveNote: input => invoke('mote:note', input),
  openCentral: (page?: string, evidenceId?: string) => invoke('mote:central',page,evidenceId),
  status: () => invoke('mote:get-status'),
  restartForStorageRecovery: () => invoke('mote:storage-restart'),
  chooseCaptureDirectory: () => invoke('mote:storage-choose'),
  openCaptureDirectory: () => invoke('mote:storage-open'),
  configure: update => invoke('mote:configure', update),
  start: () => invoke('mote:start'),
  stop: () => invoke('mote:stop'),
  reviewPending: () => invoke('mote:review-pending'),
  rejectReview: id => invoke('mote:review-reject',id),
  approveReview: id => invoke('mote:review-approve',id),
  retry: () => invoke('mote:retry'),
  permissionStatus: () => invoke('mote:permission-status'),
  permissionSettings: kind => invoke('mote:permission-settings', kind),
  openPermissions: () => invoke('mote:permissions'),
  openDataFolder: () => invoke('mote:data-folder'),
  exportMetadata: () => invoke('mote:export-metadata'),
  exportQueue: () => invoke('mote:export-queue'),
  importQueue: () => invoke('mote:import-queue'),
  onStatus: callback => {
    const handler = (_event: Electron.IpcRendererEvent, status: Status) => callback(status);
    ipcRenderer.on('mote:status', handler);
    return () => ipcRenderer.removeListener('mote:status', handler);
  },
};
contextBridge.exposeInMainWorld('mote', api);
