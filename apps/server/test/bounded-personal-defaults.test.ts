import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../src/store.js';
import {MemoryStrategies} from '../src/memory-strategies.js';
import {MemoryRecipeSettings} from '../src/memory-recipe-settings.js';
import {PERSONAL_MEMORY_RECIPE,PERSONAL_MEMORY_RECIPE_V3} from '../src/bounded-personal-memory-policy.js';
import {DAILY_EVENT_RECIPE} from '../src/daily-event-memory-policy.js';
import {RANGE_SELECTION_PERSONAL_RECIPE,RANGE_SELECTION_DAILY_RECIPE} from '../src/memory-range-selection-policy.js';
import {uiPageCaptureSource} from '../src/capture-memory-source.js';

const prior={id:'mote.personal-memory',version:'2'},coding={id:'mote.coding-memory',version:'2'};
function fixture(t:import('node:test').TestContext){
  const dir=mkdtempSync(join(tmpdir(),'mote-bounded-defaults-')),store=new Store(dir),strategies=new MemoryStrategies();
  t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});
  const capture=uiPageCaptureSource('generated');
  for(const id of ['ordinary','override',capture])store.db.prepare('INSERT INTO source_connections VALUES(?,?)').run(id,JSON.stringify({id,deviceId:'generated'}));
  return {store,strategies,capture};
}

test('fresh defaults combine context reading and range evaluation without changing immutable v2, v3, v4 or coding definitions',t=>{
  const f=fixture(t),old=f.strategies.resolve(prior),bounded=f.strategies.resolve(PERSONAL_MEMORY_RECIPE_V3),settings=new MemoryRecipeSettings(f.store,f.strategies);
  assert.deepEqual(settings.selection().map(b=>({id:b.recipe.id,version:b.recipe.version})),[RANGE_SELECTION_PERSONAL_RECIPE]);
  assert.deepEqual(settings.selection(f.capture).map(b=>({id:b.recipe.id,version:b.recipe.version})),[RANGE_SELECTION_PERSONAL_RECIPE,RANGE_SELECTION_DAILY_RECIPE]);
  assert.ok(settings.selection(f.capture).every(binding=>binding.workContract==='range-evaluation@1'));
  assert.equal(old.binding.workContract,undefined);
  assert.deepEqual(f.strategies.resolvePinned(old.binding),old);
  assert.deepEqual(bounded.binding,{
    recipe:{id:'mote.personal-memory',version:'3',fingerprint:'65bead3727faa9686ee70efe5ec00893c99bd647d047a6fe4a8d46890b388d31'},
    extract:{id:'mote.personal-extraction',version:'1',fingerprint:'708ae8a393246ecdf87c64bc6cfdee47d24c88c7b73adfd90eaf190bfbd6417f'},
    review:{id:'mote.personal-review',version:'3',fingerprint:'0d7b0c46bd64b8fcaf5a1ce2331a92e2c9a7ba7c84e3985204adbf2791950948'},
  },'historical successful receipts and recording v2 consumers keep the exact v3 definitions');
  assert.deepEqual(f.strategies.resolvePinned(bounded.binding),bounded);
  assert.equal(f.strategies.resolve(coding).binding.extract.id,'mote.context-extraction');
  assert.equal(f.strategies.resolve(PERSONAL_MEMORY_RECIPE).binding.extract.id,'mote.personal-extraction');
  assert.equal(f.strategies.resolve(PERSONAL_MEMORY_RECIPE).binding.extract.version,'2');
  assert.equal(f.strategies.resolve(PERSONAL_MEMORY_RECIPE).binding.review.version,'4');
  const context=f.strategies.resolve(PERSONAL_MEMORY_RECIPE);
  assert.deepEqual(context.binding,{
    recipe:{id:'mote.personal-memory',version:'4',fingerprint:'e059e0e823d63d007df1083c0a4db99ca39b462142f4220aca2eabf96dbd2d29'},
    extract:{id:'mote.personal-extraction',version:'2',fingerprint:'c4f6e81fa78ff1cba7fbaa0023f4af3dee69ed7d3827e62ef048641b87d13382'},
    review:{id:'mote.personal-review',version:'4',fingerprint:'31de91e813b979864d5a74048865c3f9863670e62d7fb0ae668cfe4833d3ea43'},
  },'context-reading v4 receipts retain the exact installed definitions and legacy work contract');
  assert.deepEqual(f.strategies.resolvePinned(context.binding),context);
  const combined=f.strategies.resolve(RANGE_SELECTION_PERSONAL_RECIPE);
  assert.equal(combined.binding.extract.version,'3');assert.equal(combined.binding.review.version,'5');
  assert.equal(combined.binding.workContract,'range-evaluation@1');
  assert.match(combined.extract.prompt,/context_evidence/);assert.match(combined.review.policy,/Use context_evidence yourself/);
  assert.match(combined.extract.prompt,/explicit retrospective interval or year/);assert.match(combined.extract.prompt,/Selection is not incomplete evaluation/);
  assert.equal(f.store.db.prepare("SELECT count(*) n FROM sqlite_master WHERE name='memory_input_authorizations'").get()!.n,0,'installation creates no model authority');
});

