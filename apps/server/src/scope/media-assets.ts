import {join} from 'node:path';
import {z} from 'zod';
import {MediaAssets,type MediaAssetsOptions,type MediaRole} from '../media-assets.js';
import {mediaRuntimeSettings,type MediaConfiguration} from '../media-configuration.js';
import {privateDirectory} from '../private-storage.js';
import {registerAuthenticatedRoute,type ScopedRuntime} from './http.js';
import {ExecutionFailure} from '../execution-engine.js';
import type {UserContext} from './context.js';

const roleSchema=z.enum(['ocr','dialogue','speaker-wespeaker']);
/** Instance assets and the already supervised managed worker endpoints. User
 * processing still selects its own M04 model reference; install grants no model
 * selection or historical processing authority. */
export function registerManagedMedia(runtime:ScopedRuntime,config:{dataDir:string;media?:Partial<MediaConfiguration>},options:MediaAssetsOptions={}){
 const settings=Object.freeze(mediaRuntimeSettings(config.media)),root=config.media?.modelDirectory??join(config.dataDir,'media-models');privateDirectory(root);
 const assets=new MediaAssets(root,options),controller=new AbortController();
 const probe=async(endpoint:string)=>{
  if(!settings.workerToken)return null;const url=new URL(endpoint);url.pathname='/health';
  try{const response=await fetch(url,{headers:{Authorization:'Bearer '+settings.workerToken},signal:AbortSignal.any([controller.signal,AbortSignal.timeout(1200)])});return response.ok?await response.json():null;}catch{return null;}
 };
 const health=async()=>{
  const status=assets.statuses(),[ocr,audio]=await Promise.all([status.ocr.state==='ready'?probe(settings.ocrEndpoint):null,status.dialogue.state==='ready'||status['speaker-wespeaker'].state==='ready'?probe(settings.asrEndpoint):null]);
  const missing=z.array(z.enum(['ffmpeg','faster_whisper','sherpa_onnx'])).safeParse((audio as {missingDependencies?:unknown}|null)?.missingDependencies);
  return {ocr:{...status.ocr,runtimeReady:Boolean((ocr as {ocr?:boolean}|null)?.ocr)},dialogue:{...status.dialogue,missingDependencies:missing.success?missing.data:[],runtimeReady:Boolean((audio as {asr?:boolean}|null)?.asr&&(audio as {diarization?:boolean}|null)?.diarization)},'speaker-wespeaker':{...status['speaker-wespeaker'],runtimeReady:Boolean((audio as {wespeaker?:boolean}|null)?.wespeaker)}};
 };
 const admitted=(context:UserContext)=>{runtime.authority.assertAdministrator(context);return ()=>{runtime.accounts?.assertAccountEnabled(context.userId,context.authorizationEpoch);};};
 const service={assets,health,
  credentials:(feature:'ocr'|'asr',endpoint:string)=>{const selected=feature==='ocr'?settings.ocrEndpoint:settings.asrEndpoint;return settings.workerToken&&new URL(endpoint).href===new URL(selected).href?settings.workerToken:undefined;},
  readyMask:()=>Number(assets.ready('ocr'))+2*Number(assets.ready('dialogue')),
  admission:async(feature:'ocr'|'asr',endpoint:string)=>{const selected=feature==='ocr'?settings.ocrEndpoint:settings.asrEndpoint;if(!settings.workerToken||new URL(endpoint).href!==new URL(selected).href)return;
   if(!assets.ready(feature==='ocr'?'ocr':'dialogue'))return new ExecutionFailure('blocked','model_missing');
   const value=await probe(selected) as {ocr?:boolean;asr?:boolean;diarization?:boolean}|null;
   if(feature==='ocr'?!value?.ocr:!value?.asr||!value?.diarization)return new ExecutionFailure('waiting',feature+'_worker_unavailable',5000,{executionStarted:false});
  },
  close:async()=>{controller.abort();await assets.close();}};
 runtime.services.registerInstance('managed-media',{scope:'instance',service});
 for(const url of ['/api/media-models','/api/perception/media-models'])registerAuthenticatedRoute(runtime,{method:'GET',url,handle:async()=>health()});
 for(const prefix of ['/api/media-models','/api/admin/media-models']){
  registerAuthenticatedRoute(runtime,{method:'POST',url:prefix+'/:role/install',administrator:true,handle:(context,request,reply)=>{const {role}=z.object({role:roleSchema}).parse(request.params),{source}=z.object({source:z.enum(['auto','official','mirror']).default('auto')}).strict().parse(request.body??{});return reply.code(202).send(assets.install(role,source,admitted(context)));}});
  registerAuthenticatedRoute(runtime,{method:'POST',url:prefix+'/:role/cancel',administrator:true,handle:async(context,request)=>{const {role}=z.object({role:roleSchema}).parse(request.params);z.object({}).strict().parse(request.body??{});admitted(context);return assets.cancel(role);}});
  registerAuthenticatedRoute(runtime,{method:'POST',url:prefix+'/:role/import',administrator:true,handle:async(context,request)=>{const {role}=z.object({role:roleSchema}).parse(request.params),{directory}=z.object({directory:z.string().min(1).max(4000)}).strict().parse(request.body);return assets.importBundle(role,directory,admitted(context));}});
 }
 return service;
}
export type ManagedMedia=ReturnType<typeof registerManagedMedia>;
