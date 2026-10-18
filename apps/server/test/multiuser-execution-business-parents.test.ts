import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {defaultProcessingSettings} from '../src/scope/processing-schema.js';
import {scopedFilesFixture} from './fixtures/scoped-files.js';
import {waitForScopedState} from './fixtures/scoped-process.js';

const operationPath=(id:string)=>'/api/operations/'+encodeURIComponent(id);
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

test('same-configuration file retry supersedes cancelled parent progress and keeps the native receipt family',async t=>{
 const f=await scopedFilesFixture(t),view=await f.checked(f.a.token,'/api/configuration');
 await f.checked(f.a.token,'/api/configuration/processing','PUT',{revision:view.revision,value:{...defaultProcessingSettings(),enabled:false,automatic:true,summarize:false,semanticTurns:false}});
 const capture=await f.upload(f.a.token,'generated-cancel-retry','Generated exact file retry input.'),ref=capture.original.ref;
 let first:any;
 await waitForScopedState(async()=>{first=(await f.checked(f.a.token,'/api/tasks')).items.find((task:{kind:string})=>task.kind==='processing.pipeline');return first?.state==='blocked';},()=>'disabled generated file coordinator did not become visibly blocked');
 await f.checked(f.a.token,'/api/tasks/'+first.id+'/cancel','POST',{});
 const requestId=randomUUID(),receipt=await f.checked(f.a.token,'/api/files/'+capture.id+'/retry','POST',{operationId:requestId,stage:'transcribe'}),retry=await f.checked(f.a.token,'/api/tasks/'+receipt.taskId);
 const operation='file-retry:'+hash([ref,requestId]);
 assert.equal(retry.operationId,'file-retry:'+hash([f.a.userId,operation]));
 assert.equal(retry.kind,'processing.pipeline');assert.notEqual(retry.id,first.id);
 await waitForScopedState(async()=>(await f.checked(f.a.token,'/api/tasks/'+retry.id)).state==='blocked',()=>'retry must remain visibly queued for its existing disabled setting');
 const page=await f.checked(f.a.token,'/api/operations?kind=file');assert.equal(page.items.length,1);const detail=await f.checked(f.a.token,operationPath(page.items[0].id));
 assert.equal(detail.operation.counts.cancelled,0);assert.equal(detail.operation.counts.blocked,1);assert.equal(detail.steps.find((step:{id:string})=>step.id===first.id).current,false);assert.equal(detail.steps.find((step:{id:string})=>step.id===retry.id).current,true);
});

test('a fresh import preview retires the previous generation from canonical parent progress while retaining history',async t=>{
 const {zipSync}=await import('fflate'),f=await scopedFilesFixture(t),metadata=Buffer.alloc(68,0xff);
 metadata.writeUInt32BE(1,0);metadata.write('Bud1',4,'ascii');metadata.writeUInt32BE(32,8);metadata.writeUInt32BE(32,12);metadata.writeUInt32BE(32,16);
 const bytes=Buffer.from(zipSync({'.DS_Store':metadata,'body.txt':Buffer.from('Generated preview generation evidence.')}));
 const created=await f.request(f.a.token,'/api/imports','POST',{processing:'automatic',files:[{name:'generated-generation.zip',dataBase64:bytes.toString('base64')}]});assert.equal(created.statusCode,202,created.body);const id=created.json().id,path='/api/imports/'+id;
 const preview=async()=>waitForScopedState(async()=>{const job=await f.checked(f.a.token,path);if(['failed','needs_configuration'].includes(job.status))assert.fail(JSON.stringify(job));return job.status==='awaiting_confirmation';},()=>'generated ZIP preview did not settle');
 await preview();await f.checked(f.a.token,path+'/cancel','POST',{});assert.equal((await f.request(f.a.token,path+'/retry','POST',{})).statusCode,202);await preview();assert.equal((await f.request(f.a.token,path+'/confirm','POST',{})).statusCode,202);
 await waitForScopedState(async()=>(await f.checked(f.a.token,path)).status==='completed',()=>'new import generation did not complete');
 const page=await f.checked(f.a.token,'/api/operations?kind=import');let parent:any;
 for(const operation of page.items){const detail=await f.checked(f.a.token,operationPath(operation.id));if(detail.steps.filter((step:{kind:string})=>step.kind==='processing.import-decode').length===2&&detail.steps.some((step:{kind:string})=>step.kind==='processing.import-commit')){parent=detail;break;}}
 assert.ok(parent,'canonical import includes both historical preparation and the current publication');
 assert.equal(parent.steps.filter((step:{kind:string;current:boolean})=>step.kind==='processing.import-decode'&&step.current).length,1);
 assert.equal(parent.steps.filter((step:{kind:string;current:boolean})=>step.kind==='processing.import-decode'&&!step.current).length,1);
 await waitForScopedState(async()=>(await f.checked(f.a.token,operationPath(parent.operation.id))).operation.state==='succeeded',()=>'current import and child file processing did not settle');
});

test('ordinary HTTP text import keeps preparation, publication and file processing in one private parent Operation',async t=>{
 const f=await scopedFilesFixture(t),before=await f.checked(f.a.token,'/api/operations');
 const response=await f.request(f.a.token,'/api/imports','POST',{processing:'automatic',files:[{name:'generated-parity.txt',dataBase64:Buffer.from('Generated import parent progress fixture.').toString('base64')}]});
 assert.equal(response.statusCode,202,response.body);const id=response.json().id;
 await waitForScopedState(async()=>{
  const job=await f.checked(f.a.token,'/api/imports/'+id);
  if(['failed','needs_configuration'].includes(job.status))assert.fail(JSON.stringify(job));
  return job.status==='completed';
 },()=>'generated text import did not complete');
 const page=await f.checked(f.a.token,'/api/operations?kind=import');
 let parent:any;
 for(const operation of page.items){
  const detail=await f.checked(f.a.token,operationPath(operation.id));
  const kinds=new Set(detail.steps.map((step:{kind:string})=>step.kind));
  if(kinds.has('processing.import-decode')&&kinds.has('processing.import-commit')){parent=detail;break;}
 }
 assert.ok(parent,'one canonical import Operation must contain both business phases');
 assert.ok(parent.steps.some((step:{kind:string})=>step.kind==='processing.pipeline'),'import attribution includes its file processing coordinator');
 const files=await f.checked(f.a.token,'/api/operations?kind=file');assert.equal(files.items.length,1);
 const file=await f.checked(f.a.token,operationPath(files.items[0].id));
 assert.ok(file.steps.some((step:{kind:string})=>step.kind==='processing.pipeline'));
 for(const step of file.steps)assert.ok(parent.steps.some((item:{id:string})=>item.id===step.id));
 const changes=await f.checked(f.a.token,'/api/operations/changes?since='+before.changeCursor);assert.equal(changes.reset,false);assert.ok(changes.ids.includes(parent.operation.id));assert.ok(changes.ids.includes(files.items[0].id));
 assert.equal((await f.request(f.b.token,operationPath(parent.operation.id))).statusCode,404);
 await f.restart();
 assert.equal((await f.checked(f.a.token,operationPath(parent.operation.id))).operation.kind,'import');
});

