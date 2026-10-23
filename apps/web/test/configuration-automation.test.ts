import test from 'node:test';
import assert from 'node:assert/strict';
import type {ConfigDomainView} from '@mote/shared';
import {automationChecked,automationToggle,automationIntent} from '../src/configuration-automation.js';
const domain:ConfigDomainView={id:'memory',saved:{},effective:{},fields:[],status:'applied',automation:[{path:'lifecycle.working.enabled',authorized:false,enabled:false,state:'waiting_authorization'}]};
test('ungranted true defaults stay unchecked and an unrelated save carries no enable intent',()=>{
 assert.equal(automationChecked(domain,'lifecycle.working.enabled',true,true,[]),false);assert.deepEqual(automationIntent('memory',[]),[]);
});
test('deliberate switch-on authorizes a default-true policy without fabricating a value diff',()=>{
 const intent=automationToggle([],'lifecycle.working.enabled',true);assert.equal(automationChecked(domain,'lifecycle.working.enabled',true,true,intent),true);assert.deepEqual(automationIntent('memory',intent),['memory:lifecycle.working.enabled']);
 const reset=automationToggle(intent,'lifecycle.working.enabled',false);assert.deepEqual(reset,[]);assert.equal(automationChecked(domain,'lifecycle.working.enabled',true,true,reset),false);
});
test('actual enabled authority and unsaved disabled intent remain distinct from saved defaults',()=>{
 const active={...domain,automation:[{path:'lifecycle.working.enabled',authorized:true,enabled:true,state:'active' as const}]};assert.equal(automationChecked(active,'lifecycle.working.enabled',true,true,[]),true);assert.equal(automationChecked(active,'lifecycle.working.enabled',false,true,[]),false);
});
