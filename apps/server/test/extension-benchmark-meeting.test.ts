import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {setTimeout as delay} from 'node:timers/promises';
import {zipSync,strToU8} from 'fflate';
import {buildScopedApp} from '../src/scope/app.js';

const pack = new URL('../../../plugins/extension-benchmark/meeting-pack/', import.meta.url);
const started = Date.now();
const requireComposition = process.env.MOTE_MEETING_REQUIRE_COMPOSITION !== '0';
const report: any = {originatingRound: 3, originalFrozenCandidate: '2879214', testedCandidate: process.env.MOTE_BENCHMARK_CANDIDATE ?? 'unrecorded', originalBaseline: '2c78ca8', startedAt: new Date(started).toISOString(), scope: 'Independent two-source meeting summary probe, actual authenticated loopback HTTP and installed workers', modelPolicy: 'No semantic interpretation: explicit generated structured facts, deterministic rendering and arithmetic only', operations: [], gates: {}, pluginPrivateImports: 0, pluginCoreImports: 0, productionChanges: 0, fullCaseClaim: false};
report.setup = {developmentElapsedMs:null,buildOperations:0,dependencyInstallOperations:0,newAdapters:0,fullSuiteRuns:0,realAccountBootstrap:true,actualLoopbackHttp:true,workerEnvironment:'Node /opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin/node; authorized require_escalated local execution',testAssemblyImports:['apps/server/src/scope/app.ts (production composition root)'],discoveryReads:['AGENTS.md','docs/plugin-authoring.md','docs/validation/plugin-extension-benchmark/cases.json','package.json','apps/server/package.json','Original non-benchmark multiuser-plugin-ingress and multiuser-plugins tests','Original non-benchmark fixtures/scoped-plugin-release.ts','Original SourceCapability, Original, MaterialDraft and PluginReleaseTransport value contracts'],priorTrialImplementationsRead:false,preliminaryPathMisses:['apps/server/src/accounts.ts','packages/shared/src/plugin.ts','packages/shared/src/source.ts'],firstTrial:{startedAt:'2026-10-19T18:56:28.258Z',firstSuccessfulControlReadbackAt:'2026-10-19T18:56:33.236Z',readbackElapsedMs:4978,independentOrderStatus:409,control:'PASS'}};
const hash = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');
const declaration = (id: string) => ({id, version: '1', surface: 'ingress', capability: 'source'});
const fileNames = ['plugin.mjs','notes.mjs','references.mjs','source-summary.mjs'];
const zip = zipSync(Object.fromEntries(fileNames.map(name => [name, [new Uint8Array(readFileSync(new URL(name, pack))), {mtime: new Date('2026-10-19T00:00:00Z')}]])) as any);
const manifest = {schemaVersion: 1, id: 'meeting.summary.pack', name: 'Generated meeting summary pack', version: '1.0.0', runtime: 'worker', entry: 'plugin.mjs', archive: {asset: 'plugin.zip', sha256: hash(zip)}, capabilities: ['source'], configuration: [], dependencies: [], access: ['Explicitly granted generated meeting and reference sources'], components: [declaration('meeting.notes.summary'),declaration('meeting.references.summary')]};
const controlManifest = {...manifest, version: '1.0.1', components: [...manifest.components].reverse()};
const nativeCode = 'export function apply(ctx) { ctx.on("ready", () => undefined); }\n';
const nativeZip = zipSync({'native.mjs': [strToU8(nativeCode), {mtime:new Date('2026-10-19T00:00:00Z')} ]});
const nativeManifest = {...manifest, id: 'meeting.native.harness', name: 'Unchanged generated native Harness apply module', version: '1.0.0', entry: 'native.mjs', archive: {asset: 'plugin.zip', sha256: hash(nativeZip)}, capabilities: ['engine'], components: [{id:'native.harness',version:'1',surface:'agent',capability:'engine'}]};
const releases = [
  {repository: 'round3-generated/meeting-pack', tag: 'v1.0.0', manifest, zip},
  {repository: 'round3-generated/meeting-pack', tag: 'v1.0.1', manifest: controlManifest, zip},
  {repository: 'round3-generated/native-harness', tag: 'v1.0.0', manifest: nativeManifest, zip: nativeZip},
];
const transport = async (url: string) => {
  for (const release of releases) {
    const api = `https://api.github.com/repos/${release.repository}`;
    const base = `https://github.com/${release.repository}/releases/download/${release.tag}/`;
    if (url === api + '/releases/tags/' + release.tag) return {bytes: strToU8(JSON.stringify({tag_name: release.tag, draft: false, assets: [{name: 'mote-plugin.json', browser_download_url: base + 'mote-plugin.json'}, {name: 'plugin.zip', browser_download_url: base + 'plugin.zip'}]}))};
    if (url === api + '/commits/' + release.tag) return {bytes: strToU8(JSON.stringify({sha: createHash('sha1').update(release.repository + release.tag).digest('hex')}))};
    if (url === base + 'mote-plugin.json') return {bytes: strToU8(JSON.stringify(release.manifest))};
    if (url === base + 'plugin.zip') return {bytes: release.zip};
  }
  throw Error('Unconfigured generated release transport: ' + url);
};

