import test from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {ActiveExecutionBudget} from '../dist/active-budget.js';
import {AgentTimeoutError} from '../dist/types.js';

test('resource waiting before admission does not consume the Agent execution budget',async()=>{
 let now=0;const budget=new ActiveExecutionBudget(30,()=>now);
 now+=60000;
 assert.equal(await budget.run(async()=>{now+=10;return 42;}),42);
 now+=60000;
 assert.equal(await budget.run(async()=>{now+=10;return 43;}),43);
});

test('admitted work and correction rounds share a finite budget',async()=>{
 let now=0;const budget=new ActiveExecutionBudget(40,()=>now);
 await budget.run(async()=>{now+=25;});
 await budget.run(async()=>{now+=15;});
 let calls=0;await assert.rejects(budget.run(async()=>{calls++;}),AgentTimeoutError);assert.equal(calls,0);
});

test('a running call still times out and an explicit no-deadline policy does not',async()=>{
 await assert.rejects(new ActiveExecutionBudget(20).run(()=>delay(80)),AgentTimeoutError);
 assert.equal(await new ActiveExecutionBudget(null).run(async()=>42),42);
});
