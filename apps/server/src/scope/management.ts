import type {ImportPythonPackConfig} from '../config.js';
import {readFileSync,readdirSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {z} from 'zod';
import {ServerDiagnostics,cleanEvent,diagnosticStageFilters,type EventFields,type LogLevel} from '../diagnostics.js';
import {createUpdateService} from '../updates.js';
import {repositoryRoot} from '../config.js';
import {privateDirectory,privateFile} from '../private-storage.js';
import {registerAuthenticatedRoute,type ScopedRuntime} from './http.js';
import type {Configurations} from './configuration.js';
import {randomUUID} from 'node:crypto';
export type ManagementConfig={dataDir:string;importPythonPacks?:ImportPythonPackConfig[];profile?:string;configuration?:{runtime?:'native'|'docker'|'unknown';hostConfigFile?:string|null}};
const empty=z.object({}).strict();
/** Instance diagnostics are metadata-rich operational events. The schema in
 * diagnostics.ts bounds every field; trace payloads stay excluded here. */
function metadata(raw:unknown){const event=cleanEvent(raw);if(!event)return;const {trace:_,...rest}=event;return rest;}
/** The instance writer is opened right after configuration so every domain
 * registered later can reach it through ScopedRuntime.diagnostics. */
export async function openInstanceDiagnostics(dataDir:string,configuration:Configurations){
 const directory=join(dataDir,'logs','instance');for(const path of [join(dataDir,'logs'),directory])privateDirectory(path);for(const name of readdirSync(directory))privateFile(join(directory,name));
 const settings=configuration.instance.current<Record<string,unknown>>('diagnostics'),diagnostics=new ServerDiagnostics({directory,enabled:settings.enabled!==false,level:settings.level as LogLevel|undefined,debug:settings.debug===true,traceEnabled:false,maxBytes:settings.maxBytes as number|undefined,maxFiles:settings.maxFiles as number|undefined,maxEntries:settings.maxEntries as number|undefined});await diagnostics.init();
 configuration.instance.setHandler<Parameters<ServerDiagnostics['prepareConfiguration']>[0]>('diagnostics',next=>diagnostics.prepareConfiguration({...next,traceEnabled:false}));
 return diagnostics;
}
const requestMethod=(value:unknown)=>typeof value==='string'&&['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'].includes(value)?value as EventFields['method']:undefined;
const routeName=(url:string|undefined)=>{if(!url)return 'unknown';if(!url.startsWith('/api/'))return 'web';const root=url.split('/')[2];return typeof root==='string'&&root?root:'unknown';};
export function registerRequestDiagnostics(runtime:ScopedRuntime,diagnostics:ServerDiagnostics){
 runtime.app.addHook('onRequest',(req,reply,done)=>diagnostics.run(typeof req.id==='string'&&req.id?req.id:randomUUID(),()=>{reply.header('X-Request-Id',req.id);diagnostics.record('request.started',{requestId:req.id,method:requestMethod(req.method),route:routeName(req.routeOptions.url??req.url)},'debug');done();}));
 runtime.app.addHook('onResponse',async(req,reply)=>{diagnostics.record('request.completed',{requestId:req.id,method:requestMethod(req.method),route:routeName(req.routeOptions.url),statusCode:reply.statusCode,durationMs:reply.elapsedTime},reply.statusCode>=500?'error':reply.statusCode>=400?'warn':'info');});
}
export async function registerManagement(runtime:ScopedRuntime,configuration:Configurations,config:ManagementConfig,dependencies:Parameters<typeof createUpdateService>[1]={},diagnostics?:ServerDiagnostics){
 diagnostics??=await openInstanceDiagnostics(config.dataDir,configuration);
 const version=(JSON.parse(readFileSync(join(repositoryRoot,'apps/server/package.json'),'utf8')) as {version:string}).version,updates=configuration.instance.current<{repository:string;channel:'stable'|'preview'}>('updates'),software=createUpdateService({currentVersion:version,profile:config.profile,runtime:config.configuration?.runtime,profileHome:config.configuration?.hostConfigFile?dirname(dirname(config.configuration.hostConfigFile)):undefined,repository:updates.repository,channel:updates.channel},dependencies);
 const snapshot=()=>({version:1,scope:'instance-safe-diagnostics',...diagnostics.snapshot(),coverage:{instanceMetadata:true,privateContents:false,privateTraces:false}}),range=z.object({after:z.string().datetime().default('1970-01-01T00:00:00.000Z'),before:z.string().datetime().default('9999-12-31T23:59:59.999Z')}).strict().refine(value=>value.after<value.before);
 const safeRange=async(raw:unknown)=>{const {after,before}=range.parse(raw),result=await diagnostics.exportRange(after,before);return {...result,events:result.events.map(metadata).filter(value=>value!==undefined)};};
 const page=async(raw:unknown)=>{const args=z.object({file:z.coerce.number().int().min(0).max(diagnostics.snapshot().limits.maxFiles-1).default(0),page:z.coerce.number().int().min(1).default(1),pageSize:z.coerce.number().int().min(1).max(500).default(100),stage:z.enum(diagnosticStageFilters).default('all')}).strict().parse(raw),result=await diagnostics.readPage(args.file,args.page,args.pageSize,args.stage);return {...result,items:result.items.flatMap(line=>{try{const value=metadata(JSON.parse(line));return value?[JSON.stringify(value)]:[];}catch{return [];}})};};
 try{
  runtime.services.registerInstance('instance-management',{scope:'instance',service:{snapshot}});
  registerAuthenticatedRoute(runtime,{method:'GET',url:'/api/software-update',administrator:true,handle:()=>software.status()});
  registerAuthenticatedRoute(runtime,{method:'POST',url:'/api/software-update/check',administrator:true,handle:(_context,request)=>{empty.parse(request.body??{});return software.check();}});
  registerAuthenticatedRoute(runtime,{method:'GET',url:'/api/diagnostics',administrator:true,handle:(_context,request)=>{empty.parse(request.query);return snapshot();}});
  registerAuthenticatedRoute(runtime,{method:'GET',url:'/api/diagnostics/events',administrator:true,handle:(_context,request)=>{const args=z.object({afterSeq:z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),limit:z.coerce.number().int().min(1).max(500).default(200)}).strict().parse(request.query),result=diagnostics.events(args.afterSeq,args.limit);return {...result,items:result.items.map(metadata).filter(value=>value!==undefined)};}});
  registerAuthenticatedRoute(runtime,{method:'GET',url:'/api/diagnostics/log-pages',administrator:true,handle:(_context,request)=>page(request.query)});
  registerAuthenticatedRoute(runtime,{method:'GET',url:'/api/diagnostics/logs',administrator:true,handle:async(context,request,reply)=>{const {file}=z.object({file:z.coerce.number().int().min(0).max(diagnostics.snapshot().limits.maxFiles-1).default(0)}).strict().parse(request.query),lines:string[]=[];for(let index=1;;index++){const result=await page({file,page:index,pageSize:500});lines.unshift(...result.items);if(index>=result.totalPages)break;}runtime.authority.assertAdministrator(context);reply.type('text/plain; charset=utf-8');return lines.join('\n');}});
  registerAuthenticatedRoute(runtime,{method:'GET',url:'/api/support-bundle',administrator:true,handle:async(context,request,reply)=>{diagnostics.record('support.exported');const result=await safeRange(request.query);runtime.authority.assertAdministrator(context);reply.header('Content-Disposition','attachment; filename="mote-support.json"').type('application/json');return {version:1,scope:'central-safe-support',createdAt:new Date().toISOString(),snapshot:snapshot(),...result};}});
  registerRequestDiagnostics(runtime,diagnostics);diagnostics.record('server.started');
  return {close:async()=>{await software.close();diagnostics.record('server.stopping');await diagnostics.close();}};
 }catch(error){await software.close();await diagnostics.close();throw error;}
}
