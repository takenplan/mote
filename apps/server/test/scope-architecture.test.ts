import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {checkScopes,checkScopeInventory,scopeSurfaces,checkProductionImports} from '../../../scripts/check-scope-contracts.mjs';

test('production scope inventory and transitive composition boundary are declared',()=>{
  assert.deepEqual(checkScopes(),[]);
});

test('plain Node fixture scripts explicitly load the quarantined TypeScript composition through the supported loader API',()=>{
  const fixture=new URL('./fixtures/legacy-app.mjs',import.meta.url).href;
  execFileSync(process.execPath,['--input-type=module','-e',`const fixture=await import(${JSON.stringify(fixture)});if(typeof fixture.buildApp!=='function')throw Error('Missing generated fixture builder');`],{stdio:'pipe',timeout:15000});
});

test('public and transitive production imports cannot select the legacy fixture',t=>{
  const directory=mkdtempSync(join(tmpdir(),'mote-scope-imports-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));
  const src=join(directory,'apps/server/src');mkdirSync(join(src,'scope'),{recursive:true});
  writeFileSync(join(src,'index.ts'),"import './config.js';");
  writeFileSync(join(src,'app.ts'),"export {buildApp} from '../test/fixtures/legacy-app.js';");
  writeFileSync(join(src,'config.ts'),"import './helper.mjs';");
  writeFileSync(join(src,'helper.mjs'),"import '../test/fixtures/legacy-app.js';");
  const failures=checkProductionImports(directory);
  assert.ok(failures.some(value=>value.includes('src/app.ts')&&value.includes('non-production')));
  assert.ok(failures.some(value=>value.includes('src/helper.mjs')&&value.includes('non-production')));
});

test('reviewed processing, usage and authorization helpers are allowed only from their owning scoped hosts',t=>{
  const directory=mkdtempSync(join(tmpdir(),'mote-scoped-host-helpers-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));
  const src=join(directory,'apps/server/src');mkdirSync(join(src,'scope'),{recursive:true});mkdirSync(join(src,'connectors'),{recursive:true});
  for(const path of ['index.ts','app.ts','processor-admission.ts','media-execution-facts.ts','memory-validation.ts','connectors/authorization-output.ts'])writeFileSync(join(src,path),'export {};');
  const imports={'task-execution.ts':"import '../processor-admission.js';",'processing.ts':"import '../processor-admission.js';import '../media-execution-facts.js';",'model-query.ts':"import '../memory-validation.js';",'connector-recordings.ts':"import '../connectors/authorization-output.js';"};
  for(const [path,source] of Object.entries(imports))writeFileSync(join(src,'scope',path),source);
  assert.deepEqual(checkProductionImports(directory),[]);
  writeFileSync(join(src,'scope','unreviewed.ts'),"import '../processor-admission.js';import '../media-execution-facts.js';import '../memory-validation.js';import '../connectors/authorization-output.js';");
  const failures=checkProductionImports(directory);assert.equal(failures.length,4);assert.ok(failures.every(value=>value.includes('unscoped production import: apps/server/src/scope/unreviewed.ts')));
});

test('the shared Material visibility predicate is import-free and available only to its exact scoped consumers',t=>{
  const directory=mkdtempSync(join(tmpdir(),'mote-stateless-visibility-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));
  const src=join(directory,'apps/server/src');mkdirSync(join(src,'scope'),{recursive:true});
  for(const path of ['index.ts','app.ts','store.ts'])writeFileSync(join(src,path),'export {};');
  const helper='apps/server/src/material-original-visibility.ts',pure="import type {CaptureRecord} from '@mote/shared';export function visible(record:Pick<CaptureRecord,'privacy'>){return !record.privacy.excluded;}";
  writeFileSync(join(src,'material-original-visibility.ts'),pure);writeFileSync(join(src,'material-organizer-contract.ts'),"import './material-original-visibility.js';");
  writeFileSync(join(src,'scope/evidence-projection.ts'),"import '../material-original-visibility.js';");writeFileSync(join(src,'scope/memory-capture-materials.ts'),"import '../material-original-visibility.js';import '../material-organizer-contract.js';");
  assert.deepEqual(checkProductionImports(directory),[]);
  writeFileSync(join(src,'scope/unreviewed.ts'),"import '../material-original-visibility.js';");assert.deepEqual(checkProductionImports(directory),['unscoped production import: apps/server/src/scope/unreviewed.ts -> '+helper]);rmSync(join(src,'scope/unreviewed.ts'));
  for(const [dependency,specifier] of [["import './store.js';",'./store.js'],["import 'node:fs';",'node:fs'],["import 'node:sqlite';",'node:sqlite'],["import '@mote/shared';",'@mote/shared'],["export {value} from './store.js';",'./store.js'],["import('node:fs');",'node:fs'],["require('node:sqlite');",'node:sqlite'],["import runtime = require('./store.js');",'./store.js']]){
    writeFileSync(join(src,'material-original-visibility.ts'),pure+dependency);assert.deepEqual(checkProductionImports(directory),[`unreviewed stateless helper import: ${helper} -> ${specifier}`],dependency);
  }
  writeFileSync(join(src,'material-original-visibility.ts'),pure+"const target='./store.js';import(target);");assert.deepEqual(checkProductionImports(directory),['computed production import: '+helper]);
});

test('the provider canary is available only to its scoped host and cannot acquire legacy storage or file access',t=>{
  const directory=mkdtempSync(join(tmpdir(),'mote-scoped-canary-ports-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));
  const src=join(directory,'apps/server/src');mkdirSync(join(src,'scope'),{recursive:true});
  for(const path of ['index.ts','app.ts','memory-schema.ts','memory-provider-contract.ts','store.ts'])writeFileSync(join(src,path),'export {};');
  const pure="import {randomUUID} from 'node:crypto';import './memory-schema.js';import './memory-provider-contract.js';";
  writeFileSync(join(src,'memory-provider-probe.ts'),pure);
  writeFileSync(join(src,'scope/memory-providers.ts'),"import '../memory-provider-probe.js';");
  assert.deepEqual(checkProductionImports(directory),[]);
  writeFileSync(join(src,'scope/unreviewed.ts'),"import '../memory-provider-probe.js';");
  assert.deepEqual(checkProductionImports(directory),['unscoped production import: apps/server/src/scope/unreviewed.ts -> apps/server/src/memory-provider-probe.ts']);
  rmSync(join(src,'scope/unreviewed.ts'));
  for(const specifier of ['./store.js','node:fs','node:sqlite']){
    writeFileSync(join(src,'memory-provider-probe.ts'),pure+`import ${JSON.stringify(specifier)};`);
    assert.deepEqual(checkProductionImports(directory),[`unreviewed capability probe import: apps/server/src/memory-provider-probe.ts -> ${specifier}`]);
  }
});

test('undeclared tables, APIs, MCP tools/resources/prompts, tasks, directories, extensions and scoped registrations fail the architecture check',()=>{
  const source=`const server=Fastify();server.get('/api/private',handler);
    db.exec('CREATE TABLE private_new(id TEXT)');
    executor.register({kind:'private.new',pool:'private'});
    privateDirectory(join(root,'private'));
    host.install(manifest,entry);
    server.registerTool('private_tool',{},handler);
    server.registerResource('private_resource','mote://private',{},handler);
    server.registerPrompt('private_prompt',{},handler);
    registerUserRoute(runtime,{scope:'user',method:'POST',url:'/api/new',service:'private',handle});`;
  const surfaces=scopeSurfaces(source);
  for(const kind of ['table','api','mcp','task','directory','extension'])assert.ok(surfaces.some(value=>value.startsWith(kind+':')),kind);
  for(const kind of ['registerTool','registerResource','registerPrompt'])assert.ok(surfaces.some(value=>value.startsWith('mcp:'+kind+':')),kind);
  assert.ok(surfaces.some(value=>value.includes('registerUserRoute:')&&value.includes('/api/new')));
  assert.deepEqual(checkScopeInventory({'new.ts':surfaces},{}),['undeclared scope: new.ts']);
  assert.equal(checkScopeInventory({'new.ts':surfaces},{'new.ts':{scope:'user',module:'M02',surfaces:[]}}).length,surfaces.length);
  assert.deepEqual(checkScopeInventory({'new.ts':surfaces},{'new.ts':{scope:'user',module:'M02',surfaces}}),[]);
});