test('one-time built-in default upgrades keep v2, v3 and v4 receipt scopes, preserve overrides, and explicit choice ends grandfathering',t=>{
  const f=fixture(t),old=f.strategies.resolve(prior).binding,bounded=f.strategies.resolve(PERSONAL_MEMORY_RECIPE_V3).binding,context=f.strategies.resolve(PERSONAL_MEMORY_RECIPE).binding,daily=f.strategies.resolve(DAILY_EVENT_RECIPE).binding;
  f.store.db.exec('CREATE TABLE memory_recipe_settings(id TEXT PRIMARY KEY,source_id TEXT REFERENCES source_connections(id) ON DELETE CASCADE,json TEXT NOT NULL)');
  for(const [id,source,bindings] of [['default',null,[old]],['capture-default',null,[old,daily]],['source:override','override',[old]]] as const)
    f.store.db.prepare('INSERT INTO memory_recipe_settings VALUES(?,?,?)').run(id,source,JSON.stringify(bindings));
  let settings=new MemoryRecipeSettings(f.store,f.strategies);
  assert.equal(settings.selection('ordinary')[0].recipe.version,'5');
  assert.equal(settings.selection(f.capture)[0].recipe.version,'5');
  assert.equal(settings.selection('override')[0].recipe.version,'2','explicit source choice stays pinned');
  assert.ok(settings.enabled('ordinary',old),'existing ordinary receipt can finish its original policy');
  assert.ok(settings.enabled(f.capture,old),'existing capture receipt can finish its original policy');
  assert.ok(settings.enabled('ordinary',bounded));assert.ok(settings.enabled(f.capture,bounded));
  assert.ok(settings.enabled('ordinary',context));assert.ok(settings.enabled(f.capture,context));
  assert.ok(settings.enabled(f.capture,daily),'already authorized daily v1 retains its grant');
  assert.equal(f.store.db.prepare("SELECT count(*) n FROM sqlite_master WHERE name='memory_input_authorizations'").get()!.n,0);
  settings=new MemoryRecipeSettings(f.store,new MemoryStrategies());assert.ok(settings.enabled('ordinary',old));
  settings.configure({sourceId:'override',recipes:null});
  assert.equal(settings.selection('override')[0].recipe.version,'5');
  assert.equal(settings.enabled('override',old),false,'explicit inheritance cannot regain default grandfathering');
  assert.equal(settings.enabled('override',bounded),false);assert.equal(settings.enabled('override',context),false);
  assert.ok(settings.enabled('ordinary',old),'source choice leaves other in-flight default receipts eligible');
  settings=new MemoryRecipeSettings(f.store,new MemoryStrategies());assert.equal(settings.enabled('override',old),false);
  settings.configure({sourceId:'override',recipes:[prior]});assert.ok(settings.enabled('override',old),'explicit v2 remains selectable');
  settings.configure({sourceId:'override',recipes:null});assert.equal(settings.enabled('override',old),false);
  settings.configure({recipes:[RANGE_SELECTION_PERSONAL_RECIPE]});assert.equal(settings.enabled('ordinary',old),false);
  assert.equal(settings.enabled('ordinary',bounded),false);assert.equal(settings.enabled('ordinary',context),false);
  assert.ok(settings.enabled(f.capture,old),'ordinary choice does not change capture choice');
  settings.configure({recipes:[prior]});
  settings=new MemoryRecipeSettings(f.store,new MemoryStrategies());
  assert.equal(settings.selection()[0].recipe.version,'2','restart never upgrades a later explicit owner choice');
});

