import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {z} from 'zod';
import {ConfigService} from '../src/config-service.js';

test('explicit view edits retain each masked secret by stable list identity through reorder and ordinary edits',async t=>{
 const directory=mkdtempSync(join(tmpdir(),'mote-web-view-config-'));
 const service=new ConfigService({path:join(directory,'mote.yaml'),initialDocument:{version:1,revision:0}});
 t.after(async()=>{await service.close();rmSync(directory,{recursive:true,force:true});});
 for(const domain of ['models','mcpConnections'])service.register({id:domain,schema:z.object({connections:z.array(z.object({id:z.string(),url:z.string(),token:z.string()}))}),defaultValue:{connections:[{id:'same-a',url:'https://a.invalid',token:'generated-secret-A'},{id:'same-b',url:'https://b.invalid',token:'generated-secret-B'}]},fields:[{path:'connections.*.token',sensitive:true}]});
 await service.initialize();
 for(const domain of ['models','mcpConnections']){
  const view=service.view(),value=(view.domains.find(d=>d.id===domain)!.saved as any);
  value.connections.reverse();value.connections[0].url='https://changed.invalid';
  await (service as any).replaceView(domain,value,view.revision);
  assert.deepEqual(service.saved<any>(domain).connections,[{id:'same-b',url:'https://changed.invalid',token:'generated-secret-B'},{id:'same-a',url:'https://a.invalid',token:'generated-secret-A'}]);
  const invalid=structuredClone(value);invalid.connections[0].id='new-identity';
  await assert.rejects((service as any).replaceView(domain,invalid,service.view().revision));
  assert.equal(service.saved<any>(domain).connections[0].id,'same-b');
 }
});
