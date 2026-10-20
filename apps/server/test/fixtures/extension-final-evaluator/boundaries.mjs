import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {HttpRuntime,ROOT,assert,randomUUID,sha256} from './http-runtime.mjs';
const runtime=new HttpRuntime('boundaries-'+Date.now()),results=[];
const record=value=>{results.push(value);console.log(JSON.stringify(value));};
try {
  await runtime.initialize();await runtime.start();const a=await runtime.login();
  await runtime.request(null,'GET','/api/plugins/host-capabilities',undefined,401);
  const capabilities=(await runtime.request(a,'GET','/api/plugins/host-capabilities',undefined,200)).body;
  assert.deepEqual(capabilities.invocationCapabilities.filter(c=>c.registered).map(c=>c.id).sort(),['processor','source']);
  assert.deepEqual(capabilities.factoryExports,['createMotePlugin','createMemoryProvider']);
  assert(capabilities.invocationCapabilities.filter(c=>!c.registered).every(c=>c.reason==='scoped_domain_unavailable'));
  record({id:'HOST_CAPABILITY_DISCOVERY',status:'PASS',anonymousStatus:401,...capabilities});
  const native=`import {createHash} from 'node:crypto';\nexport const name='benchmark-native-readonly';\nexport const inject=['tools'];\nexport function apply(ctx){ctx.tools.register({name:'benchmark_checksum',description:'Read-only SHA256 checksum',parameters:{type:'object',properties:{text:{type:'string'}},required:['text']},output:{schema:{type:'json'},render:(_args,value)=>[{type:'text',text:JSON.stringify(value)}]},async execute(args){return {sha256:createHash('sha256').update(args.text).digest('hex')};}});}\n`;
  const manifest={schemaVersion:1,id:'r5.native.readonly',name:'Native read-only ABI boundary specimen',version:'1.0.0',runtime:'worker',entry:'native.mjs',capabilities:['source'],configuration:[],dependencies:[],access:['read-only synthetic checksum'],components:[{id:'benchmark_checksum',version:'1',surface:'ingress',capability:'source'}]};
  const nativeRelease=await runtime.addRelease({repo:'r5-evaluator/native-readonly',manifest,files:{'native.mjs':native}});
  const pkg=await runtime.install(a,nativeRelease);
  const view=(await runtime.request(a,'GET','/api/plugins',undefined,200)).body;
  await runtime.request(a,'POST','/api/plugin-instances',{expectedRevision:view.revision,instance:{id:'native-instance',packageId:pkg.id,name:'Native unchanged trial',configuration:{},desired:false,grants:{capabilities:['source'],sourceIds:[],history:false}}},200);
  const checked=await runtime.check(a,'native-instance',{expected:'blocked'});
  assert.equal(checked.task.state,'blocked');assert.equal(checked.instance.checked,false);
  const beforeEnable=(await runtime.request(a,'GET','/api/plugins',undefined,200)).body;
  const refusedEnable=await runtime.request(a,'POST','/api/plugin-instances/native-instance/enable',{expectedRevision:beforeEnable.revision},503);
  const afterEnable=(await runtime.request(a,'GET','/api/plugins',undefined,200)).body.instances.find(instance=>instance.id==='native-instance');
  assert.equal(afterEnable.checked,false);assert.equal(afterEnable.desired,false);
  const refusedSnapshot=await runtime.snapshot(a,'native-instance',409);
  const installed=await readFile(join(runtime.dir,'vault','plugins','packages',nativeRelease.digest,'native.mjs'),'utf8').catch(()=>null);
  record({id:'P04_HARNESS',status:'FAIL',reason:'NO_EXTENSION_POINT',attempt:'Pinned apply(ctx) native module packaged unchanged; supported worker install succeeded and actual verification task blocked on absent worker factory.',nativeSha256:sha256(native),packageDigest:nativeRelease.digest,checkStatus:200,checkReceipt:checked.receipt,checkTask:checked.task,instance:afterEnable,enableStatus:refusedEnable.status,snapshotStatus:refusedSnapshot.status,byteIdentity:installed===null?'archive byte hash retained; installed path not observed':sha256(installed)===sha256(native),nativeToolExecuted:false});
  const triggerInput={id:randomUUID(),kind:'benchmark-periodic-v1',sourceIds:[],includeExisting:false,language:'en',timeZone:'UTC',componentId:'benchmark.periodic',intervalMs:1000};
  const trigger=await runtime.request(a,'POST','/api/ask-automations',triggerInput);
  assert.equal(trigger.status,400);
  record({id:'P06_TRIGGER',status:'FAIL',reason:'NO_EXTENSION_POINT',attempt:'Public durable automation admission with extension-owned policy/component',statusCode:trigger.status,body:trigger.body,pluginCallbackExecuted:false});
}catch(error){console.error(error);record({id:'BOUNDARY_RUN_ERROR',status:'FAIL',message:error.message,stack:error.stack});process.exitCode=1;}
finally {await runtime.stop();await writeFile(join(ROOT,'boundary-results.json'),JSON.stringify({createdAt:new Date().toISOString(),runDir:runtime.dir,results},null,2));}