test('customized default combinations are not replaced by the built-in upgrade',t=>{
  const f=fixture(t),old=f.strategies.resolve(prior).binding,code=f.strategies.resolve(coding).binding;
  f.store.db.exec('CREATE TABLE memory_recipe_settings(id TEXT PRIMARY KEY,source_id TEXT REFERENCES source_connections(id) ON DELETE CASCADE,json TEXT NOT NULL)');
  f.store.db.prepare("INSERT INTO memory_recipe_settings VALUES('default',NULL,?)").run(JSON.stringify([old,code]));
  const settings=new MemoryRecipeSettings(f.store,f.strategies);
  assert.deepEqual(settings.selection().map(b=>b.recipe.version),['2','2']);
  assert.equal(f.store.db.prepare('SELECT count(*) n FROM memory_recipe_legacy_scopes').get()!.n,0);
});

test('a failure halfway through the default upgrade rolls back choices, legacy scopes and marker before retry',t=>{
  const f=fixture(t),old=f.strategies.resolve(prior).binding,daily=f.strategies.resolve(DAILY_EVENT_RECIPE).binding;
  f.store.db.exec('CREATE TABLE memory_recipe_settings(id TEXT PRIMARY KEY,source_id TEXT REFERENCES source_connections(id) ON DELETE CASCADE,json TEXT NOT NULL)');
  for(const [id,bindings] of [['default',[old]],['capture-default',[old,daily]]] as const)
    f.store.db.prepare('INSERT INTO memory_recipe_settings VALUES(?,NULL,?)').run(id,JSON.stringify(bindings));
  const snapshot=f.store.db.prepare('SELECT id,json FROM memory_recipe_settings ORDER BY id').all();
  let reserves=0;const reserve=f.store.reserveMetadata.bind(f.store);
  const mock=t.mock.method(f.store,'reserveMetadata',(bytes:number)=>{if(++reserves===2)throw Error('Generated metadata reservation failure');return reserve(bytes);});
  assert.throws(()=>new MemoryRecipeSettings(f.store,f.strategies),/Generated metadata reservation failure/);
  assert.equal(f.store.db.isTransaction,false);
  assert.deepEqual(f.store.db.prepare('SELECT id,json FROM memory_recipe_settings ORDER BY id').all(),snapshot);
  for(const table of ['memory_recipe_legacy_scopes','memory_recipe_default_upgrades'])assert.equal(f.store.db.prepare(`SELECT count(*) n FROM ${table}`).get()!.n,0);
  mock.mock.restore();const settings=new MemoryRecipeSettings(f.store,new MemoryStrategies());
  assert.equal(settings.selection()[0].recipe.version,'5');assert.equal(settings.selection(f.capture)[0].recipe.version,'5');
  assert.ok(settings.enabled('ordinary',old));assert.ok(settings.enabled(f.capture,old));
  assert.equal(f.store.db.prepare('SELECT count(*) n FROM memory_recipe_default_upgrades').get()!.n,3);
});

test('v3 upgrade preserves exact source overrides, customized combinations and later explicit v3 choices through restart',t=>{
  const f=fixture(t),old=f.strategies.resolve(PERSONAL_MEMORY_RECIPE_V3).binding,daily=f.strategies.resolve(DAILY_EVENT_RECIPE).binding,code=f.strategies.resolve(coding).binding;
  f.store.db.exec('CREATE TABLE memory_recipe_settings(id TEXT PRIMARY KEY,source_id TEXT REFERENCES source_connections(id) ON DELETE CASCADE,json TEXT NOT NULL)');
  for(const [id,source,bindings] of [['default',null,[old]],['capture-default',null,[old,daily,code]],['source:override','override',[old]]] as const)
    f.store.db.prepare('INSERT INTO memory_recipe_settings VALUES(?,?,?)').run(id,source,JSON.stringify(bindings));
  let settings=new MemoryRecipeSettings(f.store,f.strategies);
  assert.equal(settings.selection()[0].recipe.version,'5');
  assert.deepEqual(settings.selection(f.capture),[old,daily,code],'custom capture policy is not a built-in default');
  assert.deepEqual(settings.selection('override'),[old]);
  assert.ok(settings.enabled('ordinary',old));
  settings.configure({recipes:[PERSONAL_MEMORY_RECIPE_V3]});
  settings=new MemoryRecipeSettings(f.store,new MemoryStrategies());
  assert.deepEqual(settings.selection(),[old],'saved v3 remains selectable and is never upgraded again');
  assert.equal(f.store.db.prepare('SELECT count(*) n FROM memory_recipe_legacy_scopes').get()!.n,0);
});

