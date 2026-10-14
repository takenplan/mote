import test from 'node:test';
import assert from 'node:assert/strict';
import {configurationPatches,savedValues} from '../src/configuration-draft.js';
import {deviceState,type Device} from '../src/api.js';
import type {ServerConfiguration} from '@mote/shared';
const config={revision:7,groups:[{fields:[
 {key:'maxStorageBytes',domain:'storage',path:'maxStorageBytes',value:3145728,savedValue:5242880,unit:'bytes'},
 {key:'retentionDays',domain:'storage',path:'retentionDays',value:0,savedValue:30},
 {key:'mcpEnabled',domain:'connectors',path:'mcpEnabled',value:false},
 {key:'mcpWriteSourceIds',domain:'connectors',path:'mcpWriteSourceIds',value:[]},
 {key:'apiKey',domain:'server',path:'embeddingApiKey',value:true,visibility:'secret-status'}
]}]} as ServerConfiguration;
test('file editors use saved values and keep pending-restart values distinct from effective values',()=>{
 assert.deepEqual(savedValues(config),{maxStorageBytes:'5',retentionDays:'30',mcpEnabled:'0',mcpWriteSourceIds:''});
});
test('domain patches contain only edited fields and never echo credential status as credential values',()=>{
 assert.deepEqual(configurationPatches(config,{maxStorageBytes:'9',retentionDays:'90',mcpEnabled:'1',mcpWriteSourceIds:'generated-a, generated-b'}),[
  {id:'storage',value:{maxStorageBytes:9*1048576,retentionDays:90}},
  {id:'connectors',value:{mcpEnabled:true,mcpWriteSourceIds:['generated-a','generated-b']}}
 ]);
 assert.throws(()=>configurationPatches(config,{apiKey:'true'}));
 assert.throws(()=>configurationPatches(config,{unregistered:'generated'}));
 assert.throws(()=>configurationPatches(config,{maxStorageBytes:'not-a-number'}));
 assert.equal(config.groups[0].fields[0].savedValue,5242880);
});
test('stale or malformed last contact does not report that a device is currently capturing',()=>{
 const device={status:'capturing',lastSeenAt:new Date(Date.now()-3600000).toISOString()} as Device;
 assert.equal(deviceState(device),'stale');
 assert.equal(deviceState({...device,lastSeenAt:'invalid'}),'stale');
 assert.equal(deviceState({...device,lastSeenAt:new Date().toISOString()}),'capturing');
});
