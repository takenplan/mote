import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {strToU8,strFromU8,zipSync,unzipSync} from 'fflate';
import {scopedMemoryFixture} from './fixtures/scoped-memory-host.js';
import {generatedMemoryRelease,generatedMem0Release} from './fixtures/scoped-memory-release.js';
import {waitForPluginCheck} from './fixtures/plugin-check.js';
import {defaultModelSettings} from '../src/model-settings.js';

async function configure(f:Awaited<ReturnType<typeof scopedMemoryFixture>>,user:any,packageId:string,configuration:Record<string,unknown>){
 const view=(await f.request(user.token,'/api/plugins')).json(),response=await f.request(user.token,'/api/plugin-instances','POST',{expectedRevision:view.revision,instance:{id:'same-instance',packageId,name:'Generated provider check',configuration,desired:false,grants:{capabilities:['repository','retrieval'],sourceIds:['same-source'],history:true}}});assert.equal(response.statusCode,200,response.body);
 const check=await f.request(user.token,'/api/plugin-instances/same-instance/check','POST',{});assert.equal(check.statusCode,200,check.body);assert.equal(check.json().observed,'checking');await waitForPluginCheck(check.json(),async id=>(await f.request(user.token,'/api/tasks/'+id)).json());return (await f.request(user.token,'/api/plugins')).json();
}

test('production HTTP capability verification detects a lying worker by actual canary IO before enable and retains its failed check',async t=>{
 const release=generatedMemoryRelease(),transport=release.transport,archiveUrl=`https://github.com/${release.repository}/releases/download/${release.tag}/plugin.zip`,files=unzipSync((await transport(archiveUrl)).bytes);
 const code=strFromU8(files['plugin.mjs']).replace('async put(input){','async put(input){throw Error("Generated actual provider unavailable");');
 const archive=zipSync({'plugin.mjs':strToU8(code)});release.manifest.archive.sha256=createHash('sha256').update(archive).digest('hex');release.transport=async url=>url===archiveUrl?{bytes:archive}:transport(url);
 const f=await scopedMemoryFixture(t,release),pkg=await f.install(),view=await configure(f,f.a,pkg,{label:'Generated liar',credential:'personal:same-model'}),instance=view.instances[0];
 assert.equal(instance.checked,false);assert.equal(instance.observed,'blocked');assert.deepEqual(instance.issues,['host_probe_failed:initial_write']);assert.ok(instance.capabilities.every((value:any)=>value.state==='unknown'));assert.equal((await f.request(f.b.token,'/api/plugins')).json().instances.length,0);
 assert.equal((await f.request(f.a.token,'/api/plugin-instances/same-instance/enable','POST',{expectedRevision:view.revision})).statusCode,503);await f.restart();const retained=(await f.request(f.a.token,'/api/plugins')).json().instances[0];assert.deepEqual(retained.issues,instance.issues);assert.equal(retained.checked,false);assert.equal(f.requests.length,0,'worker canary does not acquire a language model');
});

test('saved native provider checks contact the real generated embedding endpoint and isolate same-ID A/B capability outcomes across restart',async t=>{
 const calls:{key:string;body:string}[]=[],embedding=createServer(async(req,res)=>{let body='';for await(const chunk of req)body+=chunk;const key=String(req.headers.authorization);calls.push({key,body});res.setHeader('content-type','application/json');if(key==='Bearer GENERATED_EMBEDDING_B_KEY'){res.statusCode=500;res.end(JSON.stringify({error:'Generated B provider offline'}));return;}const input=JSON.parse(body).input,values=Array.isArray(input)?input:[input];res.end(JSON.stringify({object:'list',model:'generated-embedding',data:values.map((_:unknown,index:number)=>({object:'embedding',index,embedding:[1,0,0]}))}));});await new Promise<void>(resolve=>embedding.listen(0,'127.0.0.1',resolve));t.after(async()=>{embedding.closeAllConnections();await new Promise<void>(resolve=>embedding.close(()=>resolve()));});
 const baseUrl='http://127.0.0.1:'+(embedding.address() as any).port+'/v1',f=await scopedMemoryFixture(t,generatedMem0Release()),pkg=await f.install();
 for(const [user,owner]of [[f.a,'A'],[f.b,'B']] as const)await f.replace(user.token,'models',{profiles:[{id:'same-embedding',name:'Generated embedding',settings:{...defaultModelSettings(),provider:'custom',protocol:'openai-completions',model:'generated-embedding',baseUrl,apiKey:'GENERATED_EMBEDDING_'+owner+'_KEY'}}],selections:{memory:{kind:'personal',id:'same-embedding'}}});
 const configuration={embeddingBaseUrl:baseUrl,embeddingModel:'generated-embedding',embeddingDimension:3,embeddingSecretReference:'personal:same-embedding'},a=await configure(f,f.a,pkg,configuration),b=await configure(f,f.b,pkg,configuration);
 assert.equal(a.instances[0].checked,true);assert.ok(a.instances[0].capabilities.every((value:any)=>value.state==='verified'));assert.equal(b.instances[0].checked,false);assert.equal(b.instances[0].observed,'blocked');assert.ok(b.instances[0].issues.length);assert.ok(b.instances[0].capabilities.every((value:any)=>value.state==='unknown'));assert.ok(calls.some(call=>call.key==='Bearer GENERATED_EMBEDDING_A_KEY'));assert.ok(calls.some(call=>call.key==='Bearer GENERATED_EMBEDDING_B_KEY'));assert.equal(f.requests.length,0,'capability check uses the saved embedding reference before any Memory binding or language-model work');
 const before=calls.length;await f.restart();assert.equal((await f.request(f.a.token,'/api/plugins')).json().instances[0].checked,true);assert.equal((await f.request(f.b.token,'/api/plugins')).json().instances[0].checked,false);assert.equal(calls.length,before);assert.doesNotMatch(JSON.stringify([a,b]),/GENERATED_EMBEDDING_[AB]_KEY|personal:same-embedding/);
 const foreign=f.read(db=>db.prepare('SELECT id FROM plugin_user_checks WHERE user_id=? AND instance_id=?').get(f.b.userId,'same-instance'))!;
 const forged=await f.request(f.a.token,'/api/tasks','POST',{kind:'plugin.check',operationId:'generated-cross-owner-check',input:{instanceId:'same-instance',id:foreign.id}});assert.equal(forged.statusCode,401,forged.body);assert.equal(calls.length,before,'a forged check cannot acquire the other account provider port');assert.equal((await f.request(f.b.token,'/api/plugins')).json().instances[0].observed,'blocked');
});
