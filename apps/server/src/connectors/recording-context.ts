import {ArchivedFileStore} from '../archived-files.js';
import {ExecutionEngine} from '../execution-engine.js';
import type {SourceStore} from '../sources.js';
import type {FileStore} from '../files.js';
import type {ServerDiagnostics} from '../diagnostics.js';
import {recordingState,recordingWorkReadModel,type RecordingState,type RecordingWorkReadModel} from './recording-state.js';
import {recordingMemoryRecipe} from './recording-memory.js';
import type {ConnectorContext} from './types.js';

export interface RecordingContext {
 directory:string;
 syncIntervalMs?:number;
 sources:Pick<SourceStore,'register'|'update'|'getSource'|'getItem'>;
 files?:Pick<FileStore,'transcriptRevision'>;
 archives:Pick<ArchivedFileStore,'putParts'|'putRecordingMedia'|'attach'|'get'>;
 engine:Pick<ExecutionEngine,'register'|'cancelKind'|'enqueue'|'get'|'retry'|'tick'|'drain'>;
 closeEngine():Promise<void>;
 diagnostics?:Pick<ServerDiagnostics,'record'>;
 state:RecordingState;
 work:RecordingWorkReadModel;
 configureDefaults(sourceId:string,enable?:boolean):void;
}
export function recordingResources(context:Pick<ConnectorContext,'store'|'config'|'sources'|'files'|'sourcePipelines'|'memoryRecipeSettings'|'diagnostics'>):{context:RecordingContext;engine:ExecutionEngine} {
 const {store,sources,files,diagnostics,sourcePipelines,memoryRecipeSettings}=context;
 const archives=new ArchivedFileStore(store),state=recordingState(store,archives),engine=sourcePipelines?.engine??new ExecutionEngine(store);
 const configurePipeline=sourcePipelines?.configure.bind(sourcePipelines),configureMemory=memoryRecipeSettings?.configure.bind(memoryRecipeSettings);
 const runtime:RecordingContext={directory:context.config.connectors!.directory,syncIntervalMs:context.config.connectors?.syncIntervalMs,
  sources:{register:sources.register.bind(sources),update:sources.update.bind(sources),getSource:sources.getSource.bind(sources),getItem:sources.getItem.bind(sources)},
  ...(files?{files:{transcriptRevision:files.transcriptRevision.bind(files)}}:{}),
  archives:{putParts:archives.putParts.bind(archives),putRecordingMedia:archives.putRecordingMedia.bind(archives),attach:archives.attach.bind(archives),get:archives.get.bind(archives)},
  engine:{register:engine.register.bind(engine),cancelKind:engine.cancelKind.bind(engine),enqueue:engine.enqueue.bind(engine),get:engine.get.bind(engine),retry:engine.retry.bind(engine),tick:engine.tick.bind(engine),drain:engine.drain.bind(engine)},
  closeEngine:sourcePipelines?async()=>{}:()=>engine.close(),
  ...(diagnostics?{diagnostics:{record:diagnostics.record.bind(diagnostics)}}:{}),state,work:recordingWorkReadModel(store),
  configureDefaults:(sourceId,enable)=>{if(configurePipeline&&!state.pipelineConfigured(sourceId))configurePipeline(sourceId,{settleSeconds:0});if(enable===true&&configureMemory&&!state.memoryRecipeConfigured(sourceId))configureMemory({sourceId,recipes:[recordingMemoryRecipe]});},
 };
 return {context:runtime,engine};
}
