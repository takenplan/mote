import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {writeFileSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
import {noteCapture} from '@mote/shared';
import {identityHash} from '../src/scope/originals.js';
import {navigationRef} from '../src/context-navigation.js';
import {memoryFixture,memoryText} from './fixtures/mcp-memory.js';
import {call,value,source,item} from './fixtures/mcp.js';
import {waitForState} from './fixtures/scoped-query-accounts.js';
import {note,okCall,captureMaterial} from './fixtures/multiuser-mcp-query-suite.js';

for(const action of ['revoke','disable','source-recreate','source-toggle','delete-memory','cancel'] as const)test('actual SDK query reader carries '+action+' through a genuine provider await and keeps B available',async t=>{
 const f=await memoryFixture(t,true);for(const [user,owner]of [[f.a,'A'],[f.b,'B']] as const){const material=await f.publish(user,owner);await f.extract(user,material.id);}const directories=await f.externalize(),memory=(await f.ok(f.a.token,'/api/memories')).items[0],gate=f.hold(directories.get(f.a.userId)!,memory.id),grant=await f.mint(f.a.token),a=await f.connect(grant),b=await f.connect(await f.mint(f.b.token)),abort=new AbortController(),pending=a.client.callTool({name:'mote_read',arguments:{refs:['memory:'+memory.id]}},undefined,{signal:abort.signal}).then(result=>({result}),error=>({error:String(error)}));await gate.entered();assert.match(JSON.stringify(await okCall(b.client,'mote_context')),/Generated B/);
 if(action==='revoke')await f.ok(f.a.token,'/api/connections/'+grant.credentialId,'DELETE');else if(action==='disable'){await f.ok(f.admin.token,'/api/admin/accounts/'+f.a.userId,'PATCH',{disabled:true});await f.ok(f.admin.token,'/api/admin/accounts/'+f.a.userId,'PATCH',{disabled:false});}else if(action==='source-recreate'){await f.ok(f.a.token,'/api/sources/same-source','DELETE');await f.ok(f.a.token,'/api/ingress/sources','POST',source());}else if(action==='source-toggle'){await f.ok(f.a.token,'/api/sources/same-source','PATCH',{enabled:false});await f.ok(f.a.token,'/api/sources/same-source','PATCH',{enabled:true});}else if(action==='delete-memory')await f.ok(f.a.token,'/api/memories/'+memory.id,'DELETE');else abort.abort();gate.release();const outcome=await pending;assert.ok('error' in outcome||outcome.result.isError,JSON.stringify(outcome));assert.doesNotMatch(JSON.stringify(outcome),/Nora prefers|GENERATED_A_KEY|GENERATED_MCP_MEMORY_A/);assert.match(JSON.stringify(await okCall(b.client,'mote_context')),/Generated B/);
});
