// Research probe, not a product test or an implementation of the proposed contract.
// Run from an isolated checkout of the audited commit with built workspace libraries:
// MOTE_AUDIT_ROOT=/absolute/checkout node --import tsx --test /absolute/path/to/this/file
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
const root=resolve(process.env.MOTE_AUDIT_ROOT??process.cwd());
const load=path=>import(pathToFileURL(join(root,path)).href);
const {FeatureRegistry}=await load('packages/shared/src/feature-packs.ts');
const {WebFeatureHost}=await load('apps/web/src/features/host.ts');
const {SourceRecipeExecutor}=await load('apps/server/src/source-recipe-executor.ts');
const {ProcessingRuntime}=await load('apps/server/src/processing-runtime.ts');
const {Store}=await load('apps/server/src/store.ts');

test('baseline gap: a manifest permits undeclared components',()=>{
 const registry=new FeatureRegistry();registry.install({id:'fixture.pack',version:'1',components:[]});
 registry.register('fixture.pack',{id:'fixture.undeclared',version:'1',surface:'data'},1);
 assert.equal(registry.get('fixture.undeclared'),1);
});

test('baseline gap: WebFeatureHost does not propagate entry requires to its registry',async()=>{
 const host=new WebFeatureHost();
 try{
  await host.install({id:'fixture.pack',version:'1',components:[]},[{surface:'page',entry:{id:'fixture.page',featureId:'fixture.pack',requires:['fixture.missing'],render:()=>null}}]);
  assert.ok(host.page('fixture.page')); // FeaturePage has a separate HTTP gate; this is the host only.
  assert.equal(host.registry.inventory().capabilities[0].requires,undefined);
 }finally{await host.close();}
});

test('baseline gap: window, join and aggregation pins resolve without executing policies',()=>{
 const executor=new SourceRecipeExecutor(),calls=[];
 const component=(id,kind)=>({id:'fixture.'+id,version:'1',kind});
 const ref=id=>({id:'fixture.'+id});
 executor.registerRawWriter(component('writer','raw-writer'),()=>{throw Error('not called');});
 executor.registerRawReader(component('reader','raw-reader'),async()=>{throw Error('not called');});
 executor.registerGroup(component('group','group'),()=> 'generated-object');
 for(const kind of ['raw-retention','trigger','window','join','aggregation','index','exposure'])executor.registerPolicy(component(kind,kind));
 executor.registerStep(component('step','step'),()=>{calls.push('step');return 'generated';});
 executor.registerPublisher(component('publish','publish'),()=>{calls.push('publish');return undefined;});
 executor.installRecipe({schemaVersion:1,id:'fixture.recipe',version:'1',accepts:{sourceKind:'fixture.source'},raw:{writer:ref('writer'),reader:ref('reader'),retention:ref('raw-retention')},trigger:{policy:ref('trigger')},group:{policy:ref('group')},window:{policy:ref('window')},join:{policy:ref('join')},aggregation:{policy:ref('aggregation')},steps:[{id:'assemble',use:ref('step'),dependsOn:[]}],publish:{use:ref('publish')},index:{use:ref('index')},exposure:{use:ref('exposure'),routes:[]}});
 const recipe=executor.resolve('fixture.recipe','1');
 assert.ok(recipe.componentPins.some(pin=>pin.kind==='window'));
 executor.organize(recipe,{id:'generated-source'},'generated-object',{items:[],checkpoint:'generated-checkpoint'});
 assert.deepEqual(calls,['step','publish']);
 assert.equal('registerWindow' in executor,false);
});

test('baseline gap: same ID/version reinstall during processing accepts the old result',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'mote-research-fixture-'));
 const store=new Store(directory),runtime=new ProcessingRuntime(store);
 try{
  const id=randomUUID();await store.ingest({id,deviceId:'generated',deviceName:'Generated',platform:'import',source:'note',capturedAt:'2026-10-07T00:00:00Z',durationMs:0,ocrText:'Generated research evidence'});
  let release,entered;const wait=new Promise(r=>release=r),started=new Promise(r=>entered=r);
  const remove=runtime.registry.register({id:'fixture.slow',version:'1',lane:'extract',async process(){entered();await wait;return [{kind:'fixture-result',text:'Generated old instance result',metadata:{}}];}});
  const job=runtime.enqueue([{name:'slow',processor:'fixture.slow',inputs:[id]}]).slow;
  const running=runtime.tick();await started;remove();
  runtime.registry.register({id:'fixture.slow',version:'1',lane:'extract',async process(){return [{kind:'fixture-result',text:'Generated replacement result',metadata:{}}];}});
  release();await running;
  assert.equal(runtime.engine.get(job)?.state,'succeeded');
  assert.equal(store.archive.page({query:'old instance'}).items[0]?.text,'Generated old instance result');
 }finally{await runtime.close();store.close();rmSync(directory,{recursive:true,force:true});}
});
