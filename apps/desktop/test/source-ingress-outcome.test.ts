import {afterEach,expect,it} from 'vitest';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {SourceSync} from '../src/source-sync';
import {ingressKey} from '../src/ingress-client';
import {TransportFailure} from '../src/support';
import type {ScannedItem,SourceDefinition,SourceRequest} from '../src/source-types';
const cleanup:string[]=[];
afterEach(async()=>{for(const directory of cleanup.splice(0))await rm(directory,{recursive:true,force:true});});
const source:SourceDefinition={id:'generated-source',name:'Generated files',kind:'local-files',deviceId:'generated-device',platform:'macos',retention:'reference',enabled:true};
const account={origin:'http://127.0.0.1:47832',userId:'generated-a',deploymentId:'generated-deployment',username:'generated-a'};
const reference=(index:number):ScannedItem=>({externalId:'generated-'+index,title:'Generated file '+index,text:'',kind:'file',layer:'reference',metadata:{version:1,file:{sizeBytes:23}},document:{fileIndex:{version:1,fileId:'generated-'+index,contentVersion:'a'.repeat(64),mode:'catalog',coverage:'none',parser:'none',status:'ready',totalCharacters:0,offset:0,length:0,allowRead:false}}});
async function fixture(){
 const directory=await mkdtemp(join(tmpdir(),'mote-generated-source-ingress-'));cleanup.push(directory);const path=join(directory,'state.json'),queue=new SourceSync(path,{batchSize:3});await queue.initialize();await queue.stage({items:[reference(0),reference(1),reference(2)],seen:[],complete:false,skipped:0},false);
 let enabled=true,fail:((externalId:string)=>unknown)|undefined,confirmation:unknown;const sent:string[]=[];
 const request:SourceRequest=async(path,raw)=>{
  if(path==='/api/ingress/sources')return confirmation??{...source,enabled};
  if(path.includes('/head?'))return {revision:null};
  const body=raw as any,item=body.revision.item;sent.push(item.externalId);const failure=fail?.(item.externalId);if(failure)throw failure;
  const digest=ingressKey([source.id,item.externalId,item.revision]),id=`${digest.slice(0,8)}-${digest.slice(8,12)}-5${digest.slice(13,16)}-a${digest.slice(17,20)}-${digest.slice(20,32)}`;
  return {id:'00000000-0000-4000-8000-000000000001',...account,sourceId:source.id,partBytes:4194304,parts:[],receipt:{version:3,state:'received',deploymentId:account.deploymentId,userId:account.userId,sourceId:source.id,batchId:body.batchId,id:ingressKey([account.deploymentId,account.userId,source.id,body.batchId]),captures:[{id,externalId:item.externalId,revision:item.revision,duplicate:false}]}};
 };request.account=account;
 const restart=async()=>{const next=new SourceSync(path);await next.initialize();return next;};
 return {queue,request,restart,sent,enabled:(value:boolean)=>{enabled=value;},fail:(fn?:typeof fail)=>{fail=fn;},confirmation:(value:unknown)=>{confirmation=value;}};
}
it('validated paused registration preserves source outbox through restart and resume',async()=>{
 const f=await fixture();f.enabled(false);expect(await f.queue.flush(source,f.request)).toBe('paused');expect(f.sent).toHaveLength(0);const restored=await f.restart();expect(restored.status()).toMatchObject({pending:3,blocked:0});f.enabled(true);await restored.flush(source,f.request);expect(restored.status()).toMatchObject({pending:0,blocked:0});
});
it('raced pause uses shared classifier and retains accepted files durably before returning paused',async()=>{
 const f=await fixture();f.fail(id=>{if(id==='generated-1'){f.enabled(false);return new TransportFailure('generated race','CONFLICT',409);}});expect(await f.queue.flush(source,f.request)).toBe('paused');const restored=await f.restart();expect(restored.status()).toMatchObject({pending:2,blocked:0});expect(restored.pendingContent().map(item=>item.externalId)).toEqual(['generated-1','generated-2']);f.fail();f.enabled(true);await restored.flush(source,f.request);expect(restored.status().pending).toBe(0);
});
it.each([409,410])('active registration isolates only actual file rejection %s',async status=>{
 const f=await fixture();f.fail(id=>id==='generated-1'?new TransportFailure('generated conflict','CONFLICT',status):undefined);await f.queue.flush(source,f.request);expect((await f.restart()).status()).toMatchObject({pending:0,blocked:1,failures:[{externalId:'generated-1',status}]});
});
it('expiry remains transport failure while earlier accepted file stays acknowledged',async()=>{
 const f=await fixture();f.fail(id=>id==='generated-1'?Object.assign(new TransportFailure('generated expiry','CONFLICT',409),{uploadExpired:true}):undefined);await expect(f.queue.flush(source,f.request)).rejects.toMatchObject({uploadExpired:true});expect((await f.restart()).status()).toMatchObject({pending:2,blocked:0});
});
it('failed source identity confirmation preserves pending files without quarantine',async()=>{
 const f=await fixture();f.fail(id=>{if(id==='generated-1'){f.confirmation({...source,deviceId:'other',enabled:false});return new TransportFailure('generated race','CONFLICT',409);}});await expect(f.queue.flush(source,f.request)).rejects.toMatchObject({classification:'RESPONSE'});expect((await f.restart()).status()).toMatchObject({pending:2,blocked:0});
});
