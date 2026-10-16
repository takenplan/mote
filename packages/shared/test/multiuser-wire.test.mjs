import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MOTE_PROTOCOL_RANGE, MOTE_PROTOCOL_HEADERS, requireCompatibleProtocol} from '../src/protocol.ts';

test('public metadata matches the real M01 Wire2 and M03 Ingress3 boundary',()=>{
 const contract=JSON.parse(readFileSync(new URL('../../../protocol/contract.json',import.meta.url)));
 assert.deepEqual(MOTE_PROTOCOL_RANGE,{min:2,max:2});
 assert.deepEqual(MOTE_PROTOCOL_HEADERS,{'X-Mote-Protocol-Version':'2'});
 assert.deepEqual(contract.range,{min:2,max:2});assert.equal(contract.ingressVersion,3);
 assert.deepEqual(requireCompatibleProtocol({min:2,max:2}),{min:2,max:2});
 assert.throws(()=>requireCompatibleProtocol({min:1,max:1}),error=>error.code==='incompatible_protocol');
});
