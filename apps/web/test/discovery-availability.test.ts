import test from 'node:test';
import assert from 'node:assert/strict';
import type {FeatureCapability,FeatureInventory} from '@mote/shared';
import {resolveDiscoveryTarget} from '../src/discovery-availability.js';
import {WebFeatureHost} from '../src/features/host.js';
import type {CollectionEntry,PageEntry} from '../src/features/types.js';

const page=(id:string,overrides:Partial<PageEntry>={}):PageEntry=>({id,featureId:'generated.'+id,render:()=>null,...overrides});
const collection=(id:string,overrides:Partial<CollectionEntry>={}):CollectionEntry=>({id,featureId:'generated.'+id,label:'Generated '+id,order:1,render:()=>null,...overrides});
const capability=(id:string,version='1',state:FeatureCapability['state']='active'):FeatureCapability=>({id,version,state,featureId:'generated.server',surface:'data'});
const inventory=(capabilities:FeatureCapability[]=[]):FeatureInventory=>({schemaVersion:1,revision:1,features:[],capabilities});
const library=page('archive',{route:'library',aliases:['old-library']});
const materials=collection('materials');
const target={pageId:'archive',collectionId:'materials',href:'#/old-library?view=materials'};

function blocked(result:ReturnType<typeof resolveDiscoveryTarget>,state:'unavailable'|'checking'|'unknown'){
  assert.equal(result.state,state);
  assert.equal(result.href,undefined,'a target that cannot be opened has no fallback destination');
}

test('missing pages and collections never redirect discovery to Today or the first collection',()=>{
  const pages=[page('overview',{route:'today'}),library],collections=[materials];
  blocked(resolveDiscoveryTarget({...target,pageId:'removed'},{pages,collections}),'unavailable');
  blocked(resolveDiscoveryTarget({...target,collectionId:'removed'},{pages,collections}),'unavailable');
  blocked(resolveDiscoveryTarget(target,{pages:[],collections:[]}),'unavailable');
});

test('registered page routes canonicalize authored links while preserving category, view, returnTo and other query state',()=>{
  const query='category=coding&view=materials&returnTo=%23%2Fguide%3Fcategory%3Dcoding&evidence=generated%3Arecord&tag=one&tag=two';
  const result=resolveDiscoveryTarget({...target,categoryId:'coding',href:'#/old-library?'+query},{pages:[library],collections:[materials]});
  assert.equal(result.state,'available');
  assert.equal(result.href,'#/library?'+query);
  assert.equal(new URLSearchParams(result.href!.split('?')[1]).get('returnTo'),'#/guide?category=coding');
  assert.deepEqual(new URLSearchParams(result.href!.split('?')[1]).getAll('tag'),['one','two']);
  const embeddedQuestion=resolveDiscoveryTarget({...target,href:'#/old-library?view=materials&search=generated?question'},{pages:[library],collections:[materials]});
  assert.equal(embeddedQuestion.href,'#/library?view=materials&search=generated?question','a question mark within the query is preserved');
  const idRoute=resolveDiscoveryTarget({pageId:'generated-page',href:'#/obsolete'},{pages:[page('generated-page')],collections:[]});
  assert.equal(idRoute.state,'available');
  assert.equal(idRoute.href,'#/generated-page');
});

test('local targets are available without inventory and ignore unrelated remote failures',()=>{
  const local=page('guide',{requires:[{id:'generated.local-ui',version:'3',host:'local'}]});
  for(const state of [{},{inventoryLoading:true},{inventoryError:new Error('Generated inventory failure')}]){
    const result=resolveDiscoveryTarget({pageId:'guide',href:'#/guide'},{pages:[local],collections:[],...state});
    assert.equal(result.state,'available');
    assert.equal(result.href,'#/guide');
  }
});

test('remote dependencies stay checking until inventory is verified and retain verified links during periodic refresh',()=>{
  const remote=page('activity',{requires:['http:GET:/api/work-activity']});
  const target={pageId:'activity',href:'#/activity'};
  const state={pages:[remote],collections:[]};
  blocked(resolveDiscoveryTarget(target,state),'checking');
  blocked(resolveDiscoveryTarget(target,{...state,inventoryLoading:true}),'checking');
  const refreshing=resolveDiscoveryTarget(target,{...state,inventoryLoading:true,inventory:inventory([capability('http:GET:/api/work-activity')])});
  assert.equal(refreshing.state,'available','cached valid inventory avoids disabling links on every refresh');
  assert.equal(refreshing.href,'#/activity');
  const verified=resolveDiscoveryTarget(target,{...state,inventoryLoading:false,inventory:inventory([capability('http:GET:/api/work-activity')])});
  assert.equal(verified.state,'available');
  assert.equal(verified.href,'#/activity');
});

test('inventory transport failures and incompatible schemas produce unknown availability without stale links',()=>{
  const remote=page('activity',{requires:['http:GET:/api/work-activity']});
  const target={pageId:'activity',href:'#/activity'},state={pages:[remote],collections:[]};
  blocked(resolveDiscoveryTarget(target,{...state,inventoryError:new Error('Generated read failure')}),'unknown');
  blocked(resolveDiscoveryTarget(target,{...state,inventory:inventory([capability('http:GET:/api/work-activity')]),inventoryError:new Error('Generated recheck failure')}),'unknown');
  for(const invalid of [
    {...inventory(),schemaVersion:2},
    {...inventory(),capabilities:null},
    {...inventory(),capabilities:[null]},
    {...inventory(),capabilities:[{id:'http:GET:/api/work-activity'}]},
  ])blocked(resolveDiscoveryTarget(target,{...state,inventory:invalid as unknown as FeatureInventory}),'unknown');
});

