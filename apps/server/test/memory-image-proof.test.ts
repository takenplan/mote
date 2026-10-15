import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import type {ImageView,QueryResult} from '@mote/shared';
import {memoryImageReadReceipts,hasMemoryImageProof,imageViewCovers} from '../src/memory-image-proof.js';
import {assertMemoryTargetSupport,retainedMemoryReadReceipt} from '../src/memory-read-context.js';
import {readMemoryWorkCoverage} from '../src/memory-work-contract.js';
import {reviewMemory} from '../src/memory-review.js';

const image=(region:ImageView['region']=null):ImageView=>({original:{sha256:'a'.repeat(64),width:100,height:100,mimeType:'image/png',orientation:1,pages:1},coordinateSpace:'encoded-raster-pixels-v1',region,transform:region?'crop-encoded-raster-png@1':'original-bytes@1',viewId:(region?'b':'c').repeat(64),output:{sha256:'d'.repeat(64),width:region?.width??100,height:region?.height??100,mimeType:'image/png',sizeBytes:200}});
const result=(answer:unknown,receipts?:QueryResult['imageReadReceipts']):QueryResult=>({answer:JSON.stringify(answer),citations:[],trace:[],runId:randomUUID(),...(receipts?{imageReadReceipts:receipts}:{})});

test('visual proof comes from runner pixels, not model JSON, metadata or a different original',()=>{
 const id=randomUUID(),view=image(),span={id,image:{originalSha256:view.original.sha256,viewId:view.viewId}};
 assert.deepEqual(memoryImageReadReceipts(result({memories:[],imageReadReceipts:[{id,imageView:view}]})),[]);
 assert.equal(hasMemoryImageProof(memoryImageReadReceipts(result({},[{id,imageView:view}])),span),true);
 assert.equal(hasMemoryImageProof([{id,imageView:view}],{...span,id:randomUUID()}),false);
 assert.equal(hasMemoryImageProof([{id,imageView:view}],{id,image:{...span.image,originalSha256:'e'.repeat(64)}}),false);
 assert.throws(()=>memoryImageReadReceipts(result({},[{id,imageView:{...view,transform:'metadata@1',output:undefined}}])));
 assert.throws(()=>memoryImageReadReceipts(result({},[{id,imageView:{...view,output:undefined}}])));
});

test('visual target ownership and coverage require its own actual delivered image receipt',()=>{
 const id=randomUUID(),contextId=randomUUID(),view=image(),member={id,key:'1'.repeat(64),offset:0,length:10},span={id,image:{originalSha256:view.original.sha256,viewId:view.viewId}};
 const answer={memories:[{evidenceIds:[id],evidence:[span]}],coverage:[{key:member.key,state:'checked',candidateIndexes:[0]}]};
 const proved=result(answer,[{id,imageView:view}]);
 assert.doesNotThrow(()=>assertMemoryTargetSupport(proved,[member],()=> 'navigation'));
 assert.equal(readMemoryWorkCoverage(proved,[member as never],undefined,()=> 'navigation','range-evaluation@1').incomplete,false);
 assert.throws(()=>assertMemoryTargetSupport(result(answer),[member],()=> 'navigation'));
 assert.throws(()=>assertMemoryTargetSupport(result(answer,[{id:contextId,imageView:view}]),[member],()=> 'navigation'));
 const retained=retainedMemoryReadReceipt(proved);assert.deepEqual(retained.imageReadReceipts,[{id,imageView:view}]);
 retained.imageReadReceipts![0].imageView.original.sha256='f'.repeat(64);assert.equal(proved.imageReadReceipts![0].imageView.original.sha256,'a'.repeat(64));
});

test('independent review cannot reuse extraction pixels or replace retained proof with an unrelated crop',async()=>{
 const id=randomUUID(),view=image({x:0,y:0,width:20,height:20}),selector={originalSha256:view.original.sha256,viewId:view.viewId};
 const candidate={statement:'A generated visible shape.',evidence:[{id,image:selector}]};
 const draft=result({memories:[candidate]},[{id,imageView:view}]);
 const input={question:'Generated visual review',taskContext:{turns:[],memoryWork:{workContract:'range-evaluation@1'}}};
 await assert.rejects(()=>reviewMemory(input,draft,async()=>result({memories:[candidate]})),/did not receive/);
 const other={...image({x:50,y:50,width:10,height:10}),viewId:'e'.repeat(64)};
 await assert.rejects(()=>reviewMemory(input,draft,async()=>result({memories:[{...candidate,evidence:[{id,image:{originalSha256:other.original.sha256,viewId:other.viewId}}]}]},[{id,imageView:other}])),/retained visual proof/);
 const whole=image();
 const reviewed=await reviewMemory(input,draft,async request=>{
  assert.ok((request.taskContext!.untrustedMemoryDraft as {imageViews?:unknown}).imageViews,'view coordinates are navigation, not reused pixel permission');
  return result({memories:[{...candidate,evidence:[{id,image:{originalSha256:whole.original.sha256,viewId:whole.viewId}}]}]},[{id,imageView:whole}]);
 });assert.equal(reviewed.imageReadReceipts![0].imageView.viewId,whole.viewId);
 assert.equal(imageViewCovers(whole,view),true);assert.equal(imageViewCovers(view,whole),false);
 const discarded=await reviewMemory(input,draft,async()=>result({memories:[]}));assert.deepEqual(JSON.parse(discarded.answer).memories,[]);
});
