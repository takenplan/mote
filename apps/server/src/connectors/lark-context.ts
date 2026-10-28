import {join} from 'node:path';
import type {SourceStore} from '../sources.js';
import type {FileStore} from '../files.js';
import {larkDocumentState,larkSourceReadModel,type LarkDocumentState,type LarkSourceReadModel} from './lark-state.js';
import type {ConnectorContext} from './types.js';

export interface LarkDocumentContext {
  sources:Pick<SourceStore,'getItem'>;
  documentState(account:string,sourceId:string,scope:string):LarkDocumentState;
}
export interface LarkContext extends LarkDocumentContext {
  directory:string;
  syncIntervalMs?:number;
  sources:Pick<SourceStore,'register'|'update'|'getSource'|'getItem'|'upsert'|'listSources'|'reportStatus'>;
  files?:Pick<FileStore,'begin'|'part'|'commit'>;
  read:LarkSourceReadModel;
  documentState(account:string,sourceId:string,scope:string):LarkDocumentState;
}
export function larkContext(context:Pick<ConnectorContext,'store'|'sources'|'files'|'config'>):LarkContext {
  const {sources,files,store}=context;
  return {directory:context.config.connectors?.directory??join(context.config.dataDir,'connectors'),syncIntervalMs:context.config.connectors?.syncIntervalMs,
    sources:{register:sources.register.bind(sources),update:sources.update.bind(sources),getSource:sources.getSource.bind(sources),getItem:sources.getItem.bind(sources),
      upsert:sources.upsert.bind(sources),listSources:sources.listSources.bind(sources),reportStatus:sources.reportStatus.bind(sources)},
    ...(files?{files:{begin:files.begin.bind(files),part:files.part.bind(files),commit:files.commit.bind(files)}}:{}),
    read:larkSourceReadModel(store),documentState:(account,sourceId,scope)=>larkDocumentState(store,account,sourceId,scope)};
}
