import {readFile,writeFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {HttpRuntime,ROOT,FIXTURES,CANDIDATE,verifyCandidate,requireCandidate,assert,sha256,randomUUID,delay} from './http-runtime.mjs';
import {SemanticService} from './semantic-service.mjs';
import {assertFinanceBody} from './finance-oracle.mjs';
const {unzipSync}=requireCandidate('fflate');
const variantName=process.env.R5_VARIANT??'final-initial';
const variant=JSON.parse(await readFile(join(FIXTURES,'private-held-oracles.json'),'utf8'))[variantName];
assert(variant);
const delivery=JSON.parse(await readFile(join(FIXTURES,'iterator-delivery-freeze.json'),'utf8'));
const pack=join(CANDIDATE,'plugins/extension-benchmark/final-pack');
for(const [name,expected] of Object.entries(delivery.files))assert.equal(sha256(await readFile(join(pack,name))),expected,'submitted bytes changed after Iterator freeze: '+name);
await verifyCandidate();
const runtime=new HttpRuntime('final-'+variantName+'-'+Date.now());
const semantic=new SemanticService();
const results=[];
const record=value=>{results.push(value);console.log(JSON.stringify(value));};
const itemFor = observation => ({externalId:observation.observationId,revision:'1',observedAt:'2026-09-30T20:00:00Z',title:'Generated '+observation.sourceKind+' observation',text:observation.text,kind:'message',layer:'original',deleted:false});
const terminalSuccess=(value,label)=>{assert.equal(value.state,'succeeded',label+': '+JSON.stringify(value));return value;};

async function stageInputs(token,v) {
  const bindings=new Map(),transactions=new Map(v.transactions.map(t=>[t.transactionId,t]));
  for(const source of Object.values(v.sources)){
    await runtime.source(token,source,'Generated finance '+source);
    const observations=v.observations.filter(o=>o.sourceId===source);
    for(let start=0;start<observations.length;start+=6){
      const batch=observations.slice(start,start+6),items=batch.map(itemFor);
      const receipt=(await runtime.request(token,'POST','/api/ingress/sources/'+source+'/items',{batchId:'generated-'+randomUUID(),items},200)).body;
      assert.equal(receipt.captures.length,batch.length);
      for(let i=0;i<batch.length;i++){
        const original=receipt.captures[i].original;assert(original);
        assert.equal(original.sourceId,source);bindings.set(batch[i].observationId,original);
        semantic.bind(original,batch[i],transactions.get(batch[i].transactionId),items[i]);
      }
    }
    const page=await runtime.originals(token,source,7);assert.equal(page.items.length,observations.length);
    assert(page.pages>=(v.expected.sourceMinimumPages[source]??1));
  }
  return bindings;
}
async function lookupFinance(token,task) {
  const materialId=task.result?.materialId??task.result?.id??task.result?.material?.id;
  if(materialId)return runtime.material(token,materialId);
  const all=(await runtime.request(token,'GET','/api/materials?limit=200',undefined,200)).body.items;
  assert.equal(all.length,1,'fallback lookup requires exactly one initial Material');return runtime.material(token,all[0].id);
}
async function publicationState(token) {
  return (await runtime.request(token,'GET','/api/materials?limit=200',undefined,200)).body.items.map(m=>({id:m.id,revision:m.revision})).sort((a,b)=>a.id.localeCompare(b.id));
}
function selectedSourcesVariant(ids) {
  const observations=variant.observations.filter(o=>ids.includes(o.sourceId)),transactionIds=new Set(observations.map(o=>o.transactionId).filter(Boolean));
  const transactions=variant.transactions.filter(t=>transactionIds.has(t.transactionId));
  const selected=transactions.filter(t=>t.postedAt>='2026-09-01T00:00:00Z'&&t.postedAt<'2026-10-01T00:00:00Z');
  const expected={month:'2026-09',currency:'USD',totalObservations:observations.length,uniqueTransactions:transactions.length,noiseObservations:observations.filter(o=>o.transactionId===null).length,repeatedObservations:observations.filter(o=>o.transactionId!==null).length-transactions.length,monthlyCharges:selected.filter(t=>t.amountCents>=0).length,monthlyRefunds:selected.filter(t=>t.amountCents<0).length,grossCents:selected.filter(t=>t.amountCents>=0).reduce((s,t)=>s+t.amountCents,0),refundCents:-selected.filter(t=>t.amountCents<0).reduce((s,t)=>s+t.amountCents,0),netCents:selected.reduce((s,t)=>s+t.amountCents,0),ledgerIds:selected.map(t=>t.transactionId).sort(),allTransactionIds:transactions.map(t=>t.transactionId).sort(),sourceMinimumPages:Object.fromEntries(ids.map(id=>[id,Math.ceil(observations.filter(o=>o.sourceId===id).length/7)]))};
  return {sources:Object.fromEntries(Object.entries(variant.sources).filter(([,id])=>ids.includes(id))),observations,transactions,expected};
}
async function waitPublication(token,previousIds) {
  const deadline=Date.now()+15000;
  while(Date.now()<deadline){const items=(await runtime.request(token,'GET','/api/materials?limit=200',undefined,200)).body.items;const fresh=items.filter(item=>!previousIds.has(item.id));if(fresh.length){assert.equal(fresh.length,1);return fresh[0];}await delay(20);}
  throw new Error('no new public Material after admitted task');
}
async function reconfigure(token,id,pkg,sourceIds,capabilities=['source'],desired=false) {
  const view=(await runtime.request(token,'GET','/api/plugins',undefined,200)).body;
  const instance=view.instances.find(i=>i.id===id);assert(instance);
  return runtime.request(token,'POST','/api/plugin-instances',{expectedRevision:view.revision,instance:{id,packageId:pkg.id,name:instance.name,configuration:{pageLimit:7},desired,revocation:instance.revocation,grants:{capabilities,sourceIds,history:true}}},200);
}

try {
  await semantic.start();await runtime.initialize();await runtime.start();const a=await runtime.login(),b=await runtime.secondUser(a);
  const sourceIds=Object.values(variant.sources).reverse();
  const {makeRelease}=await import(pathToFileURL(join(pack,'release.mjs')).href);
  const makeEvaluatedRelease=async version=>{
    const authored=await makeRelease(version),files=unzipSync(authored.archive);
    assert(files['semantic-mock.mjs'],'explicit replaceable semantic seam is included in release');
    const replaced={...files,'semantic-mock.mjs':semantic.module()};
    const release=await runtime.addRelease({repo:authored.repository,tag:authored.tag,manifest:authored.manifest,files:replaced});
    return {...release,authoredArchiveSha256:sha256(authored.archive),authoredFiles:Object.fromEntries(Object.entries(files).filter(([name])=>name!=='semantic-mock.mjs').map(([name,bytes])=>[name,sha256(bytes)]))};
  };
  const release1=await makeEvaluatedRelease('1.0.0'),release2=await makeEvaluatedRelease('1.1.0');
  const pkg=await runtime.install(a,release1);
  assert.equal(semantic.ledger.length,0,'install performs no model extraction');
  assert.equal((await runtime.request(a,'GET','/api/materials',undefined,200)).body.items.length,0,'install publishes no financial result');
  const aBindings=await stageInputs(a,variant);
  const canonicalB={...variant.transactions.find(t=>t.amountCents>0&&t.postedAt.startsWith('2026-09')),amountCents:987654321,merchant:'B-ONLY-GENERATED-SENTINEL'};
  const observationB={...variant.observations.find(o=>o.transactionId===canonicalB.transactionId),sourceId:sourceIds[0],sourceKind:'bank',text:'B-ONLY-GENERATED-SENTINEL\n'+JSON.stringify(canonicalB)};
  const bv={sources:variant.sources,transactions:[canonicalB],observations:[observationB],expected:{sourceMinimumPages:Object.fromEntries(sourceIds.map(s=>[s,1]))}};
  const bBindings=await stageInputs(b.token,bv);
  await runtime.configure(a,pkg,sourceIds,{id:'same-instance',configuration:{pageLimit:7},capabilities:['source']});
  await runtime.configure(a,pkg,sourceIds,{id:'processor-instance',configuration:{pageLimit:7},capabilities:['processor']});
  await runtime.configure(b.token,pkg,sourceIds,{id:'same-instance',configuration:{pageLimit:7},capabilities:['source']});
  const as=(await runtime.snapshot(a)).body,bs=(await runtime.snapshot(b.token)).body,ap=(await runtime.snapshot(a,'processor-instance')).body;
  assert.equal(semantic.ledger.length,0,'check/enable/snapshot admission alone performs no semantic extraction');
  const operationId='r5-held-'+randomUUID(),payload={sourceIds,month:'2026-09',operationId,pageLimit:7},hostOperation=randomUUID();
  const start=Date.now(),admission=(await runtime.invoke(a,as.id,'final.finance.source',payload,hostOperation)).body;
  const task=terminalSuccess(await runtime.task(a,admission.id),'finance held input execution');
  const material=await lookupFinance(a,task),oracle=assertFinanceBody(material.body,variant,aBindings);
  assert.equal(material.members.length,43,'real Material carries all capture members');
  assert.deepEqual(material.members.map(m=>m.ref).sort(),[...aBindings.values()].map(o=>'capture:'+o.captureId).sort());
  for(const member of material.members)assert.equal(member.kind,'capture');
  assert.equal(semantic.ledger.length,43,'one semantic extraction per consumed original');
  assert(semantic.ledger.every(row=>row.reply&&!row.error));
  assert.deepEqual(semantic.ledger.map(row=>row.originalRef).sort(),[...aBindings.values()].map(original=>original.ref).sort(),'every exact original is sent to semantic extraction once');
  record({id:'P01_SOURCE',status:'PARTIAL',boundedStatus:'PASS',scope:'43 original source observations -> mocked per-observation extraction -> independent integer ledger -> real Material/readback',unexecutedRequired:['durable insight outcome required by E01.3 is incomplete'],taskId:task.id,materialId:material.material.id,revision:material.material.revision,...oracle,modelRequests:43,elapsedMs:Date.now()-start,packageDigest:release1.digest});
  const repeated=(await runtime.invoke(a,as.id,'final.finance.source',payload,hostOperation)).body;assert.equal(repeated.id,task.id);
  assert.equal(semantic.ledger.length,43,'same admitted operation does not rerun normalization');
  const sameAgain=terminalSuccess(await runtime.task(a,repeated.id),'idempotent operation');assert.deepEqual(sameAgain.result,task.result);
  const historyAgain=await runtime.material(a,material.material.id);assert.equal(historyAgain.material.revision,material.material.revision);
  record({id:'IDEMPOTENCE',status:'PASS',sameTaskId:task.id,sameMaterialRevision:true,additionalModelRequests:0});
  const chosen=variant.observations.find(o=>o.transactionId!==null),original=aBindings.get(chosen.observationId);
  const processorAdmission=(await runtime.invoke(a,ap.id,'final.text.processor',{originalRef:original.ref})).body;
  const processor=terminalSuccess(await runtime.task(a,processorAdmission.id),'submitted processor');
  const artifact=(await runtime.request(a,'GET','/api/processing/artifacts/'+processor.result.artifactId,undefined,200)).body;
  assert.equal(artifact.originalRef,original.ref);assert.equal(artifact.payload.segments.map(s=>s.text).join('\n'),chosen.text.replace(/\r\n?/g,'\n').trim());
  assert.equal(artifact.payload.engine,'final-text-normalizer-1.0.0');
  record({id:'P02_PROCESSOR',status:'PARTIAL',boundedStatus:'PASS',scope:'Real text Original -> installed processor -> durable Transcript/readback, no image-provider claim',unexecutedRequired:['capture/upload image origins (E08.1)','selected image provider and named products (E08.2)','held processor deletion/configuration fence (E08.4)'],taskId:processor.id,artifactId:processor.result.artifactId,originalRef:original.ref});
  const bPayload={sourceIds,month:'2026-09',operationId:'b-'+randomUUID(),pageLimit:7};
  const bAdmission=(await runtime.invoke(b.token,bs.id,'final.finance.source',bPayload)).body;
  const bTask=terminalSuccess(await runtime.task(b.token,bAdmission.id),'B source');const bMaterial=await lookupFinance(b.token,bTask);
  assert.equal(bMaterial.body.totals.netCents,987654321);assert.equal(bMaterial.body.allTransactions.length,1);
  assert.equal(bMaterial.body.allTransactions[0].transactionId,canonicalB.transactionId);
  if(bMaterial.material.id===material.material.id){
    const ownerARead=await runtime.material(a,bMaterial.material.id),ownerBRead=await runtime.material(b.token,material.material.id);
    assertFinanceBody(ownerARead.body,variant,aBindings);assert.equal(ownerBRead.body.totals.netCents,987654321);
    assert(!ownerARead.text.includes('B-ONLY-GENERATED-SENTINEL'));
  }else{
    await runtime.request(a,'GET','/api/materials/'+bMaterial.material.id+'/read',undefined,404);
    await runtime.request(b.token,'GET','/api/materials/'+material.material.id+'/read',undefined,404);
  }
  await runtime.request(a,'GET','/api/tasks/'+bTask.id,undefined,404);
  await runtime.invoke(a,bs.id,'final.finance.source',bPayload,randomUUID(),404);
  const foreignProcessor=(await runtime.invoke(a,ap.id,'final.text.processor',{originalRef:[...bBindings.values()][0].ref})).body;
  const foreignResult=await runtime.task(a,foreignProcessor.id);assert.notEqual(foreignResult.state,'succeeded');
  assert(!JSON.stringify(foreignResult).includes('B-ONLY-GENERATED-SENTINEL'));
  const aEvents=(await runtime.request(a,'GET','/api/plugin-events?since=0',undefined,200)).body;
  assert(!JSON.stringify(aEvents).includes(bTask.id));assert(!JSON.stringify(aEvents).includes('B-ONLY-GENERATED-SENTINEL'));
  record({id:'P11_ISOLATION',status:'PARTIAL',boundedStatus:'PASS',scope:'Actual A administrator/B users, colliding instance/source/transaction identities, owner Material/task/event/original and snapshot substitutions',unexecutedRequired:['foreign event-cursor substitution (E11.3)','both users held across A revocation then actual restart (E11.4)'],aMaterialId:material.material.id,bMaterialId:bMaterial.material.id,bNetCents:987654321,foreignProcessorState:foreignResult.state,foreignDisclosures:0});

  // Actual package upgrade while version 1 is already executing against a held model response.
  semantic.arm(sourceIds[0]);
  const upgradePayload={...payload,operationId:'old-held-upgrade-'+randomUUID()};
  const upgradeAdmission=(await runtime.invoke(a,as.id,'final.finance.source',upgradePayload)).body;
  await semantic.waitHeld();
  const pkg2=await runtime.install(a,release2);
  await reconfigure(a,'same-instance',pkg2,sourceIds);
  await runtime.request(a,'POST','/api/plugin-instances/same-instance/check',{},200);
  await runtime.action(a,'same-instance','enable');
  const as2=(await runtime.snapshot(a)).body;assert.equal(as2.version,'1.1.0');assert.equal(as2.digest,release2.digest);
  semantic.release();
  const oldTask=terminalSuccess(await runtime.task(a,upgradeAdmission.id),'admitted version 1 work drains through package upgrade');
  const oldMaterial=await lookupFinance(a,oldTask);assertFinanceBody(oldMaterial.body,variant,aBindings);
  assert.equal(oldMaterial.body.releaseVersion,'1.0.0','held work uses immutable old version');
  const newAdmission=(await runtime.invoke(a,as2.id,'final.finance.source',{...payload,operationId:'new-version-'+randomUUID()})).body;
  const newTask=terminalSuccess(await runtime.task(a,newAdmission.id),'version 1.1 new work');
  const newMaterial=await lookupFinance(a,newTask);assertFinanceBody(newMaterial.body,variant,aBindings);assert.equal(newMaterial.body.releaseVersion,'1.1.0');
  assert.notEqual(release1.digest,release2.digest);
  record({id:'PACKAGE_UPGRADE',status:'PASS',oldTaskId:oldTask.id,oldVersion:'1.0.0',oldDigest:as.digest,newTaskId:newTask.id,newVersion:as2.version,newDigest:as2.digest,oldMaterialId:oldMaterial.material.id,newMaterialId:newMaterial.material.id});

  // Reopen the same vault after a real process termination, before observing a newly published task.
  const beforeRestartIds=new Set((await runtime.request(a,'GET','/api/materials?limit=200',undefined,200)).body.items.map(m=>m.id));
  const restartVariant=selectedSourcesVariant([variant.sources['source-bank']]),restartBindings=new Map([...aBindings].filter(([id])=>restartVariant.observations.some(o=>o.observationId===id)));
  await writeFile(join(runtime.dir,'restart-subset-oracle.json'),JSON.stringify(restartVariant,null,2));
  const restartPayload={...payload,sourceIds:Object.values(restartVariant.sources),operationId:'restart-'+randomUUID()},restartOperation=randomUUID();
  const restartAdmission=(await runtime.invoke(a,as2.id,'final.finance.source',restartPayload,restartOperation)).body;
  const restartPublication=await waitPublication(a,beforeRestartIds);
  await runtime.stop('SIGKILL');await runtime.start();
  const restartRead=await runtime.material(a,restartPublication.id);assertFinanceBody(restartRead.body,restartVariant,restartBindings);
  let restartTask=await runtime.task(a,restartAdmission.id);
  if(restartTask.state!=='succeeded'){
    await runtime.request(a,'POST','/api/tasks/'+restartAdmission.id+'/retry',{confirmUnknown:true},200);
    restartTask=await runtime.task(a,restartAdmission.id);
  }
  terminalSuccess(restartTask,'restart recovery');
  const recoveredMaterial=await lookupFinance(a,restartTask);assert.equal(recoveredMaterial.material.id,restartPublication.id,'recovered task returns the original durable publication identity');
  const afterRecoveryItems=(await runtime.request(a,'GET','/api/materials?limit=200',undefined,200)).body.items;
  assert.deepEqual(afterRecoveryItems.filter(item=>!beforeRestartIds.has(item.id)).map(item=>item.id),[restartPublication.id],'restart/retry created exactly one Material outcome');
  const restartReplay=(await runtime.invoke(a,as2.id,'final.finance.source',restartPayload,restartOperation)).body;assert.equal(restartReplay.id,restartAdmission.id);
  const restartAgain=await runtime.material(a,restartPublication.id);assert.equal(restartAgain.material.revision,restartRead.material.revision);
  assert.deepEqual((await runtime.request(a,'GET','/api/materials?limit=200',undefined,200)).body.items.filter(item=>!beforeRestartIds.has(item.id)).map(item=>item.id),[restartPublication.id],'operation replay preserves one Material outcome');
  const bRestartRead=await runtime.material(b.token,bMaterial.material.id);assert.equal(bRestartRead.body.totals.netCents,987654321);
  const aRestartRead=await runtime.material(a,material.material.id);assertFinanceBody(aRestartRead.body,variant,aBindings);
  assert(new Set(runtime.processes.map(p=>p.pid)).size>=2);
  record({id:'ACTUAL_PROCESS_RESTART',status:'PASS',phase:'after real Material publication and before first task result GET',taskId:restartTask.id,materialId:restartPublication.id,distinctProcessIds:runtime.processes.map(p=>p.pid),sameTaskAfterReplay:true,sameMaterialRevision:true,bHistoryReadable:true});

  // Disable drains previously admitted work while rejecting every new snapshot.
  semantic.arm(sourceIds[0]);
  const drainAdmission=(await runtime.invoke(a,as2.id,'final.finance.source',{...payload,operationId:'drain-'+randomUUID()})).body;
  await semantic.waitHeld();await runtime.action(a,'same-instance','disable');await runtime.snapshot(a,'same-instance',409);
  semantic.release();const drainTask=terminalSuccess(await runtime.task(a,drainAdmission.id),'disable drain');const drainRead=await lookupFinance(a,drainTask);assertFinanceBody(drainRead.body,variant,aBindings);
  const stateDisabled=await publicationState(a),callsDisabled=semantic.ledger.length;
  const disabledObservation={observationId:'disabled-gap-'+randomUUID(),sourceId:sourceIds[0],sourceKind:'notice',transactionId:null,text:'GENERATED nontransaction observation admitted while extension disabled'};
  const disabledItem=itemFor(disabledObservation),disabledReceipt=(await runtime.request(a,'POST','/api/ingress/sources/'+sourceIds[0]+'/items',{batchId:'disabled-gap-'+randomUUID(),items:[disabledItem]},200)).body;
  semantic.bind(disabledReceipt.captures[0].original,disabledObservation,undefined,disabledItem);
  // The new SourceItem is still processed normally by the host. Permit only its independently identified capture projection.
  const disabledCapture=disabledReceipt.captures[0];let disabledProjection;const projectionDeadline=Date.now()+10000;
  while(Date.now()<projectionDeadline){
    const items=(await runtime.request(a,'GET','/api/materials?limit=200',undefined,200)).body.items;
    disabledProjection=items.find(m=>m.origin?.sourceId===disabledObservation.sourceId&&m.origin?.externalId==='processed:'+disabledCapture.id);
    if(disabledProjection)break;await delay(30);
  }
  assert(disabledProjection,'actual input admitted while plugin disabled retains normal host processing');
  const projected=(await runtime.request(a,'GET','/api/materials/'+disabledProjection.id+'/read',undefined,200)).body;
  assert.equal(projected.text,disabledObservation.text);
  const projectedMembers=(await runtime.request(a,'GET','/api/materials/'+disabledProjection.id+'/members',undefined,200)).body.items;
  assert.deepEqual(projectedMembers.map(m=>m.ref),['capture:'+disabledCapture.id]);
  assert.deepEqual((await publicationState(a)).filter(m=>m.id!==disabledProjection.id),stateDisabled,'disable permits no plugin publication or change to prior Material revisions');assert.equal(semantic.ledger.length,callsDisabled);
  const afterInputProjection=await publicationState(a);
  await runtime.action(a,'same-instance','enable');await delay(350);assert.equal(semantic.ledger.length,callsDisabled);
  assert.deepEqual(await publicationState(a),afterInputProjection,'re-enable alone does not scan the disabled interval');
  await runtime.request(a,'GET','/api/materials/'+material.material.id+'/read',undefined,200);
  record({id:'DISABLE_DRAIN_HISTORY',status:'PASS',drainedTask:drainTask.id,newSnapshotStatus:409,newPluginMaterialsWhileDisabled:0,normalIngressProjection:disabledProjection.id,automaticModelCallsAfterResume:0,oldHistoryReadable:true});

  // Hold A after actual original read; revoke its source grant while B completes.
  const as3=(await runtime.snapshot(a)).body;semantic.arm(sourceIds[0]);
  const revokedAdmission=(await runtime.invoke(a,as3.id,'final.finance.source',{...payload,operationId:'revoked-'+randomUUID()})).body;
  await semantic.waitHeld();
  const stateBeforeRevocation=await publicationState(a);
  const bConcurrent=(await runtime.invoke(b.token,bs.id,'final.finance.source',{...bPayload,operationId:'b-concurrent-'+randomUUID()})).body;
  const bConcurrentTask=terminalSuccess(await runtime.task(b.token,bConcurrent.id),'B continues while A held');
  const bConcurrentRead=await lookupFinance(b.token,bConcurrentTask);assert.equal(bConcurrentRead.body.totals.netCents,987654321);assert.equal(bConcurrentRead.body.allTransactions.length,1);
  await reconfigure(a,'same-instance',pkg2,sourceIds.slice(1));semantic.release();
  const revokedTask=await runtime.task(a,revokedAdmission.id);assert.notEqual(revokedTask.state,'succeeded');assert.notEqual(revokedTask.state,'unknown','unknown result cannot prove callback settlement');
  await runtime.invoke(a,as3.id,'final.finance.source',payload,randomUUID(),401);
  assert.deepEqual(await publicationState(a),stateBeforeRevocation,'grant revocation fences both new Materials and revisions');
  // The distinct processor instance remains usable after the source instance loses a grant.
  const siblingAdmission=(await runtime.invoke(a,ap.id,'final.text.processor',{originalRef:original.ref})).body;
  const siblingTask=terminalSuccess(await runtime.task(a,siblingAdmission.id),'independent processor instance continues');
  record({id:'GRANT_REVOCATION',status:'PASS',revokedTaskId:revokedTask.id,revokedTaskState:revokedTask.state,oldSnapshotStatus:401,lateUnauthorizedMaterials:0,bConcurrentTaskId:bConcurrentTask.id,processorSiblingTaskId:siblingTask.id});
  // Stop receives a newly checked, independently valid grant; prior revocation cannot explain this rejection.
  await reconfigure(a,'same-instance',pkg2,sourceIds);await runtime.request(a,'POST','/api/plugin-instances/same-instance/check',{},200);await runtime.action(a,'same-instance','enable');
  const stopSnapshot=(await runtime.snapshot(a)).body;semantic.arm(sourceIds[0]);
  const stopAdmission=(await runtime.invoke(a,stopSnapshot.id,'final.finance.source',{...payload,operationId:'isolated-stop-'+randomUUID()})).body;
  await semantic.waitHeld();const stateBeforeStop=await publicationState(a);
  await runtime.action(a,'same-instance','stop');semantic.release();const stopTask=await runtime.task(a,stopAdmission.id);assert.notEqual(stopTask.state,'succeeded');assert.notEqual(stopTask.state,'unknown');
  await runtime.snapshot(a,'same-instance',409);await runtime.invoke(a,stopSnapshot.id,'final.finance.source',payload,randomUUID(),401);
  assert.deepEqual(await publicationState(a),stateBeforeStop);
  record({id:'ISOLATED_STOP',status:'PASS',heldTaskId:stopTask.id,state:stopTask.state,previousSnapshotWasValid:true,oldSnapshotStatus:401,lateMaterialsOrRevisions:0});
  // Per-task cancellation is separately exercised against the submitted worker; a same-worker intake operation survives.
  await reconfigure(a,'same-instance',pkg2,sourceIds);await runtime.request(a,'POST','/api/plugin-instances/same-instance/check',{},200);await runtime.action(a,'same-instance','enable');
  const cancelSnapshot=(await runtime.snapshot(a)).body;semantic.arm(sourceIds[0]);
  const cancelAdmission=(await runtime.invoke(a,cancelSnapshot.id,'final.finance.source',{...payload,operationId:'isolated-cancel-'+randomUUID()})).body;
  await semantic.waitHeld();const stateBeforeCancel=await publicationState(a);await runtime.request(a,'POST','/api/tasks/'+cancelAdmission.id+'/cancel',{},200);
  semantic.release();const cancelled=await runtime.task(a,cancelAdmission.id);assert.equal(cancelled.state,'cancelled');
  const receiveSibling=(await runtime.invoke(a,cancelSnapshot.id,'final.finance.source',{mode:'receive',sourceId:chosen.sourceId,batchId:'same-worker-'+randomUUID(),items:[itemFor(chosen)]})).body;
  const received=terminalSuccess(await runtime.task(a,receiveSibling.id),'same-worker source intake survives single cancellation');assert.equal(received.result.captures.length,1);assert.equal(received.result.captures[0].duplicate,true);
  assert.deepEqual(await publicationState(a),stateBeforeCancel);
  record({id:'SUBMITTED_TASK_CANCEL',status:'PASS',cancelledTaskId:cancelled.id,sameWorkerIntakeTaskId:received.id,duplicateIntakeReceipt:true,lateMaterialsOrRevisions:0});
  const catalog=(await runtime.request(a,'GET','/api/admin/plugins',undefined,200)).body;
  const uninstall=await runtime.request(a,'POST','/api/plugins/'+pkg.id+'/uninstall',{expectedRevision:catalog.revision,operationId:randomUUID()});assert.equal(uninstall.status,409);
  await runtime.request(a,'GET','/api/materials/'+material.material.id+'/read',undefined,200);
  record({id:'P10_LIFECYCLE',status:'PARTIAL',boundedStatus:'PASS',scope:'Distinct source/processor instances; real v1→v1.1 package upgrade; disable drain; grant/stop/cancel fencing; distinct-process restart and retained-reference uninstall rejection',unexecutedRequired:['successful package removal after releasing every retained reference'],referencedUninstallStatus:409,historySurvivesRejectedRemoval:true});
  record({id:'RUN_COMPLETION',status:'PASS',variant:variantName,modelCalls:semantic.ledger.length,liveModelCalls:0,rootRegressionGate:'reported separately by root driver',fullCaseLimitations:['E01 normal query/automatic insight/browser journey not executed','E10 actual successful package removal after releasing every reference not executed','E11 model-resource export/restore not executed','No image-provider full E08 attempt']});
} catch(error) {
  console.error(error);record({id:'FINAL_EVALUATION_ERROR',status:'FAIL',message:error.message,stack:error.stack});process.exitCode=1;
} finally {
  semantic.release();await runtime.stop();await semantic.close(runtime.dir);
  await writeFile(join(ROOT,'final-evaluation-results.json'),JSON.stringify({createdAt:new Date().toISOString(),variant:variantName,candidate:delivery.candidateCommit,delivery,runDir:runtime.dir,results},null,2));
}
