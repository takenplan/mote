import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {buildApp} from '../../src/app.js';
import {ExecutionFailure} from '../../src/execution-engine.js';
import {mock} from 'node:test';

// The child uses production composition and lifecycle with generated transport
// only. It deliberately does not claim coverage of index.ts's PID/CLI installer.
if(process.env.GENERATED_RECORDING_NOW)mock.timers.enable({apis:['Date'],now:Number(process.env.GENERATED_RECORDING_NOW)});
const host=await buildApp({dataDir:process.env.GENERATED_RECORDING_ROOT!},{connectorTransports:{dingtalk:scope=>async command=>{
 const response=await fetch(process.env.GENERATED_RECORDING_PROVIDER!,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({user:scope.userId,command})}),value=await response.json() as any;
 if(value.failure)throw new ExecutionFailure(value.failure.category,value.failure.code,value.failure.retryAfterMs);
 if(command.kind==='media'){const target=join(scope.directory,'dws-runtime',command.output);mkdirSync(dirname(target),{recursive:true});writeFileSync(target,Buffer.from(value.bytes,'base64'));return {ok:true,succeeded:1,results:[{taskUuid:command.id}]};}
 return value;
}}});
await host.app.listen({host:'127.0.0.1',port:0});const address=host.app.server.address();if(!address||typeof address==='string')throw Error('Generated listener unavailable');
process.stdout.write(JSON.stringify({phase:'listening',port:address.port})+'\n');
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{void host.app.close().then(()=>process.exit(0));});
