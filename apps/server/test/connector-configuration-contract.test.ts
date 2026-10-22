import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {connectorTask,connectorAuthority,connectionSchema} from '../src/scope/connector-contract.js';
const base={configurationVersion:2,connectionId:'generated-connection',generation:1,snapshotId:randomUUID(),schedule:{syncIntervalMs:60000,autoSync:true}};
test('only explicit current connector task representation freezes nonsecret scheduling',()=>{
 for(const action of ['oauth','sync','operation','recording'] as const){const task=connectorTask.parse({...base,action});assert.deepEqual(task.schedule,base.schedule);assert.equal(task.configurationVersion,2);}
 for(const phase of ['discover','metadata','transcript','media'] as const)assert.equal(connectorTask.parse({...base,action:'recording',recordingPhase:phase}).configurationVersion,2);
 assert.equal(connectorTask.parse({...base,action:'operation',operation:'select'}).configurationVersion,2);
 for(const changed of [{...base,configurationVersion:undefined},{...base,configurationVersion:1},{...base,schedule:undefined},{...base,schedule:{...base.schedule,apiKey:'generated-secret'}},{...base,snapshotId:'invalid'},{...base,action:'unsupported'}])assert.equal(connectorTask.safeParse({...changed,action:changed.action??'sync'}).success,false);
});
test('ordinary scheduling changes preserve transport authority, credential removal does not',()=>{
 const before=connectionSchema.parse({id:'generated',provider:'gmail',syncIntervalMs:60000,autoSync:true,googleClientSecret:'generated-secret'});
 assert.equal(connectorAuthority(before),connectorAuthority({...before,syncIntervalMs:120000,autoSync:false}));assert.notEqual(connectorAuthority(before),connectorAuthority({...before,googleClientSecret:undefined}));
});
