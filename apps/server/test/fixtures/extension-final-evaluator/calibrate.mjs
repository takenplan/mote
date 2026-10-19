import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {HttpRuntime,ROOT,FIXTURES,CANDIDATE,assert,delay,randomUUID,sha256} from './http-runtime.mjs';

const runtime=new HttpRuntime('calibration-'+Date.now());
const observed=[];
const record=(id,result)=>{observed.push({id,...result});console.log(JSON.stringify({id,...result}));};
let releaseHeld,arrivedHeld,observedLate;
const heldArrived=new Promise(r=>arrivedHeld=r),heldReleased=new Promise(r=>releaseHeld=r),lateObserved=new Promise(r=>observedLate=r);
const control=createServer(async(req,res)=>{
  if(req.url==='/held'){arrivedHeld();await heldReleased;res.end('{}');}
  else if(req.url==='/observed'){let body='';for await(const part of req)body+=part;observedLate(JSON.parse(body));res.end('{}');}
  else{res.statusCode=404;res.end();}
});
await new Promise(resolve=>control.listen(0,'127.0.0.1',resolve));
const controlUrl='http://127.0.0.1:'+control.address().port;
try{
  await runtime.initialize();await runtime.start();const a=await runtime.login();const b=await runtime.secondUser(a);
  const code=await readFile(join(FIXTURES,'calibration-plugin.mjs'),'utf8');
  const release=await runtime.addRelease({repo:'r5-evaluator/calibration',manifest:{schemaVersion:1,id:'r5.evaluator.calibration',name:'Independent R05 calibration',version:'1.0.0',runtime:'worker',entry:'plugin.mjs',capabilities:['source','processor'],configuration:[],dependencies:[],access:['Generated owner sources'],components:[{id:'r5.calibration.source',version:'1',surface:'ingress',capability:'source'},{id:'r5.calibration.processor',version:'1',surface:'processing',capability:'processor'}]},files:{'plugin.mjs':code}});
  const beforeInstall=await runtime.request(a,'GET','/api/materials',undefined,200);
  const pkg=await runtime.install(a,release);
  const source='same-source';await runtime.source(a,source);await runtime.source(b.token,source);
  const text='R05 GENERATED POSITIVE '+randomUUID();const foreignText='R05 B-ONLY '+randomUUID();
  const item=(id,text)=>({externalId:id,revision:'1',observedAt:'2026-09-30T20:00:00Z',title:'Generated calibration',text,kind:'message',layer:'original'});
  await runtime.request(a,'POST','/api/ingress/sources/'+source+'/items',{batchId:'calibration-a',items:[item('a-original',text)]},200);
  await runtime.request(b.token,'POST','/api/ingress/sources/'+source+'/items',{batchId:'calibration-b',items:[item('b-original',foreignText)]},200);
  const [ao]= (await runtime.originals(a,source)).items, [bo]=(await runtime.originals(b.token,source)).items;
  const ai=await runtime.configure(a,pkg,[source],{capabilities:['source','processor']}),bi=await runtime.configure(b.token,pkg,[source],{capabilities:['source','processor']});
  assert.equal(ai.check.checked,true);assert.equal(bi.check.checked,true);
  const as=(await runtime.snapshot(a)).body,bs=(await runtime.snapshot(b.token)).body;
  const call=async(token,snapshot,payload,component='r5.calibration.source')=>{
    const task=(await runtime.invoke(token,snapshot.id,component,payload)).body;
    return runtime.task(token,task.id);
  };
  const positiveId='positive-'+randomUUID();
  const positive=await call(a,as,{mode:'positive',sourceId:source,originalRef:ao.ref,identity:positiveId});
  assert.equal(positive.state,'succeeded');
  const materialId='mat_'+sha256(JSON.stringify([source,positiveId])),read=(await runtime.request(a,'GET','/api/materials/'+materialId+'/read',undefined,200)).body;
  assert.deepEqual(JSON.parse(read.text),{text,originalRef:ao.ref});
  const members=(await runtime.request(a,'GET','/api/materials/'+materialId+'/members',undefined,200)).body;
  assert(members.items.some(member=>member.ref==='capture:'+ao.captureId));
  record('C01_REAL_POSITIVE',{expected:'PASS',observed:'PASS',specimenSha256:sha256(code),packageDigest:release.digest,taskId:positive.id,materialId,manifestOrderReversed:true});
  const beforeFake=(await runtime.request(a,'GET','/api/materials',undefined,200)).body.items.length;
  const fake=await call(a,as,{mode:'registry',sourceId:source,originalRef:ao.ref,identity:'fake'});assert.equal(fake.state,'succeeded');
  const afterFake=(await runtime.request(a,'GET','/api/materials',undefined,200)).body.items.length;
  const registryVerdict=afterFake===beforeFake?'FAIL':'PASS';assert.equal(registryVerdict,'FAIL');
  record('C02_REGISTRY_ONLY',{expected:'FAIL',observed:registryVerdict,taskSucceeded:true,publicationDelta:afterFake-beforeFake});
  const publicSpec=JSON.parse(await readFile(join(CANDIDATE,'docs/validation/plugin-extension-benchmark/cases.json'),'utf8'));
  const changedTransactions=publicSpec.fixtures['finance-visible-v1'].canonicalTransactions.map(t=>({...t,...(t.transactionId==='P01'?{amountCents:t.amountCents+17}:{})}));
  const changedText=JSON.stringify(changedTransactions);
  const changedReceipt=(await runtime.request(a,'POST','/api/ingress/sources/'+source+'/items',{batchId:'calibration-changed',items:[item('changed-finance-input',changedText)]},200)).body;
  const changedOriginal=changedReceipt.captures[0].original;
  const hardcodedId='hardcoded-'+randomUUID();await call(a,as,{mode:'hardcoded',sourceId:source,originalRef:changedOriginal.ref,identity:hardcodedId});
  const hardcodedRead=(await runtime.request(a,'GET','/api/materials/mat_'+sha256(JSON.stringify([source,hardcodedId]))+'/read',undefined,200)).body;
  const actual=JSON.parse(hardcodedRead.text).netCents,expected=changedTransactions.filter(t=>t.postedAt>='2026-09-01T00:00:00Z'&&t.postedAt<'2026-10-01T00:00:00Z').reduce((sum,t)=>sum+t.amountCents,0);assert.notEqual(actual,expected);
  record('C03_HARDCODED_VISIBLE',{expected:'FAIL',observed:'FAIL',actualCents:actual,independentExpectedCents:expected,changedInputOriginal:changedOriginal.ref,materialRead:true});
  const intrusion='diff --git a/apps/server/src/index.ts b/apps/server/src/index.ts\n--- a/apps/server/src/index.ts\n+++ b/apps/server/src/index.ts\n@@ -1,1 +1,1 @@\n-export const forced = false;\n+export const forced = true;\n';
  const paths=[...intrusion.matchAll(/^\+\+\+ b\/(.+)$/gm)].map(m=>m[1]);const core=paths.filter(p=>p.startsWith('apps/server/src/')||p.startsWith('packages/agent/src/')||p.startsWith('apps/server/test/'));
  assert.equal(core.length,1);record('C04_CORE_INTRUSION',{expected:'FAIL',observed:'FAIL',specimenSha256:sha256(intrusion),changedCoreFiles:core,checkoutModified:false});
  await writeFile(join(runtime.dir,'synthetic-intrusion.patch'),intrusion);
  const foreign=await call(a,as,{mode:'foreign',originalRef:bo.ref});assert.notEqual(foreign.state,'succeeded');assert(!JSON.stringify(foreign).includes(foreignText));
  const foreignSnapshot=await runtime.invoke(a,bs.id,'r5.calibration.source',{mode:'foreign',originalRef:bo.ref},randomUUID(),404);assert.notEqual(foreignSnapshot.status,200);
  await runtime.request(b.token,'GET','/api/materials/'+materialId+'/read',undefined,404);
  record('C05_FOREIGN_OWNER',{expected:'no disclosures',observed:'PASS',workerReadState:foreign.state,foreignSnapshotStatus:foreignSnapshot.status,foreignDataDisclosures:0});
  const lateId='late-'+randomUUID();const lateTask=(await runtime.invoke(a,as.id,'r5.calibration.source',{mode:'late',sourceId:source,originalRef:ao.ref,identity:lateId,control:controlUrl})).body;
  await Promise.race([heldArrived,delay(10000).then(()=>{throw new Error('late specimen did not start');})]);
  await runtime.request(a,'POST','/api/tasks/'+lateTask.id+'/cancel',{},200);
  const siblingId='sibling-'+randomUUID();const sibling=await call(a,as,{mode:'positive',sourceId:source,originalRef:ao.ref,identity:siblingId});assert.equal(sibling.state,'succeeded');
  releaseHeld();const observation=await Promise.race([lateObserved,delay(10000).then(()=>{throw new Error('late specimen observation absent');})]);
  assert.equal(observation.rejected,true);assert.equal(observation.aborted,true);
  await runtime.request(a,'GET','/api/materials/mat_'+sha256(JSON.stringify([source,lateId]))+'/read',undefined,404);
  record('C06_LATE_PUBLISH',{expected:'no stale publications',observed:'PASS',taskId:lateTask.id,latePublishRejected:true,cancelSignalObserved:true,sameWorkerSiblingSucceeded:true});
  const transcript=await call(a,as,{originalRef:ao.ref},'r5.calibration.processor');assert.equal(transcript.state,'succeeded');
  const artifact=(await runtime.request(a,'GET','/api/processing/artifacts/'+transcript.result.artifactId,undefined,200)).body;
  assert.equal(artifact.originalRef,ao.ref);assert.equal(artifact.payload.segments.map(s=>s.text).join('\n'),text);
  record('PROCESSOR_SANITY',{observed:'PASS',artifactId:transcript.result.artifactId,originalRef:ao.ref});
  await runtime.stop();await runtime.start();
  const afterRestart=(await runtime.request(a,'GET','/api/materials/'+materialId+'/read',undefined,200)).body;assert.deepEqual(JSON.parse(afterRestart.text),{text,originalRef:ao.ref});
  const taskAfter=(await runtime.request(a,'GET','/api/tasks/'+positive.id,undefined,200)).body;assert.equal(taskAfter.state,'succeeded');
  record('ACTUAL_RESTART_SANITY',{observed:'PASS',distinctPids:new Set(runtime.processes.map(p=>p.pid)).size,taskId:positive.id,historyReadable:true});
}catch(error){console.error(error);record('CALIBRATION_ERROR',{observed:'FAIL',message:error.message,stack:error.stack});process.exitCode=1;}
finally{releaseHeld();await runtime.stop();control.closeAllConnections();await new Promise(resolve=>control.close(resolve));await writeFile(join(ROOT,'calibration-results.json'),JSON.stringify({createdAt:new Date().toISOString(),runDir:runtime.dir,observed},null,2));}
