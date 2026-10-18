import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {unzipSync,strFromU8} from 'fflate';
import {HindsightService,ManagedHindsightRuntime} from '../../src/hindsight-runtime.js';
import type {HindsightRuntimeFactory} from '../../src/scope/memory-providers.js';

/** Scripted external native API, not a MemoryHost/provider replacement. Real
 * HindsightEngine owns banks, immutable import, staging, recall, lineage and
 * durable recovery; the real M04/M05/M09 product chain supplies all authority. */
export async function hindsightHttpFixture(options:{beforeRequest?:(event:{method:string|undefined;bank:string;path:string;userId?:string})=>void|Promise<void>}={}){
 type Bank={facts:any[];operations:Map<string,any>;documents:Set<string>};
 const faults:{consolidateAfterCommit:boolean;beforeSemantic?:(userId:string)=>Promise<void>}={consolidateAfterCommit:false};
 const descriptors:{userId:string;container:string;volume:string}[]=[];
 const banks=new Map<string,Bank>(),scopes=new Map<string,Parameters<HindsightRuntimeFactory>[0]>(),events:{userId?:string;bank:string;path:string;body:unknown;facts:any[]}[]=[];
 const server=createServer(async(req,res)=>{
  try{
   const url=new URL(req.url!,'http://127.0.0.1'),respond=(value:unknown,status=200)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(value));};
   const bytes:Buffer[]=[];for await(const chunk of req)bytes.push(Buffer.from(chunk));const payload=Buffer.concat(bytes),contentType=String(req.headers['content-type']??''),body=payload.length&&!contentType.startsWith('multipart/')?JSON.parse(payload.toString()):undefined;
   if(url.pathname==='/health'){respond({status:'healthy'});return;}if(url.pathname==='/version'){respond({api_version:'0.10.2',features:{worker:false}});return;}
   if(url.pathname==='/v1/default/banks'){respond({banks:[...banks.keys()].map(bank_id=>({bank_id}))});return;}
   const match=/^\/v1\/default\/banks\/([^/]+)(.*)$/.exec(url.pathname);if(!match){respond({},404);return;}const id=decodeURIComponent(match[1]),path=match[2],scope=scopes.get(id);
   await options.beforeRequest?.({method:req.method,bank:id,path,userId:scope?.userId});
   if(req.method==='PUT'&&!path){if(!banks.has(id))banks.set(id,{facts:[],operations:new Map(),documents:new Set()});respond({});return;}
   if(req.method==='DELETE'&&!path){banks.delete(id);respond({});return;}
   const bank=banks.get(id);if(!bank){respond({},404);return;}
   const semantic=async()=>{if(!scope)throw Error('Native worker has no host bank grant');const request={requestId:randomUUID(),purpose:'operation' as const};scope.onRequestStarted?.(request);const physical=async()=>{await scope!.assertModelAuthority?.(request);await faults.beforeSemantic?.(scope!.userId);scope!.onUsage?.({requests:1,reportedRequests:1,inputTokens:10,outputTokens:5,totalTokens:15,cacheReadTokens:0,cacheWriteTokens:0},request);scope!.onRequestFinished?.({...request,status:'completed'});};await (scope.runModel?scope.runModel(physical):physical());};
   events.push({userId:scope?.userId,bank:id,path,body,facts:structuredClone(bank.facts)});
   if(req.method==='PATCH'&&path==='/config'){respond({});return;}
   if(req.method==='GET'&&path==='/memories/list'){const offset=Number(url.searchParams.get('offset')??0),limit=Number(url.searchParams.get('limit')??100);respond({items:bank.facts.slice(offset,offset+limit),total:bank.facts.length});return;}
   if(req.method==='GET'&&path==='/operations'){respond({operations:[...bank.operations.values()]});return;}
   if(req.method==='GET'&&path.startsWith('/operations/')){respond(bank.operations.get(decodeURIComponent(path.slice('/operations/'.length)))??{status:'completed'});return;}
   if(req.method==='DELETE'&&path.startsWith('/operations/')){respond({});return;}
   if(req.method==='POST'&&path==='/transfer/import'){
    const form=await new Response(payload,{headers:{'content-type':contentType}}).formData(),file=form.get('file') as File,entries=unzipSync(new Uint8Array(await file.arrayBuffer()));
    for(const [name,bytes] of Object.entries(entries))if(name.startsWith('documents/')){const document=JSON.parse(strFromU8(bytes));if(bank.documents.has(document.id))continue;bank.documents.add(document.id);for(const fact of document.facts)bank.facts.push({...fact,id:randomUUID()});}
    const operation_id=randomUUID();bank.operations.set(operation_id,{id:operation_id,status:'completed',task_type:'import'});respond({operation_id});return;
   }
   if(req.method==='POST'&&path==='/memories'){
    if(!bank.operations.has(body.operation_id)){await semantic();for(const item of body.items)if(!bank.documents.has(item.document_id)){bank.documents.add(item.document_id);bank.facts.push({id:randomUUID(),text:item.content,metadata:item.metadata,fact_type:'world'});}bank.operations.set(body.operation_id,{id:body.operation_id,status:'completed',task_type:'retain'});}respond({operation_id:body.operation_id});return;
   }
   if(req.method==='POST'&&path==='/consolidate'){
    await semantic();const sources=bank.facts.filter(fact=>fact.fact_type!=='observation'),operation_id=randomUUID();bank.facts.push({id:randomUUID(),text:'Generated synthesis of the supplied original context.',fact_type:'observation',source_memory_ids:sources.map(fact=>fact.id)});bank.operations.set(operation_id,{id:operation_id,status:'completed',task_type:'consolidation'});if(faults.consolidateAfterCommit){faults.consolidateAfterCommit=false;respond({error:'generated-lost-consolidation-response'},500);return;}respond({operation_id});return;
   }
   if(req.method==='POST'&&path==='/memories/recall'){respond({results:bank.facts.filter(fact=>fact.metadata?.mote_record).map(fact=>({...fact,score:1}))});return;}
   if(req.method==='POST'&&path==='/reflect'){await semantic();respond({text:'Generated reflection from the exact read bank.',based_on:{memories:bank.facts.filter(fact=>fact.metadata?.mote_record),mental_models:[],directives:[]}});return;}
   respond({},404);
  }catch(error){res.writeHead(500,{'content-type':'application/json'});res.end(JSON.stringify({error:'generated_external_fixture_failure'}));}
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const service=new HindsightService('http://127.0.0.1:'+(server.address() as any).port);
 const runtimeFactory:HindsightRuntimeFactory=options=>{const descriptor=new ManagedHindsightRuntime(options);descriptors.push({userId:options.userId,container:descriptor.container,volume:descriptor.volume});return {service:async()=>service,existingService:()=>Promise.resolve(service),startWorker:async admitted=>{for(const bank of admitted){const existing=scopes.get(bank);if(existing&&existing.userId!==options.userId)throw Error('Cross-user native bank collision');scopes.set(bank,options);}},stopWorker:async()=>{},close:async()=>{}};};
 return {faults,runtimeFactory,descriptors,events,banks,close:async()=>{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}};
}
