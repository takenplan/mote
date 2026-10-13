import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../src/store.js';
import {MemoryStrategies} from '../src/memory-strategies.js';
import {MemoryRecipeSettings} from '../src/memory-recipe-settings.js';
import {PERSONAL_MEMORY_RECIPE} from '../src/bounded-personal-memory-policy.js';
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

test('fresh defaults select range evaluation without changing immutable legacy personal or coding definitions',t=>{
  const f=fixture(t),old=f.strategies.resolve(prior),settings=new MemoryRecipeSettings(f.store,f.strategies);
  assert.deepEqual(settings.selection().map(b=>({id:b.recipe.id,version:b.recipe.version})),[RANGE_SELECTION_PERSONAL_RECIPE]);
  assert.deepEqual(settings.selection(f.capture).map(b=>({id:b.recipe.id,version:b.recipe.version})),[RANGE_SELECTION_PERSONAL_RECIPE,RANGE_SELECTION_DAILY_RECIPE]);
  assert.ok(settings.selection(f.capture).every(binding=>binding.workContract==='range-evaluation@1'));
  assert.equal(old.binding.workContract,undefined);
  assert.deepEqual(f.strategies.resolvePinned(old.binding),old);
  assert.equal(f.strategies.resolve(coding).binding.extract.id,'mote.context-extraction');
  assert.equal(f.strategies.resolve(PERSONAL_MEMORY_RECIPE).binding.extract.id,'mote.personal-extraction');
  assert.equal(f.store.db.prepare("SELECT count(*) n FROM sqlite_master WHERE name='memory_input_authorizations'").get()!.n,0,'installation creates no model authority');
});

test('one-time built-in default upgrade keeps old receipt scope, preserves overrides, and explicit choice ends grandfathering',t=>{
  const f=fixture(t),old=f.strategies.resolve(prior).binding,daily=f.strategies.resolve(DAILY_EVENT_RECIPE).binding;
  f.store.db.exec('CREATE TABLE memory_recipe_settings(id TEXT PRIMARY KEY,source_id TEXT REFERENCES source_connections(id) ON DELETE CASCADE,json TEXT NOT NULL)');
  for(const [id,source,bindings] of [['default',null,[old]],['capture-default',null,[old,daily]],['source:override','override',[old]]] as const)
    f.store.db.prepare('INSERT INTO memory_recipe_settings VALUES(?,?,?)').run(id,source,JSON.stringify(bindings));
  let settings=new MemoryRecipeSettings(f.store,f.strategies);
  assert.equal(settings.selection('ordinary')[0].recipe.version,'4');
  assert.deepEqual(settings.selection(f.capture).map(binding=>binding.recipe.version),['4','2']);
  assert.equal(settings.selection('override')[0].recipe.version,'2','explicit source choice stays pinned');
  assert.ok(settings.enabled('ordinary',old),'existing ordinary receipt can finish its original policy');
  assert.ok(settings.enabled(f.capture,old),'existing capture receipt can finish its original policy');
  assert.equal(f.store.db.prepare("SELECT count(*) n FROM sqlite_master WHERE name='memory_input_authorizations'").get()!.n,0);
  settings=new MemoryRecipeSettings(f.store,new MemoryStrategies());assert.ok(settings.enabled('ordinary',old));
  settings.configure({sourceId:'override',recipes:null});
  assert.equal(settings.selection('override')[0].recipe.version,'4');
  assert.equal(settings.enabled('override',old),false,'explicit inheritance cannot regain default grandfathering');
  assert.ok(settings.enabled('ordinary',old),'source choice leaves other in-flight default receipts eligible');
  settings=new MemoryRecipeSettings(f.store,new MemoryStrategies());assert.equal(settings.enabled('override',old),false);
  settings.configure({sourceId:'override',recipes:[prior]});assert.ok(settings.enabled('override',old),'explicit v2 remains selectable');
  settings.configure({sourceId:'override',recipes:null});assert.equal(settings.enabled('override',old),false);
  settings.configure({recipes:[PERSONAL_MEMORY_RECIPE]});assert.equal(settings.enabled('ordinary',old),false);
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
  assert.equal(settings.selection()[0].recipe.version,'4');assert.equal(settings.selection(f.capture)[0].recipe.version,'4');
  assert.ok(settings.enabled('ordinary',old));assert.ok(settings.enabled(f.capture,old));
  assert.equal(f.store.db.prepare('SELECT count(*) n FROM memory_recipe_default_upgrades').get()!.n,2);
});