test('v4 default upgrade failure rolls back its selections, grandfathering and marker before retry',t=>{
  const f=fixture(t),old=f.strategies.resolve(PERSONAL_MEMORY_RECIPE_V3).binding,daily=f.strategies.resolve(DAILY_EVENT_RECIPE).binding;
  f.store.db.exec(`CREATE TABLE memory_recipe_settings(id TEXT PRIMARY KEY,source_id TEXT REFERENCES source_connections(id) ON DELETE CASCADE,json TEXT NOT NULL);
    CREATE TABLE memory_recipe_default_upgrades(id TEXT PRIMARY KEY);
    INSERT INTO memory_recipe_default_upgrades VALUES('bounded-personal@3');`);
  for(const [id,bindings] of [['default',[old]],['capture-default',[old,daily]]] as const)
    f.store.db.prepare('INSERT INTO memory_recipe_settings VALUES(?,NULL,?)').run(id,JSON.stringify(bindings));
  const snapshot=f.store.db.prepare('SELECT id,json FROM memory_recipe_settings ORDER BY id').all();
  let reserves=0;const reserve=f.store.reserveMetadata.bind(f.store);
  const mock=t.mock.method(f.store,'reserveMetadata',(bytes:number)=>{if(++reserves===2)throw Error('Generated v4 metadata reservation failure');return reserve(bytes);});
  assert.throws(()=>new MemoryRecipeSettings(f.store,f.strategies),/Generated v4 metadata reservation failure/);
  assert.equal(f.store.db.isTransaction,false);assert.deepEqual(f.store.db.prepare('SELECT id,json FROM memory_recipe_settings ORDER BY id').all(),snapshot);
  assert.equal(f.store.db.prepare('SELECT count(*) n FROM memory_recipe_legacy_scopes').get()!.n,0);
  assert.deepEqual(f.store.db.prepare('SELECT id FROM memory_recipe_default_upgrades').all().map(row=>String(row.id)),['bounded-personal@3']);
  mock.mock.restore();const settings=new MemoryRecipeSettings(f.store,new MemoryStrategies());
  assert.equal(settings.selection()[0].recipe.version,'5');assert.equal(settings.selection(f.capture)[0].recipe.version,'5');
  assert.ok(settings.enabled('ordinary',old));assert.ok(settings.enabled(f.capture,old));
});

