import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultLifecycleSettings} from '../src/memory-configuration.js';
import {automationWindowSettings} from '../src/scope/ask-automation-plan.js';
test('scheduled windows require complete immutable lifecycle settings and never infer defaults',()=>{
 const snapshot=structuredClone(defaultLifecycleSettings);assert.deepEqual(automationWindowSettings(snapshot),snapshot);snapshot.working.intervalHours=99;assert.equal(automationWindowSettings(defaultLifecycleSettings).working.intervalHours,1);
 for(const raw of [undefined,null,{}, {...snapshot,drainWindows:undefined},{...snapshot,working:{enabled:true}},{...snapshot,working:{...snapshot.working,intervalHours:'99'}},{...snapshot,unexpected:true}])assert.throws(()=>automationWindowSettings(raw),{code:'ask_automation_window_configuration_unavailable'});
});
