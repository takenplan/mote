import test from 'node:test';
import assert from 'node:assert/strict';
import {memoryTargetCoverageKeys} from './fixtures/memory-target-coverage.js';

const member=(key:string,id:string)=>({key,id,offset:0,length:78});
const body=(envelope:unknown,blocks=false)=>({messages:[{role:'user',content:blocks?[{type:'text',text:JSON.stringify(envelope)}]:JSON.stringify(envelope)}]});

test('generated coverage excludes the separately delivered context key from the actual one-target Memory wire shape',()=>{
 const input=body({request:'Generated quoted data {"key":"member_9"}',responseMode:'memory-extraction',requiredSkill:'memory-strategy',untrustedTaskContext:{memoryWork:{members:[member('member_0','generated-current')],contextMembers:[member('member_1','generated-context')],authorizedMembers:[{key:'member_0',memberRef:'member_0'}]}},untrustedEvidence:[{id:'generated-current',ocrText:'Generated current target'},{id:'generated-context',ocrText:'Generated supporting context'}]}),before=structuredClone(input);
 assert.deepEqual(memoryTargetCoverageKeys(input),['member_0']);assert.deepEqual(input,before);
});

test('generated coverage preserves all current target keys and order while history repeats keys outside that vector',()=>{
 const input=body({responseMode:'memory-extraction',untrustedTaskContext:{memoryWork:{history:[{targets:[member('member_0','generated-old-zero'),member('member_3','generated-old-three')]}],members:[member('member_2','generated-current-two'),member('member_0','generated-current-zero')],contextMembers:[member('member_1','generated-context')],authorizedMembers:[{key:'member_2',memberRef:'member_2'},{key:'member_0',memberRef:'member_0'},{key:'member_1',memberRef:'member_1'}]}}},true);
 assert.deepEqual(memoryTargetCoverageKeys(input),['member_2','member_0']);
});

test('generated review coverage uses current targets rather than draft or history keys and omits coverage for non-Memory queries',()=>{
 const input=body({responseMode:'memory-extraction',untrustedTaskContext:{untrustedMemoryDraft:{coverage:[{key:'member_7'},{key:'member_0'}]},memoryWork:{history:[{targets:[member('member_0','generated-prior-zero')],contextMembers:[member('member_8','generated-prior-context')]}],members:[member('member_0','generated-current')],contextMembers:[member('member_1','generated-context')]}}});
 assert.deepEqual(memoryTargetCoverageKeys(input),['member_0']);assert.deepEqual(memoryTargetCoverageKeys(body({responseMode:'answer',request:'Generated ordinary question'})),[]);
});