// Oracle text and amounts are deliberately outside installed ZIP bytes.
function notes(owner: string) {
  return [
    {kind: 'meeting-notes', meetingTitle: owner + ' planning', decisions: [{id: 'd1', text: 'Reserve the blue meeting room.', owner: 'Morgan'}], commitments: [{id:'c1',amountCents:2375},{id:'c2',amountCents:1825}]},
    {kind: 'meeting-notes', meetingTitle: owner + ' review', decisions: [{id: 'd2', text: 'Move the generated launch to Thursday.', owner: 'Sam'}], commitments: [{id:'c3',amountCents:990}]},
    {kind: 'meeting-notes', meetingTitle: owner + ' handoff', decisions: [{id: 'd3', text: 'Record the alternate supplier in the notes.', owner: 'Lee'}], commitments: [{id:'c4',amountCents:610}]},
  ];
}
function references(owner: string) {
  return [{kind:'reference-facts',referenceTitle:owner+' reference sheet',facts:[{id:'r1',text:'The generated venue has forty seats.',amountCents:3100},{id:'r2',text:'The projector deposit is refundable.',amountCents:875}]}];
}
function items(values: unknown[]) {
  return values.map((value,index) => ({externalId:'same-item-'+index,revision:'same-revision',observedAt:'2026-10-19T00:00:00Z',title:'Generated structured record',text:JSON.stringify(value),kind:'message',layer:'original'}));
}

