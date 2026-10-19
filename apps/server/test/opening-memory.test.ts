import test from 'node:test';
import assert from 'node:assert/strict';
import type {ContextReader} from '@mote/agent';
import {openingMemoryContext} from '../src/opening-memory.js';

const createdAt='2026-09-18T00:00:00Z';
const originalId='6f28159f-242b-5442-9a0c-a17958985a52';
const reader=(details:Record<string,unknown>[]):ContextReader=>({
  search:async()=>[],timeline:async()=>({items:[],nextCursor:null}),evidence:async()=>[],activity:async()=>({}),devices:async()=>[],
  memories:async args=>({items:args.id?details.filter(item=>item.id===args.id):details}),
});
const card=(id:string,extra:Record<string,unknown>={})=>({id,title:'Generated account',statement:'The source narrator planned a visit.',uncertainty:'The outcome is unknown.',status:'published',tier:'episode',createdAt,evidenceIds:[originalId],...extra});

test('opening leads preserve derived limits without disclosing original evidence or owner statements',async()=>{
 const detail=card('generated-card',{admission:{layer:'memory',reason:'Generated reason',scope:'Only the source narrator and this dated plan',attribution:'observed'},validFrom:'2026-09-18T00:00:00+08:00',validUntil:'2026-10-01T00:00:00+08:00',
  evidence:[{id:originalId,quote:'GENERATED ORIGINAL QUOTE',attributionContext:{version:1,ownerRelation:'owner',basis:'owner_source',ownerStatements:[{id:'generated-owner',question:'Generated question',answer:'GENERATED OWNER STATEMENT'}]}}]});
 const result=await openingMemoryContext(reader([detail]),'What was planned?',{contextTime:'2026-09-20T00:00:00Z'});
 assert.equal(result.leads.length,1,'duplicate catalog candidates disclose one lead');
 assert.deepEqual(result.leads[0].admission,{scope:'Only the source narrator and this dated plan',attribution:'observed'});
 assert.equal(result.leads[0].validFrom,detail.validFrom);assert.equal(result.leads[0].validUntil,detail.validUntil);
 assert.deepEqual(result.evidenceDependencies,{version:1,complete:true,ids:[originalId]});
 const serialized=JSON.stringify(result.leads);
 for(const privateValue of [originalId,'GENERATED ORIGINAL QUOTE','GENERATED OWNER STATEMENT','ownerRelation','ownerStatements','Generated reason'])assert.ok(!serialized.includes(privateValue));
});

test('malformed optional metadata and legacy missing fields never manufacture a lead identity or validity',async()=>{
 const result=await openingMemoryContext(reader([
  card('legacy'),
  card('invalid',{admission:{layer:'memory',scope:'Generated',attribution:{toString:()=> 'user'}},validFrom:'2026-09-18',validUntil:'not-a-date'}),
 ]),'Generated question',{});
 assert.equal(result.leads.length,2);
 for(const lead of result.leads){assert.equal(lead.admission,undefined);assert.equal(lead.validFrom,undefined);assert.equal(lead.validUntil,undefined);}
 assert.deepEqual(result.evidenceDependencies.ids,[originalId]);
});

test('opening uses the original consolidated/question/recent/proposed order, selected detail rereads and field projection',async()=>{
 const ids=['consolidated-a','consolidated-b','question-a','question-b','recent-a','recent-b','proposed-a'],details=ids.map((id,index)=>card(id,{title:'T'.repeat(210),statement:'S'.repeat(900),uncertainty:'U'.repeat(410),tier:index<2?'consolidated':'episode',status:index===6?'proposed':'published',admission:{layer:'memory',scope:'C'.repeat(800),attribution:'observed',reason:'PRIVATE_REASON'}})),calls:any[]=[];
 const base=reader(details);base.memories=async args=>{calls.push(args);if(args.id)return {items:details.filter(item=>item.id===args.id)};return {items:args.tier?[details[0],details[1]]:args.query?[details[2],details[0],details[3]]:args.status==='proposed'?[details[6]]:[details[4],details[5]]};};
 const result=await openingMemoryContext(base,'  Generated question  ',{contextTime:'2026-09-20T00:00:00Z',deviceId:'generated-device'});
 assert.deepEqual(result.leads.map(item=>item.id),ids.slice(0,5));assert.deepEqual(calls.slice(0,4).map(({tier,query,status,limit,layer,asOf,deviceId})=>({tier,query,status,limit,layer,asOf,deviceId})),[
  {tier:'consolidated',query:undefined,status:'published',limit:2,layer:'memory',asOf:'2026-09-20T00:00:00Z',deviceId:'generated-device'},
  {tier:undefined,query:'Generated question',status:'published',limit:3,layer:'memory',asOf:'2026-09-20T00:00:00Z',deviceId:'generated-device'},
  {tier:undefined,query:undefined,status:'published',limit:5,layer:'memory',asOf:'2026-09-20T00:00:00Z',deviceId:'generated-device'},
  {tier:undefined,query:undefined,status:'proposed',limit:5,layer:'memory',asOf:'2026-09-20T00:00:00Z',deviceId:'generated-device'},
 ]);
 assert.deepEqual(calls.filter(item=>item.id).map(item=>item.id),ids.slice(0,5));for(const lead of result.leads){assert.equal(lead.title.length,160);assert.equal(lead.statement.length,700);assert.equal(lead.uncertainty.length,300);assert.equal(lead.admission!.scope.length,600);assert.equal('reason' in lead.admission!,false);}
 calls.length=0;await openingMemoryContext(base,'Q'.repeat(161),{contextTime:'2026-09-20T00:00:00Z'});assert.equal(calls.some(args=>args.query!==undefined),false,'the original long-question branch remains unchanged');
});
