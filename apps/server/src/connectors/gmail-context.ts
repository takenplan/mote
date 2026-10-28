import {join} from 'node:path';
import {ArchivedFileStore} from '../archived-files.js';
import type {SourceStore} from '../sources.js';
import {gmailSyncState,type GmailSyncState} from './gmail-state.js';
import type {ConnectorConfig,ConnectorContext} from './types.js';

export interface GmailContext {
  directory:string;
  configuration:Pick<ConnectorConfig,'googleClientId'|'googleClientSecret'|'googleRedirectUri'|'syncIntervalMs'>;
  sources:Pick<SourceStore,'register'|'update'|'getSource'|'getItem'|'upsert'|'upsertBatch'|'reportStatus'>;
  archives:Pick<ArchivedFileStore,'read'|'get'|'put'|'attach'>;
  syncState:GmailSyncState;
}
/** Project runtime objects as well as types; Gmail never receives the global Store or credentials. */
export function gmailContext(context:Pick<ConnectorContext,'store'|'sources'|'config'>):GmailContext {
  const archives=new ArchivedFileStore(context.store),syncState=gmailSyncState(context.store);
  const {sources}=context,configuration=context.config.connectors;
  return {directory:configuration?.directory??join(context.config.dataDir,'connectors'),configuration:{
    googleClientId:configuration?.googleClientId,googleClientSecret:configuration?.googleClientSecret,
    googleRedirectUri:configuration?.googleRedirectUri,syncIntervalMs:configuration?.syncIntervalMs,
  },sources:{register:sources.register.bind(sources),update:sources.update.bind(sources),getSource:sources.getSource.bind(sources),
    getItem:sources.getItem.bind(sources),upsert:sources.upsert.bind(sources),upsertBatch:sources.upsertBatch.bind(sources),reportStatus:sources.reportStatus.bind(sources)},
  archives:{read:archives.read.bind(archives),get:archives.get.bind(archives),put:archives.put.bind(archives),attach:archives.attach.bind(archives)},syncState};
}
