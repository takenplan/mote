import {fixture,owner,event} from '../../server/test/fixtures/managed-calendar.js';
import {randomUUID} from 'node:crypto';
import {existsSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
const controls=process.argv[2];if(!controls)throw Error('Private generated controls directory required');
let cleanup:(()=>Promise<void>)|undefined;
const failed=(error:unknown)=>{console.error(error);void Promise.resolve(cleanup?.()).finally(()=>process.exit(1));};process.once('uncaughtException',failed);process.once('unhandledRejection',failed);
const f=await fixture({after:fn=>{cleanup=fn as ()=>Promise<void>;}} as Parameters<typeof fixture>[0],{beforeListen(node){
 node.app.addHook('onRequest',async(req,reply)=>{
  if(req.method==='GET'&&req.url.startsWith('/api/actions')&&existsSync(join(controls,'actions-read-fault')))return reply.code(503).send({error:'service_unavailable'});
  if(req.method==='POST'&&req.url.startsWith('/api/managed-calendar/')&&req.url.endsWith('/cancel')&&existsSync(join(controls,'cancel-fault')))return reply.code(403).send({error:'forbidden'});
  if(req.method==='POST'&&req.url.startsWith('/api/actions/')&&req.url.endsWith('/confirm')&&existsSync(join(controls,'confirm-fault')))return reply.code(503).send({error:'service_unavailable'});
  if(req.method==='PATCH'&&req.url.startsWith('/api/todos/')&&existsSync(join(controls,'todo-patch-fault')))return reply.code(503).send({error:'service_unavailable'});
 });
 node.app.addHook('preHandler',async req=>{if(req.method==='POST'&&req.url==='/api/todos')writeFileSync(join(controls,'todo-trace'),JSON.stringify(req.body)+'\n',{flag:'a',mode:0o600});});
 node.app.addHook('onSend',async(req,reply,payload)=>{if(req.method==='POST'&&req.url==='/api/todos'&&existsSync(join(controls,'todo-lost-receipt'))){rmSync(join(controls,'todo-lost-receipt'));reply.code(503);return JSON.stringify({error:'service_unavailable'});}return payload;});
}});
await f.request('/api/actions/targets',{deviceId:'generated-device',deviceName:'Generated device',calendars:[{id:'generated-calendar',title:'Generated calendar'}]});
const dates={start:'2099-09-18T15:00:00Z',end:'2099-09-18T16:00:00Z'};
async function add(title:string){Object.assign(event,dates,{title});return f.add();}
const waiting=await add('本轮生成的版本评审');await f.grant();await f.request('/api/managed-calendar-deliveries',undefined,f.paired.token);
const uncertain=await add('本轮生成的结果待核实');await f.request('/api/managed-calendar-deliveries',undefined,f.paired.token);const claimed=await f.request('/api/managed-calendar/'+uncertain.id+'/claim',{},f.paired.token);await f.request('/api/managed-calendar/'+uncertain.id+'/receipt',{operationId:claimed.operationId,status:'uncertain'},f.paired.token);
const succeeded=await add('本轮生成的已写入日程');await f.request('/api/managed-calendar-deliveries',undefined,f.paired.token);const saving=await f.request('/api/managed-calendar/'+succeeded.id+'/claim',{},f.paired.token);await f.request('/api/managed-calendar/'+succeeded.id+'/receipt',{operationId:saving.operationId,status:'succeeded',externalId:'generated-calendar-receipt'},f.paired.token);
const stale=await add('本轮生成的原文变化');const removed=await fetch(f.origin+'/api/captures/'+stale.evidence[0].id,{method:'DELETE',headers:{authorization:'Bearer '+owner}});if(!removed.ok)throw Error(await removed.text());
Object.assign(event,{title:'本轮生成的时间待补充',start:null,end:null});const missing=await f.add();Object.assign(event,dates);
const noteId=randomUUID();await f.request('/api/notes',{id:noteId,deviceId:'generated-todo-device',deviceName:'Generated notes device',platform:'import',capturedAt:'2026-10-29T01:00:00Z',text:'本轮生成的待办原文：完成阅读与返回路径。'});
await f.request('/api/todos',{id:randomUUID(),title:'本轮生成的已有待办',description:'原始备注',dueAt:null,evidenceIds:[noteId]});
console.log(JSON.stringify({url:f.origin,token:owner,pairedToken:f.paired.token,generatedOnly:true,liveModelCalls:0,controlledExtraction:true,noteId,waiting:waiting.id,uncertain:uncertain.id,succeeded:succeeded.id,stale:stale.id,missing:missing.id}));
process.on('SIGTERM',()=>{void cleanup?.().then(()=>process.exit(0));});