for(const captureExists of [false,true])test(`a saved personal-v3 default advances future intake while retaining old grants${captureExists?' with its existing capture composition':' before capture defaults were introduced'}`,t=>{
 const f=fixture(t),old=f.strategies.resolve(PERSONAL_MEMORY_RECIPE).binding,daily=f.strategies.resolve(DAILY_EVENT_RECIPE).binding;
 f.store.db.exec('CREATE TABLE memory_recipe_settings(id TEXT PRIMARY KEY,source_id TEXT REFERENCES source_connections(id) ON DELETE CASCADE,json TEXT NOT NULL);CREATE TABLE memory_recipe_default_upgrades(id TEXT PRIMARY KEY);');
 f.store.db.prepare("INSERT INTO memory_recipe_default_upgrades VALUES('bounded-personal@3')").run();
 f.store.db.prepare("INSERT INTO memory_recipe_settings VALUES('default',NULL,?)").run(JSON.stringify([old]));
 f.store.db.prepare("INSERT INTO memory_recipe_settings VALUES('source:override','override',?)").run(JSON.stringify([old]));
 if(captureExists)f.store.db.prepare("INSERT INTO memory_recipe_settings VALUES('capture-default',NULL,?)").run(JSON.stringify([old,daily]));
 let settings=new MemoryRecipeSettings(f.store,f.strategies);
 assert.deepEqual(settings.selection().map(binding=>binding.recipe.version),['4']);
 assert.deepEqual(settings.selection(f.capture).map(binding=>binding.recipe.version),['4','2']);
 assert.ok(settings.enabled('ordinary',old));assert.equal(settings.selection('override')[0].recipe.version,'3');
 if(captureExists){assert.ok(settings.enabled(f.capture,old));assert.ok(settings.enabled(f.capture,daily));}
 assert.equal(f.store.db.prepare("SELECT count(*) n FROM sqlite_master WHERE name='memory_input_authorizations'").get()!.n,0,'upgrading defaults never grants historical work');
 settings=new MemoryRecipeSettings(f.store,new MemoryStrategies());assert.ok(settings.enabled('ordinary',old));assert.deepEqual(f.strategies.resolvePinned(old).binding,old);
 settings.configure({recipes:[RANGE_SELECTION_PERSONAL_RECIPE]});assert.equal(settings.enabled('ordinary',old),false,'an explicit new default choice ends the retained old general grant');
 if(captureExists){assert.ok(settings.enabled(f.capture,old));settings.configure({scope:'capture',recipes:[RANGE_SELECTION_PERSONAL_RECIPE,RANGE_SELECTION_DAILY_RECIPE]});assert.equal(settings.enabled(f.capture,old),false);assert.equal(settings.enabled(f.capture,daily),false);}
 settings=new MemoryRecipeSettings(f.store,new MemoryStrategies());assert.equal(settings.enabled('ordinary',old),false);assert.equal(settings.selection('override')[0].recipe.version,'3');
});

test('a failure in the range-evaluation default upgrade rolls back both policy choices and legacy grants',t=>{
 const f=fixture(t),old=f.strategies.resolve(PERSONAL_MEMORY_RECIPE).binding,daily=f.strategies.resolve(DAILY_EVENT_RECIPE).binding;
 f.store.db.exec('CREATE TABLE memory_recipe_settings(id TEXT PRIMARY KEY,source_id TEXT REFERENCES source_connections(id) ON DELETE CASCADE,json TEXT NOT NULL);CREATE TABLE memory_recipe_default_upgrades(id TEXT PRIMARY KEY);');
 f.store.db.prepare("INSERT INTO memory_recipe_default_upgrades VALUES('bounded-personal@3')").run();
 for(const [id,bindings] of [['default',[old]],['capture-default',[old,daily]]] as const)f.store.db.prepare('INSERT INTO memory_recipe_settings VALUES(?,NULL,?)').run(id,JSON.stringify(bindings));
 const snapshot=f.store.db.prepare('SELECT id,json FROM memory_recipe_settings ORDER BY id').all();let reserves=0;const reserve=f.store.reserveMetadata.bind(f.store);
 const mocked=t.mock.method(f.store,'reserveMetadata',(bytes:number)=>{if(++reserves===2)throw Error('Generated new-policy reservation failure');return reserve(bytes);});
 assert.throws(()=>new MemoryRecipeSettings(f.store,f.strategies),/Generated new-policy reservation failure/);assert.equal(f.store.db.isTransaction,false);
 assert.deepEqual(f.store.db.prepare('SELECT id,json FROM memory_recipe_settings ORDER BY id').all(),snapshot);assert.equal(f.store.db.prepare('SELECT count(*) n FROM memory_recipe_legacy_scopes').get()!.n,0);assert.equal(f.store.db.prepare("SELECT 1 FROM memory_recipe_default_upgrades WHERE id='range-evaluation@1'").get(),undefined);
 mocked.mock.restore();const settings=new MemoryRecipeSettings(f.store,f.strategies);assert.equal(settings.selection()[0].recipe.version,'4');assert.ok(settings.enabled('ordinary',old));assert.ok(settings.enabled(f.capture,daily));
});
