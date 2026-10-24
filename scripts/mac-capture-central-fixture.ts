/** Isolated generated-data Central for the real Chrome collector journey. */
import {buildApp} from '../apps/server/src/app.js';
import type {Config} from '../apps/server/src/config.js';
import {join} from 'node:path';
const dataDir=process.env.MOTE_FIXTURE_DATA!,token=process.env.MOTE_FIXTURE_TOKEN!;
if(!process.send||!dataDir||!token)throw Error('This fixture requires a private IPC parent');
const config:Config={dataDir,token,tokenPath:join(dataDir,'token'),host:'127.0.0.1',port:0,maxStorageBytes:30_000_000,maxExportBytes:10_000_000,retentionDays:0,insightIntervalHours:0,allowedOrigins:[],model:'',modelProvider:'custom',modelProtocol:'openai-completions',modelBaseUrl:'http://127.0.0.1:1234/v1',apiKey:'',allowUnauthenticatedLocal:true,embeddingModel:'',embeddingBaseUrl:'',embeddingApiKey:'',diagnosticsEnabled:false};
const node=await buildApp(config,{backgroundWorker:false});
const url=await node.app.listen({host:'127.0.0.1',port:0});process.send({type:'ready',url});
process.on('message',message=>{if((message as {type?:string}).type==='inspect')void(async()=>{
 await node.materialOrganizer.tick();const materials=node.materials.list({query:'Visible generated article body',kind:'mote.ui-page-object'}).items;
 process.send?.({type:'inspection',wechatMaterials:node.materials.list({query:'Generated repeated message',kind:'mote.ui-page-object'}).items.map(m=>({id:m.id,text:node.materials.read(m.ref).text})),materials:materials.map(m=>({id:m.id,text:node.materials.read(m.ref).text})),memoryJobs:node.store.db.prepare('SELECT count(*) n FROM memory_jobs').get()!.n,activityGrants:node.store.db.prepare('SELECT count(*) n FROM activity_input_grants').get()!.n});
})().catch(error=>{process.send?.({type:'failure',error:String(error)});});});
process.once('SIGTERM',()=>void node.app.close().finally(()=>process.exit(0)));