for(const captureExists of [false,true])test(`a saved v4 default advances only future intake to combined personal v5${captureExists?' with its existing daily-v1 capture composition':' before capture defaults were introduced'}`,t=>{
 const f=fixture(t),old=f.strategies.resolve(PERSONAL_MEMORY_RECIPE).binding,daily=f.strategies.resolve(DAILY_EVENT_RECIPE).binding;
 f.store.db.exec('CREATE TABLE memory_recipe_settings(id TEXT PRIMARY KEY,source_id TEXT REFERENCES source_connections(id) ON DELETE CASCADE,json TEXT NOT NULL);CREATE TABLE memory_recipe_default_upgrades(id TEXT PRIMARY KEY);');
 for(const id of ['bounded-personal@3','context-reading-personal@4'])f.store.db.prepare('INSERT INTO memory_recipe_default_upgrades VALUES(?)').run(id);
 f.store.db.prepare("INSERT INTO memory_recipe_settings VALUES('default',NULL,?)").run(JSON.stringify([old]));
 f.store.db.prepare("INSERT INTO memory_recipe_settings VALUES('source:override','override',?)").run(JSON.stringify([old]));
 if(captureExists)f.store.db.prepare("INSERT INTO memory_recipe_settings VALUES('capture-default',NULL,?)").run(JSON.stringify([old,daily]));
 let settings=new MemoryRecipeSettings(f.store,f.strategies);
 assert.deepEqual(settings.selection().map(binding=>binding.recipe.version),['5']);
 assert.deepEqual(settings.selection(f.capture).map(binding=>binding.recipe.version),['5','2']);
 assert.ok(settings.enabled('ordinary',old));assert.equal(settings.selection('override')[0].recipe.version,'4');
 if(captureExists){assert.ok(settings.enabled(f.capture,old));assert.ok(settings.enabled(f.capture,daily));}
 assert.equal(f.store.db.prepare("SELECT count(*) n FROM sqlite_master WHERE name='memory_input_authorizations'").get()!.n,0,'upgrading defaults never grants historical work');
 settings=new MemoryRecipeSettings(f.store,new MemoryStrategies());assert.ok(settings.enabled('ordinary',old));assert.deepEqual(f.strategies.resolvePinned(old).binding,old);
 settings.configure({recipes:[RANGE_SELECTION_PERSONAL_RECIPE]});assert.equal(settings.enabled('ordinary',old),false,'an explicit new default choice ends the retained old general grant');
 if(captureExists){assert.ok(settings.enabled(f.capture,old));settings.configure({scope:'capture',recipes:[RANGE_SELECTION_PERSONAL_RECIPE,RANGE_SELECTION_DAILY_RECIPE]});assert.equal(settings.enabled(f.capture,old),false);assert.equal(settings.enabled(f.capture,daily),false);}
 settings=new MemoryRecipeSettings(f.store,new MemoryStrategies());assert.equal(settings.enabled('ordinary',old),false);assert.equal(settings.selection('override')[0].recipe.version,'4');
});

test('a failed combined-policy upgrade rolls back selections and legacy grants before retry',t=>{
 const f=fixture(t),old=f.strategies.resolve(PERSONAL_MEMORY_RECIPE).binding,daily=f.strategies.resolve(DAILY_EVENT_RECIPE).binding;
 f.store.db.exec('CREATE TABLE memory_recipe_settings(id TEXT PRIMARY KEY,source_id TEXT REFERENCES source_connections(id) ON DELETE CASCADE,json TEXT NOT NULL);CREATE TABLE memory_recipe_default_upgrades(id TEXT PRIMARY KEY);');
 for(const id of ['bounded-personal@3','context-reading-personal@4'])f.store.db.prepare('INSERT INTO memory_recipe_default_upgrades VALUES(?)').run(id);
 for(const [id,bindings] of [['default',[old]],['capture-default',[old,daily]]] as const)f.store.db.prepare('INSERT INTO memory_recipe_settings VALUES(?,NULL,?)').run(id,JSON.stringify(bindings));
 const snapshot=f.store.db.prepare('SELECT id,json FROM memory_recipe_settings ORDER BY id').all();let reserves=0;const reserve=f.store.reserveMetadata.bind(f.store);
 const mocked=t.mock.method(f.store,'reserveMetadata',(bytes:number)=>{if(++reserves===2)throw Error('Generated combined-policy reservation failure');return reserve(bytes);});
 assert.throws(()=>new MemoryRecipeSettings(f.store,f.strategies),/Generated combined-policy reservation failure/);assert.equal(f.store.db.isTransaction,false);
 assert.deepEqual(f.store.db.prepare('SELECT id,json FROM memory_recipe_settings ORDER BY id').all(),snapshot);assert.equal(f.store.db.prepare('SELECT count(*) n FROM memory_recipe_legacy_scopes').get()!.n,0);assert.equal(f.store.db.prepare("SELECT 1 FROM memory_recipe_default_upgrades WHERE id='range-evaluation@1'").get(),undefined);
 mocked.mock.restore();const settings=new MemoryRecipeSettings(f.store,f.strategies);assert.equal(settings.selection()[0].recipe.version,'5');assert.ok(settings.enabled('ordinary',old));assert.ok(settings.enabled(f.capture,daily));
});

for(const version of ['2','3','4'])test(`a later explicit personal v${version} choice survives all named migrations on restart`,t=>{
 const f=fixture(t);let settings=new MemoryRecipeSettings(f.store,f.strategies);
 settings.configure({recipes:[{id:prior.id,version}]});const chosen=settings.selection();
 settings=new MemoryRecipeSettings(f.store,new MemoryStrategies());assert.deepEqual(settings.selection(),chosen);assert.equal(chosen[0].workContract,undefined);
});
