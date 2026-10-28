import {join} from 'node:path';
import type {SourceStore} from '../sources.js';
import type {ConnectorConfig,ConnectorContext} from './types.js';

/** Calendar synchronization receives only its source operations and OAuth settings. */
export interface GoogleCalendarContext {
  directory:string;
  configuration:Pick<ConnectorConfig,'googleClientId'|'googleClientSecret'|'googleRedirectUri'|'syncIntervalMs'>;
  sources:Pick<SourceStore,'register'|'update'|'getSource'|'getItem'|'upsert'|'listItems'|'reportStatus'>;
}
export function googleCalendarContext(context:Pick<ConnectorContext,'sources'|'config'>):GoogleCalendarContext {
  const {sources}=context,configuration=context.config.connectors;
  return {directory:configuration?.directory??join(context.config.dataDir,'connectors'),configuration:{
    googleClientId:configuration?.googleClientId,googleClientSecret:configuration?.googleClientSecret,
    googleRedirectUri:configuration?.googleRedirectUri,syncIntervalMs:configuration?.syncIntervalMs,
  },sources:{register:sources.register.bind(sources),update:sources.update.bind(sources),getSource:sources.getSource.bind(sources),
    getItem:sources.getItem.bind(sources),upsert:sources.upsert.bind(sources),listItems:sources.listItems.bind(sources),reportStatus:sources.reportStatus.bind(sources)}};
}
