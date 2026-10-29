import {join} from 'node:path';
import {existsSync} from 'node:fs';
import {randomBytes,randomUUID} from 'node:crypto';
import {buildApp} from '../../server/src/app.js';
const directory=process.argv[2];if(!directory)throw Error('Private generated directory required');
const token=randomBytes(32).toString('hex');
const node=await buildApp({dataDir:join(directory,'data'),token,tokenPath:'generated',host:'127.0.0.1',port:0,maxStorageBytes:30_000_000,maxExportBytes:1_000_000,retentionDays:0,insightIntervalHours:0,allowedOrigins:[],model:'',modelBaseUrl:'',apiKey:'',allowUnauthenticatedLocal:false,embeddingModel:'',embeddingBaseUrl:'',embeddingApiKey:''},{backgroundWorker:false});
node.app.addHook('onRequest',async(req,reply)=>{if(req.url.startsWith('/api/work-activity')&&existsSync(join(directory,'activity-fault')))return reply.code(503).send({error:'service_unavailable',message:'Generated activity read unavailable'});if(req.url==='/api/imports'&&existsSync(join(directory,'import-missing')))return reply.code(404).send({error:'not_found',message:'Generated import list unavailable'});});
const at='2026-10-29T01:00:00.000Z',captureId=randomUUID();
node.app.post('/__fixture/activity-state',async(req)=>{if(req.headers.authorization!=='Bearer '+token)throw Error('Generated owner required');const value=req.body as {state:string};if(!['failed','cancelled','preparing','queued','awaiting_confirmation','completed'].includes(value.state))throw Error('Unknown controlled state');patch(waiting.id,{status:value.state});return {generatedOnly:true};});
const response=await node.app.inject({method:'POST',url:'/api/notes',headers:{authorization:'Bearer '+token},payload:{id:captureId,deviceId:'generated-activity',deviceName:'Generated fixture',platform:'import',capturedAt:at,text:'Generated exact Activity original: retain the result and its evidence identity.'}});if(response.statusCode!==201)throw Error(response.body);
const waiting=await node.imports.create({name:'待核对的生成资料.txt',processing:'preview',files:[{name:'generated-review.txt',dataBase64:Buffer.from('Generated private Activity input').toString('base64')}]});
const done=await node.imports.create({name:'已归档的生成资料.txt',processing:'preview',files:[{name:'generated-completed.txt',dataBase64:Buffer.from('Generated completed input').toString('base64')}]});
function patch(id:string,change:Record<string,unknown>){const row=node.store.db.prepare('SELECT json FROM import_jobs WHERE id=?').get(id)!;node.store.db.prepare('UPDATE import_jobs SET json=? WHERE id=?').run(JSON.stringify({...JSON.parse(String(row.json)),...change}),id);}
// These statuses are deliberately controlled host receipts, not a live model run.
patch(waiting.id,{status:'awaiting_confirmation',preview:{count:1,samples:[{title:'生成解析样例',text:'Generated unconfirmed interpretation',attachmentCount:0}]}});
patch(done.id,{status:'completed',captureIds:[captureId],progress:{total:1,processed:1,imported:1,duplicates:0}});
const memoryId='generated-activity-memory',job={id:memoryId,createdAt:at,updatedAt:at,status:'completed',evidenceIds:[captureId],memoryIds:[],materialInputs:[],materialRefs:{},workPackage:{goal:'核对生成资料的工作分支',instruction:'Generated controlled receipts'}};
node.store.db.prepare('INSERT INTO memory_jobs VALUES(?,?,?)').run(memoryId,at,JSON.stringify(job));
for(let i=0;i<23;i++)node.store.db.prepare('INSERT INTO memory_batches VALUES(?,?,?,?)').run('generated-activity-branch-'+i,memoryId,i,JSON.stringify({id:'generated-activity-branch-'+i,index:i,status:'completed',attempts:1,memoryIds:[],evidenceRanges:[{id:captureId,offset:0,length:10}]}));
const address=await node.app.listen({host:'127.0.0.1',port:0});console.log(JSON.stringify({generatedOnly:true,token,server:{port:new URL(address).port},waitingId:'import:'+waiting.id,doneId:'import:'+done.id,memoryId:'memory:'+memoryId,captureId}));
process.on('SIGTERM',()=>{void node.app.close().then(()=>process.exit(0));});