test('page and selected collection require all exact active server protocol versions',()=>{
  const remotePage=page('archive',{route:'library',requires:['http:GET:/api/library/catalog']});
  const remoteCollection=collection('materials',{requires:[{id:'generated.material-reader',version:'2',host:'server'},{id:'generated.local-ui',version:'3',host:'local'}]});
  const state={pages:[remotePage],collections:[remoteCollection]};
  const active=[capability('http:GET:/api/library/catalog'),capability('generated.material-reader','2')];
  const available=resolveDiscoveryTarget(target,{...state,inventory:inventory(active)});
  assert.equal(available.state,'available');
  assert.equal(available.href,'#/library?view=materials');
  for(const capabilities of [
    [],
    active.slice(0,1),
    active.slice(1),
    [active[0],capability('generated.material-reader','1')],
    [capability('http:GET:/api/library/catalog','2'),active[1]],
    [active[0],capability('generated.material-reader','2','unavailable')],
    [capability('http:GET:/api/library/catalog','1','unavailable'),active[1]],
  ])blocked(resolveDiscoveryTarget(target,{...state,inventory:inventory(capabilities)}),'unavailable');
});

test('Activity remains available when an optional Coding backend is missing',()=>{
  const activity=page('activity',{requires:['http:GET:/api/work-activity']}),coding=page('coding',{requires:[{id:'generated.coding',version:'2',host:'server'}]});
  const state={pages:[activity,coding],collections:[],inventory:inventory([capability('http:GET:/api/work-activity')])};
  const available=resolveDiscoveryTarget({pageId:'activity',href:'#/activity?returnTo=%23%2Fguide'},state);
  assert.equal(available.state,'available');
  assert.equal(available.href,'#/activity?returnTo=%23%2Fguide');
  blocked(resolveDiscoveryTarget({pageId:'coding',href:'#/coding'},state),'unavailable');
  const codingActivity={pageId:'activity',href:'#/activity?category=coding',requires:[{id:'generated.coding',version:'2',host:'server' as const}]};
  blocked(resolveDiscoveryTarget(codingActivity,state),'unavailable');
  blocked(resolveDiscoveryTarget(codingActivity,{...state,inventory:inventory([capability('generated.coding','2')])}),'unavailable');
  blocked(resolveDiscoveryTarget(codingActivity,{...state,inventory:inventory([...state.inventory.capabilities,capability('generated.coding','1')])}),'unavailable');
  const codingReady=resolveDiscoveryTarget(codingActivity,{...state,inventory:inventory([...state.inventory.capabilities,capability('generated.coding','2')])});
  assert.equal(codingReady.state,'available');
  assert.equal(codingReady.href,'#/activity?category=coding');
});

test('disposable feature snapshots revoke and restore discovery destinations as registrations change',async()=>{
  const host=new WebFeatureHost();
  const snapshot=()=>({pages:host.pages(),collections:host.collections()});
  try{
    await host.install({id:'generated.shell',version:'1',components:[]},[
      {surface:'page',entry:page('overview',{route:'today',featureId:'generated.shell'})},
      {surface:'page',entry:{...library,featureId:'generated.shell'}},
      {surface:'collection',entry:{...materials,featureId:'generated.shell'}},
    ]);
    const extensionTarget={pageId:'generated-extension',collectionId:'generated-extension-items',href:'#/retired-extension?view=generated-extension-items&returnTo=%23%2Fguide'};
    const pageContributions=[{surface:'page' as const,entry:page('generated-extension',{route:'generated-canonical',featureId:'generated.extension-page'})}];
    const collectionContributions=[{surface:'collection' as const,entry:collection('generated-extension-items',{featureId:'generated.extension-collection'})}];
    blocked(resolveDiscoveryTarget(extensionTarget,snapshot()),'unavailable');
    const extensionPage=await host.install({id:'generated.extension-page',version:'1',components:[]},pageContributions);
    blocked(resolveDiscoveryTarget(extensionTarget,snapshot()),'unavailable');
    const first=await host.install({id:'generated.extension-collection',version:'1',components:[]},collectionContributions);
    const installed=resolveDiscoveryTarget(extensionTarget,snapshot());
    assert.equal(installed.state,'available');
    assert.equal(installed.href,'#/generated-canonical?view=generated-extension-items&returnTo=%23%2Fguide');
    await first.dispose();
    assert.ok(host.page('generated-extension'),'the destination page remains registered after collection disposal');
    blocked(resolveDiscoveryTarget(extensionTarget,snapshot()),'unavailable');
    assert.equal(resolveDiscoveryTarget(target,snapshot()).state,'available','an unrelated collection remains registered');
    const second=await host.install({id:'generated.extension-collection',version:'1',components:[]},collectionContributions);
    assert.equal(resolveDiscoveryTarget(extensionTarget,snapshot()).state,'available');
    await extensionPage.dispose();
    assert.ok(host.collections().some(entry=>entry.id==='generated-extension-items'),'the collection remains registered after page disposal');
    blocked(resolveDiscoveryTarget(extensionTarget,snapshot()),'unavailable');
    await second.dispose();
    blocked(resolveDiscoveryTarget(extensionTarget,snapshot()),'unavailable');
  }finally{await host.close();}
});
