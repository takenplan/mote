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

test('undeclared tables, APIs, tasks, directories, extensions and scoped registrations fail the architecture check',()=>{
  const source=`const server=Fastify();server.get('/api/private',handler);
    db.exec('CREATE TABLE private_new(id TEXT)');
    executor.register({kind:'private.new',pool:'private'});
    privateDirectory(join(root,'private'));
    host.install(manifest,entry);
    registerUserRoute(runtime,{scope:'user',method:'POST',url:'/api/new',service:'private',handle});`;
  const surfaces=scopeSurfaces(source);
  for(const kind of ['table','api','task','directory','extension'])assert.ok(surfaces.some(value=>value.startsWith(kind+':')),kind);
  assert.ok(surfaces.some(value=>value.includes('registerUserRoute:')&&value.includes('/api/new')));
  assert.deepEqual(checkScopeInventory({'new.ts':surfaces},{}),['undeclared scope: new.ts']);
  assert.equal(checkScopeInventory({'new.ts':surfaces},{'new.ts':{scope:'user',module:'M02',surfaces:[]}}).length,surfaces.length);
  assert.deepEqual(checkScopeInventory({'new.ts':surfaces},{'new.ts':{scope:'user',module:'M02',surfaces}}),[]);
});