test('ROUND3 external meeting pack: independent order plus separately labeled same-order control', {timeout: 90000}, async t => {
  const directory = mkdtempSync(join(tmpdir(),'mote-round3-meeting-'));
  const host = await buildScopedApp({dataDir: directory}, {pluginReleaseTransport: transport});
  let base = '';
  const request = async (token: string | undefined, path: string, method = 'GET', body?: unknown) => {
    const response = await fetch(base + path, {method, headers: {'content-type':'application/json','x-mote-protocol-version':'2','x-mote-ingress-version':'3', ...(token?{authorization:'Bearer '+token}:{})}, ...(body === undefined?{}:{body:JSON.stringify(body)})});
    const value = await response.json();
    report.operations.push({elapsedMs:Date.now()-started, method, path, status:response.status, ...(path.includes('/auth/')?{}:{body:value})});
    return {status:response.status, body:value};
  };
  const ok = async (token: string | undefined,path: string,method = 'GET',body?: unknown): Promise<any> => {
    const response = await request(token,path,method,body);
    assert.equal(response.status,200,JSON.stringify({path,...response}));
    return response.body;
  };
  try {
    await host.accounts!.initialize('round3-admin','Generated-round3-password-2026');
    base = await host.app.listen({host:'127.0.0.1',port:0});
    const login = (username: string) => ok(undefined,'/api/auth/login','POST',{username,password:'Generated-round3-password-2026',mode:'client'});
    const admin = await login('round3-admin');
    const capabilities = await ok(admin.token,'/api/plugins/host-capabilities');
    report.discovery = {beforeInstall:true, actualHttp:true, value:capabilities, practicalValue:'Discovered source and processor availability without release packaging or worker check; unavailable generic engine/model domains identified before choosing an extension path.'};
    assert.deepEqual(capabilities.invocationCapabilities.filter((item:any)=>item.registered).map((item:any)=>item.id),['source','processor']);
    for (const username of ['round3-alice','round3-bob']) await ok(admin.token,'/api/admin/accounts','POST',{username,password:'Generated-round3-password-2026'});
    const alice = await login('round3-alice'), bob = await login('round3-bob');
    const view = (token: string) => ok(token,'/api/plugins');
    const install = async (release: typeof releases[number]) => {
      const preview = await ok(admin.token,'/api/plugins/resolve','POST',{repository:release.repository,tag:release.tag});
      const before = await ok(admin.token,'/api/admin/plugins');
      await ok(admin.token,'/api/plugins/install','POST',{previewId:preview.id,expectedRevision:before.revision,operationId:randomUUID()});
      const deadline = Date.now()+12000;
      for (;;) {
        const catalog = await ok(admin.token,'/api/admin/plugins');
        const installed = catalog.packages.find((pkg:any)=>pkg.source.digest===release.manifest.archive.sha256 && pkg.version===release.manifest.version);
        if (installed?.state === 'installed') return installed.id;
        if (installed?.state === 'failed' || Date.now()>deadline) assert.fail(JSON.stringify(catalog));
        await delay(10);
      }
    };
    const configure = async (token:string,packageId:string,instanceId:string,grants=['source']) => {
      await ok(token,'/api/plugin-instances','POST',{instance:{id:instanceId,packageId,name:'Generated meeting instance',configuration:{},desired:false,grants:{capabilities:grants,sourceIds:['meeting-source','reference-source'],history:false}},expectedRevision:(await view(token)).revision});
    };
    const action = async (token:string,instanceId:string,name:string) => ok(token,'/api/plugin-instances/'+instanceId+'/'+name,'POST',name==='check'?{}:{expectedRevision:(await view(token)).revision});
    const snapshot = (token:string,instanceId:string) => ok(token,'/api/plugin-instances/'+instanceId+'/snapshots','POST',{});
    const invoke = async (token:string,snapshotId:string,componentId:string,payload:unknown) => {
      const admitted = await ok(token,'/api/plugin-snapshots/'+snapshotId+'/invoke','POST',{componentId,payload,operationId:randomUUID()});
      const deadline=Date.now()+12000;
      for (;;) {
        const task=await ok(token,'/api/tasks/'+admitted.id);
        if (['succeeded','failed','blocked','cancelled','stale'].includes(task.state)) return task;
        if(Date.now()>deadline)assert.fail(JSON.stringify(task));
        await delay(10);
      }
    };

    // Probe the unchanged native module through the actual generic loading path.
    const nativePackage = await install(releases[2]);
    await configure(alice.token,nativePackage,'native-probe',['engine']);
    const nativeCheck = await request(alice.token,'/api/plugin-instances/native-probe/check','POST',{});
    report.nativeHarness = {verdict:'NO_EXTENSION_POINT', untouchedApplyModule:true, sourceSha256:hash(strToU8(nativeCode)),archiveSha256:hash(nativeZip), installed:true, check:nativeCheck, genericEngineRegistered:false, scope:'Native apply ABI availability probe only; actual Harness-session checksum tool execution remains NOT RUN'};
    assert.notEqual(nativeCheck.status,200);
    const trigger = await request(alice.token,'/api/plugin-triggers','POST',{instanceId:'meeting-instance',kind:'periodic',intervalMs:60000});
    report.trigger = {verdict:'NO_EXTENSION_POINT',attempt:trigger,scope:'No advertised generic scheduler entry; attempted public plugin trigger registration was rejected. Built-in scheduler is not an external contribution.'};
    assert.notEqual(trigger.status,200);

    for (const user of [alice,bob]) for (const sourceId of ['meeting-source','reference-source','ungranted-source']) await ok(user.token,'/api/ingress/sources','POST',{id:sourceId,name:'Generated '+sourceId,kind:'coding-agent',deviceId:'same-device',platform:'import',retention:'archive'});
    const independentPackage = await install(releases[0]);
    await configure(alice.token,independentPackage,'independent-order');
    const independentCheck = await request(alice.token,'/api/plugin-instances/independent-order/check','POST',{});
    report.independentComposition = {manifestOrder:manifest.components.map(component=>component.id),implementationOrder:['meeting.references.summary','meeting.notes.summary'],check:independentCheck};
    report.gates.independentOrder = independentCheck.status===200?'PASS':'FAIL';
    console.log('ROUND3_INDEPENDENT_ORDER',JSON.stringify(independentCheck));

    // Control differs only in release manifest ordering/version; installed JS bytes
    // are exactly identical. It does not repair or relabel independent composition.
    const controlPackage = await install(releases[1]);
    const snapshots: any = {};
    for (const [owner,user] of [['A',alice],['B_PRIVATE',bob]] as const) {
      await configure(user.token,controlPackage,'same-instance');
      await action(user.token,'same-instance','check');
      await action(user.token,'same-instance','enable');
      const snap=await snapshot(user.token,'same-instance'); snapshots[owner]=snap;
      for (const [sourceId,componentId,values,total,expectedText] of [
        ['meeting-source','meeting.notes.summary',notes(owner),5800,'d1: Reserve the blue meeting room. [owner: Morgan]'],
        ['reference-source','meeting.references.summary',references(owner),3975,'r2: The projector deposit is refundable.'],
      ] as const) {
        const task=await invoke(user.token,snap.id,componentId,{sourceId,batchId:'same-batch',items:items([...values])});
        assert.equal(task.state,'succeeded',JSON.stringify(task));
        assert.notEqual(task.result.workerPid,process.pid);
        const listing=await ok(user.token,'/api/materials');
        assert.ok(JSON.stringify(listing).includes(task.result.materialId));
        const body=await ok(user.token,'/api/materials/'+task.result.materialId+'/read');
        const members=await ok(user.token,'/api/materials/'+task.result.materialId+'/members');
        const content=JSON.stringify(body);
        assert.ok(content.includes(expectedText),content);
        assert.ok(content.includes('Source total (cents): '+total),content);
        assert.ok(content.includes(owner),content);
        if(owner==='A')assert.equal(content.includes('B_PRIVATE'),false);
        assert.equal(task.result.originalCount,values.length);
        for(const capture of task.result.receipt.captures) assert.ok(JSON.stringify(members).includes('capture:'+capture.id),JSON.stringify(members));
        if(!report.firstSuccess)report.firstSuccess={observedAt:new Date().toISOString(),elapsedMs:Date.now()-started,owner,sourceId,materialId:task.result.materialId,workerPid:task.result.workerPid,actualHttp:true,scope:'Same-order control only; timestamp is successful HTTP readback, not exact commit time'};
        report.controlResults ??= []; report.controlResults.push({owner,sourceId,taskState:task.state,materialId:task.result.materialId,originalCount:task.result.originalCount,expectedTotalCents:total,members,body});
      }
    }
    if(independentCheck.status===200) {
      await action(alice.token,'independent-order','enable');
      const independentSnapshot=await snapshot(alice.token,'independent-order');
      report.independentExecution=[];
      for(const [sourceId,componentId,total,text] of [
        ['meeting-source','meeting.notes.summary',5800,'A planning'],
        ['reference-source','meeting.references.summary',3975,'A reference sheet'],
      ] as const) {
        const task=await invoke(alice.token,independentSnapshot.id,componentId,{sourceId});
        assert.equal(task.state,'succeeded',JSON.stringify(task));
        const readback=await ok(alice.token,'/api/materials/'+task.result.materialId+'/read');
        assert.ok(JSON.stringify(readback).includes('Source total (cents): '+total));
        assert.ok(JSON.stringify(readback).includes(text));
        report.independentExecution.push({componentId,taskState:task.state,materialId:task.result.materialId,readback});
      }
    } else report.independentExecution='NOT RUN: check admission rejected';
    assert.equal((await request(alice.token,'/api/plugin-snapshots/'+snapshots.B_PRIVATE.id+'/invoke','POST',{componentId:'meeting.notes.summary',payload:{sourceId:'meeting-source'},operationId:randomUUID()})).status,404);
    // Re-read A after B has published under colliding Material IDs. The second
    // owner's write must not replace either body in A's namespace.
    for(const result of report.controlResults.filter((value:any)=>value.owner==='A')) {
      const afterB=JSON.stringify(await ok(alice.token,'/api/materials/'+result.materialId+'/read'));
      assert.equal(afterB.includes('B_PRIVATE'),false,afterB);
      assert.ok(afterB.includes(result.sourceId==='meeting-source'?'A planning':'A reference sheet'),afterB);
    }
    const denied=await invoke(alice.token,snapshots.A.id,'meeting.notes.summary',{sourceId:'ungranted-source'});
    assert.equal(denied.state,'blocked',JSON.stringify(denied));
    const bobBefore=JSON.stringify(await ok(bob.token,'/api/materials'));
    await action(alice.token,'same-instance','disable');
    assert.equal((await request(alice.token,'/api/plugin-instances/same-instance/snapshots','POST',{})).status,409);
    const bobContinuing=await invoke(bob.token,snapshots.B_PRIVATE.id,'meeting.references.summary',{sourceId:'reference-source'});
    assert.equal(bobContinuing.state,'succeeded',JSON.stringify(bobContinuing));
    await action(alice.token,'same-instance','stop');
    const stale=await request(alice.token,'/api/plugin-snapshots/'+snapshots.A.id+'/invoke','POST',{componentId:'meeting.notes.summary',payload:{sourceId:'meeting-source'},operationId:randomUUID()});
    assert.notEqual(stale.status,200,JSON.stringify(stale));
    const bobAfterStop=await invoke(bob.token,snapshots.B_PRIVATE.id,'meeting.references.summary',{sourceId:'reference-source'});
    assert.equal(bobAfterStop.state,'succeeded',JSON.stringify(bobAfterStop));
    assert.ok(bobBefore.includes('mat_'));
    report.gates.sameOrderSourceControl='PASS';report.gates.currentUserIsolation='PASS';report.gates.disableStopAndBContinues='PASS';report.gates.realWorkerPublicationControl='PASS';report.gates.coreZero='PASS';
    report.gates.regression='NOT RUN (focused trial only)';report.gates.actualProcessRestart='NOT RUN';
    report.verdict=independentCheck.status===200?'PASS_PROBE':'PARTIAL: same-order source control passed; independent composition failed';
    assert.deepEqual(Buffer.from(zip),readFileSync(new URL('plugin.zip',pack)),'Retained release must match the actual component source');
    assert.deepEqual(JSON.parse(readFileSync(new URL('mote-plugin.json',pack),'utf8')),manifest);
    assert.deepEqual(JSON.parse(readFileSync(new URL('control-mote-plugin.json',pack),'utf8')),controlManifest);
    report.assertionMode={requireComposition,expectedStatus:requireComposition?200:409,architecturalVerdict:report.gates.independentOrder};
    await t.test(requireComposition?'independently ordered registrations match and both callbacks execute':'frozen candidate reproduces independent-order rejection (architectural FAIL)',()=>assert.equal(independentCheck.status,requireComposition?200:409,JSON.stringify(independentCheck)));
    await t.test('same-order control executes both components with independent durable readback and B isolation',()=>assert.equal(report.gates.sameOrderSourceControl,'PASS'));
  } catch(error) {report.unexpectedFailure=String(error);throw error;}
  finally {
    report.finishedAt=new Date().toISOString();report.elapsedMs=Date.now()-started;
    if(process.env.MOTE_MEETING_REPORT)writeFileSync(process.env.MOTE_MEETING_REPORT,JSON.stringify(report,null,2)+'\n');
    await host.app.close();rmSync(directory,{recursive:true,force:true});
  }
});
